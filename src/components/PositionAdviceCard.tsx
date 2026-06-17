import React, { useEffect, useState } from 'react';
import { DashboardData } from '../types';
import { AlertCircle, TrendingUp, PiggyBank, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface PositionAdviceCardProps {
  data: DashboardData | null;
  activeMarketIdx: number;
  currentView?: 'swing' | 'dca';
}

export const PositionAdviceCard: React.FC<PositionAdviceCardProps> = ({ data, activeMarketIdx, currentView = 'swing' }) => {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const isDcaMode = currentView === 'dca';

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
  const marketScore = isDcaMode ? activeMarket.dcaMarketScore : activeMarket.swingMarketScore;

  // Compute total market value
  let totalMarketValue = 0;
  let activeMarketValue = 0;
  
  // We need all ETFs to get prices if they are across different markets, 
  // but for simplicity, let's look through all markets in DashboardData
  const allEtfs = data.markets.flatMap(m => m.etfs);
  
  Object.entries(positions).forEach(([sym, sharesVal]) => {
      const shares = Number(sharesVal);
      if (isNaN(shares) || shares <= 0) return;
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
  let recommendedRatio = 0;
  if (isDcaMode) {
      if (marketScore >= 70) {
          recommendedRatio = 100;
      } else if (marketScore <= 15) {
          recommendedRatio = 0;
      } else {
          recommendedRatio = Math.max(0, Math.min(100, ((marketScore - 15) / 55) * 100));
      }
  } else {
      if (marketScore >= 60) {
          recommendedRatio = 100;
      } else if (marketScore <= 20) {
          recommendedRatio = 0;
      } else {
          recommendedRatio = Math.max(0, Math.min(100, ((marketScore - 20) / 40) * 100));
      }
  }
  
  let advice = "";
  let adviceColor = "";
  let adviceBorder = "";
  let actionText = "";

  if (isDcaMode) {
      if (marketScore >= 70) {
          adviceColor = "text-emerald-400";
          adviceBorder = "border-emerald-500/30";
          actionText = "强烈定投加码 / 黄金吸筹区";
          advice = `当前定投性价比处于极高水平 (${marketScore}分)。市场遭遇显著超卖跌出空间，估值极其低廉，是极为难得的越跌越补、加速大额吸筹的“黄金上车定投窗口”！`;
      } else if (marketScore >= 50) {
          adviceColor = "text-blue-400";
          adviceBorder = "border-blue-500/30";
          actionText = "常规定投 / 分批吸筹";
          advice = `当前市场处于均值偏低的合理定投区 (${marketScore}分)。价格具备不错的安全边际，买入成本被低平，建议按照常规定投频率，按部就班分批进场，稳健攒份额。`;
      } else if (marketScore >= 30) {
          adviceColor = "text-yellow-400";
          adviceBorder = "border-yellow-500/30";
          actionText = "小额扣款 / 减小敞口";
          advice = `当前市场估值已不便宜且超买增多 (${marketScore}分)。溢价阻力与位置攀高限制了投资盈亏比，建议降低定投额度（如降至一半）或保持小额小扣观望。`;
      } else {
          adviceColor = "text-rose-400";
          adviceBorder = "border-rose-500/30";
          actionText = "暂停定投 / 减仓止盈";
          advice = `当前定投安全垫极低 (${marketScore}分)！估值泡沫严重超买，RSI 极其狂热。应当立即暂停一切增量定投划扣，获利盘建议执行逢高减仓，回笼资金储备。`;
      }
  } else {
      // Swing mode
      if (marketScore >= 65) {
          adviceColor = "text-emerald-400";
          adviceBorder = "border-emerald-500/30";
          actionText = "建议满仓或突破加仓";
          advice = `当前趋势极强极其安全 (${marketScore}分)，多头主升动能充沛，均线维持完美发散。右侧突破或主升顺势顺水，建议维持高仓位，强健持仓，甚至可以顺势突破加仓。`;
      } else if (marketScore >= 45) {
          adviceColor = "text-blue-400";
          adviceBorder = "border-blue-500/30";
          actionText = "建议保持半仓 / 跟踪势头";
          advice = `当前波段动能中等 (${marketScore}分)。价格维持在200均线上，中期波动率稳定。建议维持标准中等底仓，跟踪防守界线，不频繁加长。`;
      } else if (marketScore >= 30) {
          adviceColor = "text-yellow-400";
          adviceBorder = "border-yellow-500/30";
          actionText = "建议破位减仓防守";
          advice = `当前波段走势趋冷 (${marketScore}分)。多头动能减弱，50均线拐头向下或价格贴近生死线。建议将仓位减半或收缩风险敞口，防范下行波段。`;
      } else {
          adviceColor = "text-rose-400";
          adviceBorder = "border-rose-500/30";
          actionText = "建议一律空仓 / 右侧止损";
          advice = `当前指标严重破位破位 (${marketScore}分)！均线破纸跌碎防守，严禁徒手接利刀。为绝对策略纪律，建议锁定利润一律清仓或空仓防守，耐心度过出清波期。`;
      }
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
          <span className={cn("text-xs px-2 py-0.5 rounded ml-2 bg-slate-800 border", adviceColor, adviceBorder)}>
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
