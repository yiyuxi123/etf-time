import React from 'react';
import { EtfInfo } from '../types';
import { cn } from '../lib/utils';
import { AlertCircle, CheckCircle2, AlertOctagon } from 'lucide-react';

interface EtfTableProps {
  etfs: EtfInfo[];
  currentView?: 'swing' | 'dca';
  onManageStocks?: () => void;
}

export const EtfTable: React.FC<EtfTableProps> = ({ etfs, currentView = 'swing', onManageStocks }) => {
  const isDcaMode = currentView === 'dca';
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl flex-1 p-6 relative overflow-hidden h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-white/5 pb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex flex-wrap items-center gap-2">
          <span>国内挂钩 ETF 实时监控看板</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-bold tracking-wider font-sans">
            {isDcaMode ? '🧘 长期定投视图' : '📈 波段趋势视图'}
          </span>
        </h3>

      </div>
      
      <p className="text-[10px] text-slate-500 font-normal italic mb-4 leading-relaxed">
        {isDcaMode 
          ? "定投追求防雷，对场内溢价极不耐受：溢价 > 0.5% 即启动惩罚性倒扣评分，强力警示避免多吃摩擦损失（OTC无溢价无摩擦）。" 
          : "趋势追求效率：折溢价得分20分，通过溢价折扣正负套利修正。溢价 > 3% 判定高成本坚决一票否决。"}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] font-bold text-slate-500 border-b border-white/10">
            <tr>
              <th className="pb-3 pl-2 uppercase">代码/名称</th>
              <th className="pb-3 text-right">最新价格</th>
              <th className="pb-3 text-right hidden sm:table-cell" title="基金公司公布的最新官方净值(通常为T-1或T-2日)">T-1 最新净值</th>
              <th className="pb-3 text-right hidden md:table-cell">管理费率</th>
              <th className="pb-3 text-right">实时溢价率</th>
              <th className="pb-3 text-right hidden sm:table-cell">溢价得分 (满分20)</th>
              <th className="pb-3 text-right pr-2">系统建议状态 (总分=80+20)</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono divide-y divide-white/5">
            {etfs.map((etf) => {
              const premiumVal = etf.premiumPct;
              const isDiscount = premiumVal < 0;

              // View-specific scores & texts
              const premiumScore = isDcaMode ? etf.dcaPremiumScore : etf.swingPremiumScore;
              const totalScore = isDcaMode ? etf.dcaTotalScore : etf.swingTotalScore;
              const recommendation = isDcaMode ? etf.dcaRecommendation : etf.swingRecommendation;
              
              // Highlight limits
              const isVetoLimit = isDcaMode ? premiumVal > 0.5 : premiumVal > 3;

              return (
                <tr key={etf.symbol} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 pl-2 font-sans font-medium">
                    <div className="text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                      <span>{etf.symbol.replace('.SS', '').replace('.SZ', '')}</span>
                      {etf.symbol.startsWith('f_') && (
                        <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">OTC</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans">{etf.name}</div>
                  </td>
                  <td className="py-4 text-right text-slate-200">
                    ¥{etf.price.toFixed(4)}
                  </td>
                  <td className="py-4 text-right text-slate-400 hidden sm:table-cell">
                    {etf.estimatedIopv.toFixed(4)}
                  </td>
                  <td className="py-4 text-right text-slate-400 hidden md:table-cell text-xs">
                    {etf.fee || '--'}
                  </td>
                  <td className={cn("py-4 text-right font-bold", isVetoLimit ? "text-red-400" : isDiscount ? "text-emerald-400" : "text-yellow-500")}>
                    {premiumVal > 0 ? '+' : ''}{premiumVal.toFixed(2)}%
                  </td>
                  <td className={cn("py-4 text-right hidden sm:table-cell font-sans", premiumScore < 0 ? "text-red-400" : "text-slate-400")}>
                    {premiumScore > 0 ? '+' : ''}{premiumScore}分
                  </td>
                  <td className="py-4 text-right pr-2">
                    <span className={cn(
                      "text-[10px] px-2.5 py-1 rounded-md font-sans border font-semibold inline-block max-w-[220px] truncate sm:max-w-none",
                      isVetoLimit ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                      recommendation.includes('清仓') || recommendation.includes('暂停') ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      recommendation.includes('减仓') || recommendation.includes('高位') ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                      recommendation.includes('买') || recommendation.includes('窗口') || recommendation.includes('低吸') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    )} title={recommendation}>
                      {recommendation} ({totalScore}分)
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {etfs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
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
