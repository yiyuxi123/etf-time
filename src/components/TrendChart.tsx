import React from 'react';
import { ChartDataPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: ChartDataPoint[];
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

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const hasVix = data.length > 0 && data[0].vix !== undefined;
  const hasPe = data.length > 0 && data[0].pe !== undefined;
  const hasTrend = data.length > 0 && data[0].trend !== undefined;

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col h-[350px]">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">基准资产走势 (1Y)</h2>
            <p className="text-[10px] text-slate-500 italic mt-1">基准资产每日收盘价</p>
          </div>
        </div>
        
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#10b981', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}
                labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
              />
              <Line 
                type="monotone" 
                dataKey="close" 
                name="收盘价"
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
              />
            </LineChart>
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
              title="全球恐慌指数追踪" 
              desc="VIX" 
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
      </div>
    </div>
  );
};
