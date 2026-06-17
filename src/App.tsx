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
import QuantitativeBacktester from './components/QuantitativeBacktester';
import FundSettingsModal from './components/FundSettingsModal';
import SipPlanner from './components/SipPlanner';
import { Activity, RefreshCw, BellRing, Settings, Cloud, Loader2, Check, CloudLightning } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'api' | 'stocks' | 'sync'>('api');
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(() => localStorage.getItem('last_sync_timestamp'));

  const openSettings = (tab: 'api' | 'stocks' | 'sync' = 'api') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleCloudSyncClick = async () => {
    const webdavUsername = localStorage.getItem('webdav_username') || '';
    const webdavPassword = localStorage.getItem('webdav_password') || '';
    const webdavUrl = localStorage.getItem('webdav_url') || 'https://dav.jianguoyun.com/dav/';

    if (!webdavUsername || !webdavPassword) {
      // Not configured yet, open settings with sync subtab activated
      openSettings('sync');
      return;
    }

    setCloudSyncing(true);
    setCloudSyncSuccess(false);

    try {
      const userMarketsStr = localStorage.getItem('user_markets');
      const deepseekKey = localStorage.getItem('deepseek_api_key') || '';
      const qwenKey = localStorage.getItem('qwen_api_key') || '';
      const defaultProvider = localStorage.getItem('ai_default_provider') || 'gemini';
      
      const etfTradingJournal = (() => {
        const v = localStorage.getItem('etf_trading_journal');
        return v ? JSON.parse(v) : [];
      })();
      const etfSipPlans = (() => {
        const v = localStorage.getItem('etf_sip_plans');
        return v ? JSON.parse(v) : [];
      })();
      const etfSipMultipliers = (() => {
        const v = localStorage.getItem('etf_sip_multipliers');
        return v ? JSON.parse(v) : {};
      })();
      const marketThresholds = (() => {
        const v = localStorage.getItem('marketThresholds');
        return v ? JSON.parse(v) : null;
      })();

      const dataToBackup = {
        user_markets: userMarketsStr ? JSON.parse(userMarketsStr) : null,
        deepseek_api_key: deepseekKey.trim(),
        qwen_api_key: qwenKey.trim(),
        ai_default_provider: defaultProvider,
        etf_trading_journal: etfTradingJournal,
        etf_sip_plans: etfSipPlans,
        etf_sip_multipliers: etfSipMultipliers,
        marketThresholds: marketThresholds
      };

      const res = await fetch('/api/webdav/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword, data: dataToBackup })
      });
      const resJson = await res.json();
      if (res.ok && resJson.success) {
        const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
        localStorage.setItem('last_sync_timestamp', nowStr);
        setLastSyncTimestamp(nowStr);
        setCloudSyncSuccess(true);
        setTimeout(() => setCloudSyncSuccess(false), 3000);
      } else {
        alert(`一键云端同步失败: ${resJson.error || '未知错误'}\n即将为您打开坚果云盘设置页面检查密码。`);
        openSettings('sync');
      }
    } catch (e: any) {
      alert(`云同步异常: ${e.message}\n即将打开坚果云盘设置。`);
      openSettings('sync');
    } finally {
      setCloudSyncing(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'backtest' | 'journal' | 'score' | 'plan'>(() => {
    return (localStorage.getItem('activeTab') as any) || 'dashboard';
  });
  const [activeMarketIdx, setActiveMarketIdx] = useState(0);

  const [thresholds, setThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('marketThresholds');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [currentView, setCurrentView] = useState<'swing' | 'dca'>(() => {
    return (localStorage.getItem('currentView') as 'swing' | 'dca') || 'swing';
  });

  const [cloudBackupNotice, setCloudBackupNotice] = useState<{ updatedAt: string; localUpdatedAt: string; data: any } | null>(null);

  // Silent sync/check and self-healing CI/CD trigger on startup
  useEffect(() => {
    const checkCloudSyncOnStartup = async () => {
      const username = localStorage.getItem('webdav_username');
      const password = localStorage.getItem('webdav_password');
      const url = localStorage.getItem('webdav_url') || 'https://dav.jianguoyun.com/dav/';
      
      // 1. Light-up cloud configuration syncer
      if (username && password) {
        try {
          const res = await fetch('/api/webdav/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, username, password })
          });
          if (res.ok) {
            const resJson = await res.json();
            if (resJson.success && resJson.data) {
              const cloudPayload = resJson.data;
              const cloudUpdatedAt = cloudPayload.updatedAt;
              const localUpdatedAt = localStorage.getItem('local_last_updated') || '';

              // If cloud backup is newer than local by more than 5 seconds (5000 ms)
              if (cloudUpdatedAt && (!localUpdatedAt || new Date(cloudUpdatedAt).getTime() > new Date(localUpdatedAt).getTime() + 5000)) {
                setCloudBackupNotice({
                  updatedAt: new Date(cloudUpdatedAt).toLocaleString('zh-CN', { hour12: false }),
                  localUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toLocaleString('zh-CN', { hour12: false }) : '无记录',
                  data: cloudPayload.store
                });
              }
            }
          }
        } catch (err) {
          console.error("Startup cloud check failed:", err);
        }
      }

      // 2. Automate reading correction reports from WebDAV/locally, self-mending database, stamping processed actions!
      try {
        console.log("[CI/CD Startup Router] Reading correction reports and matching master baseline db values...");
        const response = await fetch('/api/webdav/process-corrections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, username, password })
        });
        if (response.ok) {
          const processed = await response.json();
          if (processed.success && processed.modifiedCount > 0) {
            console.log(`[CI/CD Self-Healed] Auto-reconstructed ${processed.modifiedCount} corrupted nodes perfectly.`);
          }
        }
      } catch (cicdErr) {
        console.error("Automated CI/CD hot-repair loop yielded an error:", cicdErr);
      }
    };

    const timer = setTimeout(checkCloudSyncOnStartup, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Event listener for auto-backup sync
  useEffect(() => {
    const handleJournalUpdateSync = async () => {
      const isAutoBackup = localStorage.getItem('webdav_auto_backup') === 'true';
      if (!isAutoBackup) return;

      const username = localStorage.getItem('webdav_username');
      const password = localStorage.getItem('webdav_password');
      const url = localStorage.getItem('webdav_url') || 'https://dav.jianguoyun.com/dav/';
      if (!username || !password) return;

      console.log("[Auto Sync] Triggering background backup...");
      try {
        const userMarketsStr = localStorage.getItem('user_markets');
        const deepseekKey = localStorage.getItem('deepseek_api_key') || '';
        const qwenKey = localStorage.getItem('qwen_api_key') || '';
        const defaultProvider = localStorage.getItem('ai_default_provider') || 'gemini';
        
        const etfTradingJournal = (() => {
          const v = localStorage.getItem('etf_trading_journal');
          return v ? JSON.parse(v) : [];
        })();
        const etfSipPlans = (() => {
          const v = localStorage.getItem('etf_sip_plans');
          return v ? JSON.parse(v) : [];
        })();
        const etfSipMultipliers = (() => {
          const v = localStorage.getItem('etf_sip_multipliers');
          return v ? JSON.parse(v) : {};
        })();
        const marketThresholds = (() => {
          const v = localStorage.getItem('marketThresholds');
          return v ? JSON.parse(v) : null;
        })();

        const dataToBackup = {
          user_markets: userMarketsStr ? JSON.parse(userMarketsStr) : null,
          deepseek_api_key: deepseekKey.trim(),
          qwen_api_key: qwenKey.trim(),
          ai_default_provider: defaultProvider,
          etf_trading_journal: etfTradingJournal,
          etf_sip_plans: etfSipPlans,
          etf_sip_multipliers: etfSipMultipliers,
          marketThresholds: marketThresholds
        };

        const res = await fetch('/api/webdav/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, username, password, data: dataToBackup })
        });
        const resJson = await res.json();
        if (res.ok && resJson.success) {
          const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
          const nowIso = new Date().toISOString();
          localStorage.setItem('last_sync_timestamp', nowStr);
          localStorage.setItem('local_last_updated', nowIso);
          setLastSyncTimestamp(nowStr);
          console.log("[Auto Sync] Background auto sync successful at " + nowStr + " (ISO: " + nowIso + ")");
        }
      } catch (err) {
        console.error("[Auto Sync Error] Background sync failed:", err);
      }
    };

    window.addEventListener('trading_journal_updated', handleJournalUpdateSync);
    return () => {
      window.removeEventListener('trading_journal_updated', handleJournalUpdateSync);
    };
  }, []);

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
      const userMarketsStr = localStorage.getItem('user_markets');
      const fetchOptions = userMarketsStr ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markets: JSON.parse(userMarketsStr) })
      } : {};

      const res = await fetch('/api/dashboard', fetchOptions);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to fetch data');
      }
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
        {cloudBackupNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-sm rounded-[24px] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                  <CloudLightning size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">坚果云备份拉取提醒</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">检测到云端存在更新的系统配置与交易流水</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">☁️ 坚果云云端备份时间</span>
                    <span className="font-mono text-emerald-400 font-bold">{cloudBackupNotice.updatedAt}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">💻 本机浏览器缓存时间</span>
                    <span className="font-mono text-slate-400 font-semibold">{cloudBackupNotice.localUpdatedAt}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  为了确保不同设备间的数据一致，建议您覆盖本地缓存。点击 <strong>立即拉取云端覆盖</strong> 将会无缝载入最新的交易流水、估值系数以及定投计划。
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    try {
                      const store = cloudBackupNotice.data;
                      if (store) {
                        if (store.user_markets !== undefined) localStorage.setItem('user_markets', JSON.stringify(store.user_markets));
                        if (store.deepseek_api_key !== undefined) localStorage.setItem('deepseek_api_key', store.deepseek_api_key);
                        if (store.qwen_api_key !== undefined) localStorage.setItem('qwen_api_key', store.qwen_api_key);
                        if (store.ai_default_provider !== undefined) localStorage.setItem('ai_default_provider', store.ai_default_provider);
                        if (store.etf_trading_journal !== undefined) localStorage.setItem('etf_trading_journal', JSON.stringify(store.etf_trading_journal));
                        if (store.etf_sip_plans !== undefined) localStorage.setItem('etf_sip_plans', JSON.stringify(store.etf_sip_plans));
                        if (store.etf_sip_multipliers !== undefined) localStorage.setItem('etf_sip_multipliers', JSON.stringify(store.etf_sip_multipliers));
                        if (store.marketThresholds !== undefined) localStorage.setItem('marketThresholds', JSON.stringify(store.marketThresholds));
                        
                        localStorage.setItem('local_last_updated', new Date().toISOString());
                        
                        alert('🎉 成功拉取并覆盖为坚果云端最新状态！系统即将智能刷新重新载入数据。');
                        window.location.reload();
                      }
                    } catch (e: any) {
                      alert('❌ 拉取覆盖失败: ' + e.message);
                    } finally {
                      setCloudBackupNotice(null);
                    }
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl transition-all shadow-lg active:scale-95 text-xs text-center"
                >
                  立即拉取云端覆盖
                </button>
                <button
                  onClick={() => {
                    setCloudBackupNotice(null);
                  }}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl transition-all active:scale-95 text-xs"
                >
                  暂不覆盖
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 sticky top-0 z-20 bg-[#0B0E14]/50 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                <Activity size={20} className="text-black" />
              </div>
              <div>
                <h1 className="text-sm min-[340px]:text-[15px] sm:text-lg md:text-xl font-bold tracking-tight text-white">
                  美股估值与 ETF 投资决策辅助系统
                </h1>
                <p className="text-[9px] sm:text-xs text-slate-400 font-mono mt-0.5 tracking-wider">
                  US MARKET STRATEGY & ETF DECISION ENGINE
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-white/5 pt-3 md:border-none md:pt-0">
              {data && data.markets && data.markets[activeMarketIdx] && data.markets[activeMarketIdx].quote && (
                <div className="flex md:flex flex-col items-start md:items-end mr-2 animate-in fade-in slide-in-from-right-4 duration-500">
                  <span className="text-[9px] sm:text-xs text-slate-400 font-mono uppercase">{data.markets[activeMarketIdx].name} 基准</span>
                  <span className={`text-xs sm:text-sm font-bold font-mono ${data.markets[activeMarketIdx].quote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${data.markets[activeMarketIdx].quote.price.toFixed(2)} {data.markets[activeMarketIdx].quote.changePct >= 0 ? '+' : ''}{data.markets[activeMarketIdx].quote.changePct.toFixed(2)}%
                  </span>
                </div>
              )}
              {data?.lastUpdated && (
                <span className="text-[10px] text-slate-400 font-mono uppercase bg-white/5 px-2.5 py-1 rounded-full border border-white/10 hidden sm:inline-block">
                  更新时间: {new Date(data.lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto md:ml-0">
                {/* Cloud Sync Button Group with Last Sync Label */}
                <div className="flex flex-col items-center">
                  <button 
                    onClick={handleCloudSyncClick}
                    className={`p-2 flex items-center gap-1.5 text-xs border rounded-lg transition-all shadow-sm ${
                      cloudSyncing 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40 animate-pulse font-medium' 
                      : cloudSyncSuccess 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 font-medium' 
                      : 'bg-sky-500/5 hover:bg-sky-500/15 text-sky-400 border-sky-500/20 hover:border-sky-500/40 font-medium'
                    }`}
                    title="坚果云 / WebDAV 云盘数据一键同步 (未配置时点击进入配置)"
                  >
                    {cloudSyncing ? (
                      <Loader2 size={14} className="animate-spin text-sky-400" />
                    ) : cloudSyncSuccess ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Cloud size={14} className="text-sky-400" />
                    )}
                    <span className="hidden sm:inline">
                      {cloudSyncing ? '同步中...' : cloudSyncSuccess ? '已同步' : '云端同步'}
                    </span>
                  </button>
                  {lastSyncTimestamp ? (
                    <span className="text-[9px] text-slate-400 hover:text-emerald-400 transition-colors font-mono tracking-tight mt-1 leading-none select-none text-center max-w-[100px] truncate" title={`上次云端同步于: ${lastSyncTimestamp}`}>
                      同步: {lastSyncTimestamp.includes(' ') ? lastSyncTimestamp.split(' ')[1] : lastSyncTimestamp}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500 font-mono tracking-tight mt-1 leading-none select-none text-center">
                      未同步
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => openSettings('api')}
                  className="p-2 self-start flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors font-medium h-[34px]"
                  title="系统设置"
                >
                  <Settings size={14} /> <span className="hidden sm:inline">系统设置</span>
                </button>
                <button 
                  onClick={fetchDashboard}
                  className="p-2 self-start text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors h-[34px]"
                  title="刷新数据"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>
        </header>
 
        <FundSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => {
            setIsSettingsOpen(false);
            setLastSyncTimestamp(localStorage.getItem('last_sync_timestamp'));
          }} 
          defaultTab={settingsTab} 
        />

        {/* Main Content */}
        <main className="max-w-6xl w-full max-w-screen-xl mx-auto px-3 sm:px-6 mt-4 sm:mt-6 overflow-hidden">
          <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />



          {activeTab === 'dashboard' && (
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 bg-white/5 p-4 rounded-3xl border border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-3">
                 <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400 shrink-0">
                   <Activity size={18} />
                 </div>
                 <div>
                   <h3 className="font-semibold text-sm text-white">投资策略视图切换 (Strategy View)</h3>
                   <p className="text-xs text-slate-400 mt-0.5">
                     {currentView === 'swing' ? '📈 波段趋势：顺势跟强，基于动量偏离与中期均线运行' : '🧘 长期定投：逆向吸筹，专注于大尺度跌幅与超卖便宜盘'}
                   </p>
                 </div>
               </div>
               
               <div className="flex bg-[#0A0D14] p-1 rounded-xl border border-white/5 self-start sm:self-auto shadow-inner">
                 <button
                   onClick={() => {
                     setCurrentView('swing');
                     localStorage.setItem('currentView', 'swing');
                   }}
                   className={`px-4 py-1.5 rounded-lg text-xs font-semibold gap-2 flex items-center transition-all ${currentView === 'swing' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold scale-[1.02]' : 'text-slate-400 hover:text-white'}`}
                 >
                   <span>📈 波段趋势视图</span>
                 </button>
                 <button
                   onClick={() => {
                     setCurrentView('dca');
                     localStorage.setItem('currentView', 'dca');
                   }}
                   className={`px-4 py-1.5 rounded-lg text-xs font-semibold gap-2 flex items-center transition-all ${currentView === 'dca' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold scale-[1.02]' : 'text-slate-400 hover:text-white'}`}
                 >
                   <span>🧘 长期定投视图</span>
                 </button>
               </div>
             </div>
          )}

          {activeTab === 'dashboard' && data && <PositionAdviceCard data={data} activeMarketIdx={activeMarketIdx} currentView={currentView} />}

          {activeTab === 'dashboard' && data && data.markets && data.markets[activeMarketIdx] && (() => {
             const activeMarket = data.markets[activeMarketIdx];
             const activeScore = currentView === 'dca' ? activeMarket.dcaMarketScore : activeMarket.swingMarketScore;
             const threshold = thresholds[activeMarket.id];
             if (threshold !== undefined && activeScore >= threshold) {
               return (
                  <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl mb-4 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shadow-lg shadow-emerald-500/10">
                     <div className="flex items-center gap-3">
                       <BellRing size={18} className="animate-bounce" />
                       <p className="font-medium text-sm">
                          【提醒】<strong className="text-white">{activeMarket.name}</strong> 市场在当前 [<strong className="text-white">{currentView === 'dca' ? '长期定投' : '波段趋势'}</strong>] 视图下综合评分 (<strong className="text-white">{activeScore}</strong>分) 已达到您设定的提醒阈值 ({threshold}分)。
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
              <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                {data.markets.map((m, idx) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMarketIdx(idx)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${activeMarketIdx === idx ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'}`}
                    >
                        {m.name}
                    </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Top Section: Score & Breakdown */}
                <div className="md:col-span-4 h-full flex">
                  <ScoreCard 
                    score={currentView === 'dca' ? data.markets[activeMarketIdx].dcaMarketScore : data.markets[activeMarketIdx].swingMarketScore} 
                    threshold={thresholds[data.markets[activeMarketIdx].id]}
                    currentView={currentView}
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
                  <MarketFactors breakdown={currentView === 'dca' ? data.markets[activeMarketIdx].dcaBreakdown : data.markets[activeMarketIdx].swingBreakdown} />
                </div>

                {/* Middle Section: Chart */}
                <div className="md:col-span-12">
                  <TrendChart 
                    data={data.markets[activeMarketIdx].chartData} 
                    breakdowns={currentView === 'dca' ? data.markets[activeMarketIdx].dcaBreakdown : data.markets[activeMarketIdx].swingBreakdown}
                    currentView={currentView}
                  />
                </div>

                {/* Bottom Section: ETF Table */}
                <div className="md:col-span-12">
                   <EtfTable 
                     etfs={data.markets[activeMarketIdx].etfs} 
                     currentView={currentView} 
                     onManageStocks={() => setIsSettingsOpen(true)}
                   />
                </div>
              </div>
            </>
          )}

          {activeTab === 'backtest' && data && (
            <QuantitativeBacktester markets={data.markets} currentViewDefault={currentView} />
          )}

          {activeTab === 'journal' && data && (
            <TradingJournal 
              markets={data.markets} 
              onManageStocks={() => setIsSettingsOpen(true)} 
            />
          )}

          {activeTab === 'plan' && data && <SipPlanner markets={data.markets} />}
          
          {activeTab === 'score' && <ScoreReference />}
        </main>
      </div>
    </div>
  );
}
