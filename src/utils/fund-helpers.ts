import type { MarketData, EtfInfo, GroupMode } from '../types';

/**
 * 规范化标的代码：去 F_/SH/SZ 前缀、统一小写、去空白。
 */
export function normalizeSymbol(sym: string): string {
  if (!sym) return '';
  return sym.toLowerCase().replace(/^f_/, '').replace(/\bsh\b/i, '').replace(/\bsz\b/i, '').trim();
}

/**
 * 在全部 markets 的 etfs 列表里查找指定标的。
 * 先精确匹配，再用包含关系兜底，行为与原 TradingJournal 实现一致。
 */
export function findEtfBySymbol(sym: string, markets: MarketData[]): EtfInfo | undefined {
  if (!sym) return undefined;
  const allEtfs = markets.flatMap(m => m.etfs || []);
  const cleanSym = normalizeSymbol(sym);

  const exact = allEtfs.find(e => normalizeSymbol(e.symbol) === cleanSym);
  if (exact) return exact;

  return allEtfs.find(e => {
    const cleanE = normalizeSymbol(e.symbol);
    return cleanE.includes(cleanSym) || cleanSym.includes(cleanE);
  });
}

/**
 * 判断是否为场外（OTC）基金。
 * 1. 显式 F_ 前缀 -> true
 * 2. markets 里有匹配且该 ETF symbol 以 F_ 开头 -> true
 * 3. 纯 6 位数字代码且非场内 ETF 常见开头（51/52/56/58/15/16/50）-> true
 */
export function isOtcSymbol(sym: string, markets?: MarketData[]): boolean {
  if (!sym) return false;
  const s = sym.trim().toLowerCase();
  if (s.startsWith('f_')) return true;

  if (markets) {
    const matched = findEtfBySymbol(sym, markets);
    if (matched && matched.symbol.toLowerCase().startsWith('f_')) {
      return true;
    }
  }

  if (/^\d{6}$/.test(s)) {
    const startTwo = s.substring(0, 2);
    const isTraditionalEtfStart = ['51', '52', '56', '58', '15', '16', '50'].includes(startTwo);
    if (!isTraditionalEtfStart) {
      return true;
    }
  }
  return false;
}

/**
 * 大类枚举。用于折叠分组、渐变色映射、统计聚合。
 */
export type FundCategory = 'NDX' | 'CSI300' | 'GOLD' | 'BOND' | 'OTHER';

/**
 * 按标的代码粗分大类。优先用 markets 里的归属，缺失时按代码前缀启发式判断。
 */
export function inferCategory(sym: string, markets?: MarketData[]): FundCategory {
  if (markets) {
    const etf = findEtfBySymbol(sym, markets);
    if (etf) {
      const low = etf.symbol.toLowerCase();
      if (low.includes('ndx') || low.includes('016452') || low.includes('000834') || low.includes('270042') || low.includes('513100') || low.includes('513984')) return 'NDX';
      if (low.includes('csi300') || low.includes('510300') || low.includes('510310') || low.includes('159919')) return 'CSI300';
      if (low.includes('gold') || low.includes('518880') || low.includes('159934') || low.includes('008338')) return 'GOLD';
      if (low.includes('bond') || low.includes('债')) return 'BOND';
    }
  }
  const s = sym.trim().toLowerCase();
  if (s.includes('ndx') || s.includes('016452')) return 'NDX';
  if (s.includes('csi') || s.includes('510300')) return 'CSI300';
  if (s.includes('gold') || s.includes('518')) return 'GOLD';
  return 'OTHER';
}

export const CATEGORY_LABELS: Record<FundCategory, string> = {
  NDX: '纳斯达克100',
  CSI300: '沪深300',
  GOLD: '黄金',
  BOND: '债券',
  OTHER: '其他',
};

// GroupMode 的权威定义在 types.ts；此处仅再导出便于就近引用。
export type { GroupMode };

/**
 * 货币格式化（元，2 位小数）。
 */
export function formatCurrency(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '¥0.00';
  return `¥${value.toFixed(digits)}`;
}

/**
 * 百分比格式化。
 */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
