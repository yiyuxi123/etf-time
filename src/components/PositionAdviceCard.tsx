import React, { useEffect, useState } from 'react';
import { DashboardData } from '../types';
import { AlertCircle, TrendingUp, PiggyBank, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface PositionAdviceCardProps {
  data: DashboardData | null;
  activeMarketIdx: number;
}

export const PositionAdviceCard: React.FC<PositionAdviceCardProps> = ({ data, activeMarketIdx }) => {
  const [positions, setPositions] = useState<Record<string, number>>({});

  useEffect(() => {
    // Read trading journal records to get positions
    const getPositions = () => {
        const saved = localStorage.getItem('etf_trading_journal');
        if (!saved) return {};
        try {
            const records = JSON.parse(saved);
            const chronological = [...records].sort((a: any, b: any) => a.id.localeCompare(b.id));
            const pos: Record<string, number> = {};
            chronological.forEach((r: any) => {
                if (!pos[r.symbol]) pos[r.symbol] = 0;
                if (r.type === 'BUY') {
                    pos[r.symbol] += r.shares;
                } else {
                    pos[r.symbol] = Math.max(0, pos[r.symbol] - r.shares);
                }
            });
            return pos;
        } catch {
            return {};
        }
    };
    
    setPositions(getPositions());
    
    const handleStorageChange = () => {
      setPositions(getPositions());
    };
    
    // Listen for local storage changes in case journal is updated in another tab
    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-window updates
    window.addEventListener('trading_journal_updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('trading_journal_updated', handleStorageChange);
    };
  }, []);

  if (!data || !data.markets || !data.markets[activeMarketIdx]) return null;
  
  const activeMarket = data.markets[activeMarketIdx];
  const marketScore = activeMarket.marketScore;

  // Compute total market value
  let totalMarketValue = 0;
  let activeMarketValue = 0;
  
  // We need all ETFs to get prices if they are across different markets, 
  // but for simplicity, let's look through all markets in DashboardData
  const allEtfs = data.markets.flatMap(m => m.etfs);
  
  Object.entries(positions).forEach(([sym, shares]) => {
      if (shares <= 0) return;
      const etf = allEtfs.find(e => e.symbol === sym || e.symbol.includes(sym));
      if (etf) {
          totalMarketValue += etf.price * shares;
          // Check if this ETF belongs to the active market
          if (activeMarket.etfs.some(e => e.symbol === sym || e.symbol.includes(sym))) {
              activeMarketValue += etf.price * shares;
          }
      }
  });

  if (activeMarketValue <= 0) {
      // Don't show if no positions in this market
      return null;
  }

  // Determine advice based on score for the active market
  // Typical rule of thumb: Score [0, 80], optimal allocation might linearly map.
  // E.g., score >= 60 -> 100% position, score <= 20 -> 0% position
  // Recommended allocation % = (Score - 20) / (60 - 20) * 100
  let recommendedRatio = 0;
  if (marketScore >= 60) {
      recommendedRatio = 100;
  } else if (marketScore <= 20) {
      recommendedRatio = 0;
  } else {
      recommendedRatio = Math.max(0, Math.min(100, ((marketScore - 20) / 40) * 100));
  }
  
  // To say "suggest reduce by X%", we need an assumed current ratio. 
  // For simplicity, we just output the recommended position percentage.
  // Or we can say "Suggest holding X% of total capital". 
  // Since we don't know the user's total capital (only total invested), we can just advise on their current holdings.
  // Perhaps we compare score to 50:
  let advice = "";
  let adviceColor = "";
  let actionText = "";

  if (marketScore >= 65) {
      adviceColor = "text-emerald-400";
      actionText = "建议满仓或加仓";
      advice = `当前评分较高 (${marketScore}分)，建议保持高仓位 (80%-100%)。`;
  } else if (marketScore >= 45) {
      adviceColor = "text-blue-400";
      actionText = "建议保持半仓";
      advice = `当前评分中等 (${marketScore}分)，建议维持标准仓位 (50%)，避免频繁交易。`;
  } else if (marketScore >= 30) {
      adviceColor = "text-yellow-400";
      actionText = "建议减仓防守";
      advice = `当前评分偏低 (${marketScore}分)，建议逐步降低仓位至 20%-30% 控制风险。`;
  } else {
      adviceColor = "text-rose-400";
      actionText = "建议清仓观望";
      advice = `当前评分极低 (${marketScore}分)，建议大幅减仓或清仓，耐心等待底部信号。`;
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-5 w-full md:w-auto">
        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-600/30 shrink-0">
          <PiggyBank className="text-emerald-400" size={32} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            {activeMarket.name} 市场持仓市值
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-slate-300">¥</span>
            <span className="text-2xl font-mono text-white font-bold">{activeMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      
      <div className="hidden md:block w-px h-16 bg-slate-700/50"></div>

      <div className="flex-1 w-full bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className={adviceColor} size={18} />
          <h4 className="text-sm font-bold text-white tracking-wide">仓位调整建议</h4>
          <span className={cn("text-xs px-2 py-0.5 rounded ml-2 bg-slate-800 border", adviceColor, `border-${adviceColor.split('-')[1]}-500/30`)}>
            {actionText}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
          {advice} 
          <span className="block mt-1 text-slate-500 font-mono">
            基准匹配: {(recommendedRatio).toFixed(0)}% 推荐仓位占比
          </span>
        </p>
      </div>
    </div>
  );
};
