import React from 'react';
import { Target, Info, ShieldAlert, BarChart3, TrendingUp, AlertTriangle, Cpu } from 'lucide-react';

export default function ScoreReference() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Target className="mr-2 text-emerald-400" />
          系统评分与操作指南
        </h2>
        
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          本系统构建了满分 100 分的市场打分引擎：<strong className="text-white">基础资产得分 (80分) + ETF 场内折溢价得分 (20分)</strong>。<br/>
          基础资产得分由对应市场的核心估值、情绪与均线趋势计算得出。最后系统会监测各类 ETF 的折溢价率，若溢价大于 3%，无论基础资产多好，总分均判为 0，建议坚决回避。
        </p>

        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <h3 className="text-emerald-400 font-bold mb-2 tracking-wide text-lg flex items-center">
              <span>80 - 100 分：强烈买入区 (加倍定投)</span>
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>市场特征：</strong> 资产极度低估、情绪恐慌或场内处于折价状态。<br/>
              <strong>操作建议：</strong> 绝佳的底部建仓或加倍定投区间。
            </p>
          </div>

          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-6">
            <h3 className="text-emerald-300 font-bold mb-2 tracking-wide text-lg">
              60 - 79 分：买入区 (常规定投)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>操作建议：</strong> 估值处于合理偏低区间。保持纪律，正常执行分批买入或按定投计划执行。
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold mb-2 tracking-wide text-lg">
              40 - 59 分：持有观望区 (底仓留存)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>操作建议：</strong> 资产估值中性，停止加仓，持有底仓耐心观望。场外基金此时也可暂缓买入。
            </p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6">
            <h3 className="text-orange-400 font-bold mb-2 tracking-wide text-lg">
              20 - 39 分：减仓区 (兑现利润)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>操作建议：</strong> 资产估值偏高，市场情绪亢奋，建议分批止盈兑现利润。
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-red-400 font-bold mb-2 tracking-wide text-lg">
              &lt; 20 分：清仓或高溢价否决区 (严格回避)
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>操作建议：</strong> 资产出现严重泡沫，或场内 <strong>溢价率 &gt; 3%</strong>。此时买入将承受极大的回归损耗，建议清仓、融券做空（高阶）或严格回避。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <BarChart3 className="mr-2 text-blue-400" />
          各市场基础打分逻辑 (总分80分)
        </h2>

        <div>
          <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
            纳斯达克 100 (美股)
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-2 leading-relaxed">
            <li><strong>估值系统 (满分 30 分)</strong>：QQQ 动态 PE ≤ 25 满分，≥ 35 零分。</li>
            <li><strong>情绪系统 (满分 20 分)</strong>：全球恐慌指数 VIX ≥ 30 满分，≤ 15 零分。</li>
            <li><strong>趋势特征 (满分 15 分)</strong>：向上偏离 200 日线 &gt; 5% 满分，向下受阻零分。</li>
            <li><strong>危机阿尔法 (满分 15 分)</strong>：美股长牛背景下，较年度高点回撤超 15% 即视为极佳的黄金坑底吸筹机会，获满分。</li>
          </ul>
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
            沪深 300 (A股)
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-2 leading-relaxed">
            <li><strong>估值系统 (满分 30 分)</strong>：追踪 A 股核心蓝筹 PE。基于反脆弱逻辑，PE ≤ 10 满分，≥ 14 零分（拓宽阈值防过拟合）。</li>
            <li><strong>趋势系统 (满分 20 分)</strong>：长期上行趋势提供分数。价格向上偏离 200 日线 5% 得满分。</li>
            <li><strong>情绪系统 (满分 15 分)</strong>：RSI 处于低位超卖区 (≤ 30) 获满分，提示左侧建仓机会；超买区 (≥ 70) 零分。</li>
            <li><strong>回撤保护 (满分 15 分)</strong>：A 股超跌往往伴随强力反弹机会，年度高点回撤超过 20% 获得满分鼓励低吸底仓。</li>
          </ul>
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
            黄金 (避险工具)
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-2 leading-relaxed">
            <li><strong>长期趋势 (满分 30 分)</strong>：相比于牛熊，黄金更重视趋势延续。价格超出 200 日线 5% 即获满分。</li>
            <li><strong>中期动能 (满分 20 分)</strong>：中期上涨动能足（超 50 日线 3%）。</li>
            <li><strong>情绪系统 (满分 20 分)</strong>：由于黄金常常在避险情绪剧烈时拉升，RSI 超 70 时易回调（此时得零分），RSI 低于 40（超跌段）得分更高。</li>
            <li><strong>回撤保护 (满分 10 分)</strong>：近期从高点有 10% 左右回撤将提供入场良机。</li>
          </ul>
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
            国内债市 (底仓与对冲)
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-2 leading-relaxed">
            <li>作为稳定生息资产，评价体系着眼于<strong>缓步慢行和低波动率</strong>。</li>
            <li><strong>长期均线 (满分 30 分)</strong>：向上偏离 200 日均线 2% 即视为强牛市满分。</li>
            <li><strong>中期动量 (满分 20 分)</strong>：获 50 日均线良好支撑得分 (1%满分)。</li>
            <li><strong>回撤防守 (满分 20 分)</strong>：作为防守底仓，一旦发生超过 1.5% 的回撤扣除全部分数以规避债市熊市。</li>
            <li><strong>波动率考核 (满分 10 分)</strong>：过去二十天历史回报标准差越低（波动率 &lt; 0.2%），说明市场预期越稳定，得分越高。</li>
            <li><span className="text-emerald-400 opacity-90">注：本模块支持跟踪 OTC 场外指数基金 (如 003376)。场外基金无折溢价率风险，默认获得场内折价奖励满分（20分）。</span></li>
          </ul>
        </div>
      </div>
      
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Cpu className="mr-2 text-indigo-400" />
          系统科学性评估与受众定位
        </h2>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          本系统构建逻辑基于成熟的<strong>多因子量化模型 (Multi-Factor Model)</strong> 与<strong>宏观大类资产配置 (Macro Asset Allocation)</strong>，规避了大量散户常见的“追涨杀跌”和“单一资产满仓”的情绪化陷阱。
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              系统相当于什么水平的投资者？
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed pl-3 border-l-2 border-indigo-500/20">
              相当于拥有 <strong>5 - 10 年交易经验的机构级宏观策略研究员</strong>或 <strong>FOF (基金中基金) 基金经理</strong>。本系统不追求一天翻倍的短线暴利，而是着眼于底层逻辑、分散投资与盈亏比的长期胜率。
            </p>
          </div>

          <div>
            <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              系统的科学性体现在哪里？
            </h3>
            <ul className="list-none text-sm text-slate-400 space-y-3 pl-3 border-l-2 border-emerald-500/20">
              <li><strong>遵循市场常识防过拟合：</strong> 对 PE（估值）、VIX（情绪）、RSI（动能）等经典量化指标进行宽频带（Band）线性评分截断（Clamp），有效防止对历史数据的重度过拟合。</li>
              <li><strong>克服人性弱点（左侧）：</strong> 运用反脆弱逻辑。在美股大幅回撤（危机阿尔法）或 A股/黄金 RSI 处于极度超卖区时逆向给予高分，实现“别人恐惧我贪婪”。</li>
              <li><strong>顺应市场趋势（右侧）：</strong> 结合 200 日与 50 日均线，在主要阻力位形成趋势共振时发力，避免在单边熊市中无脑接飞刀。</li>
              <li><strong>大类资产非相关性：</strong> 不死磕单一市场（比如只炒 A 股）。在防守型债券看重“低波动率”，在进攻型美股看重“估值与回撤的性价比”，因地制宜。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Info className="mr-2 text-purple-400" />
          系统专有名词解释
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-emerald-400 font-bold mb-2">折溢价率 (Premium/Discount)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              ETF 在场内（股票软件中）的交易价格与其真实净值（IOPV）的差值。<strong>溢价</strong>代表交易价高于净值，属于买贵了，会遭受额外摩擦损失；<strong>折价</strong>代表交易价低于净值，属于打折买入。本系统对高溢价（&gt;3%）实行一票否决。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-blue-400 font-bold mb-2">动态市盈率 (Trailing PE)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              用来衡量资产是否“昂贵”的基础估值指标。计算方式为总市值除以最近四个季度的净利润。PE 越低，说明回本周期越短，资产越具有投资性价比。本系统认为纳指 PE 超 35 极度危险，低于 20 为极度低估。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-purple-400 font-bold mb-2">恐慌指数 (VIX)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              芝加哥期权交易所波动率指数。用来衡量市场对未来 30 天波动性的预期。VIX 越高，说明市场越恐慌。巴菲特名言“别人恐惧我贪婪”，当 VIX 飙升（如 &gt;30）时，往往是黄金坑底买入良机。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-orange-400 font-bold mb-2">趋势乖离率 (Trend Deviation)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              当前资产价格偏离核心长期均线（如 200 日均线）的百分比。当价格大幅向下偏离均线，往往意味着过度超卖（机会）；而大幅向上偏离，则不仅代表强势，也可能蕴含技术性回调风险。不同资产对乖离率的打分逻辑不同。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-yellow-400 font-bold mb-2">核心蓝筹 (Blue Chip)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              指在特定行业内占据支配地位、业绩优良、分红稳定、红利丰厚的大公司股票（如沪深 300 中的代表性企业）。系统将沪深 300 视作中国核心资产蓝筹的代理指标。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-slate-300 font-bold mb-2">场内与场外 (On-Exchange vs OTC)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              <strong>场内基金（如 ETF）</strong>：在证券交易所挂牌上市，像买卖股票一样实时交易，价格受供需影响，会产生折溢价。<br/>
              <strong>场外基金（如 OTC 联接基金）</strong>：通过银行、支付宝或天天基金等渠道按当日收盘净值申购/赎回，没有折溢价，但确认份额较慢。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-pink-400 font-bold mb-2">相对强弱指标 (RSI)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              一种衡量某一资产买卖双方力量对比的技术动能指标。通常 RSI 大于 70 说明买方力量过大（处于超买区），面临回调风险；低于 30 甚至更低说明卖方过度宣泄（处于超卖区），往往酝酿反弹或见底机会。黄金和 A 股受此反馈比较明显。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-cyan-400 font-bold mb-2">高点回撤率 (Drawdown)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              资产当前价格距离过去一年最高点的跌幅。在股票市场中，过大的超跌（如 &gt; 20%）可能是一个很好的低吸区域；而在债市这样属于长尾生息防守的资产中，过大的回撤则往往意味着基本面的严重失血（系统予以规避倒扣分）。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-indigo-400 font-bold mb-2">波动率 (Volatility)</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              统计学中衡量资产价格起伏剧烈程度的指标（本系统使用近20日的标准均方差计率）。作为底本的债市板块，其波动率应尽量贴近于 0，保持如心跳般的极弱平稳波动是高分项。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
