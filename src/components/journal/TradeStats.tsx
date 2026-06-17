import { ArrowUpRight, ArrowDownRight, Target } from 'lucide-react';

interface TradeStatsProps {
  netRealizedPnL: number;
  unrealizedPnL: number;
  winRate: number;
  exactWins: number;
  exactLosses: number;
  totalFees: number;
}

export default function TradeStats({
  netRealizedPnL,
  unrealizedPnL,
  winRate,
  exactWins,
  exactLosses,
  totalFees,
}: TradeStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
          {netRealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
          已实现净盈亏
        </div>
        <div className={`text-lg font-mono font-bold ${netRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {netRealizedPnL >= 0 ? '+' : ''}{netRealizedPnL.toFixed(2)}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
          {unrealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
          总持仓预估浮盈
        </div>
        <div className={`text-lg font-mono font-bold ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
           <Target size={12} className="mr-1 text-cyan-400" />
           平仓胜率
        </div>
        <div className="flex items-end gap-1">
          <div className="text-lg font-mono font-bold text-white">{winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-slate-500 mb-0.5 font-mono">({exactWins}/{exactLosses})</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
           <ArrowDownRight size={12} className="mr-1 text-yellow-500" />
           累计手续费
        </div>
        <div className="text-lg font-mono font-bold text-yellow-500">
          ¥{totalFees.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
