import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Line } from 'recharts';
import type { EtfInfo } from '../../types';

interface Position {
  shares: number;
  cost: number;
  heldBuyFees: number;
}

interface PieEntry {
  name: string;
  value: number;
  fill: string;
}

interface PortfolioChartProps {
  positions: Record<string, Position>;
  pieData: PieEntry[];
  cleanChartSymbol: string;
  selectedSymbolChartData: any[];
  matchedChartEtfName: string;
  activeChartSymbol: string;
  onActiveChartSymbolChange: (sym: string) => void;
  findEtfBySymbol: (sym: string) => EtfInfo | undefined;
  allEtfs: EtfInfo[];
}

/** 持仓组合明细表 + 资产配置饼图 + 标的历史净值曲线（含买卖点）。半状态：仅图表标的切换 select 受控。 */
export default function PortfolioChart({
  positions,
  pieData,
  cleanChartSymbol,
  selectedSymbolChartData,
  matchedChartEtfName,
  activeChartSymbol,
  onActiveChartSymbolChange,
  findEtfBySymbol,
  allEtfs,
}: PortfolioChartProps) {
  const hasPositions = Object.values(positions).some(p => p.shares > 0);

  return (
    <>
      {/* Realtime hold stats */}
      {hasPositions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Detailed positions ledger list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:col-span-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">当前持仓组合明细表</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10 select-none">
                  <tr>
                    <th className="pb-3 pl-2">标的资产</th>
                    <th className="pb-3 text-right">持仓总额</th>
                    <th className="pb-3 text-right">平均买入价</th>
                    <th className="pb-3 text-right">现时估值</th>
                    <th className="pb-3 text-right pr-1">累积浮盈/亏</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono divide-y divide-white/5">
                  {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).map(([sym, pos]) => {
                    const currentEtf = findEtfBySymbol(sym);
                    const avgCost = pos.cost / pos.shares;
                    const currentPrice = currentEtf?.price || avgCost;
                    const unrealized = (currentPrice * pos.shares) - pos.cost - pos.heldBuyFees;
                    return (
                      <tr
                        key={sym}
                        onClick={() => onActiveChartSymbolChange(sym)}
                        className={`hover:bg-white/10 cursor-pointer transition-all ${cleanChartSymbol === sym ? 'bg-emerald-500/5 font-semibold text-slate-100' : ''}`}
                        title="💡 点击此行即可查看该标的历史净值曲线与买卖交易点"
                      >
                        <td className="py-3 pl-2 text-slate-300 font-sans font-semibold">
                          <div className="flex items-center gap-1.5">
                            {cleanChartSymbol === sym && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            <span>{currentEtf ? currentEtf.name : sym}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sym}</div>
                        </td>
                        <td className="py-3 text-right text-slate-400">{pos.shares.toFixed(2)}</td>
                        <td className="py-3 text-right text-slate-400">¥{avgCost.toFixed(4)}</td>
                        <td className="py-3 text-right text-slate-200">¥{currentPrice.toFixed(4)}</td>
                        <td className={`py-3 text-right font-bold pr-1 ${unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {unrealized >= 0 ? '+' : ''}{unrealized.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation visual display */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-widest select-none">
                  综合资产配置比例
                </h3>
                <p className="text-[11px] text-slate-500 mb-2">
                  实时持仓总市值的占比拆解图。
                </p>
              </div>
              <div className="w-full h-[180px] relative">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', zIndex: 1000}}
                        itemStyle={{color: '#fff', fontSize: '11px'}}
                        formatter={(value: number) => [`¥${value.toLocaleString()}`, '市价资产']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-xs text-center">
                    暂无有效持仓数据比例
                  </div>
                )}
              </div>
          </div>

        </div>
      )}

      {/* Dynamic Asset NAV Curve and Transaction points Chart overlay */}
      {selectedSymbolChartData.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex flex-wrap items-center gap-1.5 font-sans">
                <span>📈 个股/标的历史净值走势与成交买卖观察点</span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold tracking-wide border border-emerald-500/15">
                  {matchedChartEtfName} ({cleanChartSymbol})
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                基于指数历史行情与您的实时持仓智能对账。历史价格中：<span className="text-emerald-400 font-semibold">🟢 绿钻</span> 代表买入成交点，<span className="text-red-400 font-semibold">🔴 红钻</span> 代表卖出点位。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold select-none">切换标的:</span>
              <select
                value={cleanChartSymbol}
                onChange={e => onActiveChartSymbolChange(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-sans"
              >
                {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).map(([sym]) => {
                  const etfInfo = findEtfBySymbol(sym);
                  return (
                    <option key={sym} value={sym}>
                      💼 {etfInfo ? etfInfo.name : sym} ({sym})
                    </option>
                  );
                })}
                {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).length > 0 && (
                  <option disabled>─────── 全部监控列表 ───────</option>
                )}
                {allEtfs.map(e => (
                  <option key={e.symbol} value={e.symbol}>
                    🔍 {e.name} ({e.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full h-[320px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedSymbolChartData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="navPriceColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `¥${val.toFixed(2)}`}
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a]/95 backdrop-blur-md p-3.5 border border-slate-800 rounded-xl space-y-2 text-xs font-mono shadow-2xl">
                          <p className="text-slate-400 font-sans font-semibold border-b border-white/5 pb-1 mb-1">{label}</p>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-400">参考预估净值:</span>
                            <span className="text-white font-extrabold">¥{data.price.toFixed(4)}</span>
                          </div>
                          {data.buys && data.buys.length > 0 && (
                            <div className="border-t border-emerald-500/20 pt-1.5 mt-1.5 space-y-1">
                              {data.buys.map((b: any, idx: number) => (
                                <div key={idx} className="text-[#10b981] text-[11px] font-sans font-medium flex items-center gap-1">
                                  <span>🟢 [我的买入] </span>
                                  <span className="font-mono font-bold text-slate-200">{b.shares.toFixed(4)} 份</span>
                                  <span>@ ¥{b.price.toFixed(4)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {data.sells && data.sells.length > 0 && (
                            <div className="border-t border-red-500/20 pt-1.5 mt-1.5 space-y-1">
                              {data.sells.map((s: any, idx: number) => (
                                <div key={idx} className="text-[#ef4444] text-[11px] font-sans font-medium flex items-center gap-1">
                                  <span>🔴 [我的卖出] </span>
                                  <span className="font-mono font-bold text-slate-200">{s.shares.toFixed(4)} 份</span>
                                  <span>@ ¥{s.price.toFixed(4)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#10b981"
                  strokeWidth={1.8}
                  fillOpacity={1}
                  fill="url(#navPriceColor)"
                  name="参考净值走势"
                />
                <Line
                  type="monotone"
                  dataKey="buyPrice"
                  stroke="none"
                  dot={{ r: 6, fill: '#10b981', stroke: '#1c1917', strokeWidth: 1.5 }}
                  name="买入交易点"
                />
                <Line
                  type="monotone"
                  dataKey="sellPrice"
                  stroke="none"
                  dot={{ r: 6, fill: '#ef4444', stroke: '#1c1917', strokeWidth: 1.5 }}
                  name="卖出交易点"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
