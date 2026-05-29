import React from 'react';
import { EtfInfo } from '../types';
import { cn } from '../lib/utils';
import { AlertCircle, CheckCircle2, AlertOctagon } from 'lucide-react';

interface EtfTableProps {
  etfs: EtfInfo[];
}

export const EtfTable: React.FC<EtfTableProps> = ({ etfs }) => {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl flex-1 p-6 relative overflow-hidden h-full flex flex-col">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
        <span>国内挂钩 ETF 实时监控看板</span>
        <span className="text-[10px] text-slate-500 font-normal italic">自动更新场内ETF，折价满分20分，溢价率越低得分越高，&gt; 3% 触发系统否决。</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] font-bold text-slate-500 border-b border-white/10">
            <tr>
              <th className="pb-3 pl-2 uppercase">代码/名称</th>
              <th className="pb-3 text-right">最新价格</th>
              <th className="pb-3 text-right hidden sm:table-cell" title="基金公司公布的最新官方净值(通常为T-1或T-2日)">T-1 最新净值</th>
              <th className="pb-3 text-right">实时溢价率</th>
              <th className="pb-3 text-right hidden sm:table-cell">溢价得分 (满分20)</th>
              <th className="pb-3 text-right pr-2">系统建议状态 (总分=80+20)</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono divide-y divide-white/5">
            {etfs.map((etf) => {
              const isVeto = etf.premiumPct > 3;
              const isDiscount = etf.premiumPct < 0;

              return (
                <tr key={etf.symbol} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 pl-2 font-sans font-medium">
                    <div className="text-white group-hover:text-emerald-400 transition-colors">{etf.symbol.replace('.SS', '').replace('.SZ', '')}</div>
                    <div className="text-[10px] text-slate-500 font-sans">{etf.name}</div>
                  </td>
                  <td className="py-4 text-right text-slate-200">
                    ¥{etf.price.toFixed(3)}
                  </td>
                  <td className="py-4 text-right text-slate-400 hidden sm:table-cell">
                    {etf.estimatedIopv.toFixed(3)}
                  </td>
                  <td className={cn("py-4 text-right font-bold", isVeto ? "text-red-500" : isDiscount ? "text-emerald-400" : "text-yellow-500")}>
                    {etf.premiumPct > 0 ? '+' : ''}{etf.premiumPct.toFixed(2)}%
                  </td>
                  <td className="py-4 text-right text-slate-400 hidden sm:table-cell">
                    +{etf.premiumScore.toFixed(0)}分
                  </td>
                  <td className="py-4 text-right pr-2">
                    <span className={cn(
                      "text-[10px] px-2 py-1 rounded-md",
                      isVeto ? "bg-red-500/10 text-red-500" : 
                      etf.recommendation.includes('清仓') ? "bg-red-500/10 text-red-400" :
                      etf.recommendation.includes('减仓') ? "bg-orange-500/10 text-orange-400" :
                      etf.recommendation.includes('买') ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {etf.recommendation} ({etf.totalScore}分)
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {etfs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                  暂无场内ETF数据。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
