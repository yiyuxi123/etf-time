import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
yf.quote('QQQ').then(res => console.log(res.regularMarketPrice));
