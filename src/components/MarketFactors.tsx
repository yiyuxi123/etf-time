import React from 'react';
import { FactorBreakdown } from '../types';
import { cn } from '../lib/utils';
import { Activity, Percent, ArrowUpRight, TrendingUp, ShieldAlert, Zap, Waves } from 'lucide-react';

interface MarketFactorsProps {
  breakdown: FactorBreakdown[];
}

export const MarketFactors: React.FC<MarketFactorsProps> = ({ breakdown }) => {

  const getColorClass = (index: number) => {
    const colors = [
      { bg: 'bg-emerald-500', text: 'text-emerald-400' },
      { bg: 'bg-blue-500', text: 'text-blue-400' },
      { bg: 'bg-yellow-500', text: 'text-yellow-400' },
      { bg: 'bg-purple-500', text: 'text-purple-400' }
    ];
    return colors[index % colors.length];
  };

  const renderIcon = (name: string, className: string) => {
    if (name.includes('PE') || name.includes('市盈率')) return <Percent size={18} className={className} />;
    if (name.includes('VIX') || name.includes('恐慌')) return <Activity size={18} className={className} />;
    if (name.includes('趋势') || name.includes('均线') || name.includes('乖离')) return <TrendingUp size={18} className={className} />;
    if (name.includes('RSI') || name.includes('强弱') || name.includes('情绪')) return <Zap size={18} className={className} />;
    if (name.includes('回撤')) return <ShieldAlert size={18} className={className} />;
    if (name.includes('动能') || name.includes('动量')) return <ArrowUpRight size={18} className={className} />;
    if (name.includes('波动率')) return <Waves size={18} className={className} />;
    return <Activity size={18} className={className} />;
  };

  return (
    <div className="flex flex-col p-6 bg-white/5 border border-white/10 rounded-3xl h-full w-full">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
        决策因子权重分析
      </h2>
      
      <div className="flex flex-col gap-6 flex-1 justify-center">
        {breakdown.map((f, index) => {
          const colors = getColorClass(index);
          return (
            <div key={f.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-2">
                  {renderIcon(f.name, colors.text)} {f.name}
                </span>
                <span className={cn("font-bold font-mono", colors.text)}>
                  {f.score} / {f.max}
                </span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000 ease-out", colors.bg)}
                  style={{ width: `${(f.score / f.max) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-500">权重得分</span>
                <span className="text-xs font-mono text-slate-300">{typeof f.value === 'number' ? f.value.toFixed(2) : f.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
