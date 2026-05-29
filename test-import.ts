import defaultExport from 'yahoo-finance2';
const YahooFinanceClass = defaultExport.default ? defaultExport.default : defaultExport;
const yfInstance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
console.log('type:', typeof yfInstance);
yfInstance.quote('AAPL').then(() => console.log('OK')).catch((e:any) => console.error('ERR', e.message));
