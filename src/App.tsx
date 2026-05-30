import { useEffect, useState } from 'react';
import { DashboardData } from './types';
import { ScoreCard } from './components/ScoreCard';
import { MarketFactors } from './components/MarketFactors';
import { EtfTable } from './components/EtfTable';
import { TrendChart } from './components/TrendChart';
import { PositionAdviceCard } from './components/PositionAdviceCard';
import TabNav from './components/TabNav';
import TradingJournal from './components/TradingJournal';
import ScoreReference from './components/ScoreReference';
import { Activity, RefreshCw, BellRing } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'score' | 'journal'>(() => {
    return (localStorage.getItem('activeTab') as any) || 'dashboard';
  });
  const [activeMarketIdx, setActiveMarketIdx] = useState(0);

  const [thresholds, setThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('marketThresholds');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('marketThresholds', JSON.stringify(thresholds));
  }, [thresholds]);

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
      if (!json.markets || !Array.isArray(json.markets)) {
         throw new Error('Data format error');
      }
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
              {data && data.markets && data.markets[activeMarketIdx] && data.markets[activeMarketIdx].quote && (
                <div className="hidden md:flex flex-col items-end mr-4 animate-in fade-in slide-in-from-right-4 duration-500">
                  <span className="text-xs text-slate-400 font-mono uppercase">{data.markets[activeMarketIdx].name} 基准</span>
                  <span className={`text-sm font-bold font-mono ${data.markets[activeMarketIdx].quote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${data.markets[activeMarketIdx].quote.price.toFixed(2)} {data.markets[activeMarketIdx].quote.changePct >= 0 ? '+' : ''}{data.markets[activeMarketIdx].quote.changePct.toFixed(2)}%
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

          {activeTab === 'dashboard' && data && <PositionAdviceCard data={data} activeMarketIdx={activeMarketIdx} />}

          {activeTab === 'dashboard' && data && data.markets && data.markets[activeMarketIdx] && (() => {
             const activeMarket = data.markets[activeMarketIdx];
             const threshold = thresholds[activeMarket.id];
             if (threshold !== undefined && activeMarket.marketScore >= threshold) {
               return (
                  <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl mb-4 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shadow-lg shadow-emerald-500/10">
                     <div className="flex items-center gap-3">
                       <BellRing size={18} className="animate-bounce" />
                       <p className="font-medium text-sm">
                          【提醒】<strong className="text-white">{activeMarket.name}</strong> 市场当前综合评分 (<strong className="text-white">{activeMarket.marketScore}</strong>分) 已达到您设定的目标阈值 ({threshold}分)。
                       </p>
                     </div>
                     <button onClick={() => setThresholds(prev => ({...prev, [activeMarket.id]: undefined}))} className="text-xs px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 rounded transition">
                       关闭提醒
                     </button>
                  </div>
               );
             }
             return null;
          })()}

          {activeTab === 'dashboard' && data && data.markets && data.markets[activeMarketIdx] && (
            <>
              {/* Market Selection Tabs */}
              <div className="flex gap-2 mb-6">
                {data.markets.map((m, idx) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMarketIdx(idx)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMarketIdx === idx ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'}`}
                    >
                        {m.name}
                    </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Top Section: Score & Breakdown */}
                <div className="md:col-span-4 h-full flex">
                  <ScoreCard 
                    score={data.markets[activeMarketIdx].marketScore} 
                    threshold={thresholds[data.markets[activeMarketIdx].id]}
                    onThresholdChange={(val) => {
                       if (val === undefined) {
                          setThresholds(prev => {
                             const next = { ...prev };
                             delete next[data.markets[activeMarketIdx].id];
                             return next;
                          });
                       } else {
                          setThresholds(prev => ({...prev, [data.markets[activeMarketIdx].id]: val}));
                       }
                    }}
                  />
                </div>
                
                <div className="md:col-span-8 h-full flex">
                  <MarketFactors breakdown={data.markets[activeMarketIdx].breakdown} />
                </div>

                {/* Middle Section: Chart */}
                <div className="md:col-span-12">
                  <TrendChart 
                    data={data.markets[activeMarketIdx].chartData} 
                    breakdowns={data.markets[activeMarketIdx].breakdown}
                  />
                </div>

                {/* Bottom Section: ETF Table */}
                <div className="md:col-span-12">
                   <EtfTable etfs={data.markets[activeMarketIdx].etfs} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'journal' && <TradingJournal etfs={data?.markets?.[activeMarketIdx]?.etfs || []} />}
          
          {activeTab === 'score' && <ScoreReference />}
        </main>
      </div>
    </div>
  );
}
