import type React from 'react';
import { Check, X, Pencil, Cpu, Plus } from 'lucide-react';
import type { TradeRecord } from '../../types';
import type { EtfInfo, MarketData } from '../../types';

interface TradeFormConfirmProps {
  record: TradeRecord;
  pendingConfirmPrice: string;
  onPendingConfirmPriceChange: (v: string) => void;
  findEtfBySymbol: (sym: string) => EtfInfo | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 场外基金 pending 记录的成交净值确认弹窗。 */
export function TradeFormConfirm({
  record,
  pendingConfirmPrice,
  onPendingConfirmPriceChange,
  findEtfBySymbol,
  onConfirm,
  onCancel,
}: TradeFormConfirmProps) {
  const matchedEtf = findEtfBySymbol(record.symbol);
  const netPrincipal = (record.pendingAmount || 0) - record.fee;
  const priceVal = parseFloat(pendingConfirmPrice);
  const computedS = !isNaN(priceVal) && priceVal > 0 ? netPrincipal / priceVal : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Check className="text-yellow-400" size={16} />
            <h3 className="font-bold text-sm text-white font-sans">确认场外成交净值</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white bg-slate-800/40 p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">标的代码 / 名称:</span>
              <span className="text-white font-semibold font-mono">{record.symbol} {matchedEtf?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">扣款过账日期:</span>
              <span className="text-white font-semibold font-mono">{record.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">扣划总本金:</span>
              <span className="text-yellow-400 font-bold font-mono">¥{(record.pendingAmount || 0).toFixed(2)} 元</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">扣划损耗佣金:</span>
              <span className="text-slate-300 font-mono">¥{record.fee.toFixed(4)} 元</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1.5">
              <span className="text-slate-400 font-medium">确认实投本金:</span>
              <span className="text-emerald-400 font-bold font-mono">¥{netPrincipal.toFixed(4)} 元</span>
            </div>
          </div>

          <div className="space-y-1.5 font-sans">
            <label className="text-[11px] text-slate-400 font-semibold uppercase block">输入确认时成交单元净值 (元)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.0001"
                value={pendingConfirmPrice}
                onChange={e => onPendingConfirmPriceChange(e.target.value)}
                placeholder="例如 1.2345"
                className="flex-1 bg-black/40 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-yellow-500"
              />
              {matchedEtf && matchedEtf.price && (
                <button
                  type="button"
                  onClick={() => onPendingConfirmPriceChange(String(matchedEtf.price))}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 font-semibold text-[11px] px-3 py-2 rounded-lg transition-colors"
                >
                  填实时最新价
                </button>
              )}
            </div>
            {matchedEtf && matchedEtf.price && (
              <span className="text-[10px] text-slate-500 font-mono block">
                💡 当前最新实时价预测参考: ¥{matchedEtf.price} (净值一般在当夜20点前公布完毕)
              </span>
            )}
          </div>

          <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/15 flex justify-between font-mono text-xs">
            <span className="text-yellow-500 font-semibold">折算实得份额:</span>
            <span className="text-white font-extrabold text-sm">{computedS.toFixed(4)} 份</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
          >
            确认对账入账
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-all text-xs"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

interface TradeFormEditProps {
  editType: 'BUY' | 'SELL';
  editIsSip: boolean;
  editDate: string;
  editSymbol: string;
  editAmount: string;
  editFeeRate: string;
  editFee: string;
  editPrice: string;
  editShares: string;
  isEditSyncingNav: boolean;
  isOtcSymbol: (sym: string) => boolean;
  onEditTypeChange: (v: 'BUY' | 'SELL') => void;
  onEditIsSipChange: (v: boolean) => void;
  onEditDateChange: (v: string) => void;
  onEditSymbolChange: (v: string) => void;
  onEditAmountChange: (v: string) => void;
  onEditFeeRateChange: (v: string) => void;
  onEditFeeChange: (v: string) => void;
  onEditPriceChange: (v: string) => void;
  onEditSharesChange: (v: string) => void;
  onRecalculate: (amount: string, feeRate: string, price: string, fee: string | undefined, symbol: string) => void;
  onQueryNav: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 编辑历史交易记录弹窗。所有 edit* 字段受控于父组件（保存/重算逻辑在父组件）。 */
export function TradeFormEdit({
  editType,
  editIsSip,
  editDate,
  editSymbol,
  editAmount,
  editFeeRate,
  editFee,
  editPrice,
  editShares,
  isEditSyncingNav,
  isOtcSymbol,
  onEditTypeChange,
  onEditIsSipChange,
  onEditDateChange,
  onEditSymbolChange,
  onEditAmountChange,
  onEditFeeRateChange,
  onEditFeeChange,
  onEditPriceChange,
  onEditSharesChange,
  onRecalculate,
  onQueryNav,
  onSave,
  onCancel,
}: TradeFormEditProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Pencil className="text-emerald-400" size={16} />
            <h3 className="font-bold text-sm text-white font-sans">修改历史交易记录</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white bg-slate-800/40 p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs">

          {/* Type and isSip checkbox row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">动作类型</label>
              <select
                value={editType}
                onChange={(e) => onEditTypeChange(e.target.value as 'BUY' | 'SELL')}
                className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="BUY">买入 (BUY)</option>
                <option value="SELL">卖出 (SELL)</option>
              </select>
            </div>

            <div className="flex items-center pt-5 pl-2">
              <input
                type="checkbox"
                id="editIsSip"
                checked={editIsSip}
                onChange={(e) => onEditIsSipChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-800 border-slate-700 mr-2 accent-emerald-400"
              />
              <label htmlFor="editIsSip" className="text-[10px] text-slate-400 font-semibold cursor-pointer select-none">🔄 划归为定投交易</label>
            </div>
          </div>

          {/* Date and Ticker row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">过账日期</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => onEditDateChange(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">交易代码</label>
              <input
                value={editSymbol}
                onChange={(e) => onEditSymbolChange(e.target.value)}
                placeholder="如 513100"
                className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Amount, rate, custom fee inputs */}
          {editType === 'BUY' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">申购总额 (元)</label>
                <input
                  type="number"
                  step="any"
                  value={editAmount}
                  onChange={(e) => {
                    onEditAmountChange(e.target.value);
                    onRecalculate(e.target.value, editFeeRate, editPrice, undefined, editSymbol);
                  }}
                  className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">费率 (%)</label>
                <input
                  type="number"
                  step="any"
                  value={editFeeRate}
                  onChange={(e) => {
                    onEditFeeRateChange(e.target.value);
                    onRecalculate(editAmount, e.target.value, editPrice, undefined, editSymbol);
                  }}
                  className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">手续费 (元)</label>
                <input
                  type="number"
                  step="any"
                  value={editFee}
                  onChange={(e) => {
                    onEditFeeChange(e.target.value);
                    onRecalculate(editAmount, editFeeRate, editPrice, e.target.value, editSymbol);
                  }}
                  className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Price, Shares, Fee inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1 flex items-center justify-between">
                <span>成交单价/净值 (¥)</span>
                {isOtcSymbol(editSymbol) && (
                  <button
                    type="button"
                    disabled={isEditSyncingNav}
                    onClick={onQueryNav}
                    className="text-[9px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors disabled:opacity-50"
                  >
                    {isEditSyncingNav ? '查询中...' : '🔍 联网确权净值'}
                  </button>
                )}
              </label>
              <input
                type="number"
                step="any"
                value={editPrice}
                onChange={(e) => {
                  onEditPriceChange(e.target.value);
                  onRecalculate(editAmount, editFeeRate, e.target.value, editFee, editSymbol);
                }}
                className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">
                成交/确权份额 (份)
              </label>
              <input
                type="number"
                step="any"
                value={editShares}
                onChange={(e) => onEditSharesChange(e.target.value)}
                placeholder="可输入进行手动纠错"
                className="w-full bg-black/40 border border-slate-700 border-dashed rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {editType === 'SELL' && (
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-1">手续费用 (元)</label>
              <input
                type="number"
                step="any"
                value={editFee}
                onChange={(e) => onEditFeeChange(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Quick calculations display */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1 font-mono text-[10px] text-slate-400">
            {editType === 'BUY' ? (
              <>
                <div className="flex justify-between">
                  <span>入账支付金额 (A):</span>
                  <span className="text-white font-bold">¥{parseFloat(editAmount || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>损耗服务费 (开销 R%):</span>
                  <span className="text-yellow-400">¥{parseFloat(editFee || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>实投资确认额 (A - F):</span>
                  <span className="text-emerald-400 font-bold">¥{Math.max(0, parseFloat(editAmount || '0') - parseFloat(editFee || '0')).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                  <span>计算总成交增量值:</span>
                  <span className="text-white">{(parseFloat(editShares) || 0).toFixed(isOtcSymbol(editSymbol) ? 2 : 4)} 份</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>成交总对价:</span>
                  <span className="text-white font-bold">¥{((parseFloat(editPrice)||0) * (parseFloat(editShares)||0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>服务扣税息 (F):</span>
                  <span className="text-red-400">¥{parseFloat(editFee || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                  <span>销户实落袋金额:</span>
                  <span className="text-white">¥{Math.max(0, ((parseFloat(editPrice)||0) * (parseFloat(editShares)||0)) - parseFloat(editFee || '0')).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onSave}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2 rounded-xl transition-all shadow-md active:scale-95 text-xs"
          >
            保存修改
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl transition-all text-xs"
          >
            放弃修改
          </button>
        </div>
      </div>
    </div>
  );
}

interface TradeFormAddProps {
  selectedMarketId: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'SIP';
  tradeMode: 'ETF' | 'OTC';
  price: string;
  shares: string;
  totalAmount: string;
  feeRate: string;
  customFee: string;
  date: string;
  isPending: boolean;
  verifyingSymbol: boolean;
  symbolCheckResult: any;
  markets: MarketData[];
  allEtfs: EtfInfo[];
  uniqueEtfsToShow: EtfInfo[];
  findEtfBySymbol: (sym: string) => EtfInfo | undefined;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSelectedMarketIdChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTypeChange: (v: 'BUY' | 'SELL' | 'SIP') => void;
  onPriceChange: (v: string) => void;
  onTotalAmountChange: (v: string) => void;
  onSharesChange: (v: string) => void;
  onFeeRateChange: (v: string) => void;
  onCustomFeeChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onIsPendingChange: (v: boolean) => void;
  onVerifySymbol: (sym: string) => void;
  onMarketChange: (marketId: string) => void;
  onRecalcFromAmount: (v: string) => void;
  onRecalcFromShares: (v: string) => void;
  onRecalcFees: (feeRate: string, customFee: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFillRealtimePrice: () => void;
}

/** 新增交易记录表单。所有字段受控于父组件，重算/校验/提交逻辑在父组件。 */
export function TradeFormAdd({
  selectedMarketId,
  symbol,
  type,
  tradeMode,
  price,
  shares,
  totalAmount,
  feeRate,
  customFee,
  date,
  isPending,
  verifyingSymbol,
  symbolCheckResult,
  markets,
  allEtfs,
  uniqueEtfsToShow,
  findEtfBySymbol,
  showToast,
  onSelectedMarketIdChange,
  onSymbolChange,
  onTypeChange,
  onPriceChange,
  onTotalAmountChange,
  onSharesChange,
  onFeeRateChange,
  onCustomFeeChange,
  onDateChange,
  onIsPendingChange,
  onVerifySymbol,
  onMarketChange,
  onRecalcFromAmount,
  onRecalcFromShares,
  onRecalcFees,
  onSubmit,
  onFillRealtimePrice,
}: TradeFormAddProps) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(e); }} className="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

        {/* Market Link Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">关联母市场板块</label>
          <select
            value={selectedMarketId}
            onChange={e => {
              onSelectedMarketIdChange(e.target.value);
              onMarketChange(e.target.value);
            }}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">全部关联标的 (ALL)</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Direct Trade Type Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">动作类型</label>
          <select
            value={type}
            onChange={e => onTypeChange(e.target.value as 'BUY' | 'SELL' | 'SIP')}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50"
          >
            {tradeMode === 'OTC' ? (
              <>
                <option value="BUY">基金申购 🟢</option>
                <option value="SIP">定时定投 (SIP) 🔄</option>
                <option value="SELL">基金赎回 🔴</option>
              </>
            ) : (
              <>
                <option value="BUY">普通买入 🟢</option>
                <option value="SIP">定投买入 (SIP) 🔄</option>
                <option value="SELL">资金卖出 🔴</option>
              </>
            )}
          </select>
        </div>

        {/* Symbols listing */}
        <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
          <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
            <span>交易标的代码</span>
            <span className="text-[10px] text-slate-500">输入代码/首字母快速检索</span>
          </label>
          <div className="relative">
            <input
              list="journal_etfs_list"
              value={symbol}
              onChange={e => onSymbolChange(e.target.value)}
              onBlur={() => onVerifySymbol(symbol)}
              placeholder="如: 513100 或 f_016452"
              className="w-full bg-slate-900 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono"
            />
            <datalist id="journal_etfs_list">
              {uniqueEtfsToShow.map(e => (
                <option key={e.symbol} value={e.symbol}>{e.name} ({e.symbol})</option>
              ))}
            </datalist>

            {verifyingSymbol && (
              <div className="absolute right-3 top-2.5 flex items-center justify-center">
                <Cpu size={14} className="text-emerald-400 animate-spin" />
              </div>
            )}

            {symbolCheckResult && !symbolCheckResult.hasConflict && (
              <div className="absolute right-3 top-2.5 flex items-center justify-center text-emerald-400">
                <Check size={14} />
              </div>
            )}
          </div>

          {symbolCheckResult && !symbolCheckResult.hasConflict && (
            <div className="text-[10px] text-emerald-400 mt-1 font-sans flex items-center gap-1 animate-in fade-in">
              <span>✨ 官方三源交叉验证无误：<strong>{symbolCheckResult.name}</strong> ({symbolCheckResult.assetType === 'OTC' ? '场外公募型配资' : '场内交易品种'})</span>
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 pt-1">

        {/* Fees */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">自定摩擦费率 (%)</label>
          <input
            type="number"
            step="any"
            value={feeRate}
            onChange={e => {
              onFeeRateChange(e.target.value);
              onRecalcFees(e.target.value, customFee);
            }}
            className="bg-slate-900 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-orange-400 focus:outline-none focus:border-orange-500 bg-orange-500/5 font-mono"
          />
        </div>

        {/* Exact Fee Override */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
            <span>精确手续费 (元)</span>
            <span className="text-[10px] text-orange-500/55">覆盖费率</span>
          </label>
          <input
            type="number"
            step="any"
            value={customFee}
            onChange={e => {
              onCustomFeeChange(e.target.value);
              onRecalcFees(feeRate, e.target.value);
            }}
            placeholder="选填精确规费(元)"
            className="bg-slate-900 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 bg-emerald-500/5 font-mono placeholder:text-slate-600"
          />
        </div>

        {/* Trading Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">交易归档时间</label>
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
        </div>

        {/* Price input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
            <span>{tradeMode === 'OTC' ? '成交扣减净值' : '成交单价 (元)'}</span>
            {!isPending && allEtfs.some(e => e.symbol === symbol) && (
              <button
                type="button"
                onClick={onFillRealtimePrice}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium decoration-dotted underline"
              >
                实时价
              </button>
            )}
          </label>
          <input
            type="number"
            step="0.0001"
            value={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '' : price}
            disabled={isPending && tradeMode === 'OTC' && type !== 'SELL'}
            onChange={e => onPriceChange(e.target.value)}
            placeholder={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '待公布后确认' : '建仓/结算交易价'}
            className={`bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono ${isPending && tradeMode === 'OTC' && type !== 'SELL' ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-500' : ''}`}
          />
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">
            {type === 'SELL' ? '回笼账款金额 (元)' : '注入资金/申购总额 (元)'}
          </label>
          <input
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={e => onRecalcFromAmount(e.target.value)}
            placeholder="输入交易本金"
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono placeholder:text-slate-600"
          />
        </div>

        {/* Shares Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 font-semibold">
            {isPending && tradeMode === 'OTC' && type !== 'SELL' ? '自动估算/待确认' : '成交份额 (份)'}
          </label>
          <input
            type="number"
            step="any"
            value={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '' : shares}
            disabled={isPending && tradeMode === 'OTC' && type !== 'SELL'}
            onChange={e => onRecalcFromShares(e.target.value)}
            placeholder={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '待确权后入账' : '所换得的单位份额'}
            className={`bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono placeholder:text-slate-600 ${isPending && tradeMode === 'OTC' && type !== 'SELL' ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-500' : ''}`}
          />
        </div>

      </div>

      {/* Pending confirmation checkbox for OTC trades */}
      {tradeMode === 'OTC' && type !== 'SELL' && (
        <div className="flex items-center gap-2 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/15">
          <input
            type="checkbox"
            id="pending_confirmation_checkbox"
            checked={isPending}
            onChange={e => onIsPendingChange(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-yellow-500 focus:ring-yellow-500/50 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="pending_confirmation_checkbox" className="text-xs text-yellow-400 font-semibold cursor-pointer select-none">
            场外交易：暂不确定最终成交价与份额 (等净值确认后再做对账过账，适合 QDII 等 T+1 / T+2 公募基金)
          </label>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[11px] text-slate-500 font-mono">
          [类型: {tradeMode === 'OTC' ? '场外OTC认申' : '场内交易所撮合'}] [费度: {feeRate}%]
        </span>
        <button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-2 rounded-lg text-xs transition-all flex items-center shadow-lg shadow-emerald-500/10 active:scale-95"
        >
          <Plus size={14} className="mr-1" /> 保存记录
        </button>
      </div>
    </form>
  );
}
