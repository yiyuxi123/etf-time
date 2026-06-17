import yahooFinanceLib from 'yahoo-finance2';
import { DashboardData, ChartDataPoint, EtfInfo, MarketData, FactorBreakdown } from '../src/types';

let YF = yahooFinanceLib;
if (typeof YF !== 'function' && typeof (YF as any).default === 'function') {
  YF = (YF as any).default;
}
const yahooFinance = new (YF as any)({ suppressNotices: ['yahooSurvey'] });

// Utils
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const calculateRSI = (history: any[], period = 14) => {
    let valid = history.filter(h => h && h.close != null);
    if (valid.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = valid.length - period; i < valid.length; i++) {
        const diff = valid[i].close - valid[i-1].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// 📈 波端趋势视图（Swing Trading View）
function calculateSwingScore(
    id: string, 
    price: number, 
    ma200: number, 
    ma50: number, 
    ma50Up: boolean, 
    rsi: number, 
    drawdown: number, 
    pe: number, 
    vix: number, 
    volatility: number,
    usdcny: number,
    tnx: number
) {
    // Parameter normalization & safety guards
    price = typeof price === 'number' && !isNaN(price) ? price : 1;
    ma200 = typeof ma200 === 'number' && !isNaN(ma200) && ma200 > 0 ? ma200 : price;
    ma50 = typeof ma50 === 'number' && !isNaN(ma50) && ma50 > 0 ? ma50 : price;
    pe = typeof pe === 'number' && !isNaN(pe) ? pe : (id === 'ndx' ? 28 : (id === 'csi300' ? 11.8 : 0));
    vix = typeof vix === 'number' && !isNaN(vix) ? vix : 15;
    usdcny = typeof usdcny === 'number' && !isNaN(usdcny) ? usdcny : 7.23;
    tnx = typeof tnx === 'number' && !isNaN(tnx) ? tnx : 4.25;
    rsi = typeof rsi === 'number' && !isNaN(rsi) ? rsi : 50;
    drawdown = typeof drawdown === 'number' && !isNaN(drawdown) ? drawdown : 0;
    volatility = typeof volatility === 'number' && !isNaN(volatility) ? volatility : 0.2;

    let breakdown: any[] = [];
    let total = 0;

    if (id === 'ndx') {
        // DRRW (波动率状态机制):
        // VIX 极高 (>25) 代表市场深度恐慌，主升均线往往失效，重估估值安全性 PE，降低 50MA 趋势权重。
        // VIX 极低 (<15) 代表多头平稳主升，提升 50MA 趋势顺势跟强势能，降低恐慌因子的多余权重。
        let weight200MA = 25;
        let weight50MA = 15;
        let weightPE = 15;
        let weightVIX = 10;
        const weightUSDCNY = 15;

        if (vix > 25) {
            weightPE = 22;
            weight50MA = 8;
        } else if (vix < 15) {
            weight50MA = 20;
            weightVIX = 5;
        }

        const ma200Score = price > ma200 ? weight200MA : 0;
        const ma50Score = (price > ma50 && ma50Up) ? weight50MA : (price > ma50 ? weight50MA * 0.6 : 0);
        const peScore = clamp((35 - pe) / 10 * weightPE, 0, weightPE);
        const vixScore = clamp((vix - 15) / 15 * weightVIX, 0, weightVIX);
        const exchangeScore = clamp((7.35 - usdcny) / 0.35 * weightUSDCNY, 0, weightUSDCNY);

        total = ma200Score + ma50Score + peScore + vixScore + exchangeScore;
        breakdown = [
            { name: '长期趋势支撑 (200MA)', value: price > ma200 ? '均线上偏离 +' + ((price-ma200)/ma200*100).toFixed(1) + '%' : '线下破位偏离 -' + ((ma200-price)/ma200*100).toFixed(1) + '%', score: Math.round(ma200Score), max: weight200MA },
            { name: '中期势能趋势 (50MA)', value: (price > ma50 ? '线上' : '线下') + ' / ' + (ma50Up ? '50MA趋势向上' : '50MA趋势向下'), score: Math.round(ma50Score), max: weight50MA },
            { name: '估值性价比 (PE)', value: '滚动PE: ' + pe.toFixed(1), score: Math.round(peScore), max: weightPE },
            { name: '恐慌情绪因子 (VIX)', value: 'VIX: ' + vix.toFixed(1), score: Math.round(vixScore), max: weightVIX },
            { name: 'QDII反向汇率避险 (USD/CNY)', value: '美元/人民币: ' + usdcny.toFixed(3), score: Math.round(exchangeScore), max: weightUSDCNY }
        ];
    } else if (id === 'csi300') {
        // CSI300 (A股) Swing Logic: 200MA(25), 50MA(15), PE(15), RSI(15), Sino-US spread (10)
        const weight200MA = 25;
        const weight50MA = 15;
        const weightPE = 15;
        const weightRSI = 15;
        const weightSinoUS = 10;

        const ma200Score = price > ma200 ? weight200MA : 0;
        const ma50Score = (price > ma50 && ma50Up) ? weight50MA : (price > ma50 ? weight50MA * 0.6 : 0);
        const peScore = clamp((14 - pe) / 4 * weightPE, 0, weightPE);
        
        let rsiScore = 10;
        if (rsi >= 45 && rsi <= 65) {
            rsiScore = weightRSI;
        } else if (rsi > 65) {
            rsiScore = clamp(weightRSI - (rsi - 65) / 10 * 10, 5, weightRSI);
        } else {
            rsiScore = clamp((rsi - 30) / 15 * weightRSI, 0, weightRSI);
        }

        // Global risk-free rate spread proxy (lower US yield supports EM bluechips capital inflows)
        const spreadScore = clamp((5.0 - tnx) / 1.5 * weightSinoUS, 0, weightSinoUS);

        total = ma200Score + ma50Score + peScore + rsiScore + spreadScore;
        breakdown = [
            { name: '长期趋势 (200MA)', value: price > ma200 ? '均线上方' : '均线下方', score: Math.round(ma200Score), max: weight200MA },
            { name: '中期动能 (50MA)', value: (price > ma50 ? '线上' : '线下') + ' / ' + (ma50Up ? '向上' : '向下'), score: Math.round(ma50Score), max: weight50MA },
            { name: '估值水平 (PE)', value: '蓝筹复合PE: ' + pe.toFixed(1), score: Math.round(peScore), max: weightPE },
            { name: '情绪强弱 (RSI)', value: 'RSI: ' + rsi.toFixed(1), score: Math.round(rsiScore), max: weightRSI },
            { name: '中美利差流动性 (Sino-US)', value: '美10Y国债收益率: ' + tnx.toFixed(2) + '%', score: Math.round(spreadScore), max: weightSinoUS }
        ];
    } else if (id === 'gold') {
        // Gold Swing Logic: 200MA(30), 50MA(20), RSI(20), Drawdown(10)
        const ma200Score = price > ma200 ? 30 : 0;
        const ma50Score = (price > ma50 && ma50Up) ? 20 : 0;
        
        let rsiScore = 10;
        if (rsi >= 45 && rsi <= 65) {
            rsiScore = 20;
        } else if (rsi > 65) {
            rsiScore = clamp(20 - (rsi - 65) / 15 * 15, 5, 20);
        } else {
            rsiScore = clamp((rsi - 35) / 10 * 20, 0, 20);
        }

        const ddVal = Math.abs(drawdown);
        const ddScore = clamp(10 - (ddVal - 3) / 7 * 10, 0, 10);

        total = ma200Score + ma50Score + rsiScore + ddScore;
        breakdown = [
            { name: '长期趋势支撑 (200MA)', value: price > ma200 ? '均线上方' : '均线破位', score: Math.round(ma200Score), max: 30 },
            { name: '中期均线强度 (50MA)', value: price > ma50 ? '线上支撑' : '线下偏远', score: Math.round(ma50Score), max: 20 },
            { name: '情绪强度趋势 (RSI)', value: 'RSI: ' + rsi.toFixed(1), score: Math.round(rsiScore), max: 20 },
            { name: '高点回踩深度 (Drawdown)', value: '历史回撤: ' + drawdown.toFixed(1) + '%', score: Math.round(ddScore), max: 10 }
        ];
    } else { // bond
        // Bond Swing Logic: 200MA(25), 50MA(15), DD(20), Volatility(10), Rate spread(10)
        const devPct = ((price - ma200) / ma200) * 100;
        const ma200Score = clamp((devPct / 1.5) * 25, 0, 25);
        const ma50Score = (price > ma50 && ma50Up) ? 15 : 0;
        const ddVal = Math.abs(drawdown);
        const ddScore = clamp((1.5 - ddVal) / 1.5 * 20, 0, 20);
        const volScore = clamp((0.8 - volatility) / 0.6 * 10, 0, 10);
        const rateWindowScore = clamp((5.0 - tnx) / 1.5 * 10, 0, 10);

        total = ma200Score + ma50Score + ddScore + volScore + rateWindowScore;
        breakdown = [
            { name: '长期趋势支撑 (200MA)', value: '向上偏离: +' + devPct.toFixed(2) + '%', score: Math.round(ma200Score), max: 25 },
            { name: '中期均线状态 (50MA)', value: price > ma50 ? '线上上行' : '线下破位', score: Math.round(ma50Score), max: 15 },
            { name: '最高回撤防守控制', value: '最高回撤: ' + drawdown.toFixed(2) + '%', score: Math.round(ddScore), max: 20 },
            { name: '资产历史波动率 (Volatility)', value: '20D波动率: ' + volatility.toFixed(2) + '%', score: Math.round(volScore), max: 10 },
            { name: '中美宏观降息窗口 (US10Y)', value: '外围无风险债率: ' + tnx.toFixed(2) + '%', score: Math.round(rateWindowScore), max: 10 }
        ];
    }

    return {
        total: Math.round(total),
        breakdown
    };
}

// 🧘 长期定投视图（DCA View）
function calculateDCAScore(
    id: string, 
    price: number, 
    ma200: number, 
    ma50: number,
    rsi: number, 
    drawdown: number, 
    pe: number, 
    vix: number, 
    volatility: number,
    usdcny: number,
    tnx: number
) {
    // Parameter normalization & safety guards
    price = typeof price === 'number' && !isNaN(price) ? price : 1;
    ma200 = typeof ma200 === 'number' && !isNaN(ma200) && ma200 > 0 ? ma200 : price;
    ma50 = typeof ma50 === 'number' && !isNaN(ma50) && ma50 > 0 ? ma50 : price;
    pe = typeof pe === 'number' && !isNaN(pe) ? pe : (id === 'ndx' ? 28 : (id === 'csi300' ? 11.8 : 0));
    vix = typeof vix === 'number' && !isNaN(vix) ? vix : 15;
    usdcny = typeof usdcny === 'number' && !isNaN(usdcny) ? usdcny : 7.23;
    tnx = typeof tnx === 'number' && !isNaN(tnx) ? tnx : 4.25;
    rsi = typeof rsi === 'number' && !isNaN(rsi) ? rsi : 50;
    drawdown = typeof drawdown === 'number' && !isNaN(drawdown) ? drawdown : 0;
    volatility = typeof volatility === 'number' && !isNaN(volatility) ? volatility : 0.2;

    let breakdown: any[] = [];
    let total = 0;

    if (id === 'ndx') {
        // QQQ (美股) DCA Logic: PE(25), VIX(15), 200MA(15), DD(15), USDCNY exchange rate buffer (10)
        // DRRW: VIX 恐慌时提高 PE 性价比权重，降低均向势头要求。
        let weightPE = 25;
        let weightVIX = 15;
        const weight200MA = 15;
        const weightDrawdown = 15;
        const weightExchange = 10;

        if (vix > 25) {
            weightPE = 30;
            weightVIX = 10;
        }

        const peScore = clamp((35 - pe) / 10 * weightPE, 0, weightPE);
        const vixScore = clamp((vix - 15) / 15 * weightVIX, 0, weightVIX);
        const devPct = ((price - ma200) / ma200) * 100;
        const ma200Score = price <= ma200 ? weight200MA : clamp(weight200MA - (devPct / 15) * weight200MA, 0, weight200MA);
        const ddVal = Math.abs(drawdown);
        const ddScore = clamp((ddVal / 15) * weightDrawdown, 0, weightDrawdown);
        const exchangeScore = clamp((7.35 - usdcny) / 0.35 * weightExchange, 0, weightExchange);

        total = peScore + vixScore + ma200Score + ddScore + exchangeScore;
        breakdown = [
            { name: '低估吸筹 (PE性价比)', value: '滚动估值PE: ' + pe.toFixed(1), score: Math.round(peScore), max: weightPE },
            { name: '恐慌吸筹 (VIX情绪)', value: 'VIX: ' + vix.toFixed(1), score: Math.round(vixScore), max: weightVIX },
            { name: '长期生存空间 (200MA)', value: price <= ma200 ? '均红利区下方' : '均上溢价 +' + devPct.toFixed(1) + '%', score: Math.round(ma200Score), max: weight200MA },
            { name: '危机回撤空间 (Drawdown)', value: '最大回撤: ' + drawdown.toFixed(1) + '%', score: Math.round(ddScore), max: weightDrawdown },
            { name: 'QDII汇率避险系数 (USD/CNY)', value: '美元/人民币: ' + usdcny.toFixed(3), score: Math.round(exchangeScore), max: weightExchange }
        ];
    } else if (id === 'csi300') {
        const weightPE = 25;
        const weight200MA = 15;
        const weightRSI = 15;
        const weightDrawdown = 15;
        const weightSinoUS = 10;

        const peScore = clamp((14 - pe) / 4 * weightPE, 0, weightPE);
        const devPct = ((price - ma200) / ma200) * 100;
        const ma200Score = price <= ma200 ? weight200MA : clamp(weight200MA - (devPct / 15) * weight200MA, 0, weight200MA);
        const rsiScore = rsi <= 30 ? weightRSI : clamp((70 - rsi) / 40 * weightRSI, 0, weightRSI);
        const ddVal = Math.abs(drawdown);
        const ddScore = clamp((ddVal / 20) * weightDrawdown, 0, weightDrawdown);
        const spreadScore = clamp((5.0 - tnx) / 1.5 * weightSinoUS, 0, weightSinoUS);

        total = peScore + ma200Score + rsiScore + ddScore + spreadScore;
        breakdown = [
            { name: '蓝筹低估加分 (PE)', value: '核心估值PE: ' + pe.toFixed(1), score: Math.round(peScore), max: weightPE },
            { name: '筑底生存空间 (200MA)', value: price <= ma200 ? '超值筑底层 (低于均线)' : '均上溢价 +' + devPct.toFixed(1) + '%', score: Math.round(ma200Score), max: weight200MA },
            { name: '情绪超卖加分 (RSI)', value: '市场RSI: ' + rsi.toFixed(1), score: Math.round(rsiScore), max: weightRSI },
            { name: '回撤保护边界 (Drawdown)', value: '最大回撤: ' + drawdown.toFixed(1) + '%', score: Math.round(ddScore), max: weightDrawdown },
            { name: '中美偏离避险 (US10Y)', value: '美10Y国债收益率: ' + tnx.toFixed(2) + '%', score: Math.round(spreadScore), max: weightSinoUS }
        ];
    } else if (id === 'gold') {
        // Gold DCA Logic: 200MA(30), RSI(20), 50MA(20), DD(10)
        let devPct = ((price - ma200) / ma200) * 100;
        const ma200Score = price <= ma200 ? 30 : clamp(30 - (devPct / 15) * 15, 15, 30);
        const rsiScore = rsi <= 40 ? 20 : clamp((70 - rsi) / 30 * 20, 0, 20);
        const dev50Pct = ((price - ma50) / ma50) * 100;
        const ma50Score = price <= ma50 ? 20 : clamp(20 - (dev50Pct / 5) * 20, 0, 20);
        const ddVal = Math.abs(drawdown);
        const ddScore = clamp((ddVal / 12) * 10, 0, 10);

        total = ma200Score + rsiScore + ma50Score + ddScore;
        breakdown = [
            { name: '长线建仓空间 (200MA)', value: price <= ma200 ? '均红利区下方' : '均上偏离 +' + devPct.toFixed(1) + '%', score: Math.round(ma200Score), max: 30 },
            { name: '超卖情绪评估 (RSI)', value: 'RSI: ' + rsi.toFixed(1), score: Math.round(rsiScore), max: 20 },
            { name: '中期安全回落 (50MA)', value: price <= ma50 ? '50MA便宜区下方' : '偏离 +' + dev50Pct.toFixed(1) + '%', score: Math.round(ma50Score), max: 20 },
            { name: '极限回踩吸金 (Drawdown)', value: '近期回撤: ' + drawdown.toFixed(1) + '%', score: Math.round(ddScore), max: 10 }
        ];
    } else { // bond
        // Bond DCA Logic based on Underlying Yield Expected Safety
        // Higher pricing above averages represents heavily compressed yields (low return expectancy risks). We penalize.
        const devPct = ((price - ma200) / ma200) * 100;
        const ma200Score = price <= ma200 ? 30 : clamp(30 - (devPct / 1.5) * 30, 0, 30);
        const dev50Pct = ((price - ma50) / ma50) * 100;
        const ma50Score = price <= ma50 ? 15 : clamp(15 - (dev50Pct / 0.8) * 15, 0, 15);
        const ddVal = Math.abs(drawdown);
        const ddScore = clamp((1.5 - ddVal) / 1.5 * 20, 0, 20);
        const volScore = clamp((0.5 - volatility) / 0.3 * 15, 0, 15);

        total = ma200Score + ma50Score + ddScore + volScore;
        breakdown = [
            { name: '利率反向低吸安全区 (200MA)', value: price <= ma200 ? '宏观超值低估区' : '高位偏离 +' + devPct.toFixed(2) + '%', score: Math.round(ma200Score), max: 30 },
            { name: '中期偏折限额 (50MA)', value: price <= ma50 ? '底部分段保护' : '均上偏离 +' + dev50Pct.toFixed(2) + '%', score: Math.round(ma50Score), max: 15 },
            { name: '历史极限回撤 (Drawdown)', value: '最高回撤: ' + drawdown.toFixed(2) + '%', score: Math.round(ddScore), max: 20 },
            { name: '平滑极窄波动 (Volatility)', value: '波动标准差: ' + volatility.toFixed(2) + '%', score: Math.round(volScore), max: 15 }
        ];
    }

    return {
        total: Math.round(total),
        breakdown
    };
}

const getHistoricalMacro = (dateStr: string, map: Map<string, number>, defaultValue: number): number => {
    if (map && map.has(dateStr)) {
        const val = map.get(dateStr);
        if (val !== null && val !== undefined && !isNaN(val)) return val;
    }
    const d = new Date(dateStr);
    for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
        const prevDate = new Date(d);
        prevDate.setDate(d.getDate() - dayOffset);
        const prevStr = prevDate.toISOString().split('T')[0];
        if (map && map.has(prevStr)) {
            const val = map.get(prevStr);
            if (val !== null && val !== undefined && !isNaN(val)) return val;
        }
    }
    return defaultValue;
};

async function fetchMarketData(
    id: string, 
    name: string, 
    benchmarkSymbol: string, 
    etfSymbols: {symbol: string, name: string, fee?: string}[], 
    useVix = false,
    usdcnyPrice: number,
    usdcnyMap: Map<string, number>,
    tnxPrice: number,
    tnxMap: Map<string, number>
): Promise<MarketData> {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 2);

    const promises: Promise<any>[] = [
        yahooFinance.quote(benchmarkSymbol),
        yahooFinance.chart(benchmarkSymbol, { period1, interval: '1d' }).catch(() => ({ quotes: [] }))
    ];
    if (useVix) {
        promises.push(yahooFinance.quote('^VIX'));
        promises.push(yahooFinance.chart('^VIX', { period1, interval: '1d' }).catch(() => ({ quotes: [] })));
    }

    const results = await Promise.all(promises);
    const benchmarkQuote = results[0];
    const benchmarkHistory = results[1].quotes || [];
    const vixQuote = useVix ? results[2] : null;
    const vixHistory = useVix ? results[3]?.quotes || [] : [];

    const vixValue = vixQuote?.regularMarketPrice || 15;

    // Separate ETF and OTC funds
    const tencentEtfs = etfSymbols.filter(e => !e.symbol.startsWith('f_'));
    const otcFunds = etfSymbols.filter(e => e.symbol.startsWith('f_'));

    // Process History to calculate Technicals & Scores
    const vixMap = new Map();
    if (useVix) {
        vixHistory.forEach((q: any) => {
            if (q.date && q.close !== null && q.close !== undefined && !isNaN(q.close)) {
                vixMap.set(q.date.toISOString().split('T')[0], q.close);
            }
        });
    }

    const chartData: ChartDataPoint[] = [];
    const historyLengths = benchmarkHistory.length;
    
    let closes: number[] = [];
    const ma200WindowSize = 200;
    let yearHigh = 0;

    let finalRsi = 50;
    let finalMa50Up = true;

    for (let i = 0; i < historyLengths; i++) {
        const dateStr = benchmarkHistory[i].date.toISOString().split('T')[0];
        const close = benchmarkHistory[i].close;
        if (!close) continue;
        closes.push(close);
        
        if (closes.length > ma200WindowSize) closes.shift();
        
        const ma200 = closes.reduce((a, b) => a + b, 0) / closes.length;
        const trendPct = ((close - ma200) / ma200) * 100;
        
        if (close > yearHigh) yearHigh = close;
        const drawdown = yearHigh ? ((close - yearHigh) / yearHigh) * 100 : 0;

        const cp: any = {
            date: dateStr,
            close: close,
            trend: trendPct,
            drawdown: drawdown
        };

        if (i >= 14) {
            const histSlice = benchmarkHistory.slice(0, i + 1);
            cp.rsi = calculateRSI(histSlice, 14);
        } else {
            cp.rsi = 50;
        }

        const recent50 = closes.slice(-50);
        const ma50 = recent50.reduce((a, b) => a + b, 0) / Math.min(closes.length, 50);

        const recent50Prev = closes.slice(-51, -1);
        const ma50Prev = recent50Prev.length > 0 ? (recent50Prev.reduce((a, b) => a + b, 0) / Math.min(closes.length - 1, 50)) : ma50;
        const ma50Up = ma50 >= ma50Prev;

        if (i === historyLengths - 1) {
            finalRsi = cp.rsi;
            finalMa50Up = ma50Up;
        }

        if (i >= 20) {
            const recent = closes.slice(-20);
            const mean = recent.reduce((a,b)=>a+b, 0) / recent.length;
            const variance = recent.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / recent.length;
            cp.volatility = (Math.sqrt(variance) / mean) * 100;
        } else {
            cp.volatility = 0;
        }

        const histVix = useVix ? (vixMap.get(dateStr) || vixValue) : 15;
        const histPe = (id === 'ndx' ? (benchmarkQuote.trailingPE || 28) : (id === 'csi300' ? 11.8 : 0)) * (close / (benchmarkQuote.regularMarketPrice || close));
        const histVolatility = cp.volatility || 0.2;
        const histUsdcny = getHistoricalMacro(dateStr, usdcnyMap, usdcnyPrice);
        const histTnx = getHistoricalMacro(dateStr, tnxMap, tnxPrice);

        // Store unconditionally in cp to support full explanation trace in the frontend
        cp.vix = histVix;
        cp.pe = histPe;
        cp.volatility = histVolatility;
        cp.usdcny = histUsdcny;
        cp.tnx = histTnx;

        // Calculate Swing & DCA scores for history
        const swingRes = calculateSwingScore(id, close, ma200, ma50, ma50Up, cp.rsi, drawdown, histPe, histVix, histVolatility, histUsdcny, histTnx);
        const dcaRes = calculateDCAScore(id, close, ma200, ma50, cp.rsi, drawdown, histPe, histVix, histVolatility, histUsdcny, histTnx);

        // Add 20 points of default premium score to historical test, assuming historical entry was done via OTC or 0-premium matching the scaling to 100
        cp.swingScore = Math.min(100, swingRes.total + 20);
        cp.dcaScore = Math.min(100, dcaRes.total + 20);
        cp.score = cp.swingScore; // Default legacy score

        if (i >= historyLengths - 252) {
            chartData.push(cp as ChartDataPoint);
        }
    }

    // Now calculate latest real-time scores
    const price = benchmarkQuote.regularMarketPrice || (closes.length > 0 ? closes[closes.length - 1] : 0);
    const ma200 = benchmarkQuote.twoHundredDayAverage || (closes.length > 0 ? closes.reduce((a, b) => a + b, 0) / closes.length : price);
    const ma50 = benchmarkQuote.fiftyDayAverage || (closes.length > 0 ? closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(closes.length, 50) : price);
    const high52 = benchmarkQuote.fiftyTwoWeekHigh || yearHigh;
    const drawdown = high52 ? ((price - high52) / high52) * 100 : 0;

    const latestVix = useVix ? vixValue : 15;
    const latestPe = id === 'ndx' ? (benchmarkQuote.trailingPE || 28) : (id === 'csi300' ? 11.8 : 0);
    const latestVolatility = chartData.length > 0 ? chartData[chartData.length - 1].volatility || 0.2 : 0.2;

    const latestSwing = calculateSwingScore(id, price, ma200, ma50, finalMa50Up, finalRsi, drawdown, latestPe, latestVix, latestVolatility, usdcnyPrice, tnxPrice);
    const latestDCA = calculateDCAScore(id, price, ma200, ma50, finalRsi, drawdown, latestPe, latestVix, latestVolatility, usdcnyPrice, tnxPrice);

    let etfResults: EtfInfo[] = [];
    if (tencentEtfs.length > 0) {
        try {
            const tencentRes = await fetch(`https://qt.gtimg.cn/q=${tencentEtfs.map(e => e.symbol).join(',')}`);
            const tencentText = await tencentRes.text();

            etfResults = tencentEtfs.map((etf) => {
                let etfPrice = 0;
                let prevClose = 0;
                let estimatedIopv = 0;
                let premiumPct = 0;
                
                const match = tencentText.match(new RegExp(`v_${etf.symbol}="(.*?)"`));
                if (match && match[1]) {
                    const parts = match[1].split('~');
                    if (parts.length > 78) {
                        etfPrice = parseFloat(parts[3]) || parseFloat(parts[4]) || 0;
                        prevClose = parseFloat(parts[4]);
                        premiumPct = parseFloat(parts[77]) || 0;
                        estimatedIopv = parseFloat(parts[78]) || 0;
                    }
                }

                if (!etfPrice && prevClose) etfPrice = prevClose;

                if (!estimatedIopv && etfPrice) {
                    const change = benchmarkQuote.regularMarketPrice && benchmarkQuote.regularMarketPreviousClose ? 
                        (benchmarkQuote.regularMarketPrice / benchmarkQuote.regularMarketPreviousClose) : 1;
                    estimatedIopv = prevClose * change;
                    if (!estimatedIopv) estimatedIopv = etfPrice * 0.99;
                    premiumPct = ((etfPrice - estimatedIopv) / estimatedIopv) * 100;
                }

                // 1. Swing Premium Score
                let swingPremiumScore = 0;
                if (premiumPct <= 0) swingPremiumScore = 20; 
                else if (premiumPct < 3) swingPremiumScore = 20 - (premiumPct / 3) * 20;

                let swingTotalScore = latestSwing.total + swingPremiumScore;
                let swingRecommendation = '';
                
                if (premiumPct > 3) {
                    swingTotalScore = 0;
                    swingRecommendation = '⚠️ 高溢价 (暂避)';
                } else if (swingTotalScore >= 70) {
                    swingRecommendation = '强烈买入 (右侧确立买入)';
                } else if (swingTotalScore >= 50) {
                    swingRecommendation = '买入 (突破加仓)';
                } else if (swingTotalScore >= 30) {
                    swingRecommendation = '持有 (正常回踩观察)';
                } else if (swingTotalScore >= 15) {
                    swingRecommendation = '减仓 (破位止损观望)';
                } else {
                    swingRecommendation = '清仓 (超买分批止盈)';
                }

                // 2. DCA Premium Score
                let dcaPremiumScore = 0;
                if (premiumPct <= 0) {
                    dcaPremiumScore = 20;
                } else if (premiumPct > 0 && premiumPct <= 0.5) {
                    dcaPremiumScore = 20 - premiumPct * 20;
                } else {
                    // Penalty of negative scoring for >0.5% premium inside DCA
                    dcaPremiumScore = Math.max(-20, 10 - (premiumPct - 0.5) * 40);
                }

                let dcaTotalScore = latestDCA.total + dcaPremiumScore;
                let dcaRecommendation = '';

                if (premiumPct > 3) {
                    dcaTotalScore = 0;
                    dcaRecommendation = '⚠️ 场内溢价过高 (建议转换或暂停买入)';
                } else if (premiumPct > 0.5) {
                    dcaTotalScore = Math.max(0, dcaTotalScore);
                    dcaRecommendation = '⚠️ 溢价过高 (建议换同类低溢价或暂停场内买入)';
                } else if (dcaTotalScore >= 70) {
                    dcaRecommendation = '强烈买入 (黄金吸筹窗口)';
                } else if (dcaTotalScore >= 50) {
                    dcaRecommendation = '买入 (分批低吸/常规定投)';
                } else if (dcaTotalScore >= 30) {
                    dcaRecommendation = '持有 (高位暂停扣款)';
                } else if (dcaTotalScore >= 15) {
                    dcaRecommendation = '减仓 (红盘控仓/暂停扣款)';
                } else {
                    dcaRecommendation = '清仓 (减少扣款/暂停定投观望)';
                }

                return {
                    symbol: etf.symbol.replace('sh', '').replace('sz', ''),
                    name: etf.name,
                    price: etfPrice,
                    estimatedIopv,
                    premiumPct,
                    
                    // Legacy values default to Swing
                    premiumScore: Math.round(swingPremiumScore),
                    totalScore: Math.round(swingTotalScore),
                    recommendation: swingRecommendation,
                    
                    fee: (etf as any).fee,
                    
                    // Specific dual attributes
                    swingPremiumScore: Math.round(swingPremiumScore),
                    swingTotalScore: Math.round(swingTotalScore),
                    swingRecommendation,
                    dcaPremiumScore: Math.round(dcaPremiumScore),
                    dcaTotalScore: Math.round(dcaTotalScore),
                    dcaRecommendation
                };
            });
        } catch (e) {
            console.error(`Tencent fetch failed for ${id}`);
        }
    }

    if (otcFunds.length > 0) {
        for (const otc of otcFunds) {
            try {
                const code = otc.symbol.replace('f_', '');
                const res = await fetch(`http://fundgz.1234567.com.cn/js/${code}.js`);
                const text = await res.text();
                const jsonStr = text.match(/jsonpgz\((.*)\);/);
                if (jsonStr && jsonStr[1]) {
                    const data = JSON.parse(jsonStr[1]);
                    const etfPrice = parseFloat(data.gsz) || parseFloat(data.dwjz);
                    const estimatedIopv = parseFloat(data.dwjz);
                    
                    let swingTotalScore = latestSwing.total + 20;
                    let swingRecommendation = '';
                    if (swingTotalScore >= 70) {
                        swingRecommendation = '强烈买入 (右侧确立买入)';
                    } else if (swingTotalScore >= 50) {
                        swingRecommendation = '买入 (突破加仓)';
                    } else if (swingTotalScore >= 30) {
                        swingRecommendation = '持有 (正常回踩观察)';
                    } else if (swingTotalScore >= 15) {
                        swingRecommendation = '减仓 (破位止损观望)';
                    } else {
                        swingRecommendation = '清仓 (超买分批止盈)';
                    }

                    let dcaTotalScore = latestDCA.total + 20;
                    let dcaRecommendation = '';
                    if (dcaTotalScore >= 70) {
                        dcaRecommendation = '强烈买入 (黄金吸筹窗口)';
                    } else if (dcaTotalScore >= 50) {
                        dcaRecommendation = '买入 (分批低吸/常规定投)';
                    } else if (dcaTotalScore >= 30) {
                        dcaRecommendation = '持有 (高位暂停扣款)';
                    } else if (dcaTotalScore >= 15) {
                        dcaRecommendation = '减仓 (红盘控仓/暂停扣款)';
                    } else {
                        dcaRecommendation = '清仓 (减少扣款/暂停定投观望)';
                    }

                    etfResults.push({
                        symbol: code,
                        name: otc.name,
                        price: etfPrice,
                        estimatedIopv,
                        premiumPct: 0,
                        
                        premiumScore: 20,
                        totalScore: Math.round(swingTotalScore),
                        recommendation: swingRecommendation,
                        
                        fee: (otc as any).fee,
                        
                        swingPremiumScore: 20,
                        swingTotalScore: Math.round(swingTotalScore),
                        swingRecommendation,
                        dcaPremiumScore: 20,
                        dcaTotalScore: Math.round(dcaTotalScore),
                        dcaRecommendation
                    });
                }
            } catch (e) {
                console.error(`Eastmoney fetch failed for ${otc.symbol}`, e);
            }
        }
    }

    return {
        id,
        name,
        quote: {
            price,
            changePct: benchmarkQuote.regularMarketChangePercent || 0
        },
        // Legacy fields set to Swing style
        marketScore: Math.round(latestSwing.total),
        breakdown: latestSwing.breakdown,
        etfs: etfResults,
        chartData,

        // Specific dual fields
        swingMarketScore: Math.round(latestSwing.total),
        dcaMarketScore: Math.round(latestDCA.total),
        swingBreakdown: latestSwing.breakdown,
        dcaBreakdown: latestDCA.breakdown
    };
}

export default async function handler(req: any, res: any) {
  try {
    console.log("Fetching global macro indicators...");
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 2);

    const [usdcnyQuote, usdcnyHistoryRes, tnxQuote, tnxHistoryRes] = await Promise.all([
        yahooFinance.quote('CNY=X').catch(() => ({ regularMarketPrice: 7.23 })),
        yahooFinance.chart('CNY=X', { period1, interval: '1d' }).catch(() => ({ quotes: [] })),
        yahooFinance.quote('^TNX').catch(() => ({ regularMarketPrice: 4.25 })),
        yahooFinance.chart('^TNX', { period1, interval: '1d' }).catch(() => ({ quotes: [] }))
    ]);

    const usdcnyPrice = usdcnyQuote?.regularMarketPrice || 7.23;
    const tnxPrice = tnxQuote?.regularMarketPrice || 4.25;

    const usdcnyMap = new Map<string, number>();
    const usdcnyHistory = usdcnyHistoryRes.quotes || [];
    usdcnyHistory.forEach((q: any) => {
        if (q.date && q.close !== null && q.close !== undefined && !isNaN(q.close)) {
            usdcnyMap.set(new Date(q.date).toISOString().split('T')[0], q.close);
        }
    });

    const tnxMap = new Map<string, number>();
    const tnxHistory = tnxHistoryRes.quotes || [];
    tnxHistory.forEach((q: any) => {
        if (q.date && q.close !== null && q.close !== undefined && !isNaN(q.close)) {
            tnxMap.set(new Date(q.date).toISOString().split('T')[0], q.close);
        }
    });

    console.log(`USD/CNY Latest: ${usdcnyPrice}, TNX Latest: ${tnxPrice}. Starting parallel fetch for target classes...`);
    
    const markets = await Promise.all([
        fetchMarketData(
            'ndx',
            '纳斯达克100',
            'QQQ',
            req.body?.markets?.find((m: any) => m.id === 'ndx')?.etfSymbols || [
                { symbol: 'sh513100', name: '国泰纳指100ETF (513100)', fee: '0.80% / 年' },
                { symbol: 'sz159941', name: '广发纳指100ETF (159941)', fee: '0.80% / 年' },
                { symbol: 'sh513110', name: '华安纳指100ETF (513110)', fee: '0.80% / 年' },
                { symbol: 'sh513300', name: '华夏纳指100ETF (513300)', fee: '0.80% / 年' },
                { symbol: 'f_016452', name: '华夏纳斯达克100QDII-C (016452)', fee: '0.80% / 年' },
                { symbol: 'f_000834', name: '大成纳斯达克100QDII-A (000834)', fee: '0.80% / 年' },
                { symbol: 'f_040046', name: '华安纳斯达克100QDII-A (040046)', fee: '0.80% / 年' },
                { symbol: 'f_019524', name: '易方达纳斯达克100QDII-人民币A (019524)', fee: '0.80% / 年' },
                { symbol: 'f_270042', name: '广发纳斯达克100QDII-A (270042)', fee: '0.80% / 年' }
            ],
            true,
            usdcnyPrice,
            usdcnyMap,
            tnxPrice,
            tnxMap
        ),
        fetchMarketData(
            'csi300',
            '沪深300',
            '000300.SS',
            req.body?.markets?.find((m: any) => m.id === 'csi300')?.etfSymbols || [
                { symbol: 'sh510300', name: '华泰柏瑞300 (510300)', fee: '0.20% / 年' },
                { symbol: 'sh510310', name: '易方达沪深300 (510310)', fee: '0.20% / 年' },
                { symbol: 'sz159919', name: '嘉实沪深300 (159919)', fee: '0.60% / 年' }
            ],
            false,
            usdcnyPrice,
            usdcnyMap,
            tnxPrice,
            tnxMap
        ),
        fetchMarketData(
            'gold',
            '黄金',
            'GC=F',
            req.body?.markets?.find((m: any) => m.id === 'gold')?.etfSymbols || [
                { symbol: 'sh518880', name: '华安黄金ETF (518880)', fee: '0.60% / 年' },
                { symbol: 'sh518800', name: '国泰黄金ETF (518800)', fee: '0.60% / 年' },
                { symbol: 'sz159934', name: '易方达黄金ETF (159934)', fee: '0.60% / 年' },
                { symbol: 'sh518660', name: '工银黄金ETF (518660)', fee: '0.60% / 年' }
            ],
            false,
            usdcnyPrice,
            usdcnyMap,
            tnxPrice,
            tnxMap
        ),
        fetchMarketData(
            'bond',
            '国内债市',
            '511010.SS',
            req.body?.markets?.find((m: any) => m.id === 'bond')?.etfSymbols || [
                { symbol: 'f_003376', name: '广发中债7-10年国开债A (003376) [场外]', fee: '0.35% / 年' }
            ],
            false,
            usdcnyPrice,
            usdcnyMap,
            tnxPrice,
            tnxMap
        )
    ]);

    const data: DashboardData = {
      markets,
      lastUpdated: new Date().toISOString()
    };

    res.status(200).json(data);
  } catch (error: any) {
    console.error("Dashboard fetch error details:", error.stack);
    res.status(500).json({ error: "Failed to fetch market data", details: error.message });
  }
}
