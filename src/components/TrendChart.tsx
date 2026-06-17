import React from 'react';
import { ChartDataPoint, FactorBreakdown } from '../types';
import { ComposedChart, LineChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: ChartDataPoint[];
  breakdowns?: FactorBreakdown[];
  currentView?: 'swing' | 'dca';
}

const MiniChart = ({ title, desc, dataKey, color, data, formatter }: any) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-[220px]">
    <div className="mb-4">
      <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">{title}</h2>
      {desc && <p className="text-[10px] text-slate-500 mt-1">{desc}</p>}
    </div>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" hide={true} />
          <YAxis 
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
            tickMargin={5}
            tickFormatter={formatter}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
            itemStyle={{ color: color, fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}
            labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
            formatter={(val: number) => [formatter ? formatter(val) : val.toFixed(2), title.split(' ')[0]]}
          />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const isScore = payload[0].name.toLowerCase().includes('score');
    const scoreVal = d.dcaScore !== undefined ? (payload[0].name === 'dcaScore' ? d.dcaScore : d.swingScore) : d.score;
    const priceVal = d.close;
    
    return (
      <div className="bg-[#0f172a]/95 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl max-w-[280px]">
        <p className="text-xs text-slate-400 font-mono mb-2">{label}</p>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-1.5">
            <span className="text-slate-400">量化综合评分</span>
            <span className="font-bold text-blue-400 text-sm">{Math.round(scoreVal)} 分</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-200">收盘价格:</span>
            <span className="font-bold text-emerald-400">${priceVal?.toFixed(4)}</span>
          </div>
          {d.pe !== undefined && d.pe > 0 && d.pe < 500 && (
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">滚动市盈率 (PE):</span>
              <span className="text-slate-300 font-semibold">{d.pe.toFixed(1)}</span>
            </div>
          )}
          {d.vix !== undefined && d.vix > 0 && (
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">恐慌情绪 (VIX):</span>
              <span className="text-purple-300 font-semibold">{d.vix.toFixed(1)}</span>
            </div>
          )}
          {d.rsi !== undefined && (
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">强弱指标 (RSI):</span>
              <span className={`${d.rsi > 70 ? 'text-red-400' : d.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'} font-semibold`}>
                {d.rsi.toFixed(1)}
              </span>
            </div>
          )}
          {d.usdcny !== undefined && d.usdcny > 0 && (
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">美元/人民币:</span>
              <span className="text-rose-300 font-semibold">{d.usdcny.toFixed(3)}</span>
            </div>
          )}
          {d.tnx !== undefined && d.tnx > 0 && (
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">美10年债收益率:</span>
              <span className="text-amber-300 font-semibold">{d.tnx.toFixed(2)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const TrendChart: React.FC<TrendChartProps> = ({ data, breakdowns, currentView = 'swing' }) => {
  const breakdownNames = breakdowns?.map(b => b.name) || [];
  const isDcaMode = currentView === 'dca';
  const scoreKey = isDcaMode ? 'dcaScore' : 'swingScore';
  
  const hasVix = breakdownNames.some(n => n.includes('VIX') || n.includes('恐慌')) && data.length > 0 && data[0].vix !== undefined;
  const hasPe = breakdownNames.some(n => n.includes('PE') || n.includes('市盈率') || n.includes('估值')) && data.length > 0 && data[0].pe !== undefined;
  const hasTrend = breakdownNames.some(n => n.includes('趋势') || n.includes('乖离') || n.includes('均线')) && data.length > 0 && data[0].trend !== undefined;
  const hasRsi = breakdownNames.some(n => n.includes('RSI') || n.includes('强弱') || n.includes('情绪')) && data.length > 0 && data[0].rsi !== undefined;
  const hasDrawdown = breakdownNames.some(n => n.includes('回撤')) && data.length > 0 && data[0].drawdown !== undefined;
  const hasVolatility = breakdownNames.some(n => n.includes('波动率')) && data.length > 0 && data[0].volatility !== undefined;
  
  // Cross border metrics mapped
  const hasUsdcny = data.length > 0 && data[0].usdcny !== undefined;
  const hasTnx = data.length > 0 && data[0].tnx !== undefined;

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col h-[350px]">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              基准资产走势 & 历史评分走势 ({isDcaMode ? '长期定投视图' : '波段趋势视图'})
            </h2>
            <p className="text-[10px] text-slate-500 italic mt-1">综合估值、动能、波动的量化历史得分 (左轴) 与 资产收盘价 (右轴)</p>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500"></span>
              <span className="text-slate-400">收盘价</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-gradient-to-b from-blue-500/50 to-blue-500/0 border-t border-blue-500"></div>
              <span className="text-slate-400">{isDcaMode ? '定投得分' : '趋势得分'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                minTickGap={30}
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} 
                tickFormatter={(val) => {
                  const parts = val.split('-');
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
                }}
              />
              <YAxis 
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
                tickMargin={10}
                orientation="right"
                yAxisId="right"
              />
              <YAxis 
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#3b82f6', fontFamily: 'monospace' }}
                tickMargin={10}
                orientation="left"
                yAxisId="left"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey={scoreKey} 
                name={scoreKey}
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#scoreGradient)"
                activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="close" 
                name="收盘价"
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasPe && (
            <MiniChart 
              title="市盈率 PE 追踪" 
              desc="预估动量市盈率 (越高越贵)" 
              dataKey="pe" 
              color="#38bdf8" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? v.toFixed(1) : v} 
            />
        )}
        {hasVix && (
            <MiniChart 
              title="全球恐慌指数 VIX" 
              desc="标普SPX波指" 
              dataKey="vix" 
              color="#a855f7" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? v.toFixed(1) : v}
            />
        )}
        {hasTrend && (
            <MiniChart 
              title="趋势乖离率 %" 
              desc="均线偏离度" 
              dataKey="trend" 
              color="#fb923c" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : v}
            />
        )}
        {hasRsi && (
            <MiniChart 
              title="相对强弱 (RSI 14D)" 
              desc="动能指标 (>70超买, <30超卖)" 
              dataKey="rsi" 
              color="#f43f5e" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? v.toFixed(1) : v}
            />
        )}
        {hasDrawdown && (
            <MiniChart 
              title="高点回撤 %" 
              desc="距离近期高点跌幅" 
              dataKey="drawdown" 
              color="#facc15" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? `${v.toFixed(1)}%` : v}
            />
        )}
        {hasVolatility && (
            <MiniChart 
              title="波动率 % (20D)" 
              desc="近期历史波动率" 
              dataKey="volatility" 
              color="#22d3ee" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? `${v.toFixed(2)}%` : v}
            />
        )}
        {hasUsdcny && (
            <MiniChart 
              title="美元/人民币 汇率" 
              desc="USD/CNY 汇价" 
              dataKey="usdcny" 
              color="#10b981" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? v.toFixed(3) : v}
            />
        )}
        {hasTnx && (
            <MiniChart 
              title="美国10年期国债收益率" 
              desc="^TNX (外围无风险资产锚)" 
              dataKey="tnx" 
              color="#f43f5e" 
              data={data} 
              formatter={(v: number) => typeof v === 'number' ? `${v.toFixed(2)}%` : v}
            />
        )}
      </div>
    </div>
  );
};
