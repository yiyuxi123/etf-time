import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Key, Cpu, Eye, EyeOff, Sparkles, Sliders, Cloud, HelpCircle, Loader2 } from 'lucide-react';
import { defaultMarketsConfig } from '../config/defaultMarkets';

export default function FundSettingsModal({ isOpen, onClose, defaultTab = 'api' }: { isOpen: boolean, onClose: () => void, defaultTab?: 'api' | 'stocks' | 'sync' | 'cicd' }) {
  // Tabs: 'api' or 'stocks' or 'sync' or 'cicd'
  const [activeSubTab, setActiveSubTab] = useState<'api' | 'stocks' | 'sync' | 'cicd'>(defaultTab);

  useEffect(() => {
    if (isOpen) {
      setActiveSubTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Load existing stocks config
  const [markets, setMarkets] = useState<any[]>(() => {
    const saved = localStorage.getItem('user_markets');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultMarketsConfig));
  });

  // Load API configurations
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseek_api_key') || '');
  const [qwenKey, setQwenKey] = useState(() => localStorage.getItem('qwen_api_key') || '');
  const [defaultProvider, setDefaultProvider] = useState(() => localStorage.getItem('ai_default_provider') || 'gemini');

  // Password visibility
  const [showDsKey, setShowDsKey] = useState(false);
  const [showQwenKey, setShowQwenKey] = useState(false);

  // WebDAV states
  const [webdavUrl, setWebdavUrl] = useState(() => localStorage.getItem('webdav_url') || 'https://dav.jianguoyun.com/dav/我的坚果云/');
  const [webdavUsername, setWebdavUsername] = useState(() => localStorage.getItem('webdav_username') || '');
  const [webdavPassword, setWebdavPassword] = useState(() => localStorage.getItem('webdav_password') || '');
  const [webdavAutoBackup, setWebdavAutoBackup] = useState(() => localStorage.getItem('webdav_auto_backup') === 'true');
  const [webdavAutoCicd, setWebdavAutoCicd] = useState(() => localStorage.getItem('webdav_auto_cicd') !== 'false');
  const [showWebdavPassword, setShowWebdavPassword] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [cicdStatus, setCicdStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [cicdLogs, setCicdLogs] = useState<string[]>([]);

  const [isResetConfirming, setIsResetConfirming] = useState(false);

  if (!isOpen) return null;

  const runCicdRepairPipeline = async () => {
    setCicdStatus('running');
    setCicdLogs([`[${new Date().toLocaleTimeString()}] 🚀 正在建立高安全性多通道网络连结...`]);
    try {
      const res = await fetch('/api/webdav/process-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCicdStatus('success');
        setCicdLogs(data.logs || []);
      } else {
        setCicdStatus('error');
        setCicdLogs(prev => [...prev, `[ERROR] CI/CD 系统中断运行。原因: ${data.error || '对账服务器核验无响应'}`]);
      }
    } catch (e: any) {
      setCicdStatus('error');
      setCicdLogs(prev => [...prev, `[ERROR] 网络握手异常: ${e.message}`]);
    }
  };

  const handleSave = async () => {
    localStorage.setItem('user_markets', JSON.stringify(markets));
    localStorage.setItem('deepseek_api_key', deepseekKey.trim());
    localStorage.setItem('qwen_api_key', qwenKey.trim());
    localStorage.setItem('ai_default_provider', defaultProvider);
    localStorage.setItem('webdav_url', webdavUrl.trim());
    localStorage.setItem('webdav_username', webdavUsername.trim());
    localStorage.setItem('webdav_password', webdavPassword.trim());
    localStorage.setItem('webdav_auto_backup', webdavAutoBackup ? 'true' : 'false');
    localStorage.setItem('webdav_auto_cicd', webdavAutoCicd ? 'true' : 'false');
    
    if (webdavAutoBackup && webdavUsername.trim() && webdavPassword.trim()) {
      try {
        const dataToBackup = {
          user_markets: markets,
          deepseek_api_key: deepseekKey.trim(),
          qwen_api_key: qwenKey.trim(),
          ai_default_provider: defaultProvider,
          etf_trading_journal: (() => {
            const v = localStorage.getItem('etf_trading_journal');
            return v ? JSON.parse(v) : [];
          })(),
          etf_sip_plans: (() => {
            const v = localStorage.getItem('etf_sip_plans');
            return v ? JSON.parse(v) : [];
          })(),
          etf_sip_multipliers: (() => {
            const v = localStorage.getItem('etf_sip_multipliers');
            return v ? JSON.parse(v) : {};
          })(),
          marketThresholds: (() => {
            const v = localStorage.getItem('marketThresholds');
            return v ? JSON.parse(v) : null;
          })()
        };

        const resBackup = await fetch('/api/webdav/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword, data: dataToBackup })
        });
        const resJson = await resBackup.json();
        if (resBackup.ok && resJson.success) {
          const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
          const nowIso = new Date().toISOString();
          localStorage.setItem('last_sync_timestamp', nowStr);
          localStorage.setItem('local_last_updated', nowIso);
        }
      } catch (e) {
        console.error("Auto backup failed:", e);
      }
    }
    // Refresh page to take effect
    window.location.reload();
  };

  const testWebdavConnection = async () => {
    if (!webdavUsername || !webdavPassword) {
      setSyncStatus({ type: 'error', message: '请输入坚果云账户与应用授权密码！' });
      return;
    }
    setSyncStatus({ type: 'loading', message: '正在测试连接坚果云 WebDAV...' });
    try {
      const res = await fetch('/api/webdav/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({ type: 'success', message: data.message });
      } else {
        setSyncStatus({ type: 'error', message: data.error || '连接失败，请检查配置' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: `连接异常: ${e.message}` });
    }
  };

  const backupToWebdav = async () => {
    if (!webdavUsername || !webdavPassword) {
      setSyncStatus({ type: 'error', message: '请先填写坚果云账户及授权密码！' });
      return;
    }
    setSyncStatus({ type: 'loading', message: '正在备份本地配置与交易数据到云端...' });
    try {
      const dataToBackup = {
        user_markets: markets,
        deepseek_api_key: deepseekKey.trim(),
        qwen_api_key: qwenKey.trim(),
        ai_default_provider: defaultProvider,
        etf_trading_journal: (() => {
          const v = localStorage.getItem('etf_trading_journal');
          return v ? JSON.parse(v) : [];
        })(),
        etf_sip_plans: (() => {
          const v = localStorage.getItem('etf_sip_plans');
          return v ? JSON.parse(v) : [];
        })(),
        etf_sip_multipliers: (() => {
          const v = localStorage.getItem('etf_sip_multipliers');
          return v ? JSON.parse(v) : {};
        })(),
        marketThresholds: (() => {
          const v = localStorage.getItem('marketThresholds');
          return v ? JSON.parse(v) : null;
        })()
      };

      const res = await fetch('/api/webdav/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword, data: dataToBackup })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
        const nowIso = new Date().toISOString();
        localStorage.setItem('last_sync_timestamp', nowStr);
        localStorage.setItem('local_last_updated', nowIso);
        setSyncStatus({ type: 'success', message: `备份成功！备份时间: ${nowStr}。数据已安全加密保存在云端。` });
      } else {
        setSyncStatus({ type: 'error', message: data.error || '备份失败' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: `备份出错: ${e.message}` });
    }
  };

  const restoreFromWebdav = async () => {
    if (!webdavUsername || !webdavPassword) {
      setSyncStatus({ type: 'error', message: '请先填写坚果云账户及授权密码！' });
      return;
    }
    const confirmRestore = window.confirm("⚠️ 确定从云端恢复吗？这会覆盖本地所有的定投计划、交易记录、自选列表及 API key！此操作无法撤销。");
    if (!confirmRestore) return;

    setSyncStatus({ type: 'loading', message: '正在从云端拉取并同步数据...' });
    try {
      const res = await fetch('/api/webdav/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const payload = data.data;
        const store = payload.store;

        if (store) {
          if (store.user_markets) localStorage.setItem('user_markets', JSON.stringify(store.user_markets));
          if (store.deepseek_api_key !== undefined) localStorage.setItem('deepseek_api_key', store.deepseek_api_key);
          if (store.qwen_api_key !== undefined) localStorage.setItem('qwen_api_key', store.qwen_api_key);
          if (store.ai_default_provider !== undefined) localStorage.setItem('ai_default_provider', store.ai_default_provider);
          if (store.etf_trading_journal) localStorage.setItem('etf_trading_journal', JSON.stringify(store.etf_trading_journal));
          if (store.etf_sip_plans) localStorage.setItem('etf_sip_plans', JSON.stringify(store.etf_sip_plans));
          if (store.etf_sip_multipliers) localStorage.setItem('etf_sip_multipliers', JSON.stringify(store.etf_sip_multipliers));
          if (store.marketThresholds) localStorage.setItem('marketThresholds', JSON.stringify(store.marketThresholds));
          
          if (payload.updatedAt) {
            const dateStr = new Date(payload.updatedAt).toLocaleString('zh-CN', { hour12: false });
            localStorage.setItem('last_sync_timestamp', dateStr);
            localStorage.setItem('local_last_updated', payload.updatedAt);
          } else {
            const nowIso = new Date().toISOString();
            localStorage.setItem('last_sync_timestamp', new Date().toLocaleString('zh-CN', { hour12: false }));
            localStorage.setItem('local_last_updated', nowIso);
          }

          setSyncStatus({ type: 'success', message: '同步完成！正在刷新应用以加载最新云端配置...' });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setSyncStatus({ type: 'error', message: '拉取成功，但备份数据格式不符合要求' });
        }
      } else {
        setSyncStatus({ type: 'error', message: data.error || '拉取备份失败' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: `恢复失败: ${e.message}` });
    }
  };

  const addEtf = (marketIndex: number) => {
    const newMarkets = [...markets];
    newMarkets[marketIndex].etfSymbols.push({ symbol: '', name: '新标的', fee: '0.00% / 年' });
    setMarkets(newMarkets);
  };

  const updateEtf = (marketIndex: number, etfIndex: number, field: string, value: string) => {
    const newMarkets = [...markets];
    newMarkets[marketIndex].etfSymbols[etfIndex][field] = value;
    setMarkets(newMarkets);
  };

  const removeEtf = (marketIndex: number, etfIndex: number) => {
    const newMarkets = [...markets];
    newMarkets[marketIndex].etfSymbols.splice(etfIndex, 1);
    setMarkets(newMarkets);
  };

  const resetDefault = () => {
    localStorage.removeItem('user_markets');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="text-emerald-400" size={18} />
              系统设置与标的管理
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
              在此配置大模型交易识单 API Keys、默认 AI 记账引擎，以及增删交易自选标的。
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-full transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Modular Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 sm:px-6 py-1.5 sm:py-2 gap-2 shrink-0 overflow-x-auto scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setActiveSubTab('api')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${activeSubTab === 'api' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/20'}`}
          >
            <Key size={14} />
            AI 模型记账配置 (API Settings)
          </button>
          <button
            onClick={() => setActiveSubTab('stocks')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${activeSubTab === 'stocks' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/20'}`}
          >
            <Sliders size={14} />
            自选标的管理 (Stocks / Funds)
          </button>
          <button
            onClick={() => setActiveSubTab('sync')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${activeSubTab === 'sync' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/20'}`}
          >
            <Cloud size={14} />
            坚果云 / WebDAV 云同步 (Cloud Sync)
          </button>
          <button
            onClick={() => setActiveSubTab('cicd')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${activeSubTab === 'cicd' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800/20'}`}
          >
            <Sparkles size={14} className="text-emerald-400" />
            AI 对账自愈 & CI/CD 诊断箱 (Self-Heal Control)
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950/20">
          {activeSubTab === 'api' && (
            <div className="space-y-6">
              
              {/* Default selection engine */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="text-emerald-400" size={16} />
                  <span className="font-bold text-slate-200 text-sm">选择默认 AI 记账引擎</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  选择大语言模型对图片和一句话描述进行理解。Gemini 为系统内置引擎（免费无需配置）；若需体验 DeepSeek 或 Qwen，请在下方补充对应的 API 密钥。
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { id: 'gemini', title: 'Gemini (内置)', desc: '支持一句话与图片识单（免费免配置）' },
                    { id: 'deepseek', title: 'DeepSeek Chat', desc: '支持一句话极速录入（需配置 API Key）' },
                    { id: 'qwen', title: 'Qwen 通义千问', desc: '支持一句话及 vision 截图识单（需 API Key）' }
                  ].map((engine) => (
                    <label 
                      key={engine.id}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${defaultProvider === engine.id ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-400 shadow-md' : 'bg-black/20 border-slate-800 hover:bg-slate-800/30 text-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="ai_provider"
                          checked={defaultProvider === engine.id}
                          onChange={() => setDefaultProvider(engine.id)}
                          className="accent-emerald-400 mr-1"
                        />
                        <span className="font-bold text-xs">{engine.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-normal">{engine.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* API and Key configurations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* DeepSeek configuration */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-200">DeepSeek API 设置</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">deepseek-chat</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-semibold block">DEEPSEEK API KEY</label>
                    <div className="relative">
                      <input 
                        type={showDsKey ? "text" : "password"}
                        value={deepseekKey}
                        onChange={(e) => setDeepseekKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-emerald-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDsKey(!showDsKey)}
                        className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-400"
                      >
                        {showDsKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    请到 DeepSeek 开放平台申请 API Key。由于 DeepSeek 标准 Chat 接口暂时不具备完整视觉多模态，用此大模型处理图片可能会提示出错。
                  </p>
                </div>

                {/* Qwen / Dashscope configuration */}
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-200">Qwen / 阿里百炼设置</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">qwen-plus & vl</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-semibold block">DASHSCOPE API KEY / QWEN KEY</label>
                    <div className="relative">
                      <input 
                        type={showQwenKey ? "text" : "password"}
                        value={qwenKey}
                        onChange={(e) => setQwenKey(e.target.value)}
                        placeholder="请输入阿里云百炼 API Key"
                        className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-emerald-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowQwenKey(!showQwenKey)}
                        className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-400"
                      >
                        {showQwenKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    支持一句话和截图记账流程。文字调用 qwen-plus，附带截图自动识别调用大模视觉感知层 qwen-vl-plus 提炼成交摘要。
                  </p>
                </div>

              </div>

            </div>
          )}

          {activeSubTab === 'stocks' && (
            <div className="space-y-6">
              {markets.map((market, mIdx) => (
                <div key={market.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden animate-in fade-in duration-200">
                   <div className="bg-slate-800/50 p-4 border-b border-slate-700/50 flex justify-between items-center">
                     <div className="font-bold text-slate-200 text-sm">{market.name} <span className="text-[10px] text-slate-500 font-mono ml-2 border border-slate-700 bg-black/20 rounded px-1.5 py-0.2">{market.benchmarkSymbol}</span></div>
                   </div>
                   <div className="p-4 space-y-3">
                     {market.etfSymbols.map((etf: any, eIdx: number) => (
                       <div key={eIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-black/20 p-3 rounded-lg border border-slate-700/30 animate-in fade-in duration-200">
                         <div className="flex flex-col gap-1 sm:col-span-3">
                           <label className="text-[9px] text-slate-600 uppercase font-semibold">交易代码</label>
                           <input 
                             value={etf.symbol}
                             onChange={(e) => updateEtf(mIdx, eIdx, 'symbol', e.target.value)}
                             className="bg-transparent border-b border-slate-800 text-xs focus:border-emerald-500 text-slate-200 focus:outline-none pb-1 font-mono w-full"
                             placeholder="如 f_016452"
                           />
                         </div>
                         <div className="flex flex-col gap-1 sm:col-span-4">
                           <label className="text-[9px] text-slate-600 uppercase font-semibold">名称备注</label>
                           <input 
                             value={etf.name}
                             onChange={(e) => updateEtf(mIdx, eIdx, 'name', e.target.value)}
                             className="bg-transparent border-b border-slate-800 text-xs focus:border-emerald-500 text-slate-200 focus:outline-none pb-1 w-full"
                             placeholder="如 华夏纳指100"
                           />
                         </div>
                         <div className="flex flex-col gap-1 sm:col-span-4">
                           <label className="text-[9px] text-slate-600 uppercase font-semibold">年度损耗 / 费率说明</label>
                           <input 
                             value={etf.fee || ''}
                             onChange={(e) => updateEtf(mIdx, eIdx, 'fee', e.target.value)}
                             className="bg-transparent border-b border-slate-800 text-xs focus:border-emerald-500 text-slate-200 focus:outline-none pb-1 w-full"
                             placeholder="如 0.8% / 年"
                           />
                         </div>
                         <div className="flex items-center justify-end sm:justify-center sm:col-span-1 pb-1">
                           <button onClick={() => removeEtf(mIdx, eIdx)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="删除当前标的">
                             <Trash2 size={15} />
                           </button>
                         </div>
                       </div>
                      ))}
                      <button onClick={() => addEtf(mIdx)} className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center mt-2.5 px-3 py-1.5 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-colors w-max font-bold">
                        <Plus size={13} className="mr-1" /> 添加板块成员
                      </button>
                    </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* WebDAV Cloud Sync UI Panel */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Cloud className="text-emerald-400" size={18} />
                  <span className="font-bold text-slate-200 text-sm">坚果云 / WebDAV 云端备份同步</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  通过标准的 WebDAV 传输协议，您可以将本地所有的 <b>定投计划配置、交易历史记录、自定义自选证券标的</b>，以及 <b>大模型 API 密钥配置</b> 安全备份存储至您的云端，实现永不丢失、跨端登录、一键导入。
                </p>

                {/* Account Setup Input fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                      WebDAV 服务端地址 (DCA URL)
                      <span className="text-[10px] text-slate-500 font-normal">(坚果云默认为根路径)</span>
                    </label>
                    <input
                      type="text"
                      value={webdavUrl}
                      onChange={(e) => setWebdavUrl(e.target.value)}
                      className="bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono focus:border-emerald-500 focus:outline-none transition-colors"
                      placeholder="https://dav.jianguoyun.com/dav/"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-semibold">坚果云账号 (邮箱/手机号)</label>
                    <input
                      type="text"
                      value={webdavUsername}
                      onChange={(e) => setWebdavUsername(e.target.value)}
                      className="bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                      placeholder="e.g. username@example.com"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>第三方应用授权密码</span>
                      <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                        <HelpCircle size={11} /> 必须在坚果云后台申请<b>应用授权密码</b>，不能填普通账户密码
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showWebdavPassword ? 'text' : 'password'}
                        value={webdavPassword}
                        onChange={(e) => setWebdavPassword(e.target.value)}
                        className="bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 pr-10 text-xs font-mono w-full focus:border-emerald-500 focus:outline-none transition-colors"
                        placeholder="在坚果云「账户信息 -> 安全选项 -> 第三方应用管理」中添加并复制"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebdavPassword(!showWebdavPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showWebdavPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto Cloud Sync Switch */}
                <div className="flex items-center justify-between p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/60 mt-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">自动随本地保存同步 (Auto Sync)</span>
                    <span className="text-[10px] text-slate-400">在您点击保存配置或修改完毕时，静默备份最新的全部配置至坚果云盘。</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={webdavAutoBackup}
                      onChange={(e) => setWebdavAutoBackup(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-emerald-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500/20 border border-slate-700 peer-checked:border-emerald-500/40"></div>
                  </label>
                </div>
              </div>

              {/* Action buttons & guides */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={testWebdavConnection}
                  disabled={syncStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-slate-200 disabled:opacity-50 text-xs font-bold rounded-xl border border-slate-700/60 hover:border-slate-600 transition-all active:scale-[0.98]"
                >
                  {syncStatus.type === 'loading' ? <Loader2 size={14} className="animate-spin text-emerald-400" /> : <Cloud size={14} />}
                  测试云端连接
                </button>

                <button
                  type="button"
                  onClick={backupToWebdav}
                  disabled={syncStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/10 active:scale-[0.98]"
                >
                  {syncStatus.type === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  立即备份当前数据
                </button>

                <button
                  type="button"
                  onClick={restoreFromWebdav}
                  disabled={syncStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                >
                  {syncStatus.type === 'loading' ? <Loader2 size={14} className="animate-spin text-emerald-400" /> : <Cloud size={14} className="text-emerald-400" />}
                  从云端恢复本地数据
                </button>
              </div>

              {/* Action Status Output log */}
              {syncStatus.type !== 'idle' && (
                <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                  syncStatus.type === 'loading' ? 'bg-slate-800/40 text-slate-300 border border-slate-800' :
                  syncStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {syncStatus.type === 'loading' ? (
                    <Loader2 size={16} className="animate-spin shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <Cloud size={16} className="shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-semibold block">
                      {syncStatus.type === 'loading' ? '云端通信中...' : syncStatus.type === 'success' ? '操作成功' : '发生错误'}
                    </span>
                    <p className="opacity-90 leading-relaxed text-[11px] font-sans whitespace-pre-wrap">{syncStatus.message}</p>
                  </div>
                </div>
              )}

              {/* Easy setup tutorial card */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle size={12} className="text-emerald-400" /> 坚果云 (Jianguoyun) WebDAV 三步简易配置指南：
                </span>
                <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside pl-1">
                  <li>打开坚果云官网登录您的账号，进入右上角 <b>「账户信息 &rarr; 安全选项 &rarr; 第三方应用管理」</b>。</li>
                  <li>点击 <b>「添加应用」</b>，给该应用命名（如 <i>InvestmentApp</i>），生成为您专属的一串<b>应用授权密码</b>。</li>
                  <li>将您的坚果云登录用户名（通常是您的电子邮箱） and 上面刚刚生成的<b>授权密码</b>填入本页面表格中，然后点保存账户即可！</li>
                </ol>
              </div>
            </div>
          )}

          {activeSubTab === 'cicd' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-400 animate-pulse" size={18} />
                  <span className="font-bold text-slate-200 text-sm">AI 纠错自愈 & Anti-Pollution CI/CD 回路控制中心</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  启动 CI/CD 智能数据治理引擎。本系统将自动从本地与坚果云（如有配置）下载用户提交的所有公认资产价格修正、NAV纠错报告，并通过多信道比对进行安全审计。<b>符合官方历史交易数据的纠错包将全自动吸收自愈至主对账数据库并打上防污染数字水印，防止重复分析。</b>
                </p>

                {/* Switch for Startup Auto Self-Healing */}
                <div className="flex items-center justify-between p-3.5 bg-slate-900/40 rounded-xl border border-slate-800/60 mt-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">启动时自动加载纠错包并对账 (Auto-Heal on Boot)</span>
                    <span className="text-[10px] text-slate-400">开启此项后，每次打开页面都会在后台静默读取坚果云盘修正清单文件并热补丁，防止重复载入。</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={webdavAutoCicd}
                      onChange={(e) => setWebdavAutoCicd(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-emerald-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500/20 border border-slate-700 peer-checked:border-emerald-500/40"></div>
                  </label>
                </div>
              </div>

              {/* Action trigger button */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={runCicdRepairPipeline}
                  disabled={cicdStatus === 'running'}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.97]"
                >
                  {cicdStatus === 'running' ? (
                    <Loader2 size={15} className="animate-spin text-slate-950" />
                  ) : (
                    <Sparkles size={15} className="text-slate-950" />
                  )}
                  ⚡ 立即执行全套 CI/CD 数据流沙试验与自巡检热补丁
                </button>
              </div>

              {/* Terminal code window */}
              {cicdLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 uppercase tracking-wider">
                    <span>CI/CD 自愈诊断控制台输出日志 (System Terminal Output)</span>
                    <span className="text-emerald-400/80 animate-pulse font-mono flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE AGENT SESSION
                    </span>
                  </div>
                  <div className="bg-black/95 p-4 rounded-2xl border border-slate-800 font-mono text-[10px] md:text-xs text-emerald-400/90 leading-relaxed overflow-y-auto max-h-[260px] shadow-2xl space-y-1.5 scrollbar-thin">
                    {cicdLogs.map((log, lIdx) => (
                      <div key={lIdx} className="whitespace-pre-wrap font-mono select-text">
                        {log}
                      </div>
                    ))}
                    {cicdStatus === 'running' && (
                      <div className="animate-pulse text-slate-500 font-mono italic">
                        &gt; System compiling and cross-checking records, please stand by...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center rounded-b-2xl shrink-0">
           {isResetConfirming ? (
             <div className="flex items-center gap-2 animate-in fade-in duration-200 w-full sm:w-auto justify-between sm:justify-start">
               <span className="text-[11px] sm:text-xs text-red-400 font-semibold">确定恢复吗？</span>
               <div className="flex items-center gap-2">
                 <button onClick={resetDefault} className="text-[11px] sm:text-xs bg-red-500 hover:bg-red-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors">
                    确定重置
                 </button>
                 <button onClick={() => setIsResetConfirming(false)} className="text-[11px] sm:text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                    取消
                 </button>
               </div>
             </div>
           ) : (
             <button 
               onClick={() => setIsResetConfirming(true)} 
               className="text-[11px] sm:text-xs text-slate-500 hover:text-slate-300 px-3 py-2 hover:bg-slate-800 rounded-lg transition-colors w-full sm:w-auto text-left"
               disabled={activeSubTab !== 'stocks'}
               style={{ opacity: activeSubTab === 'stocks' ? 1 : 0 }}
             >
                恢复板块标的推荐
             </button>
           )}
           <button onClick={handleSave} className="flex justify-center items-center text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 w-full sm:w-auto">
              <Save size={15} className="mr-1.5" /> 保存配置并应用
           </button>
        </div>

      </div>
    </div>
  );
}
