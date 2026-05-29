import React from 'react';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';

export default function ScoreReference() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Target className="mr-2 text-emerald-400" />
          系统评分与操作指南
        </h2>
        
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          本系统通过计算纳斯达克100指数的动态市盈率(PE)、恐慌指数(VIX)、200日均线乖离率(Trend)，构建出一个满分 80 分的市场基础评分模型。
          随后，将国内挂钩 ETF 的实时溢价率纳入考量（折价额外奖励，高溢价惩罚，满分20分），得出单只 ETF 的最终决策总分（满分 100 分）。
        </p>

        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <h3 className="text-emerald-400 font-bold mb-2 tracking-wide text-lg flex items-center">
              <span>80 - 100 分：强烈买入区 (加倍定投)</span>
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 估值极低，市场恐慌情绪蔓延，但趋势依然未破或已严重超跌。<br/>
              <strong>操作建议：</strong> 此时为极佳的底部建仓区间。若在进行定投计划，建议加倍定投金额或手动补仓。
            </p>
          </div>

          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-6">
            <h3 className="text-emerald-300 font-bold mb-2 tracking-wide text-lg">
              60 - 79 分：买入区 (常规低吸定投)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 估值处于合理偏低区间，具备较好的投资性价比。<br/>
              <strong>操作建议：</strong> 保持纪律，正常执行分批买入或常规按月/周进行定投计划。
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold mb-2 tracking-wide text-lg">
              40 - 59 分：持有观望区 (底仓留存观望)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 估值合理或略偏高，市场情绪较为狂热。<br/>
              <strong>操作建议：</strong> 停止加仓或大幅减少买入频率。底仓坚定持有，耐心等待市场回调。
            </p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6">
            <h3 className="text-orange-400 font-bold mb-2 tracking-wide text-lg">
              20 - 39 分：减仓区 (逐步收获利润)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 估值已进入相对高估阶段，且市场情绪极度亢奋。<br/>
              <strong>操作建议：</strong> 建议停止买入，开始分批止盈，逐步兑现前期的浮盈。
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-red-400 font-bold mb-2 tracking-wide text-lg">
              &lt; 20 分：清仓 / 溢价否决区 (高估值风险)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 美股处于极度泡沫化，或 ETF 的场内溢价率大于 3%。<br/>
              <strong>操作建议：</strong> 若出现溢价过高（&gt;3%），系统会无视美股估值直接给出“溢价否决”，此时买入必然承受巨大摩擦损耗。建议坚决清仓或严格回避。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
