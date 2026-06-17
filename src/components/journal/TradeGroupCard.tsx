import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { TradeRecord, GroupMode } from '../../types';
import { inferCategory, CATEGORY_LABELS, type FundCategory } from '../../utils/fund-helpers';
import type { EtfInfo, MarketData } from '../../types';

interface TradeGroupCardProps {
  records: TradeRecord[];
  markets: MarketData[];
  findEtfBySymbol: (sym: string) => EtfInfo | undefined;
  groupMode: GroupMode;
}

interface GroupNode {
  key: string;
  label: string;
  records: TradeRecord[];
  totalAmount: number;
  children?: GroupNode[];
}

/** 按 groupMode 维度对 records 分组。返回有序分组节点（含二级分组用于 category 模式）。 */
function buildGroups(
  records: TradeRecord[],
  groupMode: GroupMode,
  markets: MarketData[],
): GroupNode[] {
  if (groupMode === 'category') {
    // 大类 -> 基金 二级分组
    const byCat = new Map<FundCategory, Map<string, TradeRecord[]>>();
    for (const r of records) {
      const cat = inferCategory(r.symbol, markets);
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const sym = r.symbol;
      if (!byCat.get(cat)!.has(sym)) byCat.get(cat)!.set(sym, []);
      byCat.get(cat)!.get(sym)!.push(r);
    }
    const order: FundCategory[] = ['NDX', 'CSI300', 'GOLD', 'BOND', 'OTHER'];
    return order
      .filter(c => byCat.has(c))
      .map(cat => {
        const symMap = byCat.get(cat)!;
        const children: GroupNode[] = Array.from(symMap.entries()).map(([sym, recs]) => ({
          key: sym,
          label: sym,
          records: recs,
          totalAmount: recs.reduce((s, r) => s + (r.pendingAmount || r.price * r.shares || 0), 0),
        }));
        return {
          key: cat,
          label: CATEGORY_LABELS[cat],
          records: children.flatMap(c => c.records),
          totalAmount: children.reduce((s, c) => s + c.totalAmount, 0),
          children,
        };
      });
  }

  // 单层分组：source / month / status
  const bucket = new Map<string, TradeRecord[]>();
  for (const r of records) {
    let key: string;
    if (groupMode === 'source') {
      key = r.isSip ? '定投' : '手动';
    } else if (groupMode === 'month') {
      key = r.date.substring(0, 7); // YYYY-MM
    } else {
      // status：持仓中 / 已清仓 由父级 positions 判定较复杂，这里用 pending 状态近似
      key = r.isPending ? '待对账' : '已记账';
    }
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(r);
  }
  return Array.from(bucket.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, recs]) => ({
      key,
      label: key,
      records: recs,
      totalAmount: recs.reduce((s, r) => s + (r.pendingAmount || r.price * r.shares || 0), 0),
    }));
}

/** 按维度折叠分组的交易记录视图。折叠态内聚于此组件。 */
export default function TradeGroupCard({ records, markets, findEtfBySymbol, groupMode }: TradeGroupCardProps) {
  const groups = buildGroups(records, groupMode, markets);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([groups[0]?.key].filter(Boolean) as string[]));

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (groups.length === 0) {
    return <div className="py-8 text-center text-slate-500 text-xs select-none">暂无交易记录可分组。</div>;
  }

  return (
    <div className="space-y-2">
      {groups.map(group => {
        const isOpen = expanded.has(group.key);
        return (
          <div key={group.key} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(group.key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-sm font-bold text-slate-200 font-sans">{group.label}</span>
                <span className="text-[10px] text-slate-500 font-mono">({group.records.length} 笔)</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">¥{group.totalAmount.toLocaleString()}</span>
            </button>

            {isOpen && (
              <div className="divide-y divide-white/5">
                {group.children ? (
                  // category 二级：基金 -> 记录
                  group.children.map(child => {
                    const childOpen = expanded.has(child.key);
                    return (
                      <div key={child.key} className="bg-black/20">
                        <button
                          onClick={() => toggle(child.key)}
                          className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 pl-4">
                            {childOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                            <span className="text-xs font-semibold text-slate-300">
                              {findEtfBySymbol(child.key)?.name || child.key}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{child.key}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">¥{child.totalAmount.toLocaleString()}</span>
                        </button>
                        {childOpen && (
                          <div className="px-4 pb-2">
                            {child.records.map(r => (
                              <div key={r.id} className="flex items-center justify-between py-1 pl-8 text-[11px] font-mono">
                                <span className="text-slate-400">
                                  {r.date} · {r.isSip ? '定投' : r.type === 'BUY' ? '买入' : '卖出'}
                                </span>
                                <span className="text-slate-300">¥{(r.pendingAmount || r.price * r.shares || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // 单层分组：直接列记录
                  group.records.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-1.5 text-[11px] font-mono">
                      <span className="text-slate-400">
                        {r.date} · {findEtfBySymbol(r.symbol)?.name || r.symbol} · {r.isSip ? '定投' : r.type === 'BUY' ? '买入' : '卖出'}
                      </span>
                      <span className="text-slate-300">¥{(r.pendingAmount || r.price * r.shares || 0).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
