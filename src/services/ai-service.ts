/**
 * AI Service — Browser/Capacitor WebView port of the /api/ai-parse endpoint.
 *
 * Provides aiParseTransaction() which calls DeepSeek, Qwen, or Gemini to
 * parse a natural-language or image-based transaction into structured data.
 *
 * All HTTP calls go through the unified http-client utility.
 */

import { GoogleGenAI } from '@google/genai';
import { httpPost } from './http-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiParseParams {
  /** Natural-language transaction description */
  text?: string;
  /** Base64-encoded image data (without the "data:..." prefix) */
  image?: string;
  /** Provider: 'deepseek' | 'qwen' | 'gemini' */
  provider?: string;
  /** Watchlist/portfolio context for symbol matching */
  portfolioContext?: any[];
  /** User-configured DeepSeek API key */
  deepseekKey?: string;
  /** User-configured Qwen API key */
  qwenKey?: string;
  /** Legacy / generic API key fallback */
  apiKey?: string;
}

export interface ParsedTransaction {
  type: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  shares: number;
  fee: number;
  date: string;
}

export interface AiParseResult {
  success: boolean;
  parsed?: ParsedTransaction;
  error?: string;
}

// ---------------------------------------------------------------------------
// Gemini helper — get API key from localStorage or built-in
// ---------------------------------------------------------------------------

function getGeminiKey(): string | null {
  const localKey = localStorage.getItem('gemini_api_key');
  if (localKey) return localKey;
  return (typeof process !== 'undefined' && (process as any).env?.GEMINI_API_KEY) || null;
}

let _cachedAi: GoogleGenAI | null = null;
let _cachedAiKey: string | null = null;

function getAi(): GoogleGenAI | null {
  const key = getGeminiKey();
  if (!key) return null;
  if (_cachedAi && _cachedAiKey === key) return _cachedAi;
  _cachedAi = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
  _cachedAiKey = key;
  return _cachedAi;
}

// ---------------------------------------------------------------------------
// JSON cleaning helper — strip markdown code fences from AI responses
// ---------------------------------------------------------------------------

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// System instruction (copied verbatim from server.ts lines 370-383)
// ---------------------------------------------------------------------------

function buildSystemInstruction(portfolioContext: any[]): string {
  const todayStr = new Date().toISOString().split('T')[0];

  return `You are an expert investment accounting assistant. Your task is to play-parse a financial investment transaction from user statement (text or image) and return a strict JSON format back.
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
}

// ---------------------------------------------------------------------------
// DeepSeek provider
// ---------------------------------------------------------------------------

async function callDeepSeek(
  text: string | undefined,
  systemInstruction: string,
  apiKey: string,
): Promise<string> {
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: text || 'Please parse the transaction.' },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const responseText = await httpPost('https://api.deepseek.com/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
    timeout: 30000,
  });

  const data = JSON.parse(responseText);
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Qwen (Tongyi Qianwen) provider
// ---------------------------------------------------------------------------

async function callQwen(
  text: string | undefined,
  image: string | undefined,
  systemInstruction: string,
  apiKey: string,
): Promise<string> {
  const isVision = !!image;
  const model = isVision ? 'qwen-vl-plus' : 'qwen-plus';

  let messages: any[];

  if (isVision) {
    // Ensure the image has a data URI prefix for Qwen
    let imgUrl = image!;
    if (!imgUrl.startsWith('data:')) {
      imgUrl = `data:image/jpeg;base64,${imgUrl}`;
    }
    messages = [
      { role: 'system', content: systemInstruction },
      {
        role: 'user',
        content: [
          { type: 'text', text: text || 'Please extract trade transaction records from this image.' },
          { type: 'image_url', image_url: { url: imgUrl } },
        ],
      },
    ];
  } else {
    messages = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: text || 'Please parse the transaction.' },
    ];
  }

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.1,
  });

  const responseText = await httpPost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
    timeout: 30000,
  });

  const data = JSON.parse(responseText);
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

async function callGemini(
  text: string | undefined,
  image: string | undefined,
  systemInstruction: string,
): Promise<string> {
  const ai = getAi();
  if (!ai) {
    throw new Error('Gemini / Built-in API Key is not configured. Set gemini_api_key in localStorage.');
  }

  if (image) {
    // Strip data URI prefix if present
    let base64Data = image;
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg' as const,
      },
    };
    const textPart = {
      text: text || 'Please extract trade transaction records from this image.',
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    return response.text || '';
  } else {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: text || 'Please parse the transaction.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    return response.text || '';
  }
}

// ---------------------------------------------------------------------------
// aiParseTransaction — main exported function
// ---------------------------------------------------------------------------

export async function aiParseTransaction(params: AiParseParams = {}): Promise<AiParseResult> {
  const { text, image, provider, portfolioContext, deepseekKey, qwenKey, apiKey } = params;

  try {
    // Resolve API keys
    const actualDeepseekKey = deepseekKey || apiKey || null;
    const actualQwenKey = qwenKey || apiKey || null;

    const systemInstruction = buildSystemInstruction(portfolioContext || []);

    let resultText = '';
    let activeProvider = provider || 'gemini';

    // Smart routing: if there is an image and deepseek is selected, auto-route
    // to Qwen (if Qwen key is configured) or Gemini
    if (image && activeProvider === 'deepseek') {
      if (actualQwenKey) {
        activeProvider = 'qwen';
        console.log('Image detected on DeepSeek request; auto-routing to Qwen VL.');
      } else {
        activeProvider = 'gemini';
        console.log('Image detected on DeepSeek request, Qwen key not configured; auto-routing to Gemini.');
      }
    }

    // Call the selected provider
    if (activeProvider === 'deepseek') {
      if (!actualDeepseekKey) {
        return {
          success: false,
          error:
            'DeepSeek API Key is empty. Please configure it in Settings -> API Settings first.',
        };
      }
      resultText = await callDeepSeek(text, systemInstruction, actualDeepseekKey);
    } else if (activeProvider === 'qwen') {
      if (!actualQwenKey) {
        return {
          success: false,
          error:
            'Qwen API Key is empty. Please configure it in Settings -> API Settings first.',
        };
      }
      resultText = await callQwen(text, image, systemInstruction, actualQwenKey);
    } else {
      // Gemini (default / fallback)
      resultText = await callGemini(text, image, systemInstruction);
    }

    // Parse the response JSON
    let parsed: ParsedTransaction;
    try {
      const cleanText = cleanJsonText(resultText);
      const raw = JSON.parse(cleanText);
      parsed = {
        type: raw.type || 'BUY',
        symbol: raw.symbol || '',
        price: parseFloat(raw.price) || 1.0,
        shares: parseFloat(raw.shares) || 0,
        fee: parseFloat(raw.fee) || 0.0,
        date: raw.date || new Date().toISOString().split('T')[0],
      };
    } catch (parseErr: any) {
      console.error('JSON parsing error on AI response:', resultText, parseErr);
      return {
        success: false,
        error:
          'AI response could not be parsed into transactional JSON format. Please try again with simple, clear details.',
      };
    }

    return { success: true, parsed };
  } catch (err: any) {
    console.error('AI parse error:', err);

    let errMsg = err.message || 'Failed to parse transaction data with AI';

    // Detect quota / rate-limit errors and surface a helpful message
    const lowerMsg = errMsg.toLowerCase();
    if (
      lowerMsg.includes('quota') ||
      lowerMsg.includes('429') ||
      lowerMsg.includes('resource_exhausted') ||
      lowerMsg.includes('limit')
    ) {
      errMsg =
        '内置免费 AI (Gemini) 的单日调用额度已满或访问过于频繁（Quota Exceeded/429）。为了更顺畅的操作，建议您：\n' +
        '1. 点击页面右上角 [设置] 图标，切换到「API 设置」页；\n' +
        '2. 配置您个人的 DeepSeek 密钥或通义千问 (Qwen) 密钥；\n' +
        '3. 或直接在此页面手动输入持仓价与份额进行常规记账。';
    }

    return { success: false, error: errMsg };
  }
}
