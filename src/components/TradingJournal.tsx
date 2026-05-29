import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Target, PiggyBank, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart, Pie } from 'recharts';
import { EtfInfo } from '../types';

interface TradeRecord {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  shares: number;
  fee: number; // 摩擦费用
}

export default function TradingJournal({ etfs }: { etfs: EtfInfo[] }) {
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [symbol, setSymbol] = useState('513100');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [showsFeeRate, setShowsFeeRate] = useState(false);
  const [feeInput, setFeeInput] = useState('0');

  useEffect(() => {
    const saved = localStorage.getItem('etf_trading_journal');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveRecords = (newRecords: TradeRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('etf_trading_journal', JSON.stringify(newRecords));
  };

  const addRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || !shares) return;
    
    const p = parseFloat(price);
    const s = parseFloat(shares);
    let fee = parseFloat(feeInput) || 0;
    
    const newRecord: TradeRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      type,
      symbol,
      price: p,
      shares: s,
      fee
    };
    
    saveRecords([newRecord, ...records]);
    setPrice('');
    setShares('');
    setFeeInput('0');
  };

  const removeRecord = (id: string) => {
    saveRecords(records.filter(r => r.id !== id));
  };

  const clearRecords = () => {
    if (confirm('确定要清空所有交易记录吗？此操作不可恢复。')) {
      saveRecords([]);
    }
  };

  // 计算盈亏和持仓 (按标的分开计算)
  let totalFees = 0;
  let realizedPnL = 0;
  
  const positions: Record<string, { shares: number, cost: number }> = {};

  // 严格从旧往新的计算
  const chronological = [...records].sort((a,b) => a.id.localeCompare(b.id));

  chronological.forEach(r => {
    totalFees += r.fee;
    if (!positions[r.symbol]) {
      positions[r.symbol] = { shares: 0, cost: 0 };
    }
    const pos = positions[r.symbol];

    if (r.type === 'BUY') {
      pos.cost += r.price * r.shares;
      pos.shares += r.shares;
    } else {
      if (pos.shares > 0) {
        const avgCost = pos.cost / pos.shares;
        const profit = (r.price - avgCost) * r.shares;
        realizedPnL += profit;
        
        pos.cost -= avgCost * r.shares;
        pos.shares -= r.shares;
      }
    }
  });

  const netRealizedPnL = realizedPnL - totalFees;

  let totalShares = 0;
  let totalCost = 0;
  let unrealizedPnL = 0;

  Object.entries(positions).forEach(([sym, pos]) => {
     totalShares += pos.shares;
     totalCost += pos.cost;
     
     const currentEtf = etfs.find(e => e.symbol === sym || e.symbol.includes(sym));
     if (currentEtf && pos.shares > 0) {
        unrealizedPnL += (currentEtf.price - (pos.cost / pos.shares)) * pos.shares;
     }
  });

  const avgCostPerShare = totalShares > 0 ? (totalCost / totalShares) : 0;

  const winTrades = chronological.filter(r => r.type === 'SELL' && ((parseFloat(price) || 0) > avgCostPerShare)); // Rough estimate
  // Re-calculating actual trade win rate accurately
  let exactWins = 0;
  let exactLosses = 0;
  let simPos = 0;
  let simCost = 0;
  
  chronological.forEach(r => {
    if (r.type === 'BUY') {
      simCost += r.price * r.shares;
      simPos += r.shares;
    } else {
      if (simPos > 0) {
        const avg = simCost / simPos;
        if (r.price > avg) exactWins++;
        else exactLosses++;
        simCost -= avg * r.shares;
        simPos -= r.shares;
      }
    }
  });

  const winRate = (exactWins + exactLosses) > 0 ? (exactWins / (exactWins + exactLosses) * 100) : 0;
  
  const chartData = [
    { name: '已实现净盈亏', value: Number(netRealizedPnL.toFixed(2)), isPositive: netRealizedPnL >= 0 },
    { name: '累计摩擦费用', value: Number(totalFees.toFixed(2)), isPositive: false }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieData = Object.entries(positions)
    .filter(([_, pos]) => pos.shares > 0)
    .map(([sym, pos], index) => {
      const currentEtf = etfs.find(e => e.symbol === sym || e.symbol.includes(sym));
      const value = currentEtf ? currentEtf.price * pos.shares : (pos.cost / pos.shares) * pos.shares;
      const name = currentEtf ? currentEtf.name.split(' ')[0] : sym;
      return {
        name,
        value: Number(value.toFixed(2)),
        fill: COLORS[index % COLORS.length]
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center">
            {netRealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
            已实现净盈亏
          </div>
          <div className={`text-lg font-mono ${netRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netRealizedPnL >= 0 ? '+' : ''}{netRealizedPnL.toFixed(2)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center">
            {unrealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
            总持仓预估浮盈
          </div>
          <div className={`text-lg font-mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center">
             <Target size={12} className="mr-1" />
             平仓胜率
          </div>
          <div className="flex items-end gap-1">
            <div className="text-lg font-mono text-white">{winRate.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 mb-0.5">({exactWins}/{exactLosses})</div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center">
             <ArrowDownRight size={12} className="mr-1 text-yellow-500" />
             累计摩擦损耗
          </div>
          <div className="text-lg font-mono text-yellow-500">
            ¥{totalFees.toFixed(2)}
          </div>
        </div>
      </div>

      {Object.values(positions).some(p => p.shares > 0) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">当前各标的持仓明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10">
                <tr>
                  <th className="pb-3 pl-2">标的</th>
                  <th className="pb-3 text-right">持仓份额</th>
                  <th className="pb-3 text-right">平均持仓成本</th>
                  <th className="pb-3 text-right">最新现价</th>
                  <th className="pb-3 text-right">持仓浮动盈亏</th>
                </tr>
              </thead>
              <tbody className="text-sm font-mono divide-y divide-white/5">
                {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).map(([sym, pos]) => {
                  const currentEtf = etfs.find(e => e.symbol === sym || e.symbol.includes(sym));
                  const avgCost = pos.cost / pos.shares;
                  const currentPrice = currentEtf?.price || avgCost;
                  const unrealized = (currentPrice - avgCost) * pos.shares;
                  return (
                    <tr key={sym} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-2 text-slate-300 font-sans">
                        {currentEtf ? currentEtf.name : sym}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sym}</div>
                      </td>
                      <td className="py-3 text-right text-slate-200">{pos.shares.toLocaleString()}</td>
                      <td className="py-3 text-right text-emerald-400">¥{avgCost.toFixed(3)}</td>
                      <td className="py-3 text-right text-slate-300">¥{currentPrice.toFixed(3)}</td>
                      <td className={`py-3 text-right ${unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {unrealized >= 0 ? '+' : ''}{unrealized.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-widest">新增交易纪要</h3>
        <form onSubmit={addRecord} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">操作类型</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as 'BUY' | 'SELL')}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="BUY">买入建仓/定投</option>
              <option value="SELL">卖出止盈/止损</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">标的代码</label>
            <input 
              type="text" 
              list="etf-symbols"
              value={symbol}
              onChange={e => {
                 setSymbol(e.target.value);
                 const curr = etfs.find(etf => etf.symbol === e.target.value || etf.symbol.includes(e.target.value));
                 if (curr && !price) setPrice(curr.price.toString());
              }}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-40"
              placeholder="输入或选择"
            />
            <datalist id="etf-symbols">
              {etfs.map(etf => (
                <option key={etf.symbol} value={etf.symbol}>{etf.name}</option>
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5 relative group">
            <label className="text-xs text-slate-400">成交净价</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.001"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="例如 2.270"
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-32"
              />
              <button
                type="button"
                className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                   const curr = etfs.find(e => e.symbol === symbol || e.symbol.includes(symbol));
                   if (curr) setPrice(curr.price.toString());
                }}
              >
                当前价
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">成交份额</label>
            <input 
              type="number" 
              value={shares}
              onChange={e => setShares(e.target.value)}
              placeholder="例如 10000"
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-32"
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs text-slate-400">交易总费用(元)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.01"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                placeholder="如填 5"
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-28"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">
              提示: 包含券商佣金、过户费及基金固有费损
            </span>
          </div>

          <button 
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center ml-auto"
          >
            <Plus size={16} className="mr-1" /> 添加记录
          </button>
        </form>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">历史流水记录</h3>
          {records.length > 0 && (
            <button 
              onClick={clearRecords}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
            >
              清空记录
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10">
              <tr>
                <th className="pb-3 pl-2">日期</th>
                <th className="pb-3">动作</th>
                <th className="pb-3">标的</th>
                <th className="pb-3 text-right">成交价</th>
                <th className="pb-3 text-right">份额</th>
                <th className="pb-3 text-right">摩擦费用</th>
                <th className="pb-3 text-right pr-2">操作</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-white/5">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pl-2 text-slate-400">{record.date}</td>
                  <td className={`py-3 font-bold ${record.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {record.type === 'BUY' ? '买入' : '卖出'}
                  </td>
                  <td className="py-3 text-slate-300">{record.symbol}</td>
                  <td className="py-3 text-right text-slate-200">¥{record.price.toFixed(3)}</td>
                  <td className="py-3 text-right text-slate-300">{record.shares.toLocaleString()}</td>
                  <td className="py-3 text-right text-yellow-500">¥{record.fee.toFixed(2)}</td>
                  <td className="py-3 text-right pr-2">
                    <button 
                      onClick={() => removeRecord(record.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="删除记录"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">暂无交易记录。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
        
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest flex items-center">
            持仓分布情况
          </h3>
          <div className="w-full h-[220px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', zIndex: 1000}}
                    itemStyle={{color: '#fff', fontSize: '12px'}}
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '持仓市值']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                暂无持仓
              </div>
            )}
          </div>
          {pieData.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest flex items-center">
            盈亏与磨损可视化
          </h3>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#ffffff05'}}
                  contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', zIndex: 1000}}
                  formatter={(value: number) => [`¥${Math.abs(value).toFixed(2)}`, '金额']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : (entry.name.includes('费用') ? '#eab308' : '#ef4444')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-6 pt-4 border-t border-white/10 text-center leading-relaxed">
            频繁交易会导致摩擦费用（黄柱）显著上升，可能蚕食大部分已实现收益。建议采取定投及低频交易策略。
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}
