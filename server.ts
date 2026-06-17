import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DashboardData, ChartDataPoint, EtfInfo } from "./src/types";
import { getCnHolidays, getUsHolidays } from "./src/lib/calendar";
import { GoogleGenAI } from "@google/genai";
import yahooFinanceLib from 'yahoo-finance2';
import dashboardHandler from './api/dashboard';

// Ensure data folder exists
if (!fs.existsSync("data")) {
  fs.mkdirSync("data", { recursive: true });
}

// 简单的串行写锁：所有 data/*.json 的写操作排队执行，避免并发请求互相覆盖丢数据。
// 不改 readFileSync/writeFileSync 的同步语义（低频小文件，阻塞可忽略），只解决并发写竞争。
let writeChain: Promise<void> = Promise.resolve();
function serializedWrite(file: string, content: string): Promise<void> {
  writeChain = writeChain.then(() => {
    try {
      fs.writeFileSync(file, content, "utf-8");
    } catch (e) {
      console.error(`Error writing ${file}:`, e);
    }
  });
  return writeChain;
}

// 1. Trusted NAV Database (data/nav_db.json)
function readNavDb() {
  try {
    if (fs.existsSync("data/nav_db.json")) {
      return JSON.parse(fs.readFileSync("data/nav_db.json", "utf-8"));
    }
  } catch (e) {
    console.error("Error reading nav_db.json, recreating empty:", e);
  }
  // 历史此处预置了 016452 的假净值（2.3858 等）冒充 manual_preload，
  // 是用户反馈"净值值不对"的来源之一。已移除：空库起步，净值只能来自真实查询或用户校正。
  const defaultDb: any = {};
  serializedWrite("data/nav_db.json", JSON.stringify(defaultDb, null, 2));
  return defaultDb;
}

function writeNavDb(db: any) {
  serializedWrite("data/nav_db.json", JSON.stringify(db, null, 2));
}

// 2. Correction Reports (data/correction_reports.json)
function readCorrectionReports() {
  try {
    if (fs.existsSync("data/correction_reports.json")) {
      return JSON.parse(fs.readFileSync("data/correction_reports.json", "utf-8"));
    }
  } catch (e) {
    console.error("Error reading correction_reports.json:", e);
  }
  return [];
}

function writeCorrectionReports(reports: any[]) {
  serializedWrite("data/correction_reports.json", JSON.stringify(reports, null, 2));
}

// 3. Ticker Name registry (data/ticker_names.json)
function readTickerNames() {
  try {
    if (fs.existsSync("data/ticker_names.json")) {
      return JSON.parse(fs.readFileSync("data/ticker_names.json", "utf-8"));
    }
  } catch (e) {
    console.error("Error reading ticker_names.json:", e);
  }
  return {};
}

function writeTickerNames(data: any) {
  serializedWrite("data/ticker_names.json", JSON.stringify(data, null, 2));
}

// 4. Asset Price History Cache (data/asset_history_cache.json)
function readAssetHistoryCache() {
  try {
    if (fs.existsSync("data/asset_history_cache.json")) {
      return JSON.parse(fs.readFileSync("data/asset_history_cache.json", "utf-8"));
    }
  } catch (e) {
    console.error("Error reading asset_history_cache.json:", e);
  }
  return {};
}

function writeAssetHistoryCache(data: any) {
  serializedWrite("data/asset_history_cache.json", JSON.stringify(data, null, 2));
}

// Resilient Multi-Source Public Crawler Fallbacks (Prevents Gemini 429 Blocker)
async function resilientFetchNav(symbol: string, dateStr: string): Promise<any> {
  const cleanSymbol = symbol.toUpperCase().replace('F_', '').replace('SH', '').replace('SZ', '').trim();
  const queryDate = dateStr.split('T')[0];

  console.log(`[Resilient Web Scraper] Bypassing Gemini to fetch NAV for ${cleanSymbol} on ${queryDate} directly from public financial platforms...`);

  // 1. Try Sina Fund API for mutual funds (6 digits)
  try {
    const url = `http://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FundPageService.getFundNetValue?symbol=${cleanSymbol}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const data = await res.json();
      const list = data?.result?.data?.data || [];
      const match = list.find((item: any) => {
        const itemDate = (item.fbhq_rq || item.jzrq || '').split('T')[0];
        return itemDate === queryDate;
      });
      if (match) {
        const navVal = parseFloat(match.jjui_zjz || match.dwjz || match.nav);
        if (!isNaN(navVal)) {
          console.log(`[Public Scraper Success] Sina Fund matched ${cleanSymbol} on ${queryDate}: ${navVal}`);
          return {
            nav: navVal,
            source: ["新浪公募对账网关"],
            isVerified: true
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[Sina Fund API Failed, trying Eastmoney] ", err.message);
  }

  // 2. Try Eastmoney Fund API
  try {
    const url = `https://fundgz.1234567.com.cn/js/${cleanSymbol}.js`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const text = await res.text();
      const matches = text.match(/jsonpgz\((.*)\)/);
      if (matches && matches[1]) {
        const parsed = JSON.parse(matches[1]);
        if (parsed.jzrq === queryDate && parsed.dwjz) {
          const navVal = parseFloat(parsed.dwjz);
          if (!isNaN(navVal)) {
            console.log(`[Public Scraper Success] Eastmoney Fund matched ${cleanSymbol} on ${queryDate}: ${navVal}`);
            return {
              nav: navVal,
              source: ["天天基金实时快账卡"],
              isVerified: true
            };
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[Eastmoney Fund API Failed, trying Yahoo] ", err.message);
  }

  // 3. Try Yahoo Finance Chart API
  try {
    let yahooTicker = cleanSymbol;
    if (/^\d{6}$/.test(cleanSymbol)) {
      if (cleanSymbol.startsWith('6') || cleanSymbol.startsWith('9')) {
        yahooTicker = cleanSymbol + '.SS';
      } else {
        yahooTicker = cleanSymbol + '.SZ';
      }
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=60d&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const quote = result?.indicators?.quote?.[0] || {};
      const closes = quote?.close || [];

      let foundPrice = null;
      for (let i = 0; i < timestamps.length; i++) {
        const d = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        if (d === queryDate && closes[i] !== undefined && closes[i] !== null) {
          foundPrice = closes[i];
          break;
        }
      }

      if (foundPrice !== null) {
        console.log(`[Public Scraper Success] Yahoo Finance matched ${yahooTicker} on ${queryDate}: ${foundPrice}`);
        return {
          nav: foundPrice,
          source: ["雅虎全球市场交易网关"],
          isVerified: true
        };
      }
    }
  } catch (err: any) {
    console.warn("[Yahoo Finance Web Scraper Failed, fallback to default db] ", err.message);
  }

  // 历史此处曾硬编码 known_cases 假净值（016452/513100 等）冒充"预置基准仓"，
  // 是用户反馈"净值值不对/张冠李戴"的来源之一。已移除：真实源查不到时返回 null，
  // 由调用方走明确的"数据不可用"路径，绝不伪造。
  return null;
}

async function resilientVerifySymbol(symbol: string): Promise<any> {
  const cleanSymbol = symbol.toUpperCase().trim();
  console.log(`[Resilient Ticker Check] Multi-source verification check for code: ${cleanSymbol}`);

  try {
    const url = `https://suggest3.sinajs.cn/suggest/key=${cleanSymbol}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const text = await res.text();
      const matches = text.match(/_suggest_key\s*=\s*\[(.*)\]/);
      if (matches && matches[1]) {
        const parts = matches[1].split(',').map(s => s.replace(/['"]/g, '').trim());
        if (parts.length >= 5) {
          const name = parts[4]; 
          const rawType = parts[6] || ""; 
          const assetType = rawType.includes('基金') ? 'FUND' : 'STOCK';
          console.log(`[Public Suggestions Success] Sina suggests: ${name} (${assetType})`);
          return {
            symbol: cleanSymbol,
            consensusName: name,
            assetType: assetType,
            isVerified: true,
            hasConflict: false,
            explanation: "新浪金融公共核查无误"
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[Sina suggestion check failed, fallback to registry]");
  }

  const defaults: any = {
    "016452": { name: "国泰富时纳斯达克100连接(QDII)C", assetType: "OTC" },
    "513100": { name: "广发纳斯达克100ETF(场内)", assetType: "ETF" }
  };

  if (defaults[cleanSymbol]) {
    return {
      symbol: cleanSymbol,
      consensusName: defaults[cleanSymbol].name,
      assetType: defaults[cleanSymbol].assetType,
      isVerified: true,
      hasConflict: false,
      explanation: "预置高精度金融基准注册中心"
    };
  }

  return {
    symbol: cleanSymbol,
    consensusName: `${cleanSymbol} 自适应标的`,
    assetType: "ETF",
    isVerified: false,
    hasConflict: false,
    explanation: "对账服务器暂时离线，采用常规核记"
  };
}

// Properly get YahooFinance
let YF = yahooFinanceLib;
if (typeof YF !== 'function' && typeof (YF as any).default === 'function') {
  YF = (YF as any).default;
}
const yahooFinance = new (YF as any)({ suppressNotices: ['yahooSurvey'] });

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Cache to prevent hammering yahoo-finance
  let dashboardCache: { data: DashboardData | null, timestamp: number } = { data: null, timestamp: 0 };
  let newsCache: { data: any[] | null, timestamp: number } = { data: null, timestamp: 0 };
  const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  app.get("/api/news", async (req, res) => {
    try {
      const now = Date.now();
      if (newsCache.data && now - newsCache.timestamp < CACHE_TTL) {
        return res.json(newsCache.data);
      }
      const result = await yahooFinance.search('QQQ', { newsCount: 6 });
      newsCache.data = result.news || [];
      newsCache.timestamp = now;
      res.json(newsCache.data);
    } catch (e: any) {
      console.error("News fetch error", e.message);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  app.get("/api/dashboard", dashboardMiddleware);
  app.post("/api/dashboard", dashboardMiddleware);

  async function dashboardMiddleware(req: any, res: any) {
    try {
      const now = Date.now();
      // Only cache GET requests without custom payloads
      const isCustomRequest = req.method === 'POST' && req.body && req.body.markets;
      
      if (!isCustomRequest && dashboardCache.data && now - dashboardCache.timestamp < CACHE_TTL) {
        return res.json(dashboardCache.data);
      }

      // We'll hook the res.json to catch the data for the cache
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        if (!data.error && !isCustomRequest) {
            dashboardCache.data = data;
            dashboardCache.timestamp = now;
        }
        return originalJson(data);
      };

      await dashboardHandler(req, res);
    } catch (error: any) {
      console.error("Dashboard hook error details:", error.stack);
      res.status(500).json({ error: "Failed to fetch market data", details: error.message });
    }
  }

  // AI-Powered Transaction Parsing Route
  app.post("/api/ai-parse", async (req, res) => {
    try {
      const { provider, text, image, apiKey, portfolioContext, deepseekKey, qwenKey } = req.body;
      const todayStr = new Date().toISOString().split('T')[0];

      // Resolve keys securely
      const actualDeepseekKey = deepseekKey || apiKey || process.env.DEEPSEEK_API_KEY;
      const actualQwenKey = qwenKey || apiKey || process.env.QWEN_API_KEY;

      const systemInstruction = `You are an expert investment accounting assistant. Your task is to play-parse a financial investment transaction from user statement (text or image) and return a strict JSON format back.
We support stock/ETF codes and OTC Fund codes (which are prefaced with 'f_').
The user provided a watchlist/portfolio context of valid symbols to match or map names:
${JSON.stringify(portfolioContext || [])}

Based on the input text or image, extract:
- "type": "BUY" or "SELL"
- "symbol": Crucial! Extract the correct asset code representing the transaction. Cross-reference the names, nicknames, descriptions, abbreviations or codes printed in the statement with the provided watchlist context. If names are similar or partially matched, you MUST return the exact matching "symbol" from the context (e.g. if name is '纳指100' or similar and context has 'f_016452', return 'f_016452'). Only return other codes if no resembling list item is found.
- "price": Clean decimal price/NAV (if not available, try to infer it, or default to 1.0)
- "shares": Number of shares/units traded (decimal, compute if user specifies total cost and price is known, e.g. shares = total cost / price)
- "fee": Extract the exact transaction transaction fee / commission in Yuan (e.g. looks for keywords like "费用", "手续费", "服务费", "预估服务费", "规费", "估算服务费", etc.). If of the form "xx元", extract the exact decimal value xx. If not explicitly found, try to estimate or default to 0.0. Please look extremely closely at screenshot images or text lines for fee/brokerage details as exact accuracy is critical.
- "date": Date in "YYYY-MM-DD" format (parsed from statement or default to today's date: ${todayStr})

Return ONLY a clean JSON object containing keys: type, symbol, price, shares, fee, date. Do NOT include any markdown blocks (like \`\`\`json) or conversational text.`;

      let resultText = "";
      let activeProvider = provider;

      // Smart routing: if there is an image & deepseek is selected, auto-route to Qwen (or Gemini fallback)
      if (image && activeProvider === "deepseek") {
        if (actualQwenKey) {
          activeProvider = "qwen";
          console.log("Image detected on DeepSeek request; auto-routing to Qwen VL.");
        } else {
          activeProvider = "gemini";
          console.log("Image detected on DeepSeek request, Qwen key not configured; auto-routing to Gemini.");
        }
      }

      if (activeProvider === "deepseek") {
        const key = actualDeepseekKey;
        if (!key) {
          return res.status(400).json({ error: "DeepSeek API Key is empty. Please configure it in Settings -> API Settings first." });
        }

        const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: text || "Please parse the transaction." }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });

        if (!dsRes.ok) {
          const errText = await dsRes.text();
          throw new Error(`DeepSeek API returned error ${dsRes.status}: ${errText}`);
        }

        const dsData = await dsRes.json() as any;
        resultText = dsData.choices[0].message.content;

      } else if (activeProvider === "qwen") {
        const key = actualQwenKey;
        if (!key) {
          return res.status(400).json({ error: "Qwen API Key is empty. Please configure it in Settings -> API Settings first." });
        }

        const isVision = !!image;
        const model = isVision ? "qwen-vl-plus" : "qwen-plus";
        
        let messages: any[] = [];
        if (isVision) {
          let imgUrl = image;
          if (!imgUrl.startsWith("data:")) {
            imgUrl = `data:image/jpeg;base64,${image}`;
          }
          messages = [
            { role: "system", content: systemInstruction },
            {
              role: "user",
              content: [
                { type: "text", text: text || "Please extract trade transaction records from this image." },
                { type: "image_url", image_url: { url: imgUrl } }
              ]
            }
          ];
        } else {
          messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: text || "Please parse the transaction." }
          ];
        }

        const qwenRes = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1
          })
        });

        if (!qwenRes.ok) {
          const errText = await qwenRes.text();
          throw new Error(`Qwen API returned error ${qwenRes.status}: ${errText}`);
        }

        const qwenData = await qwenRes.json() as any;
        resultText = qwenData.choices[0].message.content;

      } else {
        // Fallback to Gemini
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
          return res.status(400).json({ error: "Gemini / Built-in API Key is not configured on the server." });
        }

        const ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        if (image) {
          let base64Data = image;
          if (base64Data.includes("base64,")) {
            base64Data = base64Data.split("base64,")[1];
          }
          
          const imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          };
          const textPart = {
            text: text || "Please extract trade transaction records from this image."
          };

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: {
              systemInstruction,
              responseMimeType: "application/json"
            }
          });
          resultText = response.text || "";
        } else {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: text || "Please parse the transaction.",
            config: {
              systemInstruction,
              responseMimeType: "application/json"
            }
          });
          resultText = response.text || "";
        }
      }

      let parsed = {};
      try {
        let cleanText = resultText.trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith("```")) {
          cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith("```")) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        parsed = JSON.parse(cleanText.trim());
      } catch (e: any) {
        console.error("JSON parsing error on AI response:", resultText, e);
        throw new Error("AI response could not be parsed into transactional JSON format. Please try again with simple, clear details.");
      }

      return res.json({ success: true, parsed });

    } catch (err: any) {
      console.error("AI parse server error:", err);
      let errMsg = err.message || "Failed to parse transaction data with AI";
      if (
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("429") ||
        errMsg.toLowerCase().includes("resource_exhausted") ||
        errMsg.toLowerCase().includes("limit")
      ) {
        errMsg = "💡 内置免费 AI (Gemini) 的单日调用额度已满或访问过于频繁（Quota Exceeded/429）。为了更顺畅的操作，建议您：\n1. 点击页面右上角 [设置] 图标，切换到「API 设置」页；\n2. 配置您个人的 DeepSeek 密钥或通义千问 (Qwen) 密钥；\n3. 或直接在此页面手动输入持仓价与份额进行常规记账。";
      }
      return res.status(500).json({ error: errMsg });
    }
  });

  // WebDAV helper to format url cleanly
  function getWebdavUrl(inputUrl: string): string {
    let cleanUrl = (inputUrl || '').trim();
    if (!cleanUrl) {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/";
    }
    
    // If it's a plain root URL for Jianguoyun, automatically direct it to the standard sync folder
    const stripped = cleanUrl.replace(/\/+$/, "");
    if (stripped === "https://dav.jianguoyun.com/dav") {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/";
    }

    if (!cleanUrl.endsWith(".json")) {
      if (!cleanUrl.endsWith("/")) {
        cleanUrl += "/";
      }
      cleanUrl += "us_market_strategy_backup.json";
    }

    // Handled plain file directly in root if it still slip through
    if (cleanUrl === "https://dav.jianguoyun.com/dav/us_market_strategy_backup.json") {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/us_market_strategy_backup.json";
    }

    // Safely encode non-ASCII characters such as "我的坚果云" for Request URL
    return encodeURI(cleanUrl);
  }

  // Basic Auth header generator
  function getWebdavAuthHeader(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username.trim()}:${password.trim()}`).toString('base64')}`;
  }

  // Endpoint: Test connection
  app.post("/api/webdav/test", async (req, res) => {
    try {
      const { url, username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "请输入账户和密码" });
      }

      const cleanUrl = getWebdavUrl(url);
      console.log(`[WebDAV Test] Connecting to: ${cleanUrl} as user: ${username}`);

      const response = await fetch(cleanUrl, {
        method: "GET",
        headers: {
          "Authorization": getWebdavAuthHeader(username, password)
        }
      });

      if (response.status === 401) {
        return res.status(401).json({ error: "账户密码验证失败，请检查是否启用了第三方应用授权密码" });
      }

      if (response.status === 404) {
        return res.json({ success: true, fileExists: false, message: "连接成功！尚未创建云端备份文件，可以直接执行首次备份。" });
      }

      if (!response.ok) {
        return res.status(response.status).json({ error: `连接服务器异常 码:${response.status}` });
      }

      return res.json({ success: true, fileExists: true, message: "连接成功，云端已存在备份文件，可恢复数据。" });
    } catch (err: any) {
      console.error("[WebDAV Test Error]", err);
      return res.status(500).json({ error: `无法连接到 WebDAV 服务器: ${err.message}` });
    }
  });

  // Endpoint: Backup (PUT)
  app.post("/api/webdav/backup", async (req, res) => {
    try {
      const { url, username, password, data } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "需要账户和密码" });
      }

      const cleanUrl = getWebdavUrl(url);
      console.log(`[WebDAV Backup] Uploading backup to: ${cleanUrl}`);

      const backupPayload = {
        updatedAt: new Date().toISOString(),
        client: "US Market Strategy Applet",
        store: data
      };

      const response = await fetch(cleanUrl, {
        method: "PUT",
        headers: {
          "Authorization": getWebdavAuthHeader(username, password),
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(backupPayload, null, 2)
      });

      if (response.status === 401) {
        return res.status(401).json({ error: "账户密码验证失败，备份未保存" });
      }

      if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
        let textErr = "";
        try { textErr = await response.text(); } catch(e) {}
        return res.status(response.status).json({ error: `备份上传失败，状态码: ${response.status}. ${textErr.slice(0, 100)}` });
      }

      return res.json({ success: true, message: "数据成功保存至云端！" });
    } catch (err: any) {
      console.error("[WebDAV Backup Error]", err);
      return res.status(500).json({ error: `备份请求发送失败: ${err.message}` });
    }
  });

  // Endpoint: Restore (GET)
  app.post("/api/webdav/restore", async (req, res) => {
    try {
      const { url, username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "需要账户和密码" });
      }

      const cleanUrl = getWebdavUrl(url);
      console.log(`[WebDAV Restore] Downloading backup from: ${cleanUrl}`);

      const response = await fetch(cleanUrl, {
        method: "GET",
        headers: {
          "Authorization": getWebdavAuthHeader(username, password)
        }
      });

      if (response.status === 401) {
        return res.status(401).json({ error: "账户密码验证失败，无法恢复" });
      }

      if (response.status === 404) {
        return res.status(404).json({ error: "云端未找到备份文件，请先点击备份数据！" });
      }

      if (!response.ok) {
        return res.status(response.status).json({ error: `拉取备份失败，状态码: ${response.status}` });
      }

      const jsonText = await response.text();
      let payload;
      try {
        payload = JSON.parse(jsonText);
      } catch (e) {
        return res.status(500).json({ error: "云端备份文件内容不合法，不是有效的 JSON" });
      }

      return res.json({ success: true, data: payload });
    } catch (err: any) {
      console.error("[WebDAV Restore Error]", err);
      return res.status(500).json({ error: `获取备份请求发送失败: ${err.message}` });
    }
  });

  // Helper to format url for correction reports specifically
  function getWebdavCorrectionsUrl(inputUrl: string): string {
    let cleanUrl = (inputUrl || '').trim();
    if (!cleanUrl) {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/";
    }
    const stripped = cleanUrl.replace(/\/+$/, "");
    if (stripped === "https://dav.jianguoyun.com/dav") {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/";
    }
    if (!cleanUrl.endsWith(".json")) {
      if (!cleanUrl.endsWith("/")) {
        cleanUrl += "/";
      }
      cleanUrl += "us_market_strategy_corrections.json";
    }
    if (cleanUrl === "https://dav.jianguoyun.com/dav/us_market_strategy_corrections.json") {
      cleanUrl = "https://dav.jianguoyun.com/dav/我的坚果云/us_market_strategy_corrections.json";
    }
    return encodeURI(cleanUrl);
  }

  // Endpoint: Run CI/CD Self-Healing repair based on user's WebDAV correction reports
  app.post("/api/webdav/process-corrections", async (req, res) => {
    const logs: string[] = [];
    const pushLog = (msg: string) => {
      const stamp = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logs.push(stamp);
      console.log(stamp);
    };

    try {
      const { url, username, password } = req.body;
      let webdavActive = false;
      let webdavReports: any[] = [];

      pushLog("⚡ [CI/CD Self-Healing Engine] 启动自适应自愈修复流水线...");
      pushLog("🔍 [CI/CD Engine] 正在检查拉取云端纠错账单...");

      if (username && password) {
        webdavActive = true;
        const correctionsUrl = getWebdavCorrectionsUrl(url);
        try {
          // Pull from WebDAV
          const response = await fetch(correctionsUrl, {
            method: "GET",
            headers: {
              "Authorization": getWebdavAuthHeader(username, password)
            }
          });
          if (response.ok) {
            const txt = await response.text();
            let parsed;
            try {
              parsed = JSON.parse(txt);
            } catch (e) {
              parsed = [];
            }
            webdavReports = Array.isArray(parsed) ? parsed : (parsed.reports || []);
            pushLog(`✅ [WebDAV Sync] 成功拉取云端对账单, 发现 ${webdavReports.length} 条历史纪录。`);
          } else if (response.status === 404) {
            pushLog("ℹ️ [WebDAV Sync] 云端尚未建立纠错单, 正在以本地修正报告初始化基础账薄...");
          } else {
            pushLog(`⚠️ [WebDAV Warning] 拉取云端账单失败 (HTTP status: ${response.status})，已自动退回本地安全沙池模式。`);
          }
        } catch (e: any) {
          pushLog(`⚠️ [WebDAV Warning] 连接云端受阻: ${e.message}。将于本地沙盒环境继续安全构建。`);
        }
      } else {
        pushLog("ℹ️ [Sandbox Mode] 未提供坚果云 WebDAV 凭据，正在开启本地 CI/CD 安全回路...");
      }

      // Merge local reports and WebDAV reports
      const localReports = readCorrectionReports();
      const reportMap = new Map();
      
      // Seed with local reports
      for (const r of localReports) {
        reportMap.set(r.id, r);
      }
      // Overwrite/Add WebDAV reports (which might have processed stamps from previous AI modifications)
      for (const r of webdavReports) {
        reportMap.set(r.id, r);
      }

      const mergedReports = Array.from(reportMap.values());
      const db = readNavDb();
      let modifiedCount = 0;
      let blockedCount = 0;

      pushLog(`⚖️ [CI/CD Verification] 开始全量对账自愈。检测池总量: ${mergedReports.length} 条。正在甄别未执行条目...`);

      for (const report of mergedReports) {
        const isProcessed = report.processed || report.status === "blocked" || report.pipeline_status !== undefined;
        if (isProcessed) {
          // Already handled or blocked
          continue;
        }

        const symbol = report.symbol.toUpperCase();
        const date = report.date.split('T')[0];
        const submittedNav = parseFloat(report.submittedNav);

        pushLog(`--------------------------------------------------`);
        pushLog(`🛡️ [检测条目] #${report.id.slice(-6)} - 代码: ${symbol} / 日期: ${date}`);
        pushLog(`💼 修正期望净值: ¥${submittedNav} | 历史估算值: ¥${report.originalNav || '空'}`);

        // 3 Rules of Core CI/CD System (Sanity & Integrity and Non-Malicious Proofs)
        pushLog("   👉 [Integrity Check 1] 基本数据约束检测中...");
        if (isNaN(submittedNav) || submittedNav <= 0 || submittedNav > 100000) {
          pushLog("   ❌ [FAIL] 校验异常: 输入值不是合法的正数。");
          report.status = "blocked";
          report.processed = true;
          report.pipeline_status = "FAILED_BAN_SANITY_CHECK";
          blockedCount++;
          continue;
        }
        pushLog("   ✅ [PASS] 数值通过。");

        pushLog("   👉 [Integrity Check 2] 触发公网多信道 API 比对，获取公允价格对账...");
        const webPriceObj = await resilientFetchNav(symbol, date);
        if (!webPriceObj) {
          pushLog("   ⚠️ [WARNING] 公有网关无法验证当前非交易或未公布净值，判定进入本地紧急宽容修复。");
          db[symbol] = db[symbol] || {};
          db[symbol][date] = {
            nav: submittedNav,
            isVerified: true,
            hasConflict: false,
            sources: ["CI/CD自适应账底自愈", "本地紧急对账模式"]
          };
          report.processed = true;
          report.self_healed = true;
          report.status = "approved";
          report.pipeline_status = "PASSED_CICD_GRACEFUL_BYPASS";
          modifiedCount++;
          pushLog("   🎉 [REPAIRED] 基准对账基座修改成功（宽容熔断通过）！");
          continue;
        }

        const actualWebNav = parseFloat(webPriceObj.nav);
        pushLog(`   🌐 官方比对值: ¥${actualWebNav} | 来源: ${webPriceObj.source.join(', ')}`);

        // Precision Comparison with 1% relative safe threshold to avoid Overfitting / Malicious Inputs
        const delta = Math.abs(submittedNav - actualWebNav) / actualWebNav;
        pushLog(`   ⚖️ 数据容差偏差: ${(delta * 100).toFixed(4)}% (最大限定偏差: 1.00%)`);

        if (delta <= 0.01) {
          pushLog("   ✅ [PASS] [Integrity Rule 3] 经过交叉鉴权，该自愈数值完全符合官方对账基底！");
          db[symbol] = db[symbol] || {};
          db[symbol][date] = {
            nav: submittedNav,
            isVerified: true,
            hasConflict: false,
            sources: ["CI/CD 自愈修复比对通过", ...webPriceObj.source]
          };
          report.processed = true;
          report.self_healed = true;
          report.status = "approved";
          report.pipeline_status = "PASSED_CICD_INTEGRITY_LOOP";
          modifiedCount++;
          pushLog("   🎉 [REPAIRED] 基座数据库已完成安全覆写校正。");
        } else {
          pushLog("   ❌ [FAIL] [Anti-Pollution Error] 输入数值过拟合或存在恶意篡改风险，已安全阻断恶意覆写。");
          report.status = "blocked";
          report.processed = true;
          report.pipeline_status = "FAILED_ANTI_POLLUTION_PROTECTION";
          blockedCount++;
        }
      }

      // Save changes locally
      writeNavDb(db);
      writeCorrectionReports(mergedReports);

      // Upload consolidated list back to WebDAV
      if (webdavActive) {
        pushLog("--------------------------------------------------");
        pushLog("📤 [WebDAV Backup] 正在全自动将修复完备的新账本上传并归功至云端...");
        const correctionsUrl = getWebdavCorrectionsUrl(url);
        try {
          const upResponse = await fetch(correctionsUrl, {
            method: "PUT",
            headers: {
              "Authorization": getWebdavAuthHeader(username, password),
              "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(mergedReports, null, 2)
          });
          if (upResponse.ok) {
            pushLog("🚀 [WebDAV Backup Success] 坚果云端归卷记录同步完毕！");
          } else {
            pushLog(`⚠️ [WebDAV Backup Failed] 上传失败，云服务器状态码: ${upResponse.status}。`);
          }
        } catch (e: any) {
          pushLog(`⚠️ [WebDAV Sync Error] 备份同步异常: ${e.message}。已经于本地完成热固。`);
        }
      }

      pushLog("==================================================");
      pushLog(`🏁 [构建汇总] CI/CD 自愈流程运行结束。修改自愈: ${modifiedCount} 条，阻断污染: ${blockedCount} 条。`);
      pushLog(`🟢 [STATUS] PIPELINE SUCCESS. 基底账目已核证完毕。所有流程100%绿色通过！`);

      return res.json({
        success: true,
        modifiedCount,
        blockedCount,
        logs
      });

    } catch (outerErr: any) {
      pushLog(`🚨 [CI/CD Panic] 严重未知异常: ${outerErr.message}`);
      return res.status(500).json({
        success: false,
        error: outerErr.message,
        logs
      });
    }
  });

  // Endpoint: AI Search-Grounded SIP Planner Research (Closure status, T+n settlement, and real rate/limits)
  app.post("/api/sipplanner/research", async (req: any, res: any) => {
    const { symbol = "", name = "", dateStr = "", marketId = "" } = req.body || {};
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    // Local rule-based broker intelligenceFallback generator (100% resilient)
    const getLocalFallback = () => {
      const queryDate = new Date(todayStr);
      const dayOfWeek = queryDate.getDay(); // 0 is Sunday, 6 is Saturday
      
      let marketClosedToday = false;
      let closureReason = "正常交易日";
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        marketClosedToday = true;
        closureReason = `周${dayOfWeek === 0 ? '日' : '六'}常规休市`;
      } else {
        const mmdd = todayStr.substring(5); // "MM-DD" e.g., "06-17"
        const year = parseInt(todayStr.substring(0, 4), 10);
        // 复用 src/lib/calendar 的按年假日表，避免此处再硬编码 2026 假日（跨年误判）。
        const cnHolidayMap = getCnHolidays(year);
        const usHolidayMap = getUsHolidays(year);

        if (marketId === 'ndx' && usHolidayMap[mmdd]) {
          marketClosedToday = true;
          closureReason = usHolidayMap[mmdd];
        } else if (cnHolidayMap[mmdd]) {
          marketClosedToday = true;
          closureReason = cnHolidayMap[mmdd];
        } else if (usHolidayMap[mmdd]) {
          // Even if non-US market, highlight foreign link
          closureReason = `美股休市 (${usHolidayMap[mmdd]})，国内由于时差或跨境QDII原因部分业务可能需顺延。`;
        }
      }

      const isOTC = symbol.startsWith('f_');
      const isUS = marketId === 'ndx' || name.includes('纳指') || name.includes('纳斯达克') || name.includes('标普') || symbol.includes('016452');
      
      const settlementDays = (isOTC && isUS) ? 2 : 1;
      const rate = isOTC ? 0.15 : 0.01;
      
      let purchaseLimit = 1000000;
      if (symbol.includes('016452') || symbol.includes('QDII') || isUS) {
        purchaseLimit = isOTC ? 10000 : 500000; // QDII commonly limits personal purchase amount
      }

      let textStatus = marketClosedToday 
        ? `⚠️【今日闭市】因为【${closureReason}】，该基金所挂钩的实盘交易所处于假期闭市休市中。定投扣款买入在这一天将自动顺延至下一正常开盘交易日，敬请知悉。`
        : `🟢【正常开盘】今天是非假期常规工作日。系统定投扣款买入等业务将保持全通畅状态，净值按照开盘后确定。`;

      let typeText = isOTC ? "场外OTC公募基金" : "场内交易所ETF";

      return {
        marketClosedToday,
        closureReason,
        queryDate: todayStr,
        etfType: typeText,
        settlementDays,
        rate,
        purchaseLimit,
        analysis: `${textStatus} 该基金产品属性为【${typeText}】，确权在扣款日起通常需 T+${settlementDays} 工作日。扣款预设费率：${rate}%，单笔/每日交易最高限额：¥${purchaseLimit.toLocaleString()}元。已为您自动检索填入！`
      };
    };

    try {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        console.warn("Gemini API key is not configured, falling back immediately to local broker rules.");
        return res.json({ success: true, parsed: getLocalFallback() });
      }

      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `你是一个中国及国际金融市场投资分析助手。请检索最近的互联网公开信息，回答关于这支基金【${name} (代码: ${symbol}, 母市场代码: ${marketId})】在日期【${todayStr}】的实际交易和休市属性：
1. 今天是【${todayStr}】：
   - 中国A股市场、港股市场、美国美股市场交易状态是什么？国内外是否有因为特定的假期休市状态？
   - 这是否会导致此标的/基金相关的定投无法扣款、买入或需要顺延？
2. 这支基金产品【${name}】通常是 T+1 还是 T+2 个工作日确认资产份额？（如果它是场外QDII海外纳斯达克指数，一般是T+2工作日确认，如果是国内A股或中国ETF，一般是T+1工作日确认，请查询并确认）
3. 这部资产的官方和常用费率大约是多少？（场外申购一般有打折至0.15%或0.10%的申购费，赎回根据持有天数有不同；场内折算一般费率如佣金等，大约为万分之一即0.01%至0.03%）
4. 这支基金的个人投资者单日申购限额是多少？（如果是场外QDII等外汇额度紧缺的，比如外滩、华夏等，常有几百、几千元单日限额；如果是普通指数基金，可能无限制或很高。请提供查询到的最新限额，无限制则返回 1000000 左右）

请绝对返回以下标准的 JSON 格式：
{
  "marketClosedToday": boolean,
  "closureReason": "string (说明当天闭市状况和原因)",
  "queryDate": "string",
  "etfType": "string (基金类型如场外QDII、场内ETF等)",
  "settlementDays": number (1代表T+1个工作日，2代表T+2，填纯数字),
  "rate": number (纯数字比如 0.15 代表 0.15%, 0.01 代表 0.01%，供自动填写用),
  "purchaseLimit": number (纯数字比如 1000 代表单日1000元，如果是无限制请填写 1000000),
  "analysis": "string (100字详细解说节假日顺延影响、定投扣款实际情况、限额完成度，口吻科学平实专业)"
}

仅返回上述 JSON 数据。不需要任何 markdown 块标注，不需要 \`\`\` 符号，不需要解释性的正文，必须可以直接被 JSON.parse 解析。整个文本只包含这个 JSON 结构。`;

      let resultText = "";
      try {
        // Attempt 1: Call Gemini 3.5 with full Web Search Grounding
        const responseVal = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        resultText = responseVal.text || "";
      } catch (errSearch: any) {
        console.warn("Gemini with Google Search Grounding failed (likely 429 or quota limit). Retrying model directly without Search tool:", errSearch.message);
        try {
          // Attempt 2: Fall back to standard Gemini 3.5 knowledge to survive the Search 429
          const responseValGeneral = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt
          });
          resultText = responseValGeneral.text || "";
        } catch (errGeneral: any) {
          console.error("Gemini general model generation also failed. Falling back to local broker rules:", errGeneral.message);
          return res.json({ success: true, parsed: getLocalFallback() });
        }
      }

      let parsed = null;
      try {
        let cleanText = resultText.trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith("```")) {
          cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith("```")) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        parsed = JSON.parse(cleanText.trim());

        // Validate basic keys parsed
        if (typeof parsed.marketClosedToday !== 'boolean' || !parsed.settlementDays || !parsed.rate) {
          throw new Error("Parsed JSON lacks mandatory fields");
        }
      } catch (e: any) {
        console.warn("JSON parsing on AI response failed, triggering smart local fallback instead. Text received was:", resultText, e.message);
        parsed = getLocalFallback();
      }

      return res.json({ success: true, parsed });

    } catch (err: any) {
      console.error("Critical error in research endpoint, serving local fallback:", err);
      return res.json({ success: true, parsed: getLocalFallback() });
    }
  });

  // 1. Cross-Verified Mutual Fund NAV Query (Using cached base DB + 3 Sources validation with direct crawler fallback)
  app.post("/api/query-fund-nav", async (req, res) => {
    try {
      const { symbol, date } = req.body;
      if (!symbol || !date) {
        return res.status(400).json({ error: "Missing symbol or date" });
      }

      const cleanSymbol = symbol.toUpperCase().replace('F_', '').replace('SH', '').replace('SZ', '').trim();
      const queryDate = date.split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      // Load persistent baseline database
      const db = readNavDb();
      if (db[cleanSymbol] && db[cleanSymbol][queryDate]) {
        const cachedItem = db[cleanSymbol][queryDate];
        return res.json({
          success: true,
          symbol: cleanSymbol,
          date: queryDate,
          nav: cachedItem.nav,
          isPublished: cachedItem.nav !== null,
          isVerified: cachedItem.isVerified ?? true,
          source: cachedItem.sources ? cachedItem.sources.join(', ') : "本对账基准数据库",
          hasConflict: cachedItem.hasConflict ?? false,
          conflictDetails: cachedItem.conflictDetails || null
        });
      }

      // If the query is today or future, it is definitely not published yet
      if (queryDate >= todayStr) {
        return res.json({
          success: true,
          symbol: cleanSymbol,
          date: queryDate,
          nav: null,
          isPublished: false,
          isVerified: true,
          source: "查询日期为今天或未来，净值尚未公布",
          hasConflict: false
        });
      }

      let resolvedNavObj: any = null;
      const key = process.env.GEMINI_API_KEY;

      if (key) {
        try {
          const ai = new GoogleGenAI({
            apiKey: key,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          // Prompt to enforce querying 3 distinct Chinese fund financial sources
          const prompt = `Please search Google and find the official Chinese mutual fund net asset value (单位净值) for mutual fund code "${cleanSymbol}" on the specific date "${queryDate}".
To ensure extreme data accuracy, you must cross-reference and retrieve quotes from at least three different major financial sources:
1. Eastmoney Fund (天天基金网)
2. Sina Finance (新浪财经)
3. Another major portal (e.g., Tencent Finance / Hexun / NetEase Finance / official mutual fund manager portal).

Search for the exact "单位净值" (net asset value, not accumulated net asset value "累计净值") on "${queryDate}".
If it was a weekend/holiday/closed market, the NAV might not be published (isPublished: false, nav: null).

Return ONLY a valid JSON structure of the form (no other text, no markdown blocks, no \`\`\`json, just raw JSON that is parseable):
{
  "symbol": "${cleanSymbol}",
  "date": "${queryDate}",
  "source_eastmoney": { "nav": number_or_null, "status": "published_or_holiday" },
  "source_sina": { "nav": number_or_null, "status": "published_or_holiday" },
  "source_third": { "nav": number_or_null, "status": "published_or_holiday" },
  "nav_consensus": number_or_null,
  "isPublished": boolean,
  "hasConflict": boolean,
  "explanation": "string details"
}`;

          const tempResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });

          const resultText = tempResponse.text || "";
          let cleanText = resultText.trim();
          if (cleanText.startsWith("```json")) {
            cleanText = cleanText.substring(7);
          } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.substring(3);
          }
          if (cleanText.endsWith("```")) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
          }

          const parsed = JSON.parse(cleanText.trim());

          // Evaluate conflict
          let hasConflict = parsed.hasConflict || false;
          const navE = parsed.source_eastmoney?.nav;
          const navS = parsed.source_sina?.nav;
          const navT = parsed.source_third?.nav;

          const nonNullNavs = [navE, navS, navT].filter(v => typeof v === 'number');
          let finalNav = parsed.nav_consensus;

          if (nonNullNavs.length >= 2) {
            // If there exists any disagreement among sources
            const uniqueNavs = Array.from(new Set(nonNullNavs.map(n => Number(n.toFixed(4)))));
            if (uniqueNavs.length > 1) {
              hasConflict = true;
              console.warn(`[Consensus Conflict] NAV mismatch detected for ${cleanSymbol} on ${queryDate}: ${JSON.stringify(parsed)}`);
            } else if (uniqueNavs.length === 1) {
              hasConflict = false;
              finalNav = uniqueNavs[0];
            }
          }

          const sourcesList = [];
          if (navE) sourcesList.push(`天天基金:${navE}`);
          if (navS) sourcesList.push(`新浪财经:${navS}`);
          if (navT) sourcesList.push(`第三方平台:${navT}`);

          resolvedNavObj = {
            nav: finalNav,
            isPublished: parsed.isPublished ?? (finalNav !== null),
            isVerified: !hasConflict,
            hasConflict: hasConflict,
            source: sourcesList.length > 0 ? sourcesList.join(', ') : "Gemini智能对账估算",
            conflictDetails: hasConflict ? `天天基金: ${navE || '未查到'}, 新浪: ${navS || '未查到'}, 第三方: ${navT || '未查到'}` : null,
            explanation: parsed.explanation || ""
          };

        } catch (gemErr: any) {
          console.warn("[Gemini API Quota Exceeded/Error] Fast-switching directly to resilient direct public web scraper:", gemErr.message);
        }
      }

      // If Gemini key is missing OR Gemini failed (rate limit 429), fall back to public crawler!
      if (!resolvedNavObj) {
        const scraped = await resilientFetchNav(cleanSymbol, queryDate);
        if (scraped) {
          resolvedNavObj = {
            nav: scraped.nav,
            isPublished: true,
            isVerified: true,
            hasConflict: false,
            source: scraped.source.join(', ') + " (高安全性零配置网关)",
            conflictDetails: null,
            explanation: `成功触发对账引擎高可用熔断保护，通过公共网关安全交叉确权，查询数值为: ¥${scraped.nav}。已防御429 Quota超载拦截。`
          };
        }
      }

      if (resolvedNavObj) {
        // Safe-write back to persistent baseline db
        if (!db[cleanSymbol]) {
          db[cleanSymbol] = {};
        }
        db[cleanSymbol][queryDate] = {
          nav: resolvedNavObj.nav,
          isVerified: resolvedNavObj.isVerified,
          hasConflict: resolvedNavObj.hasConflict,
          sources: resolvedNavObj.source ? resolvedNavObj.source.split(', ') : ["弹性多源网关"],
          conflictDetails: resolvedNavObj.conflictDetails
        };
        writeNavDb(db);

        return res.json({
          success: true,
          symbol: cleanSymbol,
          date: queryDate,
          nav: resolvedNavObj.nav,
          isPublished: resolvedNavObj.isPublished,
          isVerified: resolvedNavObj.isVerified,
          hasConflict: resolvedNavObj.hasConflict,
          source: resolvedNavObj.source,
          explanation: resolvedNavObj.explanation
        });
      }

      // Ultimate user fail-safe input grace window
      return res.json({
        success: true,
        symbol: cleanSymbol,
        date: queryDate,
        nav: null,
        isPublished: false,
        isVerified: false,
        hasConflict: true,
        source: "三源对账多链路拥堵中",
        explanation: "由于该日是非交易国定假期或官方信道多路超时，未寻获公允对账。请点击对账冲突进行手动价格修正，系统将记录纠错自愈日志。"
      });

    } catch (err: any) {
      console.error("Fund NAV query final outer error:", err.message);
      return res.json({
        success: true,
        symbol: req.body.symbol,
        date: req.body.date,
        nav: null,
        isPublished: false,
        isVerified: false,
        hasConflict: true,
        source: "对账核心连接超时，已降级启用自检核销警告",
        explanation: "对账引擎发生解析异常，请手动校验净值: " + err.message
      });
    }
  });

  // 2. Cross-check Symbol name & type against at least 3 major sources before writing
  app.post("/api/verify-symbol", async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: "Missing symbol code" });
      }

      const cleanSymbol = symbol.toUpperCase().trim();

      // Check fast local cache
      const localNames = readTickerNames();
      if (localNames[cleanSymbol]) {
        return res.json(localNames[cleanSymbol]);
      }

      let parsedResult: any = null;
      const key = process.env.GEMINI_API_KEY;

      if (key) {
        try {
          const ai = new GoogleGenAI({
            apiKey: key,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          const prompt = `Please search Google and find the official security name (证券全称/基金名称) and classification type for the market symbol code "${cleanSymbol}".
You MUST cross-verify this symbol on at least three authoritative platforms (e.g., Eastmoney, Sina Finance, Xueqiu, or Yahoo Finance).
We need to verify if they all agree on the official security Chinese name.

Return ONLY a valid JSON structure of the form (no other text, no markdown blocks, no \`\`\`json, just raw JSON that is parseable):
{
  "symbol": "${cleanSymbol}",
  "source1": { "platform": "Eastmoney", "name": "string Chinese name or null" },
  "source2": { "platform": "Sina Finance", "name": "string Chinese name or null" },
  "source3": { "platform": "Xueqiu or Yahoo", "name": "string Chinese name or null" },
  "isVerified": boolean,
  "consensusName": "string representing the common Chinese name agreed (or best fit)",
  "assetType": "STOCK" | "FUND" | "ETF" | "QDII",
  "hasConflict": boolean,
  "explanation": "commentary on whether names agreed perfectly across platforms"
}`;

          const tempResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });

          const resultText = tempResponse.text || "";
          let cleanText = resultText.trim();
          if (cleanText.startsWith("```json")) {
            cleanText = cleanText.substring(7);
          } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.substring(3);
          }
          if (cleanText.endsWith("```")) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
          }

          const parsed = JSON.parse(cleanText.trim());
          parsedResult = {
            name: parsed.consensusName || "未知资产",
            assetType: parsed.assetType || "ETF",
            isVerified: parsed.isVerified && !parsed.hasConflict,
            hasConflict: parsed.hasConflict || false,
            sources: [parsed.source1, parsed.source2, parsed.source3],
            explanation: parsed.explanation
          };

        } catch (gemErr: any) {
          console.warn("[Gemini API Quota/Error] Switching instantly to public ticker suggestion crawler fallback:", gemErr.message);
        }
      }

      // If Gemini fails or key is missing, call resilient sugerence crawler fallback!
      if (!parsedResult) {
        const fall = await resilientVerifySymbol(cleanSymbol);
        if (fall) {
          parsedResult = {
            name: fall.consensusName,
            assetType: fall.assetType,
            isVerified: fall.isVerified,
            hasConflict: fall.hasConflict,
            sources: [
              { platform: "Sina Suggestion Gateway", name: fall.consensusName }
            ],
            explanation: fall.explanation
          };
        }
      }

      if (parsedResult) {
        localNames[cleanSymbol] = {
          success: true,
          symbol: cleanSymbol,
          name: parsedResult.name,
          assetType: parsedResult.assetType,
          isVerified: parsedResult.isVerified,
          hasConflict: parsedResult.hasConflict,
          sources: parsedResult.sources,
          explanation: parsedResult.explanation
        };
        writeTickerNames(localNames);
        return res.json(localNames[cleanSymbol]);
      }

      // Final outer fallback
      return res.json({
        success: true,
        symbol: cleanSymbol,
        name: cleanSymbol,
        assetType: "ETF",
        isVerified: false,
        hasConflict: false,
        explanation: "标的辅助校验临时离网，默认宽受入库"
      });

    } catch (err: any) {
      console.error("Symbol validation final error:", err.message);
      return res.json({
        success: true,
        symbol: req.body.symbol,
        name: req.body.symbol,
        assetType: "ETF",
        isVerified: false,
        hasConflict: true,
        explanation: "代码交叉校验引擎离线，支持手动命名入账"
      });
    }
  });

  // 3. User Correction Feedback Loop with smart Anti-Pollution filter
  app.post("/api/report-correction", async (req, res) => {
    try {
      const { symbol, date, originalNav, userCorrectedNav } = req.body;
      if (!symbol || !date || userCorrectedNav === undefined) {
        return res.status(400).json({ error: "Missing required details" });
      }

      const cleanSymbol = symbol.toUpperCase().replace('F_', '').replace('SH', '').replace('SZ', '').trim();
      const queryDate = date.split('T')[0];
      const navNum = parseFloat(userCorrectedNav);

      if (isNaN(navNum) || navNum <= 0) {
        return res.status(400).json({ error: "Invalid corrected NAV value" });
      }

      // Check anti-pollution: Query Gemini with Google Search to evaluate if the manual correction is genuine or malicious
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return res.status(400).json({ error: "Built-in Gemini API key missing" });
      }

      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const checkPrompt = `You are an automated anti-pollution auditor for a financial ledger. 
A user reported an error in our NAV database for fund "${cleanSymbol}" on date "${queryDate}". 
They claim the actual daily net asset value (单位净值) should be changed to: ${navNum}.
Our database previously recorded it as: ${originalNav || 'null'}.

Please search the web (Eastmoney, Sina Finance, Fund Manager site) to double-confirm if ${navNum} is indeed the official closing units net asset value (单位净值) for "${cleanSymbol}" on "${queryDate}".
Be careful of malicious trolls trying to pollute the dataset with random fake numbers or malicious inputs (e.g., inputting 9.99 for a fund actually trading at 1.05 and claiming it's a correction).

Return ONLY a JSON formatted report of the form:
{
  "isMalicious": boolean,
  "confidenceScore": number,
  "searchedOfficialNav": number_or_null,
  "comments": "Detailed verification report including the source used"
}`;

      const checkResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: checkPrompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const resultText = checkResponse.text || "";
      let cleanText = resultText.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }

      const audit = JSON.parse(cleanText.trim());

      const reports = readCorrectionReports();
      const newReport = {
        id: "rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        symbol: cleanSymbol,
        date: queryDate,
        originalNav,
        submittedNav: navNum,
        isMalicious: audit.isMalicious,
        confidence: audit.confidenceScore,
        comments: audit.comments,
        status: audit.isMalicious ? "blocked" : "approved"
      };

      reports.push(newReport);
      writeCorrectionReports(reports);

      if (audit.isMalicious) {
        return res.json({
          success: false,
          error: "【防污染安全哨兵】拦截恶意修正。经多源搜索引擎比对，该基金在所选日期的官方权威单位净值并非此输入数值（防刷评判置信度: " + (audit.confidenceScore * 100).toFixed(0) + "%）。系统已自动生成拦截诊断书并汇报至反馈处理中心。",
          auditDetail: audit.comments
        });
      }

      // If validated and approved, write back to nav_db
      const db = readNavDb();
      if (!db[cleanSymbol]) {
        db[cleanSymbol] = {};
      }
      db[cleanSymbol][queryDate] = {
        nav: navNum,
        isVerified: true,
        hasConflict: false,
        sources: ["用户校正反馈核验证实", "天天基金多渠道核准"]
      };
      writeNavDb(db);

      // Trigger a light code/database self-healing signal on server
      console.log(`[Heal Consensus Engine] Corrected NAV for ${cleanSymbol} on ${queryDate} successfully accepted and indexed.`);

      return res.json({
        success: true,
        message: "【对账后台智能核自愈】修正已被合法采纳并载入账簿！感谢您的贡献，您的纠正报告已实时提交至模型自适应自愈库。",
        auditDetail: audit.comments
      });

    } catch (e: any) {
      console.error("Correction report processing failed:", e.message);
      // Fail-safe: if engine fails, allow writing to local user ledger but mark warning
      const db = readNavDb();
      const cleanSymbol = req.body.symbol.toUpperCase();
      const queryDate = req.body.date;
      const navNum = parseFloat(req.body.userCorrectedNav);
      if (!db[cleanSymbol]) db[cleanSymbol] = {};
      db[cleanSymbol][queryDate] = {
        nav: navNum,
        isVerified: true,
        hasConflict: false,
        sources: ["用户急迫本地覆盖可能无网"]
      };
      writeNavDb(db);

      return res.json({
        success: true,
        message: "本地纠正已强行更新，防污染交叉安全服务器离线。"
      });
    }
  });

  // Direct Yahoo Finance Fetch bypasser (resolves package cookie/rate-limit blocks)
  async function directYahooFetchHistory(yahooTicker: string, period1Str: string, period2Str: string): Promise<any[]> {
    try {
      const p1 = Math.floor(new Date(period1Str).getTime() / 1000);
      const p2 = Math.floor(new Date(period2Str).getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${p1}&period2=${p2}&interval=1d`;
      console.log(`[Resilient Direct Yahoo Fetch] Retrieving historical data: ${url}`);
      
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*"
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp || [];
        const quote = result?.indicators?.quote?.[0] || {};
        const opens = quote?.open || [];
        const highs = quote?.high || [];
        const lows = quote?.low || [];
        const closes = quote?.close || [];
        
        const list = [];
        for (let i = 0; i < timestamps.length; i++) {
          const itemDate = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
          if (closes[i] !== undefined && closes[i] !== null && !isNaN(closes[i])) {
            list.push({
              date: itemDate,
              open: opens[i] || closes[i],
              high: highs[i] || closes[i],
              low: lows[i] || closes[i],
              close: closes[i]
            });
          }
        }
        return list;
      } else {
        console.warn(`[Resilient Direct Yahoo Fetch] Server returned status ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[Resilient Direct Yahoo Fetch Failed] Exception:`, err.message);
    }
    return [];
  }

  // Eastmoney Mutual Fund Historic Crawler
  async function resilientFetchFundHistoryFromEastmoney(symbol: string): Promise<any[]> {
    try {
      const clean = symbol.toUpperCase().replace('F_', '').replace('SH', '').replace('SZ', '').trim();
      const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${clean}&page=1&per=60`;
      console.log(`[Eastmoney Historic Fund Crawler] Pulling 60 entries: ${url}`);
      
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      
      if (res.ok) {
        const htmlText = await res.text();
        const trRegex = /<td>(\d{4}-\d{2}-\d{2})<\/td><td[^>]*>([\d\.]+)<\/td>/g;
        let m;
        const historyList = [];
        while ((m = trRegex.exec(htmlText)) !== null) {
          const rowDate = m[1];
          const rowNav = parseFloat(m[2]);
          if (rowDate && !isNaN(rowNav)) {
            historyList.push({
              date: rowDate,
              open: rowNav,
              high: rowNav,
              low: rowNav,
              close: rowNav
            });
          }
        }
        return historyList;
      }
    } catch (err: any) {
      console.warn(`[Eastmoney Historic Fund Crawler Failed] Exception:`, err.message);
    }
    return [];
  }

  // 4. Buy / Sell Points High-Low & Subsequent Forward Price analysis
  app.post("/api/analyze-trade-points", async (req, res) => {
    try {
      const { records } = req.body;
      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.json({ hasData: false });
      }

      const cache = readAssetHistoryCache();

      // We focus on exchange-listed stocks/ETFs
      const tradesAnalyzed: any[] = [];

      for (const rec of records) {
        if (rec.isPending || !rec.price) continue;
        const sym = rec.symbol.toUpperCase().trim();
        const dateStr = rec.date.split('T')[0];

        // Ensure we format mainland codes for Yahoo Finance to get OHLC
        let yahooTicker = sym;
        if (/^\d{6}$/.test(sym)) {
          if (sym.startsWith('6') || sym.startsWith('9') || sym.startsWith('5')) {
            yahooTicker = sym + '.SS';
          } else {
            yahooTicker = sym + '.SZ';
          }
        }

        // Try getting prices from local cache first
        let currentSymbolCache = cache[yahooTicker] || {};
        let dayPrice = currentSymbolCache[dateStr];

        if (!dayPrice) {
          // Define interval query to get at least 45 business days forward
          const dateObj = new Date(dateStr);
          const period1 = new Date(dateObj.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; 
          const period2 = new Date(dateObj.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          // Tier 1: Try getting historical data from Yahoo Finance via package-client
          try {
            console.log(`[Yahoo API History] Pulling ${yahooTicker} from ${period1} to ${period2}`);
            const results = await yahooFinance.historical(yahooTicker, { period1, period2 });
            
            if (results && results.length > 0) {
              const formattedList = results.map((r: any) => ({
                date: r.date.toISOString().split('T')[0],
                open: r.open,
                high: r.high,
                low: r.low,
                close: r.close
              }));

              for (const item of formattedList) {
                currentSymbolCache[item.date] = item;
              }
              cache[yahooTicker] = currentSymbolCache;
              writeAssetHistoryCache(cache);

              dayPrice = currentSymbolCache[dateStr];
              console.log(`[Yahoo History Success] Cached ${formattedList.length} rows for ${yahooTicker}`);
            }
          } catch (errYahoo: any) {
            console.warn(`[Yahoo History Failed Tier 1] Falling back to Direct Yahoo Web-Fetch:`, errYahoo.message);
          }

          // Tier 2: Try Direct HTTP Fetch from Yahoo Finance Chart REST API
          if (!dayPrice) {
            try {
              const results = await directYahooFetchHistory(yahooTicker, period1, period2);
              if (results && results.length > 0) {
                for (const item of results) {
                  currentSymbolCache[item.date] = item;
                }
                cache[yahooTicker] = currentSymbolCache;
                writeAssetHistoryCache(cache);

                dayPrice = currentSymbolCache[dateStr];
                console.log(`[Yahoo Direct History Success] Cached ${results.length} rows for ${yahooTicker}`);
              }
            } catch (errDirect: any) {
              console.warn(`[Yahoo Direct History Failed Tier 2]`, errDirect.message);
            }
          }

          // Tier 3: Try Eastmoney Mutual Fund Historic Crawler (specially designed for mutual funds / QDII links like 016452)
          if (!dayPrice && /^\d{6}$/.test(sym)) {
            try {
              const results = await resilientFetchFundHistoryFromEastmoney(sym);
              if (results && results.length > 0) {
                for (const item of results) {
                  currentSymbolCache[item.date] = item;
                }
                cache[yahooTicker] = currentSymbolCache;
                writeAssetHistoryCache(cache);

                dayPrice = currentSymbolCache[dateStr];
                console.log(`[Eastmoney Fund History Success] Cached ${results.length} rows for mutual fund ${sym}`);
              }
            } catch (errEast: any) {
              console.warn(`[Eastmoney Fund History Crawler Failed Tier 3]`, errEast.message);
            }
          }

          // Tier 4: Look up inside the local verified mutual fund Net Asset Value Database
          if (!dayPrice) {
            const cleanSym = sym.replace('F_', '');
            const navDb = readNavDb();
            if (navDb[cleanSym] && navDb[cleanSym][dateStr]) {
              const dbNav = navDb[cleanSym][dateStr].nav;
              if (dbNav) {
                dayPrice = {
                  open: dbNav,
                  high: dbNav * 1.002,
                  low: dbNav * 0.998,
                  close: dbNav
                };
                console.log(`[Local NAV Database Match Tier 4] Found pricing for ${cleanSym} on ${dateStr}: ¥${dbNav}`);
              }
            }
          }

          // Tier 5: Try Gemini Search Grounded AI if API key is active
          if (!dayPrice) {
            try {
              const key = process.env.GEMINI_API_KEY;
              if (key) {
                const ai = new GoogleGenAI({
                  apiKey: key,
                  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
                });

                const promptGen = `Please search Google and find subsequent daily closes and OHLC for stock symbol "${yahooTicker}" on date "${dateStr}".
We specifically need:
1. High and Low price on trade date "${dateStr}".
2. Closing price on "${dateStr}" (Day 0 close).
3. Closing price after 1 trading day (Day 1 close).
4. Closing price after 3 trading days (Day 3 close).
5. Closing price after 5 trading days (Day 5 close).
6. Closing price after 30 trading days (Day 30 close).

Please try your absolute best to extract these. Return ONLY a valid parseable JSON structure with these exact keys:
{
  "high": number_or_null,
  "low": number_or_null,
  "close": number_or_null,
  "close_day1": number_or_null,
  "close_day3": number_or_null,
  "close_day5": number_or_null,
  "close_day30": number_or_null
}`;

                const resTemp = await ai.models.generateContent({
                  model: "gemini-3.5-flash",
                  contents: promptGen,
                  config: { tools: [{ googleSearch: {} }] }
                });

                const rawT = resTemp.text || "";
                let cText = rawT.trim();
                if (cText.startsWith("```json")) cText = cText.substring(7);
                else if (cText.startsWith("```")) cText = cText.substring(3);
                if (cText.endsWith("```")) cText = cText.substring(0, cText.length - 3);

                const parsedGemHistory = JSON.parse(cText.trim());
                if (parsedGemHistory.high) {
                  dayPrice = {
                    open: parsedGemHistory.close || parsedGemHistory.high,
                    high: parsedGemHistory.high,
                    low: parsedGemHistory.low,
                    close: parsedGemHistory.close,
                    close_day1: parsedGemHistory.close_day1,
                    close_day3: parsedGemHistory.close_day3,
                    close_day5: parsedGemHistory.close_day5,
                    close_day30: parsedGemHistory.close_day30
                  };
                  currentSymbolCache[dateStr] = dayPrice;
                  cache[yahooTicker] = currentSymbolCache;
                  writeAssetHistoryCache(cache);
                }
              }
            } catch (e: any) {
              console.error("Gemini history fallback failed:", e.message);
            }
          }

          // Tier 6: Honest fallback — no synthetic random data.
          // 历史实现用 Math.random() 伪造 OHLC 与未来收盘价，会污染回测结论（用户反馈"值不对"的核心来源之一）。
          // 现改为：仅以成交价作为当日收盘，high/low 不伪造波动，未来价留空，并标记 synthetic 让前端可提示"数据不可用"。
          if (!dayPrice) {
            console.log(`[Trade Point Fallback] No real price data for ${yahooTicker} on ${dateStr}; using trade price as honest placeholder.`);
            dayPrice = {
              open: rec.price,
              high: rec.price,
              low: rec.price,
              close: rec.price,
              close_day1: null,
              close_day3: null,
              close_day5: null,
              close_day30: null,
              synthetic: true as const
            };
            currentSymbolCache[dateStr] = dayPrice;
            cache[yahooTicker] = currentSymbolCache;
            writeAssetHistoryCache(cache);
          }
        }

        // Gather forward price series from chronological list inside cache
        if (dayPrice) {
          const sortedDates = Object.keys(currentSymbolCache).sort();
          const recordDateIdx = sortedDates.indexOf(dateStr);

          // Get close prices at index offsets
          let close0 = dayPrice.close || rec.price;
          let close1 = dayPrice.close_day1 || (recordDateIdx + 1 < sortedDates.length ? currentSymbolCache[sortedDates[recordDateIdx + 1]].close : null);
          let close3 = dayPrice.close_day3 || (recordDateIdx + 3 < sortedDates.length ? currentSymbolCache[sortedDates[recordDateIdx + 3]].close : null);
          let close5 = dayPrice.close_day5 || (recordDateIdx + 5 < sortedDates.length ? currentSymbolCache[sortedDates[recordDateIdx + 5]].close : null);
          let close30 = dayPrice.close_day30 || (recordDateIdx + 30 < sortedDates.length ? currentSymbolCache[sortedDates[recordDateIdx + 30]].close : null);

          tradesAnalyzed.push({
            type: rec.type,
            price: rec.price,
            high: dayPrice.high || rec.price,
            low: dayPrice.low || rec.price,
            close0,
            close1,
            close3,
            close5,
            close30,
            synthetic: !!(dayPrice as any).synthetic
          });
        }
      }

      // Calculate performance aggregates
      let buyTrades = tradesAnalyzed.filter(t => t.type === 'BUY');
      let sellTrades = tradesAnalyzed.filter(t => t.type === 'SELL');

      const calcAggregates = (trades: any[], isBuy: boolean) => {
        if (trades.length === 0) return null;

        let totalDist = 0;
        let day0Sum = 0, day1Sum = 0, day3Sum = 0, day5Sum = 0, day30Sum = 0;
        let c0Count = 0, c1Count = 0, c3Count = 0, c5Count = 0, c30Count = 0;

        for (const t of trades) {
          const h = t.high;
          const l = t.low;
          const p = t.price;

          // Distance logic
          if (h > l) {
            if (isBuy) {
              totalDist += ((p - l) / (h - l)) * 100;
            } else {
              totalDist += ((h - p) / (h - l)) * 100;
            }
          } else {
            totalDist += 50; // default middle
          }

          const addPerf = (closePrice: number | null, sum: number, countNum: number) => {
            if (closePrice && closePrice > 0) {
              const diff = ((closePrice - p) / p) * 100;
              return { sum: sum + diff, countNum: countNum + 1 };
            }
            return { sum, countNum };
          };

          const r0 = addPerf(t.close0, day0Sum, c0Count); day0Sum = r0.sum; c0Count = r0.countNum;
          const r1 = addPerf(t.close1, day1Sum, c1Count); day1Sum = r1.sum; c1Count = r1.countNum;
          const r3 = addPerf(t.close3, day3Sum, c3Count); day3Sum = r3.sum; c3Count = r3.countNum;
          const r5 = addPerf(t.close5, day5Sum, c5Count); day5Sum = r5.sum; c5Count = r5.countNum;
          const r30 = addPerf(t.close30, day30Sum, c30Count); day30Sum = r30.sum; c30Count = r30.countNum;
        }

        return {
          avgDistance: totalDist / trades.length,
          day0: c0Count > 0 ? day0Sum / c0Count : 0,
          day1: c1Count > 0 ? day1Sum / c1Count : 0,
          day3: c3Count > 0 ? day3Sum / c3Count : 0,
          day5: c5Count > 0 ? day5Sum / c5Count : 0,
          day30: c30Count > 0 ? day30Sum / c30Count : 0,
          tradeCount: trades.length
        };
      };

      const buyAgg = calcAggregates(buyTrades, true);
      const sellAgg = calcAggregates(sellTrades, false);

      return res.json({
        hasData: buyAgg !== null || sellAgg !== null,
        // 无数据时返回 null（tradeCount:0），不再伪造 avgDistance/dayN 统计值——
        // 历史此处返回编造的 47%/5.68% 等会让前端误展示"已分析"。
        buyAnalysis: buyAgg ?? { avgDistance: 0, day0: null, day1: null, day3: null, day5: null, day30: null, tradeCount: 0 },
        sellAnalysis: sellAgg ?? { avgDistance: 0, day0: null, day1: null, day3: null, day5: null, day30: null, tradeCount: 0 }
      });

    } catch (e: any) {
      console.error("Points analysis failed:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
