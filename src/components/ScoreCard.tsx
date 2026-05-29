import React from 'react';
import { cn } from '../lib/utils';
import { DashboardData } from '../types';
import { Gauge, TrendingUp, AlertTriangle } from 'lucide-react';

interface ScoreCardProps {
  score: number; // Market Score out of 80 (or 100 max visually)
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ score }) => {
  // Map score [0, 80] to descriptive text
  let status = "Hold";
  let colorClass = "text-yellow-500";
  let bgClass = "bg-yellow-500/10";
  
  if (score >= 70) {
    status = "强烈买入 (加倍定投)";
    colorClass = "text-emerald-400";
    bgClass = "bg-emerald-500/20 border-emerald-500/50";
  } else if (score >= 50) {
    status = "买入 (常规定投)";
    colorClass = "text-emerald-300";
    bgClass = "bg-emerald-400/20 border-emerald-400/50";
  } else if (score >= 30) {
    status = "持有 (观望留存)";
    colorClass = "text-yellow-400";
    bgClass = "bg-yellow-500/20 border-yellow-500/50";
  } else if (score >= 15) {
    status = "减仓 (逐步止盈)";
    colorClass = "text-orange-400";
    bgClass = "bg-orange-500/20 border-orange-500/50";
  } else {
    status = "清仓 (高风险回避)";
    colorClass = "text-red-400";
    bgClass = "bg-red-500/20 border-red-500/50";
  }

  // Calculate percentage of 80 (market max) purely for the circle
  const percentage = Math.min(100, Math.max(0, (score / 80) * 100));

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-sm h-full w-full relative overflow-hidden">
      <div className="flex items-center gap-2 mb-4 text-white/40 font-bold tracking-widest text-xs uppercase italic">
        <Gauge size={16} />
        <h2>综合市场打分</h2>
      </div>

      <div className="relative flex items-center justify-center mb-6">
        {/* Simple SVG circular progress */}
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-white/5"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 56}
            strokeDashoffset={2 * Math.PI * 56 * (1 - percentage / 100)}
            className={cn("transition-all duration-1000 ease-out", colorClass)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-bold tracking-tighter", colorClass.replace('text-', 'text-'))}>
            {score}
          </span>
          <span className="text-xs text-slate-400 font-medium">/ 80</span>
        </div>
      </div>

      <div className={cn("px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest border border-solid", colorClass, bgClass)}>
        {status}
      </div>
      
      <p className="mt-4 text-xs text-center text-slate-300 max-w-[200px]">
        基础评分剔除了单只场内ETF的溢价惩罚，满分为 80 分。
      </p>
    </div>
  );
};
