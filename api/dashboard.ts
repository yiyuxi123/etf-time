import YahooFinance from 'yahoo-finance2';
import { DashboardData, ChartDataPoint, EtfInfo, MarketData, FactorBreakdown } from '../src/types';

const yf = new (YahooFinance as any)();

// Utils
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

async function fetchMarketData(id: string, name: string, benchmarkSymbol: string, etfSymbols: {symbol: string, name: string}[], scoreLogic: (quote: any, history: any[], vixValue?: number) => {score: number, breakdowns: FactorBreakdown[]}, useVix = false): Promise<MarketData> {
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

    // Tencent API fetch for ETFs
    let etfResults: EtfInfo[] = [];
    if (etfSymbols.length > 0) {
        try {
            const tencentRes = await fetch(`https://qt.gtimg.cn/q=${etfSymbols.map(e => e.symbol).join(',')}`);
            const tencentText = await tencentRes.text();

            etfResults = etfSymbols.map((etf) => {
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
                    recommendation
                };
            });
        } catch (e) {
            console.error(`Tencent fetch failed for ${id}`);
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

    for (let i = 0; i < historyLengths; i++) {
        const dateStr = benchmarkHistory[i].date.toISOString().split('T')[0];
        const close = benchmarkHistory[i].close;
        if (!close) continue;
        closes.push(close);
        
        let ma200 = close;
        if (closes.length > ma200WindowSize) closes.shift();
        
        const ma = closes.reduce((a, b) => a + b, 0) / closes.length;
        const trendPct = ((close - ma) / ma) * 100;

        const cp: any = {
            date: dateStr,
            close: close,
            trend: trendPct
        };

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
                { symbol: 'sh513100', name: '国泰纳指100 (513100)' },
                { symbol: 'sz159941', name: '广发纳指100 (159941)' },
                { symbol: 'sh513110', name: '华泰纳指100 (513110)' },
                { symbol: 'sh513300', name: '华夏纳斯达克 (513300)' }
            ],
            (quote, history, vixValue) => {
                const pe = quote.trailingPE || 30;
                const price = quote.regularMarketPrice || 0;
                const ma200 = quote.twoHundredDayAverage || price;

                let vixScore = clamp(((vixValue! - 15) / 15) * 20, 0, 20);
                let peScore = clamp(((35 - pe) / 15) * 40, 0, 40);
                const trendDiffPct = ((price - ma200) / ma200) * 100;
                let trendScore = clamp(((trendDiffPct + 5) / 10) * 20, 0, 20);
                
                return {
                    score: vixScore + peScore + trendScore,
                    breakdowns: [
                        { name: '市盈率 (PE)', value: pe, score: Math.round(peScore), max: 40 },
                        { name: '恐慌指数 (VIX)', value: vixValue!, score: Math.round(vixScore), max: 20 },
                        { name: '趋势偏离度', value: trendDiffPct, score: Math.round(trendScore), max: 20 }
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
                { symbol: 'sh510300', name: '华泰柏瑞300 (510300)' },
                { symbol: 'sh510310', name: '易方达沪深300 (510310)' },
                { symbol: 'sz159919', name: '嘉实沪深300 (159919)' }
            ],
            (quote, history) => {
                const pe = quote.trailingPE || 12;
                const price = quote.regularMarketPrice || 0;
                const ma200 = quote.twoHundredDayAverage || price;

                let peScore = clamp(((15 - pe) / 5) * 40, 0, 40);
                const trendDiffPct = ((price - ma200) / ma200) * 100;
                let trendScore = clamp(((trendDiffPct + 5) / 10) * 40, 0, 40);

                return {
                    score: peScore + trendScore,
                    breakdowns: [
                        { name: '市盈率 (PE)', value: pe, score: Math.round(peScore), max: 40 },
                        { name: '均线趋势', value: trendDiffPct, score: Math.round(trendScore), max: 40 }
                    ]
                };
            }
        ),
        fetchMarketData(
            'gold',
            '黄金',
            'GLD',
            [
                { symbol: 'sh518880', name: '华安黄金ETF (518880)' },
                { symbol: 'sh518800', name: '国泰黄金ETF (518800)' },
                { symbol: 'sz159934', name: '易方达黄金ETF (159934)' }
            ],
            (quote, history) => {
                const price = quote.regularMarketPrice || 0;
                const ma50 = quote.fiftyDayAverage || price;
                const ma200 = quote.twoHundredDayAverage || price;

                const trendDiff200 = ((price - ma200) / ma200) * 100;
                let trendScore200 = clamp(((trendDiff200 + 10) / 20) * 40, 0, 40);

                const trendDiff50 = ((price - ma50) / ma50) * 100;
                let trendScore50 = clamp(((trendDiff50 + 5) / 10) * 40, 0, 40);

                return {
                    score: trendScore200 + trendScore50,
                    breakdowns: [
                        { name: '长期趋势 (200MA)', value: trendDiff200, score: Math.round(trendScore200), max: 40 },
                        { name: '中期动能 (50MA)', value: trendDiff50, score: Math.round(trendScore50), max: 40 }
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
