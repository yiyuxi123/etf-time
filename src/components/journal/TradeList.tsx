import { Pencil, Trash2 } from 'lucide-react';
import type { TradeRecord } from '../../types';

interface OtcDates {
  deductionDate: string;
  confirmDate: string;
  isPostponed: boolean;
}

interface TradeListProps {
  sortedRecords: TradeRecord[];
  filteredRecords: TradeRecord[];
  deletingRecordId: string | null;
  isOtcSymbol: (sym: string) => boolean;
  getOtcDates: (dateStr: string, symbol: string) => OtcDates;
  getNextTradingDay: (dateStr: string, symbol: string) => string;
  onConfirmPending: (record: TradeRecord) => void;
  onEdit: (record: TradeRecord) => void;
  onRequestDelete: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onReportCorrection: (record: TradeRecord) => void;
}

/** 历史收支核销流水表格。删除确认态沿用父组件单 id 控制。 */
export default function TradeList({
  sortedRecords,
  filteredRecords,
  deletingRecordId,
  isOtcSymbol,
  getOtcDates,
  getNextTradingDay,
  onConfirmPending,
  onEdit,
  onRequestDelete,
  onDelete,
  onCancelDelete,
  onReportCorrection,
}: TradeListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10 select-none">
          <tr>
            <th className="pb-3 pl-2">过账日期</th>
            <th className="pb-3">动作类型</th>
            <th className="pb-3">资产代码</th>
            <th className="pb-3 text-right">价格/净值</th>
            <th className="pb-3 text-right">交易份额</th>
            <th className="pb-3 text-right">划款扣费</th>
            <th className="pb-3 text-right pr-2">安全剔除</th>
          </tr>
        </thead>
        <tbody className="text-sm font-mono divide-y divide-white/5">
          {sortedRecords.map((record, i) => (
            <tr key={`${record.id}-${i}`} className="hover:bg-white/5 transition-colors group">
              <td className="py-3 pl-2 text-xs">
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOTC = isOtcSymbol(record.symbol);

                  if (isOTC) {
                    const { deductionDate, confirmDate, isPostponed } = getOtcDates(record.date, record.symbol);
                    const isDeductionPending = deductionDate > todayStr;

                    return (
                      <div className="flex flex-col gap-0.5 leading-normal">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">扣款日:</span>
                          <span className="text-slate-200 font-mono text-[11px] font-medium">{deductionDate}</span>
                          {isPostponed && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 font-semibold scale-90 origin-left">顺延</span>
                          )}
                          {isDeductionPending && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold scale-90 origin-left">待扣款</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">确权日:</span>
                          <span className="text-slate-400 font-mono text-[11px]">{confirmDate}</span>
                          {!isDeductionPending && record.isPending && record.navStatus === 'not_updated' && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-semibold scale-90 origin-left">未更新</span>
                          )}
                          {!isDeductionPending && record.isPending && record.navStatus !== 'not_updated' && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-semibold scale-90 origin-left animate-pulse">待确权</span>
                          )}
                          {!isDeductionPending && !record.isPending && record.navStatus === 'updated' && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold scale-90 origin-left">已更新</span>
                          )}
                          {!isDeductionPending && !record.isPending && record.navStatus !== 'updated' && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold scale-90 origin-left">已确权</span>
                          )}
                          {isDeductionPending && (
                            <span className="text-[9px] text-slate-600 scale-90 origin-left">(预期确权)</span>
                          )}
                        </div>
                        {!isDeductionPending && record.isPending && record.navStatus === 'not_updated' && (
                          <div className="text-[9.5px] text-red-400 font-sans font-semibold mt-0.5 animate-pulse flex items-center gap-1">
                            <span>⚠️ 净值暂未公布</span>
                          </div>
                        )}
                        {!isDeductionPending && !record.isPending && record.navStatus === 'updated' && (
                          <div className="text-[10px] text-emerald-500/80 font-sans font-semibold mt-0.5 flex items-center gap-1">
                            <span>✓ 自动校对已更新</span>
                          </div>
                        )}
                        {isPostponed && (
                          <div className="text-[9.5px] text-slate-500 font-sans leading-none mt-0.5 opacity-80">
                            (计划: {record.date} 休市)
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return <span className="text-slate-400 font-mono">{record.date}</span>;
                  }
                })()}
              </td>
              <td className={`py-3 text-xs font-bold ${record.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                {record.isSip ? '🔄 定投' : (record.type === 'BUY' ? '买入' : '卖出')}
              </td>
              <td className="py-3 text-xs text-slate-300 font-semibold">{record.symbol}</td>
              <td className="py-3 text-right text-xs text-slate-200">
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOTC = isOtcSymbol(record.symbol);
                  const actualDeductionDate = isOTC ? getNextTradingDay(record.date, record.symbol) : record.date;

                  if (actualDeductionDate > todayStr) {
                    return (
                      <span className="text-amber-500 font-semibold italic text-[11px]">
                        扣 ¥{(record.pendingAmount || record.price * record.shares || 0).toFixed(2)} [待扣款]
                      </span>
                    );
                  } else if (record.isPending) {
                    return (
                      <span className="text-yellow-500 font-semibold italic text-[11px] animate-pulse">
                        扣 ¥{(record.pendingAmount || 0).toFixed(2)} [待确认]
                      </span>
                    );
                  } else {
                    return (
                      <div className="flex flex-col items-end">
                        <span className={record.hasConflict ? "text-amber-400 font-bold font-mono" : "text-slate-250 font-mono"}>
                          ¥{record.price.toFixed(4)}
                        </span>
                        {record.hasConflict && (
                          <button
                            type="button"
                            onClick={() => onReportCorrection(record)}
                            className="text-[9px] bg-red-500/20 text-red-300 hover:bg-red-500/35 border border-red-500/30 px-1 py-0.5 rounded cursor-pointer mt-0.5"
                            title={record.conflictDetails || "多源对账单校准存在冲突"}
                          >
                            ⚠️ 对账冲突(点击纠错)
                          </button>
                        )}
                      </div>
                    );
                  }
                })()}
              </td>
              <td className="py-3 text-right text-xs text-slate-300">
                {record.isPending ? (
                  <span className="text-slate-500 text-[11px]">- -</span>
                ) : (
                  record.shares.toFixed(2)
                )}
              </td>
              <td className="py-3 text-right text-xs text-yellow-400 font-semibold">¥{record.fee.toFixed(2)}</td>
              <td className="py-3 text-right pr-2">
                {deletingRecordId === record.id ? (
                  <div className="flex items-center justify-end gap-1.5 animate-in fade-in duration-100">
                    <button
                      onClick={() => onDelete(record.id)}
                      className="text-[10px] bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded text-slate-950 font-bold"
                    >
                      确认
                    </button>
                    <button
                      onClick={onCancelDelete}
                      className="text-[10px] bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-white/5"
                    >
                      否
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end items-center gap-1">
                    {record.isPending && (
                      <button
                        onClick={() => onConfirmPending(record)}
                        className="text-[10px] bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-2 py-0.5 rounded transition-all active:scale-95 flex items-center mr-1"
                        title="立刻确认该日净值"
                      >
                        确认净值
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(record)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg sm:opacity-0 group-hover:opacity-100"
                      title="修改交易记录"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onRequestDelete(record.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg sm:opacity-80 group-hover:opacity-100"
                      title="删除单条数据"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {filteredRecords.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-500 text-xs select-none">暂无对应检索条件的交易记录。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
