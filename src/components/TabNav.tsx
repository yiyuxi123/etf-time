import React from 'react';
import { LayoutDashboard, BookText, HelpCircle, Newspaper } from 'lucide-react';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

interface TabNavProps {
  activeTab: 'dashboard' | 'score' | 'journal';
  setActiveTab: (tab: 'dashboard' | 'score' | 'journal') => void;
}

export default function TabNav({ activeTab, setActiveTab }: TabNavProps) {
  return (
    <div className="flex space-x-2 bg-white/5 p-1 rounded-xl w-max mb-6 border border-white/10 mx-auto">
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
  );
}
