interface NavSyncLog {
  id: string;
  message: string;
  type: 'syncing' | 'success' | 'error';
}

interface NavSyncStatusProps {
  logs: NavSyncLog[];
}

/** OTC 净值后台对账状态指示器，纯展示。 */
export default function NavSyncStatus({ logs }: NavSyncStatusProps) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-[#0b1716] border border-emerald-500/15 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-duration-1000"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <h4 className="text-xs font-bold text-emerald-400 font-sans uppercase tracking-wider flex items-center gap-1">
            <span>🔄 公募基金智能纠错对账引擎 (Auto-Syncing Engine)</span>
          </h4>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          后台自动轮询纠错 · 实现T+2绝对合规计账
        </span>
      </div>
      <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 font-mono">
        {logs.slice(-4).map((log, index) => (
          <div key={index} className="flex gap-2 text-[11px] leading-relaxed animate-in fade-in slide-in-from-left-1 duration-150">
            <span className="text-slate-600">»</span>
            <span className={`font-medium ${
              log.type === 'syncing' ? 'text-amber-400 animate-pulse' :
              log.type === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
