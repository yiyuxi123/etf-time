export interface FactorBreakdown {
  value: number;
  score: number;
  max: number;
}

export interface MetricBreakdown {
  pe: FactorBreakdown;
  vix: FactorBreakdown;
  trend: FactorBreakdown;
}

export interface EtfInfo {
  symbol: string;
  name: string;
  price: number;
  estimatedIopv: number;
  premiumPct: number;
  premiumScore: number;
  totalScore: number;
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'REDUCE' | 'CLEAR' | 'VETO - AVOID';
}

export interface ChartDataPoint {
  date: string;
  close: number;
  ma200?: number | null;
  pe?: number;
  vix?: number;
  trend?: number;
}

export interface DashboardData {
  marketScore: number;
  qqqQuote?: {
    price: number;
    changePct: number;
  };
  breakdown: MetricBreakdown;
  etfs: EtfInfo[];
  chartData: ChartDataPoint[];
  lastUpdated: string;
}
