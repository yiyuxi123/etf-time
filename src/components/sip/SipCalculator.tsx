import { useState } from 'react';
import { Calculator, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type CalcFrequency = 'weekly' | 'monthly';

/** 长期定投复利模拟器。完全自治：5 个输入 state + 投影计算内聚于此组件。 */
export default function SipCalculator() {
  const [calcInitial, setCalcInitial] = useState(10000);
  const [calcPeriodAmount, setCalcPeriodAmount] = useState(500);
  const [calcFrequency, setCalcFrequency] = useState<CalcFrequency>('monthly');
  const [calcExpectedReturn, setCalcExpectedReturn] = useState(8);
  const [calcYears, setCalcYears] = useState(20);

  const projectionData = (() => {
    const dataPoints: any[] = [];
    const compoundingPeriodsPerYear = calcFrequency === 'monthly' ? 12 : 52;
    const ratePerPeriod = calcExpectedReturn / 100 / compoundingPeriodsPerYear;

    let investedWealth = calcInitial;
    let compoundedWealth = calcInitial;

    for (let year = 0; year <= calcYears; year++) {
      if (year === 0) {
        dataPoints.push({
          year: '第 0 年',
          '只存不入 (本金)': Math.round(investedWealth),
          '定投累计总本金': Math.round(investedWealth),
          '复利增长总市值': Math.round(compoundedWealth),
        });
        continue;
      }
      for (let p = 0; p < compoundingPeriodsPerYear; p++) {
        investedWealth += calcPeriodAmount * (calcFrequency === 'weekly' && compoundingPeriodsPerYear === 12 ? 4.33 : 1);
        compoundedWealth = (compoundedWealth + calcPeriodAmount) * (1 + ratePerPeriod);
      }
      dataPoints.push({
        year: `第 ${year} 年`,
        '只存不入 (本金)': Math.round(calcInitial),
        '定投累计总本金': Math.round(investedWealth),
        '复利增长总市值': Math.round(compoundedWealth),
      });
    }
    return dataPoints;
  })();

  const finalCompoundTotal = projectionData[projectionData.length - 1]['复利增长总市值'];
  const finalInvestTotal = projectionData[projectionData.length - 1]['定投累计总本金'];
  const finalEarnedInterest = finalCompoundTotal - finalInvestTotal;

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator className="text-emerald-400" />
            长期财富奇迹：定投收益未来复利模拟器
          </h3>
          <p className="text-xs text-slate-400 mt-1">计算未来若干年内，零钱定投累积的滚雪球资产</p>
        </div>

        <div className="text-slate-500 text-xs flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
          <span>复利预期</span>
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full ml-2" />
          <span>本金累计</span>
        </div>
      </div>

      {/* Dynamic Calculator Form Box */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">初始启动资金 (元)</label>
          <input
            type="number"
            value={calcInitial}
            onChange={e => setCalcInitial(Math.max(0, parseInt(e.target.value) || 0))}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">每期定投投入 (元)</label>
          <input
            type="number"
            value={calcPeriodAmount}
            onChange={e => setCalcPeriodAmount(Math.max(0, parseInt(e.target.value) || 0))}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">定投周期频率</label>
          <select
            value={calcFrequency}
            onChange={e => setCalcFrequency(e.target.value as CalcFrequency)}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="weekly">按周买入</option>
            <option value="monthly">按月买入</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400">平均复合年回报 (%)</label>
          <input
            type="number"
            step="0.5"
            value={calcExpectedReturn}
            onChange={e => setCalcExpectedReturn(Math.max(0, parseFloat(e.target.value) || 0))}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
          <label className="text-xs text-slate-400">持有执行期 (年)</label>
          <input
            type="number"
            value={calcYears}
            onChange={e => setCalcYears(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Visual Wealth Stack and Recharts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl">
            <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono">预计期末总资产值</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
              ¥{finalCompoundTotal.toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              在第 {calcYears} 年末，得益于年化 {calcExpectedReturn}% 滚动的复利成长，资产最终实现大步级跨越。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <div className="text-[10px] text-slate-500 font-mono">累计本金总投入</div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ¥{finalInvestTotal.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <div className="text-[10px] text-cyan-400 font-mono">累计产生的复利盈余</div>
              <div className="text-lg font-bold font-mono text-cyan-400 mt-1">
                +¥{finalEarnedInterest.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed bg-[#0A0D14]/80 p-4 rounded-xl border border-white/5">
            <div className="flex gap-2 items-start">
              <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-emerald-300 font-bold">收益比倍增：</span>
                本金投入 ¥{finalInvestTotal.toLocaleString()} 元，通过收益产生复利膨胀，最终利息比占本金 of <strong className="text-white font-mono">{(finalEarnedInterest / finalInvestTotal * 100).toFixed(1)}%</strong>。
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="w-full h-[320px] bg-black/10 rounded-2xl p-4 border border-white/5 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={projectionData}
                margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                <XAxis dataKey="year" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'cbd5e1' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="复利增长总市值"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorInterest)"
                />
                <Area
                  type="monotone"
                  dataKey="定投累计总本金"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#colorPrincipal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
