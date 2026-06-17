import { useState } from 'react';

type FilterType = 'ALL' | 'BUY' | 'SELL' | 'SIP' | 'PENDING';
type SortBy = 'time-desc' | 'time-asc' | 'symbol' | 'type';

interface TradeFiltersProps {
  filterType: FilterType;
  sortBy: SortBy;
  onFilterTypeChange: (v: FilterType) => void;
  onSortByChange: (v: SortBy) => void;
  hasRecords: boolean;
  onClear: () => void;
}

/** 历史流水面板的筛选/排序工具栏 + 清空确认。清空确认态内聚于此组件。 */
export default function TradeFilters({
  filterType,
  sortBy,
  onFilterTypeChange,
  onSortByChange,
  hasRecords,
  onClear,
}: TradeFiltersProps) {
  const [isClearingReal, setIsClearingReal] = useState(false);

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">历史收支核销流水</h3>

        {/* Filter selectors to reduce clutter */}
        <select
          value={filterType}
          onChange={e => onFilterTypeChange(e.target.value as FilterType)}
          className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 font-sans focus:outline-none focus:border-emerald-500/50"
        >
          <option value="ALL">全部操作 (ALL)</option>
          <option value="BUY">普通买入</option>
          <option value="SIP">定投买入</option>
          <option value="SELL">单边卖出</option>
          <option value="PENDING">待对账确认</option>
        </select>

        {/* Sort selectors */}
        <select
          value={sortBy}
          onChange={e => onSortByChange(e.target.value as SortBy)}
          className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 font-sans focus:outline-none focus:border-emerald-500/50"
        >
          <option value="time-desc">⏳ 交易时间降序 (最新在前)</option>
          <option value="time-asc">⌛ 交易时间升序 (最早在前)</option>
          <option value="symbol">🗂️ 按资产代码分类 (A-Z)</option>
          <option value="type">🔄 按买/卖类型聚类</option>
        </select>
      </div>

      {hasRecords && (
        <div className="flex items-center">
          {isClearingReal ? (
            <div className="flex items-center gap-2 bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/50 animate-in fade-in duration-200">
              <span className="text-[11px] text-red-400 font-semibold">确定清除全部流水吗？关联持仓也可能清零：</span>
              <button
                onClick={() => {
                  onClear();
                  setIsClearingReal(false);
                }}
                className="text-[10px] bg-red-600 hover:bg-red-500 text-slate-950 font-bold px-2 py-0.5 rounded"
              >
                确定
              </button>
              <button
                onClick={() => setIsClearingReal(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-white/10"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsClearingReal(true)}
              className="text-[10px] text-red-400 hover:text-red-300 px-2.5 py-1 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors font-bold"
            >
              清空流水
            </button>
          )}
        </div>
      )}
    </div>
  );
}
