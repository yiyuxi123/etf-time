import yahooFinanceLib from 'yahoo-finance2';
let YF = yahooFinanceLib;
if (typeof YF !== 'function' && typeof (YF as any).default === 'function') {
  YF = (YF as any).default;
}
const yahooFinance = new (YF as any)({ suppressNotices: ['yahooSurvey'] });

async function check() {
  const period1 = new Date();
  period1.setDate(period1.getDate() - 5);
  const chartRes = await yahooFinance.chart('GC=F', { period1, interval: '1d' });
  console.log("GC=F length:", chartRes.quotes.length);
}
check().catch(console.error);
