import React from 'react';
import { MetricBreakdown } from '../types';
import { cn } from '../lib/utils';
import { Activity, Percent, ArrowUpRight } from 'lucide-react';

interface MarketFactorsProps {
  breakdown: MetricBreakdown;
}

export const MarketFactors: React.FC<MarketFactorsProps> = ({ breakdown }) => {
  const factors = [
    {
      key: 'pe',
      label: '估值因子 (Nasdaq PE)',
      icon: <Percent size={18} className="text-emerald-400" />,
      value: `${breakdown.pe.value.toFixed(1)}x`,
      score: breakdown.pe.score,
      max: breakdown.pe.max,
      description: '动态市盈率 <= 20 满分，>= 35 零分',
      colorClass: 'bg-emerald-500',
      textColor: 'text-emerald-400'
    },
    {
      key: 'vix',
      label: '情绪因子 (VIX Index)',
      icon: <Activity size={18} className="text-blue-400" />,
      value: breakdown.vix.value.toFixed(1),
      score: breakdown.vix.score,
      max: breakdown.vix.max,
      description: '恐慌指数 >= 30 满分，<= 15 零分',
      colorClass: 'bg-blue-500',
      textColor: 'text-blue-400'
    },
    {
      key: 'trend',
      label: '趋势因子 (距离200日均线)',
      icon: <ArrowUpRight size={18} className="text-yellow-400" />,
      value: `${breakdown.trend.value > 0 ? '+' : ''}${breakdown.trend.value.toFixed(1)}%`,
      score: breakdown.trend.score,
      max: breakdown.trend.max,
      description: '向上偏离均线 5% 满分，向下偏离 5% 零分',
      colorClass: 'bg-yellow-500',
      textColor: 'text-yellow-400'
    }
  ];

  return (
    <div className="flex flex-col p-6 bg-white/5 border border-white/10 rounded-3xl h-full w-full">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
        决策因子权重分析
      </h2>
      
      <div className="flex flex-col gap-6 flex-1 justify-center">
        {factors.map((f) => (
          <div key={f.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-2">
                {f.icon} {f.label}
              </span>
              <span className={cn("font-bold font-mono", f.textColor)}>
                {f.score} / {f.max}
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-1000 ease-out", f.colorClass)}
                style={{ width: `${(f.score / f.max) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500">{f.description}</span>
              <span className="text-xs font-mono text-slate-300">{f.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
