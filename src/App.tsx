import { useEffect, useState } from 'react';
import { DashboardData } from './types';
import { ScoreCard } from './components/ScoreCard';
import { MarketFactors } from './components/MarketFactors';
import { EtfTable } from './components/EtfTable';
import { TrendChart } from './components/TrendChart';
import TabNav from './components/TabNav';
import TradingJournal from './components/TradingJournal';
import ScoreReference from './components/ScoreReference';
import { Activity, RefreshCw } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'score' | 'journal'>(() => {
    return (localStorage.getItem('activeTab') as any) || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch data');
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Refresh every 5 minutes automatically
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-200 flex flex-col items-center justify-center font-sans">
        <Activity className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium tracking-tight">正在计算并同步数据，请稍候...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-200 flex items-center justify-center p-4">
        <div className="bg-red-500/10 text-red-400 p-6 rounded-3xl max-w-md w-full border border-red-500/20 backdrop-blur-md">
          <h2 className="font-bold text-lg mb-2">获取仪表盘数据失败</h2>
          <p className="text-sm opacity-80">{error}</p>
          <button 
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 text-sm font-medium rounded-lg hover:bg-red-500/30 transition"
          >
            点击重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-white pb-12 relative overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="px-6 py-6 border-b border-white/10 sticky top-0 z-20 bg-[#0B0E14]/50 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">美股估值与 ETF 投资决策辅助系统</h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5">US MARKET STRATEGY & ETF DECISION ENGINE</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {data?.qqqQuote && (
                <div className="hidden md:flex flex-col items-end mr-4 animate-in fade-in slide-in-from-right-4 duration-500">
                  <span className="text-xs text-slate-400 font-mono uppercase">纳斯达克100 (QQQ) 基准</span>
                  <span className={`text-sm font-bold font-mono ${data.qqqQuote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${data.qqqQuote.price.toFixed(2)} {data.qqqQuote.changePct >= 0 ? '+' : ''}{data.qqqQuote.changePct.toFixed(2)}%
                  </span>
                </div>
              )}
             {data?.lastUpdated && (
               <span className="text-[10px] text-slate-400 font-mono uppercase bg-white/5 px-3 py-1 rounded-full border border-white/10 hidden sm:inline-block">
                 更新时间: {new Date(data.lastUpdated).toLocaleTimeString()}
               </span>
             )}
              <button 
                onClick={fetchDashboard}
                className="p-2 text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                title="刷新数据"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 mt-8">
          <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
          
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Top Section: Score & Breakdown */}
              <div className="md:col-span-4 h-full flex">
                {data && <ScoreCard score={data.marketScore} />}
              </div>
              
              <div className="md:col-span-8 h-full flex">
                {data && <MarketFactors breakdown={data.breakdown} />}
              </div>

              {/* Middle Section: Chart */}
              <div className="md:col-span-12">
                {data && <TrendChart data={data.chartData} />}
              </div>

              {/* Bottom Section: ETF Table */}
              <div className="md:col-span-12">
                 {data && <EtfTable etfs={data.etfs} />}
              </div>
            </div>
          )}

          {activeTab === 'journal' && <TradingJournal etfs={data?.etfs || []} />}
          
          {activeTab === 'score' && <ScoreReference />}
        </main>
      </div>
    </div>
  );
}
