import YahooFinance from 'yahoo-finance2';
const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
async function test() {
  const res = await Promise.all([
    yf.quote('000300.SS'),
    yf.quote('GLD')
  ]);
  console.log(res.map(r => r.regularMarketPrice));
}
test();
