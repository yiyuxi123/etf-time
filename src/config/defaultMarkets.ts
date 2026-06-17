export const defaultMarketsConfig = [
    {
        id: 'ndx',
        name: '纳斯达克100',
        benchmarkSymbol: 'QQQ',
        etfSymbols: [
            { symbol: 'sh513100', name: '国泰纳指100ETF (513100)', fee: '0.80% / 年' },
            { symbol: 'sz159941', name: '广发纳指100ETF (159941)', fee: '0.80% / 年' },
            { symbol: 'sh513110', name: '华安纳指100ETF (513110)', fee: '0.80% / 年' },
            { symbol: 'sh513300', name: '华夏纳指100ETF (513300)', fee: '0.80% / 年' },
            { symbol: 'f_016452', name: '华夏纳斯达克100QDII-C (016452)', fee: '0.80% / 年' },
            { symbol: 'f_000834', name: '大成纳斯达克100QDII-A (000834)', fee: '0.80% / 年' },
            { symbol: 'f_040046', name: '华安纳斯达克100QDII-A (040046)', fee: '0.80% / 年' },
            { symbol: 'f_019524', name: '易方达纳斯达克100QDII-人民币A (019524)', fee: '0.80% / 年' },
            { symbol: 'f_270042', name: '广发纳斯达克100QDII-A (270042)', fee: '0.80% / 年' }
        ]
    },
    {
        id: 'csi300',
        name: '沪深300',
        benchmarkSymbol: '000300.SS',
        etfSymbols: [
            { symbol: 'sh510300', name: '华泰柏瑞300 (510300)', fee: '0.20% / 年' },
            { symbol: 'sh510310', name: '易方达沪深300 (510310)', fee: '0.20% / 年' },
            { symbol: 'sz159919', name: '嘉实沪深300 (159919)', fee: '0.60% / 年' }
        ]
    },
    {
        id: 'gold',
        name: '黄金',
        benchmarkSymbol: 'GC=F',
        etfSymbols: [
            { symbol: 'sh518880', name: '华安黄金ETF (518880)', fee: '0.60% / 年' },
            { symbol: 'sh518800', name: '国泰黄金ETF (518800)', fee: '0.60% / 年' },
            { symbol: 'sz159934', name: '易方达黄金ETF (159934)', fee: '0.60% / 年' },
            { symbol: 'sh518660', name: '工银黄金ETF (518660)', fee: '0.60% / 年' }
        ]
    },
    {
        id: 'bond',
        name: '国内债市',
        benchmarkSymbol: '511010.SS',
        etfSymbols: [
            { symbol: 'f_003376', name: '广发中债7-10年国开债A (003376) [场外]', fee: '0.35% / 年' }
        ]
    }
];
