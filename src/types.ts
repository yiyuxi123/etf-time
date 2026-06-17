export interface FactorBreakdown {
  name: string;
  value: number | string;
  score: number;
  max: number;
}

export interface MetricBreakdown {
  [key: string]: FactorBreakdown;
}

export interface EtfInfo {
  symbol: string;
  name: string;
  price: number;
  estimatedIopv: number;
  premiumPct: number;
  premiumScore: number;
  totalScore: number;
  recommendation: string;
  fee?: string;
  swingPremiumScore: number;
  swingTotalScore: number;
  swingRecommendation: string;
  dcaPremiumScore: number;
  dcaTotalScore: number;
  dcaRecommendation: string;
}

export interface ChartDataPoint {
  date: string;
  close: number;
  ma200?: number | null;
  pe?: number;
  vix?: number;
  trend?: number;
  rsi?: number;
  drawdown?: number;
  volatility?: number;
  score?: number;
  swingScore?: number;
  dcaScore?: number;
}

export interface MarketData {
  id: string;
  name: string;
  marketScore: number;
  swingMarketScore: number;
  dcaMarketScore: number;
  quote?: {
    price: number;
    changePct: number;
  };
  breakdown: FactorBreakdown[];
  swingBreakdown: FactorBreakdown[];
  dcaBreakdown: FactorBreakdown[];
  etfs: EtfInfo[];
  chartData: ChartDataPoint[];
}

export interface DashboardData {
  markets: MarketData[];
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// 交易记录与定投计划（权威类型定义，组件应从此处 import，勿在各文件重复定义）
// ---------------------------------------------------------------------------

/** 单笔交易/定投记录。兼容 localStorage 中 etf_trading_journal 的历史结构。 */
export interface TradeRecord {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  /** 定投产生（区别于手动买卖），用于"定投 vs 手动"分组 */
  isSip?: boolean;
  symbol: string;
  price: number;
  shares: number;
  fee: number;
  /** 待对账确认（OTC 净值未回填） */
  isPending?: boolean;
  /** 申购金额暂存，待净值回填后计算份额 */
  pendingAmount?: number;
  /** 净值同步状态 */
  navStatus?: 'temp' | 'not_updated' | 'updated';
  hasConflict?: boolean;
  conflictDetails?: string | null;
  isVerified?: boolean;
  navSources?: string | null;
}

/** 定投计划。兼容 localStorage 中 etf_sip_plans 的历史结构。 */
export interface SipPlan {
  id: string;
  name: string;
  /** 'ndx' | 'csi300' | 'gold' | 'bond' */
  marketId: string;
  symbol: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  /** 智能定投：按市场得分动态调整倍率 */
  isSmart: boolean;
  startDate: string;
  totalInvested: number;
  historyCount: number;
  status: 'active' | 'paused';
  rate?: number;
  settlementDays?: number;
  purchaseLimit?: number;
  lastExecutedDate?: string;
  dayOfWeek?: number;
}

/** 折叠分组维度 */
export type GroupMode = 'category' | 'source' | 'month' | 'status';

/** 按维度分组后的结果节点 */
export interface TradeGroup {
  key: string;
  label: string;
  records: TradeRecord[];
  totalAmount: number;
  expanded: boolean;
  children?: TradeGroup[];
}

/** 净值查询结果（queryFundNav 返回结构的权威版） */
export interface NavQueryResult {
  success: boolean;
  symbol: string;
  date: string;
  nav: number | null;
  isPublished: boolean;
  isVerified: boolean;
  hasConflict: boolean;
  source: string;
  conflictDetails?: string | null;
  explanation?: string;
}

