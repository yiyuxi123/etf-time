import React from 'react';
import { LayoutDashboard, BookText, HelpCircle, TrendingUp, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

interface TabNavProps {
  activeTab: 'dashboard' | 'backtest' | 'journal' | 'score' | 'plan';
  setActiveTab: (tab: 'dashboard' | 'backtest' | 'journal' | 'score' | 'plan') => void;
}

export default function TabNav({ activeTab, setActiveTab }: TabNavProps) {
  return (
    <div className="w-full overflow-x-auto scrollbar-none mb-6 px-4">
      <div className="flex items-center justify-start sm:justify-center gap-1 bg-white/5 p-1 rounded-xl w-max border border-white/10 mx-auto min-w-max">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors",
            activeTab === 'dashboard' ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <LayoutDashboard size={16} />
          <span>策略监控</span>
        </button>
        <button
          onClick={() => setActiveTab('backtest')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors",
            activeTab === 'backtest' ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <TrendingUp size={16} />
          <span>历史回测</span>
        </button>
        <button
          onClick={() => setActiveTab('journal')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors",
            activeTab === 'journal' ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <BookText size={16} />
          <span>交易记录</span>
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors",
            activeTab === 'plan' ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <Calendar size={16} />
          <span>定投计划</span>
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-colors",
            activeTab === 'score' ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <HelpCircle size={16} />
          <span>评分说明</span>
        </button>
      </div>
    </div>
  );
}
