import React from 'react';
import { Target, Info, ShieldAlert, BarChart3, TrendingUp, Cpu, Award } from 'lucide-react';

export default function ScoreReference() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Target className="text-emerald-400" />
          多因子双维度量化打分核心引擎指南
        </h2>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          本系统构建了满分 100 分的两套独立量化评估逻辑：<strong className="text-white">基础各市场资产多因子打分 (80分) + 场内折溢价偏差修正 (20分)</strong>。<br/>
          为了解决“右侧势头趋势跟随”与“左侧逆向分吸筹”的天然特征冲突，系统将算法彻底解耦为 <strong>📈 波段趋势型</strong> 与 <strong>🧘 长期定投型</strong> 双视图。
        </p>

        <div className="mb-8 p-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
          <h3 className="text-sm font-bold text-orange-400 flex items-center gap-1.5 mb-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span>自选资产、实盘定投纪律与折溢价摩擦声明</span>
          </h3>
          <p className="text-slate-300 text-xs leading-relaxed space-y-2">
            <span className="block text-slate-200 mt-2"><strong>🛠 自行选股与标别管理</strong>: 支持全量管理底层资产标的。顶部点击『标的管理设置』引入场外联接、重组场内ETF，自定义费率，自动刷新并覆盖全局引擎。</span>
            <span className="block text-slate-200 mt-2"><strong>📊 实盘交易纪律与记录管线</strong>: 提供双模态(【ETF】场内份额 / 【OTC】场外定投确权金额)录入纪法。引入 <strong>自动化摩擦费率扣减</strong> 以及 <strong>定投 (SIP) 标记</strong> 支持，隔离定投数据。支持本地 CSV/JSON 随时导入导出。</span>
            <span className="block text-slate-200 mt-2"><strong>⚠️ 汇率对冲与折溢价</strong>: 美股等 QDII 将因 离岸人民币 (USD/CNY) 汇率产生巨额对冲误差。此外，重度恐慌时境内纳指常发 10-15% 溢价陷阱，请严守纪律。</span>
          </p>
        </div>

        {/* Dynamic & Cross Border Highlights */}
        <div className="mb-8 p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
          <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5 mb-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>核心算法：跨大类资产交叉因子与动态重估 (DRRW) 机制</span>
          </h3>
          <p className="text-slate-300 text-xs leading-relaxed">
            不同于单一技术面，本引擎完美融合跨大类宏观因子：
          </p>
          <ul className="text-slate-400 text-xs space-y-1.5 list-disc list-inside mt-2">
            <li><strong>美元外汇敞口避险 (USD/CNY)</strong>：实存计入纳斯达克汇兑溢价。当汇率极值扭转时，安全系数自动缩放。</li>
            <li><strong>中美利差无风险锚 (US10Y)</strong>：监控 <strong>^TNX (美国10年期国债收益率)</strong>。其上行将虹吸新兴市场蓝筹，下行促外资流入。</li>
            <li><strong>DRRW 动态风险权重管理</strong>：在美股模块，当 VIX 极高(&gt;25)极度恐慌时，系统会自动将 50MA 趋势权重降低，提升 PE 估值性价比权重；当 VIX 极低(&lt;15)平稳主升时，增加趋势追随权重，实现自适应市场状态微调。</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0D1527] border border-blue-500/20 rounded-2xl p-6">
            <h3 className="text-blue-400 font-bold mb-3 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>📈 波段趋势视图指标标准权重 (右侧)</span>
            </h3>
            <ul className="text-slate-300 text-xs space-y-2.5">
              <li className="flex justify-between items-start gap-4">
                <span><strong>200日长期均线 (25 - 30分)</strong>：顺势跟强，高于长期牛熊线得分。</span>
                <span className="text-blue-400 font-mono shrink-0">重兵驻防</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>50日中期均线 (15 - 20分)</strong>：中期动量强度，判定多头势能。</span>
                <span className="text-slate-400 font-mono shrink-0">顺势势能</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>滚动估值PE / 汇率 (15分)</strong>：估值底气与宏观美元外汇。</span>
                <span className="text-slate-400 font-mono shrink-0">安全边界</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>RSI / 外围债率 (10 - 20分)</strong>：动能超卖或外围收益流动性。</span>
                <span className="text-slate-400 font-mono shrink-0">非对称优势</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#0B1A1E] border border-emerald-500/20 rounded-2xl p-6">
            <h3 className="text-emerald-400 font-bold mb-3 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>🧘 长期定投视图指标标准权重 (左侧)</span>
            </h3>
            <ul className="text-slate-300 text-xs space-y-2.5">
              <li className="flex justify-between items-start gap-4">
                <span><strong>低估吸筹性价比 (25 - 30分)</strong>：极端便宜或低于200MA时，逆向得分高。</span>
                <span className="text-emerald-400 font-mono shrink-0">黄金深坑</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>超卖情绪RSI / 恐慌度 (15 - 20分)</strong>：恐惧中吸货，超卖区高分，狂热区得0分。</span>
                <span className="text-slate-400 font-mono shrink-0">别人恐惧</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>最大历史回撤 (10 - 20分)</strong>：度量当前距离高点回调，跌幅越大买点越安全。</span>
                <span className="text-slate-400 font-mono shrink-0">回调安全</span>
              </li>
              <li className="flex justify-between items-start gap-4">
                <span><strong>50日中期均线 (0 - 20分)</strong>：非相关大类剔除此中线，在逆向建仓阶段忽略中期干扰。</span>
                <span className="text-slate-400 font-mono shrink-0">忽略波折</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <h3 className="text-emerald-400 font-bold mb-2 tracking-wide text-sm flex items-center">
              <span>🟢 70 - 100 分：极具性价比 / 强烈买入 (黄金攒投区)</span>
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              <strong>【波段】操作建议：</strong> 趋势共振完成完全上行，右侧势头饱满，强烈突破买点。 <br/>
              <strong>【定投】操作建议：</strong> 极其悲观恐慌超卖，资产极端便宜。回测推荐调频至最大投入（通常为 1.5x - 3.0x 倍数累积优质筹码）。
            </p>
          </div>

          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-6">
            <h3 className="text-emerald-300 font-bold mb-2 tracking-wide text-sm">
              🔵 50 - 69 分：势能良好 / 温和买入 (常规定投区)
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              <strong>【波段】操作建议：</strong> 趋势巩固，多头发力，标准轻仓或加仓。 <br/>
              <strong>【定投】操作建议：</strong> 价格合理，波动良性。执行 1.0x 标准基数定投。
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold mb-2 tracking-wide text-sm">
              🟡 30 - 49 分：位置中性 / 守土观望 (防守减额区)
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              <strong>【波段】操作建议：</strong> 趋势高位盘整或跌破核心支撑，持有低仓。 <br/>
              <strong>【定投】操作建议：</strong> 估值在中高危水平或无风险利率高烧无退。建议拉长定投跨度，缩减积攒额度。
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <h3 className="text-red-400 font-bold mb-2 tracking-wide text-sm">
              🔴 &lt; 30 分：估值严重透支 / 严格防守 (暂停扣款 / 一票否决)
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              <strong>【波段】操作建议：</strong> 长期牛熊破死破跌，无条件清仓止损保护本金存留。<br/>
              <strong>【定投】操作建议：</strong> 高位疯牛赶顶泡沫溢满，RSI与超买爆表，触发高位暂停定投，绝不追高代劳。<br/>
              <strong>一票否决规则（场内折溢价）：</strong> 
              场内溢价率在波段视界若<strong> &gt; 3.0%</strong>，或定投视界若 <strong> &gt; 0.5%</strong>，皆被系统强力降级，一票否决为零，回避高额套利摩擦损耗。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="text-blue-400" />
          四大市场资产多因子细分打分模型 (每类别总分 80 分)
        </h2>

        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
            <h3 className="text-slate-100 font-bold text-base flex items-center gap-2">
              纳斯达克 100 (美股核心进攻)
            </h3>
            <span className="text-xs bg-blue-500/20 text-blue-400 font-mono px-2 py-0.5 rounded-full">主攻宽频牛</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">📈 波段趋势因子配比 (正常状态下)</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>200日均线支撑 (25分)</strong>：价格在 200MA 上下偏离度算准。</li>
                <li><strong>50日均线势能 (15分)</strong>：50MA线上及其倾斜多头状态。</li>
                <li><strong>估值性价比 PE (15分)</strong>：纳指PE在 25-35 宽幅。 </li>
                <li><strong>恐慌情绪 VIX (10分)</strong>：SPX VIX 偏离 15 - 30 恐慌。</li>
                <li><strong>汇率避险 USD/CNY (15分)</strong>：汇率反向增厚（7.35对折算）。</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">🧘 长期定投因子配比 (正常状态下)</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>低估吸筹 PE 性价比 (25分)</strong>：极低PE释放大量定投抢筹。</li>
                <li><strong>长期生存空间 200MA (15分)</strong>：贴近甚至跌穿牛熊线时，倾泄买点。</li>
                <li><strong>恐惧吸筹 VIX (15分)</strong>：高企引发极具偏斜的加舱打分。</li>
                <li><strong>危机高位回撤 (15分)</strong>：距离一年最高的回撤，越狠越买。</li>
                <li><strong>汇率缓冲 USD/CNY (10分)</strong>：评估换算对冲保障安全。</li>
              </ul>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-2">※ 处于高 VIX 时启动 DRRW（提升 PE 占定投大额比 30 分，缩紧趋势干扰）。</span>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
            <h3 className="text-slate-100 font-bold text-base flex items-center gap-2">
              沪深 300 (国内大盘蓝筹)
            </h3>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full">反脆弱极地牛</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">📈 波段趋势因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>200日长期趋势 (25分)</strong>：多头确立极强评分依据。</li>
                <li><strong>50日中期动能 (15分)</strong>：50MA 上方多头。</li>
                <li><strong>估值性价比 PE (15分)</strong>：核心蓝筹 PE 在 10-14 安全底盘。</li>
                <li><strong>相对强弱 RSI (15分)</strong>：极冷或极热偏离，常态健康区间最高。</li>
                <li><strong>中美利差流动性 (10分)</strong>：追踪美10Y国债 ^TNX 变化，越低越好。</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">🧘 长期定投因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>估值超低 PE (25分)</strong>：PE ≤ 10 时满负荷评分，白送区域。</li>
                <li><strong>筑底长期均线 (15分)</strong>：跌穿 200MA 时，给予反脆弱多加高分。</li>
                <li><strong>情绪超卖 RSI (15分)</strong>：RSI 跌入 ≤30 冰点，恐惧贪婪底出现。</li>
                <li><strong>危机回撤保护 (15分)</strong>：回撤达到 20% 提供极限支持。</li>
                <li><strong>中美利差无风险锚 (10分)</strong>：美债收益高烧不退时采取合理克制。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
            <h3 className="text-slate-100 font-bold text-base flex items-center gap-2">
              黄金 (全球抗通胀避险)
            </h3>
            <span className="text-xs bg-amber-500/20 text-amber-400 font-mono px-2 py-0.5 rounded-full">长尾避风港</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">📈 波段趋势因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>长期势头 200MA (30分)</strong>：超 200MA 5% 为完美强势波段。</li>
                <li><strong>中期斜率 50MA (20分)</strong>：50MA 极佳上行跟随。</li>
                <li><strong>情绪强度 RSI (20分)</strong>：高位极热恐调整，RSI 温和偏强最优。</li>
                <li><strong>高点回撤深度 (10分)</strong>：洗盘后势头拉起，回撤在 10% 以内扣分少。</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">🧘 长期定投因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>长线安全均线 (30分)</strong>：低于 200MA，长久筑底性价比满分。</li>
                <li><strong>超卖情绪 RSI (20分)</strong>：低迷超卖，散户割肉即满分。</li>
                <li><strong>中期安全回落 (20分)</strong>：低于 50MA 逆向收集。</li>
                <li><strong>历史回撤深度 (10分)</strong>：极限下跌回调防线。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
            <h3 className="text-slate-100 font-bold text-base flex items-center gap-2">
              国内债券 (压舱石低波防守)
            </h3>
            <span className="text-xs bg-rose-500/20 text-rose-400 font-mono px-2 py-0.5 rounded-full">常恒生息对冲</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">📈 波段趋势因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>200MA长期强支撑 (25分)</strong>：偏离度在常态上攀区间。</li>
                <li><strong>50MA中期稳上扬 (15分)</strong>：平滑上升不失守。</li>
                <li><strong>超低高点回撤 (20分)</strong>：债市高位不容得超1.5% 回撤，一旦失控全扣。</li>
                <li><strong>波动率考核 (10分)</strong>：20日波动极致窄小保持生息平稳。</li>
                <li><strong>降息窗口 TNX (10分)</strong>：美债下行溢出释放流动性加分。</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2 font-mono">🧘 长期定投因子配比</h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li><strong>超强利率低吸 200MA (30分)</strong>：回调筑底超安全无波买入。</li>
                <li><strong>50MA回归线 (15分)</strong>：常态逆向收集。</li>
                <li><strong>历史极限回撤 (20分)</strong>：稳妥防线上扣。</li>
                <li><strong>波动狭窄度 Vol (15分)</strong>：追求超平稳运行，高危波动扣分。</li>
              </ul>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 opacity-90 block mt-3">※ 本债市模块支持跟踪零折溢价的 OTC 场外指数联接基金。场外默认获得最高场内折价修正满分（20分）。</span>
        </div>
      </div>
      
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Cpu className="text-indigo-400" />
          系统科学性评估与算法定位
        </h2>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          本系统构建逻辑基于业内成熟的<strong>大类资产轮动理论 (Asset Rotation)</strong>、<strong>行为金融学 (Behavioral Finance)</strong>、以及 <strong>防过拟合自适应网格</strong>，帮助投资者绕过“跟风抬轿”与“满仓死扛”等感性认知缺陷。
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-slate-200 font-bold text-sm mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              系统定位处于什么水平？
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed pl-3 border-l-2 border-indigo-500/20">
              相当于您聘请了一位拥有 <strong>8 年以上交易资历的宏观大类配置买方研究员</strong>。它不关心任何短周期日内噪声与小作文，而是死克宏观无风险流动性底、波动率、历史周期位置、折溢价套利等客观常识。
            </p>
          </div>

          <div>
            <h3 className="text-slate-200 font-bold text-sm mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              反脆弱架构的落地体现
            </h3>
            <ul className="list-none text-xs text-slate-400 space-y-3 pl-3 border-l-2 border-emerald-500/20">
              <li><strong>宽限度阶梯（防过拟合）：</strong> 对 PE、VIX、RSI 等高灵敏因子的多级梯度都设置了线性的截断限制，不猜测个位数精确值，杜绝了重度依赖单一历史表现的“过拟合神话”。</li>
              <li><strong>反弹危机阿尔法：</strong> 特设回撤触发权重溢额机制。在市场大跌（如纳指大回撤、A股RSI坠入25冰点）散户割肉时，长期定投评分会非线性急涨，配合历史回测，自动给出 2.0x 乃至更高加倍定投提示。</li>
              <li><strong>双系统避害机制：</strong> 场内高额溢价（例如海外 QDII 遭到疯狂买盘爆买，场内买价超出净值 &gt;3%）时，该资产的最终得分将无条件归零，避免做“高接接盘侠”。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Info className="text-purple-400" />
          系统高阶专有名词速览
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-emerald-400 font-bold mb-2 text-xs font-mono">折溢价率 (Premium/Discount Ratio)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              场内交易价格相较其实时基金净值的偏离度。<strong>溢价</strong>暗示场内资金追捧买贵了；<strong>折价</strong>则表示买家清冷可以打折吸货。本系统特置最高一票降权防摩擦。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-blue-400 font-bold mb-2 text-xs font-mono">滚动市盈率 (Trailing PE)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              常恒估值模型基础。使用最近4季度公司每股真实收益加总，测算回本周转。宽频 PE 估值中：纳指 25 以下极富吸引力，35 以上风险极高。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-purple-400 font-bold mb-2 text-xs font-mono">恐慌指数 (SPX VIX)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              标普500期权波动率指数，作为全球市场情绪情绪极值的先锋观测仪。飙升 (&gt;25) 预示黄金坑见底；常态低迷 (&lt;15) 预示平稳安全上涨。
            </p>
          </div>

          <div className="bg-black/20 rounded-xl p-5 border border-white/5">
            <h4 className="text-orange-400 font-bold mb-2 text-xs font-mono">美国10年期国债收益率 (^TNX)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              全球无风险资产价值定价之母（外围无风风险锚）。其高企代表流动性抽血，导致非美元新兴市场（以及债券板块）吸引力折损。下行代表降息流动性释放拓宽。
            </p>
          </div>

          <div className="bg-[#0D1527] rounded-xl p-5 border border-blue-500/10 col-span-1 md:col-span-2">
            <h4 className="text-indigo-400 font-bold mb-2 text-xs font-mono">美元汇率套利系数 (USD/CNY)</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              跨境外籍资产换算护城河。纳指 QDII 最终在华计价以法币挂钩，当美元相较于人民币贬值（汇率回归）时，会产生汇差侵蚀，反之则构成对冲溢价。模型特设 7.35 减扣梯队，实战反馈极致精细。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
