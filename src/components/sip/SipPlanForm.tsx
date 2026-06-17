import type React from 'react';
import { Search, CheckCircle, Plus, Sparkles } from 'lucide-react';
import type { MarketData } from '../../types';

interface SipPlanFormProps {
  name: string;
  marketId: string;
  symbol: string;
  amount: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  planDayOfWeek: number;
  isSmart: boolean;
  startDate: string;
  rate: string;
  settlementDays: string;
  purchaseLimit: string;
  researchLoading: boolean;
  researchResult: any;
  markets: MarketData[];
  onNameChange: (v: string) => void;
  onMarketIdChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onFrequencyChange: (v: 'daily' | 'weekly' | 'biweekly' | 'monthly') => void;
  onPlanDayOfWeekChange: (v: number) => void;
  onIsSmartChange: (v: boolean) => void;
  onStartDateChange: (v: string) => void;
  onRateChange: (v: string) => void;
  onSettlementDaysChange: (v: string) => void;
  onPurchaseLimitChange: (v: string) => void;
  onTriggerAiResearch: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/** 创建定投计划表单。所有字段受控于父组件，AI 检索与提交逻辑在父组件。 */
export default function SipPlanForm({
  name, marketId, symbol, amount, frequency, planDayOfWeek, isSmart, startDate,
  rate, settlementDays, purchaseLimit, researchLoading, researchResult, markets,
  onNameChange, onMarketIdChange, onSymbolChange, onAmountChange, onFrequencyChange,
  onPlanDayOfWeekChange, onIsSmartChange, onStartDateChange, onRateChange,
  onSettlementDaysChange, onPurchaseLimitChange, onTriggerAiResearch, onSubmit,
}: SipPlanFormProps) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(e); }} className="space-y-4 text-xs">
      <div className="space-y-1.5">
        <label className="text-slate-400 font-semibold">计划策略名</label>
        <input
          type="text"
          required
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="如：美股指数长期智能吸筹计划"
          className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold">关联母市场</label>
          <select
            value={marketId}
            onChange={e => onMarketIdChange(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold">选择标的物</label>
          <select
            value={symbol}
            onChange={e => onSymbolChange(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-2.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {markets.find(m => m.id === marketId)?.etfs.map(e => (
              <option key={e.symbol} value={e.symbol}>{e.name.split(' ')[0]} ({e.symbol})</option>
            )) || (
              <option value="">暂无标的</option>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold">单期基准额 (元)</label>
          <input
            type="number"
            required
            value={amount}
            onChange={e => onAmountChange(e.target.value)}
            placeholder="如 1000"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold">定投周期</label>
          <select
            value={frequency}
            onChange={e => onFrequencyChange(e.target.value as any)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="daily">每日定投</option>
            <option value="weekly">每周定投</option>
            <option value="biweekly">每双周定投</option>
            <option value="monthly">每月定投</option>
          </select>
        </div>
      </div>

      {(frequency === 'weekly' || frequency === 'biweekly') && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <label className="text-slate-400 font-semibold flex items-center gap-1">
            <span>选定星期几扣划</span>
            <span className="text-[10px] text-slate-500 font-normal">(闭市顺延)</span>
          </label>
          <select
            value={planDayOfWeek}
            onChange={e => onPlanDayOfWeekChange(parseInt(e.target.value, 10))}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value={1}>周一 (Monday)</option>
            <option value={2}>周二 (Tuesday)</option>
            <option value={3}>周三 (Wednesday)</option>
            <option value={4}>周四 (Thursday)</option>
            <option value={5}>周五 (Friday)</option>
            <option value={6}>周六 (Saturday - 闭市顺延)</option>
            <option value={7}>周日 (Sunday - 闭市顺延)</option>
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-slate-400 font-semibold">首次划款起点日</label>
        <input
          type="date"
          required
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
        />
      </div>

      {/* AI Real-time Retrieval and Auto-fill Tool */}
      <div className="pt-1.5 pb-0.5">
        <button
          type="button"
          disabled={researchLoading}
          onClick={onTriggerAiResearch}
          className={`w-full py-2.5 px-3 border border-dashed rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
            researchLoading
              ? 'border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.98]'
          }`}
        >
          <Search size={14} className={researchLoading ? "animate-spin" : ""} />
          {researchLoading ? 'AI 正在检索该基金属性与休市状态...' : '🔍 让 AI 联网检索最新交易费率与闭市顺延'}
        </button>
      </div>

      {/* Research output segment */}
      {researchResult && (
        <div className="bg-[#0f172a]/90 border border-cyan-500/20 rounded-2xl p-3.5 space-y-2 text-[11px] leading-relaxed relative overflow-hidden animate-in fade-in duration-200">
          <div className="absolute right-0 top-0 bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-bl-xl font-bold scale-[0.85] origin-top-right uppercase tracking-wider font-mono">
            AI Grounded
          </div>
          <div className="flex gap-1.5 items-center font-bold text-cyan-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>AI 联网智能研判报告</span>
          </div>
          <div className="text-slate-300 mt-1">
            针对选定划款日 <strong className="text-white font-mono">{researchResult.queryDate}</strong> 的分析：
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1.5 text-slate-300">
            <div className="flex justify-between items-center">
              <span>今日国内外市场交易状态:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${researchResult.marketClosedToday ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                {researchResult.marketClosedToday ? '🔴 闭市休市' : '正常开市交易'}
              </span>
            </div>
            {researchResult.closureReason && (
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">休市原因:</span>
                <span className="text-slate-400 font-bold">{researchResult.closureReason}</span>
              </div>
            )}
            <span className="block h-[1px] bg-white/5 my-1" />
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500 block">推荐确认天数</span>
                <strong className="text-white font-mono">T+{researchResult.settlementDays} 工作日</strong>
              </div>
              <div>
                <span className="text-slate-500 block">建议交易费率比</span>
                <strong className="text-white font-mono">{researchResult.rate}%</strong>
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-[10px] mt-1 italic">
            <strong>定投可行性评估:</strong> {researchResult.analysis}
          </p>
        </div>
      )}

      {/* Overridable transaction details parsed dynamically */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold flex items-center gap-1">
            <span>交易费率比 (%)</span>
          </label>
          <input
            type="number"
            step="any"
            required
            value={rate}
            onChange={e => onRateChange(e.target.value)}
            placeholder="如 0.15"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <div className="text-[10px] text-slate-500">场外约 0.15% | 场内约 0.01%</div>
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-400 font-semibold">份额确认完成时间(开市日)</label>
          <select
            value={settlementDays}
            onChange={e => onSettlementDaysChange(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-platina-200 text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="1">T+1 工作日确认份额</option>
            <option value="2">T+2 工作日份额(场外QDII等)</option>
            <option value="3">T+3 延迟工作日确认</option>
          </select>
          <div className="text-[10px] text-slate-500">节假日闭市时顺延确认</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-slate-400 font-semibold">本基金单日申购最大限额 (元)</label>
        <input
          type="number"
          required
          value={purchaseLimit}
          onChange={e => onPurchaseLimitChange(e.target.value)}
          placeholder="无限制填 1000000"
          className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono"
        />
        <div className="text-[10px] text-slate-500">超额可能导致扣款被拒/定投完成度不全</div>
      </div>

      {/* Smart DCA Toggle */}
      <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-emerald-400 flex items-center gap-1">
            <Sparkles size={14} />
            <span>启用智能多因子调节 (SMART-DCA)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSmart}
              onChange={e => onIsSmartChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          <strong>如何决策?</strong> 开启后系统自动监控估值评分，若分高估低则自动增加申购系数，高位泡沫溢价高则防御性低位买，抹均成本，增强中长期总阿尔法值！
        </p>
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 text-sm font-sans"
      >
        <Plus size={16} /> 保存创建定投策略
      </button>
    </form>
  );
}
