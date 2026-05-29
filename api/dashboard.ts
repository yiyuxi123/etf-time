import defaultExport from 'yahoo-finance2';
import { DashboardData, ChartDataPoint, EtfInfo } from '../src/types';

// @ts-ignore
const YahooFinanceClass = defaultExport.default ? defaultExport.default : defaultExport;
const yfInstance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export default async function handler(req: any, res: any) {
  try {
    console.log("Fetching fresh market data from Yahoo Finance...");
    
    // 1. Fetch VIX and QQQ (as Nasdaq 100 proxy)
    const [vixQuote, qqqQuote] = await Promise.all([
      yfInstance.quote('^VIX'),
      yfInstance.quote('QQQ')
    ]);

    const vixValue = vixQuote.regularMarketPrice || 15;
    const qqqPrice = qqqQuote.regularMarketPrice || 0;
    const qqqPE = qqqQuote.trailingPE || 30; // fallback PE
    const qqq200MA = qqqQuote.twoHundredDayAverage || qqqPrice;

    // Calculate Market Score Components
    // Sentiment (VIX): 20 pts. VIX >= 30 -> 20pts, VIX <= 15 -> 0pts
    let vixScore = ((vixValue - 15) / 15) * 20;
    vixScore = Math.max(0, Math.min(20, vixScore));

    // Valuation (PE): 40 pts. PE <= 20 -> 40pts, PE >= 35 -> 0pts
    let peScore = ((35 - qqqPE) / 15) * 40;
    peScore = Math.max(0, Math.min(40, peScore));

    // Trend (QQQ vs 200MA): 20 pts. Price >= 200MA + 5% -> 20pts, Price <= 200MA - 5% -> 0pts
    const trendDiffPct = ((qqqPrice - qqq200MA) / qqq200MA) * 100;
    let trendScore = ((trendDiffPct + 5) / 10) * 20;
    trendScore = Math.max(0, Math.min(20, trendScore));

    const marketScore = vixScore + peScore + trendScore;

    // 2. Fetch ETF data from Tencent API
    const targetETFs = [
      { symbol: 'sh513100', name: '国泰纳指100 (513100)' },
      { symbol: 'sz159941', name: '广发纳指100 (159941)' },
      { symbol: 'sh513110', name: '华泰柏瑞纳指 (513110)' },
      { symbol: 'sh513300', name: '华夏纳斯达克 (513300)' }
    ];

    // Fetch from Tencent API
    const tencentRes = await fetch(`https://qt.gtimg.cn/q=${targetETFs.map(e => e.symbol).join(',')}`);
    const tencentText = await tencentRes.text();

    const etfResults: EtfInfo[] = targetETFs.map((etf) => {
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
          const qqqChange = qqqQuote.regularMarketPrice && qqqQuote.regularMarketPreviousClose ? 
            (qqqQuote.regularMarketPrice / qqqQuote.regularMarketPreviousClose) : 1;
          estimatedIopv = prevClose * qqqChange;
          if (!estimatedIopv) estimatedIopv = price * 0.99;
          premiumPct = ((price - estimatedIopv) / estimatedIopv) * 100;
      }

      let premiumScore = 0;
      if (premiumPct <= 0) premiumScore = 20; 
      else if (premiumPct < 3) premiumScore = 20 - (premiumPct / 3) * 20;
      
      let totalScore = marketScore + premiumScore;
      let recommendation = '';
      
      if (premiumPct > 3) {
        totalScore = 0;
        recommendation = '⚠️ 溢价过高 (暂停买入)';
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

    // 3. Historical K-Line chart data (1 year)
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    
    const [historyRes, vixHistoryRes] = await Promise.all([
      yfInstance.chart('QQQ', { period1, interval: '1d' }),
      yfInstance.chart('^VIX', { period1, interval: '1d' })
    ]);

    const history = historyRes.quotes || [];
    const vixHistory = vixHistoryRes.quotes || [];
    
    const vixMap = new Map();
    vixHistory.forEach((q: any) => {
      if (q.date) vixMap.set(q.date.toISOString().split('T')[0], q.close);
    });

    const chartData: ChartDataPoint[] = [];
    const historyLengths = history.length;
    
    let windowSize = 50;
    let closes: number[] = [];

    for (let i = 0; i < historyLengths; i++) {
      const dateStr = history[i].date.toISOString().split('T')[0];
      const close = history[i].close;
      closes.push(close);
      if (closes.length > windowSize) {
          closes.shift();
      }
      const ma = closes.reduce((a, b) => a + b, 0) / closes.length;
      
      const estimatedHistoricalPe = qqqPE * (close / qqqPrice);
      const trendPct = ((close - ma) / ma) * 100;

      chartData.push({
        date: dateStr,
        close: close,
        vix: vixMap.get(dateStr) || vixValue, 
        pe: estimatedHistoricalPe,
        trend: trendPct
      } as any);
    }

    const data: DashboardData = {
      marketScore: Math.round(marketScore),
      qqqQuote: {
        price: qqqQuote.regularMarketPrice || 0,
        changePct: qqqQuote.regularMarketChangePercent || 0,
      },
      breakdown: {
        pe: { value: qqqPE, score: Math.round(peScore), max: 40 },
        vix: { value: vixValue, score: Math.round(vixScore), max: 20 },
        trend: { value: trendDiffPct, score: Math.round(trendScore), max: 20 }
      },
      etfs: etfResults,
      chartData: chartData,
      lastUpdated: new Date().toISOString()
    };

    res.status(200).json(data);
  } catch (error: any) {
    console.error("Dashboard fetch error details:", error.stack);
    res.status(500).json({ error: "Failed to fetch market data", details: error.message });
  }
}
