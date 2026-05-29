import YahooFinance from 'yahoo-finance2';
import { DashboardData, ChartDataPoint, EtfInfo, MarketData, FactorBreakdown } from '../src/types';

const yf = new (YahooFinance as any)();

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

async function fetchMarketData(id: string, name: string, benchmarkSymbol: string, etfSymbols: {symbol: string, name: string, fee?: string}[], scoreLogic: (quote: any, history: any[], vixValue?: number) => {score: number, breakdowns: FactorBreakdown[]}, useVix = false): Promise<MarketData> {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);

    const promises: Promise<any>[] = [
        yf.quote(benchmarkSymbol),
        yf.chart(benchmarkSymbol, { period1, interval: '1d' }).catch(() => ({ quotes: [] }))
    ];
    if (useVix) {
        promises.push(yf.quote('^VIX'));
        promises.push(yf.chart('^VIX', { period1, interval: '1d' }).catch(() => ({ quotes: [] })));
    }

    const results = await Promise.all(promises);
    const benchmarkQuote = results[0];
    const benchmarkHistory = results[1].quotes || [];
    const vixQuote = useVix ? results[2] : null;
    const vixHistory = useVix ? results[3]?.quotes || [] : [];

    const vixValue = vixQuote?.regularMarketPrice || 15;

    const { score, breakdowns } = scoreLogic(benchmarkQuote, benchmarkHistory, vixValue);

    // Separate ETF and OTC funds
    const tencentEtfs = etfSymbols.filter(e => !e.symbol.startsWith('f_'));
    const otcFunds = etfSymbols.filter(e => e.symbol.startsWith('f_'));

    let etfResults: EtfInfo[] = [];
    if (tencentEtfs.length > 0) {
        try {
            const tencentRes = await fetch(`https://qt.gtimg.cn/q=${tencentEtfs.map(e => e.symbol).join(',')}`);
            const tencentText = await tencentRes.text();

            etfResults = tencentEtfs.map((etf) => {
                let price = 0;
                let prevClose = 0;
                let estimatedIopv = 0;
                let premiumPct = 0;
                
                const match = tencentText.match(new RegExp(`v_${etf.symbol}="(.*?)"`));
                if (match && match[1]) {
                    const parts = match[1].split('~');
                    if (parts.length > 78) {
                        price = parseFloat(parts[3]) || parseFloat(parts[4]) || 0; // Current price
                        prevClose = parseFloat(parts[4]); // Previous close
                        premiumPct = parseFloat(parts[77]) || 0; // Tencent QDII Official Premium
                        estimatedIopv = parseFloat(parts[78]) || 0; // Tencent QDII Official T-1 NAV
                    }
                }

                if (!price && prevClose) price = prevClose;

                if (!estimatedIopv && price) {
                    const change = benchmarkQuote.regularMarketPrice && benchmarkQuote.regularMarketPreviousClose ? 
                        (benchmarkQuote.regularMarketPrice / benchmarkQuote.regularMarketPreviousClose) : 1;
                    estimatedIopv = prevClose * change;
                    if (!estimatedIopv) estimatedIopv = price * 0.99;
                    premiumPct = ((price - estimatedIopv) / estimatedIopv) * 100;
                }

                let premiumScore = 0;
                if (premiumPct <= 0) premiumScore = 20; 
                else if (premiumPct < 3) premiumScore = 20 - (premiumPct / 3) * 20;
                
                let totalScore = score + premiumScore;
                let recommendation = '';
                
                if (premiumPct > 3) {
                    totalScore = 0;
                    recommendation = '⚠️ 高溢价 (暂避)';
                } else if (totalScore >= 80) {
                    recommendation = '强烈买入 (建议加倍定投)';
                } else if (totalScore >= 60) {
                    recommendation = '买入 (维持正常定投)';
                } else if (totalScore >= 40) {
                    recommendation = '持有 (底仓留存观望)';
                } else if (totalScore >= 20) {
                    recommendation = '减仓 (逐步兑现利润)';
                } else {
                    recommendation = '清仓 (高风险区回避)';
                }

                return {
                    symbol: etf.symbol.replace('sh', '').replace('sz', ''),
                    name: etf.name,
                    price,
                    estimatedIopv,
                    premiumPct,
                    premiumScore: Math.round(premiumScore),
                    totalScore: Math.round(totalScore),
                    recommendation,
                    fee: (etf as any).fee
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
                    const price = parseFloat(data.gsz) || parseFloat(data.dwjz);
                    const estimatedIopv = parseFloat(data.dwjz); // use previous day NAV
                    
                    let totalScore = score + 20; // OTC funds have no premium risk, default full premium score (20)
                    let recommendation = '';
                    
                    if (totalScore >= 80) {
                        recommendation = '强烈买入 (建议加倍定投)';
                    } else if (totalScore >= 60) {
                        recommendation = '买入 (维持正常定投)';
                    } else if (totalScore >= 40) {
                        recommendation = '持有 (底仓留存观望)';
                    } else if (totalScore >= 20) {
                        recommendation = '减仓 (逐步兑现利润)';
                    } else {
                        recommendation = '清仓 (高风险区回避)';
                    }

                    etfResults.push({
                        symbol: code,
                        name: otc.name,
                        price,
                        estimatedIopv,
                        premiumPct: 0,
                        premiumScore: 20,
                        totalScore: Math.round(totalScore),
                        recommendation,
                        fee: (otc as any).fee
                    });
                }
            } catch (e) {
                console.error(`Eastmoney fetch failed for ${otc.symbol}`, e);
            }
        }
    }

    // Chart logic
    const vixMap = new Map();
    if (useVix) {
        vixHistory.forEach((q: any) => {
            if (q.date) vixMap.set(q.date.toISOString().split('T')[0], q.close);
        });
    }

    const chartData: ChartDataPoint[] = [];
    const historyLengths = benchmarkHistory.length;
    
    let windowSize = 50;
    let closes: number[] = [];
    let ma200WindowSize = 200;

    // For rolling factors
    let yearHigh = 0;

    for (let i = 0; i < historyLengths; i++) {
        const dateStr = benchmarkHistory[i].date.toISOString().split('T')[0];
        const close = benchmarkHistory[i].close;
        if (!close) continue;
        closes.push(close);
        
        let ma200 = close;
        if (closes.length > ma200WindowSize) closes.shift();
        
        const ma = closes.reduce((a, b) => a + b, 0) / closes.length;
        const trendPct = ((close - ma) / ma) * 100;
        
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

        if (i >= 20) {
            const recent = closes.slice(-20);
            const mean = recent.reduce((a,b)=>a+b, 0) / recent.length;
            const variance = recent.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / recent.length;
            cp.volatility = (Math.sqrt(variance) / mean) * 100;
        } else {
            cp.volatility = 0;
        }

        if (useVix) {
            cp.vix = vixMap.get(dateStr) || vixValue;
            cp.pe = (benchmarkQuote.trailingPE || 30) * (close / (benchmarkQuote.regularMarketPrice || close));
        }

        chartData.push(cp as ChartDataPoint);
    }

    return {
        id,
        name,
        marketScore: Math.round(score),
        quote: {
            price: benchmarkQuote.regularMarketPrice || 0,
            changePct: benchmarkQuote.regularMarketChangePercent || 0,
        },
        breakdown: breakdowns,
        etfs: etfResults,
        chartData
    };
}

export default async function handler(req: any, res: any) {
  try {
    console.log("Fetching fresh market data from Yahoo Finance...");
    
    const markets = await Promise.all([
        fetchMarketData(
            'ndx',
            '纳斯达克100',
            'QQQ',
            [
                { symbol: 'sh513100', name: '国泰纳指100 (513100)', fee: '0.80% / 年' },
                { symbol: 'sz159941', name: '广发纳指100 (159941)', fee: '0.80% / 年' },
                { symbol: 'sh513110', name: '华泰纳指100 (513110)', fee: '0.80% / 年' },
                { symbol: 'sh513300', name: '华夏纳斯达克 (513300)', fee: '0.80% / 年' }
            ],
            (quote, history, vixValue) => {
                const pe = quote.trailingPE || 30;
                const price = quote.regularMarketPrice || 0;
                const ma200 = quote.twoHundredDayAverage || price;
                const high52 = quote.fiftyTwoWeekHigh || price;

                let vixScore = clamp(((vixValue! - 15) / 15) * 20, 0, 20);
                let peScore = clamp(((35 - pe) / 10) * 30, 0, 30); // widened PE band
                
                const trendDiffPct = ma200 ? ((price - ma200) / ma200) * 100 : 0;
                let trendScore = clamp(((trendDiffPct + 5) / 10) * 15, 0, 15);

                const drawdown = high52 ? ((price - high52) / high52) * 100 : 0;
                let ddScore = clamp(((-drawdown) / 15) * 15, 0, 15);
                
                return {
                    score: vixScore + peScore + trendScore + ddScore,
                    breakdowns: [
                        { name: '市盈率 (PE)', value: pe, score: Math.round(peScore), max: 30 },
                        { name: '恐慌指数 (VIX)', value: vixValue!, score: Math.round(vixScore), max: 20 },
                        { name: '趋势规律 (200MA)', value: trendDiffPct, score: Math.round(trendScore), max: 15 },
                        { name: '危机阿尔法回撤', value: drawdown, score: Math.round(ddScore), max: 15 }
                    ]
                };
            },
            true
        ),
        fetchMarketData(
            'csi300',
            '沪深300',
            '000300.SS',
            [
                { symbol: 'sh510300', name: '华泰柏瑞300 (510300)', fee: '0.20% / 年' },
                { symbol: 'sh510310', name: '易方达沪深300 (510310)', fee: '0.20% / 年' },
                { symbol: 'sz159919', name: '嘉实沪深300 (159919)', fee: '0.60% / 年' }
            ],
            (quote, history) => {
                const pe = quote.trailingPE || 12;
                const price = quote.regularMarketPrice || 0;
                const ma200 = quote.twoHundredDayAverage || price;
                const high52 = quote.fiftyTwoWeekHigh || price;

                // A-share bottom PE is usually around 10, bubble PE > 15
                let peScore = clamp(((14 - pe) / 4) * 30, 0, 30);
                
                const trendDiff200 = ma200 ? ((price - ma200) / ma200) * 100 : 0;
                let trendScore = clamp(((trendDiff200 + 5) / 10) * 20, 0, 20);

                const rsi = calculateRSI(history, 14);
                // RSI oversold buy points
                let rsiScore = clamp(((70 - rsi) / 40) * 15, 0, 15);

                const drawdown = high52 ? ((price - high52) / high52) * 100 : 0;
                // A shares oversold bounce logic
                let ddScore = clamp(((-drawdown) / 20) * 15, 0, 15);

                return {
                    score: peScore + trendScore + rsiScore + ddScore,
                    breakdowns: [
                        { name: '市盈率 (PE)', value: pe, score: Math.round(peScore), max: 30 },
                        { name: '长期均线趋势', value: trendDiff200, score: Math.round(trendScore), max: 20 },
                        { name: '相对强弱 (RSI)', value: rsi, score: Math.round(rsiScore), max: 15 },
                        { name: '高点回撤率', value: drawdown, score: Math.round(ddScore), max: 15 }
                    ]
                };
            }
        ),
        fetchMarketData(
            'gold',
            '黄金',
            'GLD',
            [
                { symbol: 'sh518880', name: '华安黄金ETF (518880)', fee: '0.60% / 年' },
                { symbol: 'sh518800', name: '国泰黄金ETF (518800)', fee: '0.60% / 年' },
                { symbol: 'sz159934', name: '易方达黄金ETF (159934)', fee: '0.60% / 年' },
                { symbol: 'sh518660', name: '工银黄金ETF (518660)', fee: '0.60% / 年' }
            ],
            (quote, history) => {
                const price = quote.regularMarketPrice || 0;
                const ma50 = quote.fiftyDayAverage || price;
                const ma200 = quote.twoHundredDayAverage || price;
                const high52 = quote.fiftyTwoWeekHigh || price;

                const trendDiff200 = ma200 ? ((price - ma200) / ma200) * 100 : 0;
                let trendScore200 = clamp(((trendDiff200 + 5) / 10) * 30, 0, 30);

                const trendDiff50 = ma50 ? ((price - ma50) / ma50) * 100 : 0;
                let trendScore50 = clamp(((trendDiff50 + 2) / 5) * 20, 0, 20);

                const rsi = calculateRSI(history, 14);
                // Gold shouldn't be chased at high RSI
                let rsiScore = clamp(((70 - rsi) / 30) * 20, 0, 20);

                const drawdown = high52 ? ((price - high52) / high52) * 100 : 0;
                let ddScore = clamp(((-drawdown) / 10) * 10, 0, 10);

                return {
                    score: trendScore200 + trendScore50 + rsiScore + ddScore,
                    breakdowns: [
                        { name: '长期趋势 (200MA)', value: trendDiff200, score: Math.round(trendScore200), max: 30 },
                        { name: '中期动能 (50MA)', value: trendDiff50, score: Math.round(trendScore50), max: 20 },
                        { name: '情绪与超卖 (RSI)', value: rsi, score: Math.round(rsiScore), max: 20 },
                        { name: '高点回撤率', value: drawdown, score: Math.round(ddScore), max: 10 }
                    ]
                };
            }
        ),
        fetchMarketData(
            'bond',
            '国内债市',
            '511010.SS',
            [
                { symbol: 'f_003376', name: '广发中债7-10年国开债A (003376) [场外]', fee: '0.35% / 年' }
            ],
            (quote, history) => {
                const price = quote.regularMarketPrice || 0;
                const ma200 = quote.twoHundredDayAverage || price;
                const ma50 = quote.fiftyDayAverage || price;
                const high52 = quote.fiftyTwoWeekHigh || price;

                const trendDiff200 = ma200 ? ((price - ma200) / ma200) * 100 : 0;
                let trendScore = clamp(((trendDiff200 + 1) / 3) * 30, 0, 30);

                const trendDiff50 = ma50 ? ((price - ma50) / ma50) * 100 : 0;
                let momentScore = clamp(((trendDiff50 + 0.5) / 1.5) * 20, 0, 20);

                const drawdown = high52 ? ((price - high52) / high52) * 100 : 0;
                let ddScore = clamp(((drawdown + 1.5) / 1.5) * 20, 0, 20);

                let volScore = 10;
                let volatility = 0;
                const validHist = history.filter(h => h && h.close != null);
                if (validHist.length > 20) {
                    const recent = validHist.slice(-20).map(h => h.close);
                    const mean = recent.reduce((a,b)=>a+b, 0) / recent.length;
                    const variance = recent.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / recent.length;
                    volatility = (Math.sqrt(variance) / mean) * 100;
                    volScore = clamp(((1 - volatility) / 0.8) * 10, 0, 10);
                }

                return {
                    score: trendScore + momentScore + ddScore + volScore,
                    breakdowns: [
                        { name: '长期均线 (200MA)', value: trendDiff200, score: Math.round(trendScore), max: 30 },
                        { name: '中期动能 (50MA)', value: trendDiff50, score: Math.round(momentScore), max: 20 },
                        { name: '高点回撤防御', value: drawdown, score: Math.round(ddScore), max: 20 },
                        { name: '短期波动率 (20D)', value: volatility, score: Math.round(volScore), max: 10 }
                    ]
                };
            }
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
