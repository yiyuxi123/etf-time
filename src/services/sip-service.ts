/**
 * SIP Service - Ported from server.ts /api/sipplanner/research endpoint.
 *
 * Researches SIP (Systematic Investment Plan) information for a given fund:
 * - Market open/close status on a given date
 * - Settlement days (T+1 or T+2)
 * - Rate (fee percentage)
 * - Purchase limit
 *
 * Uses Gemini with Google Search grounding when an API key is available,
 * falling back to a local rule-based engine with embedded holiday calendars.
 */
// Note: Gemini API calls use @google/genai SDK's internal HTTP, not http-client.
// http-client is available for any additional network requests if needed.

// ============================================================================
// Types
// ============================================================================

export interface SipResearchParams {
  symbol: string;
  name: string;
  dateStr: string;
  marketId: string;
}

export interface SipResearchParsed {
  marketClosedToday: boolean;
  closureReason: string;
  queryDate: string;
  etfType: string;
  settlementDays: number;
  rate: number;
  purchaseLimit: number;
  analysis: string;
}

export interface SipResearchResult {
  success: boolean;
  parsed: SipResearchParsed;
}

// ============================================================================
// Holiday Maps (2026) - Copied from server.ts
// ============================================================================

// 2026 Public Holidays in China
const cnHolidayMap: Record<string, string> = {
  '01-01': '元旦假期',
  '02-17': '春节除夕休市',
  '02-18': '春节大年初一休市',
  '02-19': '春节大年初二休市',
  '02-20': '春节大年初三休市',
  '02-21': '春节假期休市',
  '02-22': '春节假期休市',
  '02-23': '春节假期休市',
  '04-05': '清明节休市',
  '04-06': '清明节补休',
  '05-01': '劳动节休市',
  '06-19': '端午节假期休市(2026年端午节为6月19日)',
  '10-01': '国庆长假首日休市',
  '10-02': '国庆长假休市',
  '10-03': '国庆长假联开休市',
  '10-04': '国庆长假休市',
  '10-05': '国庆长假休市',
  '10-06': '国庆长假休市',
  '10-07': '国庆长假休市',
};

// 2026 Public Holidays in USA (for QDII Nasdaq/S&P index)
const usHolidayMap: Record<string, string> = {
  '01-01': "New Year's Day 美股休市",
  '01-19': 'Martin Luther King Day 美股休市',
  '02-16': "Washington's Birthday 美股总统日休市",
  '04-03': 'Good Friday 耶稣受难日美股休市',
  '05-25': 'Memorial Day 美股阵亡将士纪念日休市',
  '06-19': 'Juneteenth 六月节美股休市',
  '07-03': 'Independence Day 美美独立日提前休市(观察日)',
  '09-07': 'Labor Day 美国劳动节美股休市',
  '11-26': 'Thanksgiving 感恩节美股休市',
  '12-25': 'Christmas 圣诞节美股休市',
};

// ============================================================================
// Local Rule-Based Fallback Engine
// ============================================================================

/**
 * Generate SIP research results using purely local holiday maps and rules.
 * 100% resilient - no network required.
 */
function getLocalFallback(params: SipResearchParams): SipResearchParsed {
  const { symbol, name, dateStr, marketId } = params;
  const todayStr = dateStr || new Date().toISOString().split('T')[0];
  const queryDate = new Date(todayStr);
  const dayOfWeek = queryDate.getDay(); // 0 is Sunday, 6 is Saturday

  let marketClosedToday = false;
  let closureReason = '正常交易日';

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    marketClosedToday = true;
    closureReason = `周${dayOfWeek === 0 ? '日' : '六'}常规休市`;
  } else {
    const mmdd = todayStr.substring(5); // "MM-DD" e.g., "06-17"

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
  const isUS =
    marketId === 'ndx' ||
    name.includes('纳指') ||
    name.includes('纳斯达克') ||
    name.includes('标普') ||
    symbol.includes('016452');

  const settlementDays = isOTC && isUS ? 2 : 1;
  const rate = isOTC ? 0.15 : 0.01;

  let purchaseLimit = 1000000;
  if (symbol.includes('016452') || symbol.includes('QDII') || isUS) {
    purchaseLimit = isOTC ? 10000 : 500000; // QDII commonly limits personal purchase amount
  }

  const textStatus = marketClosedToday
    ? `⚠️【今日闭市】因为【${closureReason}】，该基金所挂钩的实盘交易所处于假期闭市休市中。定投扣款买入在这一天将自动顺延至下一正常开盘交易日，敬请知悉。`
    : `🟢【正常开盘】今天是非假期常规工作日。系统定投扣款买入等业务将保持全通畅状态，净值按照开盘后确定。`;

  const typeText = isOTC ? '场外OTC公募基金' : '场内交易所ETF';

  return {
    marketClosedToday,
    closureReason,
    queryDate: todayStr,
    etfType: typeText,
    settlementDays,
    rate,
    purchaseLimit,
    analysis: `${textStatus} 该基金产品属性为【${typeText}】，确权在扣款日起通常需 T+${settlementDays} 工作日。扣款预设费率：${rate}%，单笔/每日交易最高限额：¥${purchaseLimit.toLocaleString()}元。已为您自动检索填入！`,
  };
}

// ============================================================================
// Gemini AI Research (with Google Search Grounding)
// ============================================================================

/**
 * Attempt to use Gemini AI with Google Search grounding to research SIP information.
 * Returns the parsed result, or null if Gemini is unavailable or fails.
 */
async function tryGeminiResearch(params: SipResearchParams): Promise<SipResearchParsed | null> {
  const { symbol, name, dateStr, marketId } = params;
  const todayStr = dateStr || new Date().toISOString().split('T')[0];

  // Try to get Gemini API key from localStorage (client-side)
  let apiKey = '';
  try {
    apiKey = localStorage.getItem('gemini_api_key') || '';
  } catch (e) {
    // localStorage not available
  }

  if (!apiKey) {
    console.warn('Gemini API key is not configured, falling back immediately to local broker rules.');
    return null;
  }

  // Dynamically import @google/genai
  let GoogleGenAI: any;
  try {
    const genaiModule = await import('@google/genai');
    GoogleGenAI = genaiModule.GoogleGenAI;
  } catch (e) {
    console.warn('Failed to import @google/genai, falling back to local broker rules:', e);
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
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

  let resultText = '';

  try {
    // Attempt 1: Call Gemini with full Web Search Grounding
    const responseVal = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    resultText = responseVal.text || '';
  } catch (errSearch: any) {
    console.warn(
      'Gemini with Google Search Grounding failed (likely 429 or quota limit). Retrying model directly without Search tool:',
      errSearch.message
    );
    try {
      // Attempt 2: Fall back to standard Gemini knowledge to survive the Search 429
      const responseValGeneral = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      resultText = responseValGeneral.text || '';
    } catch (errGeneral: any) {
      console.error(
        'Gemini general model generation also failed. Falling back to local broker rules:',
        errGeneral.message
      );
      return null;
    }
  }

  // Parse the response
  try {
    let cleanText = resultText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    const parsed = JSON.parse(cleanText.trim());

    // Validate basic keys parsed
    if (typeof parsed.marketClosedToday !== 'boolean' || !parsed.settlementDays || parsed.rate === undefined) {
      throw new Error('Parsed JSON lacks mandatory fields');
    }

    return {
      marketClosedToday: parsed.marketClosedToday,
      closureReason: parsed.closureReason || '',
      queryDate: parsed.queryDate || todayStr,
      etfType: parsed.etfType || '',
      settlementDays: parsed.settlementDays,
      rate: parsed.rate,
      purchaseLimit: parsed.purchaseLimit || 1000000,
      analysis: parsed.analysis || '',
    };
  } catch (e: any) {
    console.warn(
      'JSON parsing on AI response failed, triggering smart local fallback instead. Text received was:',
      resultText,
      e.message
    );
    return null;
  }
}

// ============================================================================
// Main Export: researchSipInfo
// ============================================================================

/**
 * Research SIP information for a given fund.
 *
 * Strategy:
 * 1. Try Gemini with Google Search grounding for real-time market data
 * 2. Fall back to local rule-based engine with embedded 2026 holiday calendars
 *
 * @param params - The fund symbol, name, query date, and market ID
 * @returns Parsed SIP research result
 */
export async function researchSipInfo(params: SipResearchParams): Promise<SipResearchResult> {
  const { symbol, name, dateStr, marketId } = params;

  // Try Gemini AI first
  try {
    const geminiResult = await tryGeminiResearch(params);
    if (geminiResult) {
      return { success: true, parsed: geminiResult };
    }
  } catch (err: any) {
    console.error('Critical error in Gemini research, serving local fallback:', err);
  }

  // Fall back to local rule-based engine
  const localResult = getLocalFallback(params);
  return { success: true, parsed: localResult };
}
