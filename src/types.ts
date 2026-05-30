export interface FactorBreakdown {
  name: string;
  value: number;
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
}

export interface MarketData {
  id: string;
  name: string;
  marketScore: number;
  quote?: {
    price: number;
    changePct: number;
  };
  breakdown: FactorBreakdown[];
  etfs: EtfInfo[];
  chartData: ChartDataPoint[];
}

export interface DashboardData {
  markets: MarketData[];
  lastUpdated: string;
}
