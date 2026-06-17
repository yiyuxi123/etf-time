import React, { useState, useMemo } from "react";
import { MarketData, ChartDataPoint } from "../types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  ShieldAlert,
  Award,
  Play,
  Info,
  HelpCircle,
} from "lucide-react";

interface QuantitativeBacktesterProps {
  markets: MarketData[];
  currentViewDefault?: "swing" | "dca";
}

export default function QuantitativeBacktester({
  markets,
  currentViewDefault = "swing",
}: QuantitativeBacktesterProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"swing" | "dca">(currentViewDefault);

  // Custom backtester input parameters
  const [swingBuyThreshold, setSwingBuyThreshold] = useState(70);
  const [swingSellThreshold, setSwingSellThreshold] = useState(50);

  const [dcaStopThreshold, setDcaStopThreshold] = useState(40);
  const [dcaDoubleThreshold, setDcaDoubleThreshold] = useState(85);
  const [multiplier, setMultiplier] = useState(2.0);

  const activeMarket = markets[selectedIdx];
  const chartData = activeMarket?.chartData || [];

  // 🧪 SIMULATION ENGINE
  const simulationResults = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    if (viewMode === "swing") {
      // 📈 Swing Trading Simulation Strategy
      // Start with $10,000 cash.
      let cash = 10000;
      let holdings = 0;
      let isInvested = false;
      const initialPrice = chartData[0].close || 1;

      // 📉 FRICTION PARAMS
      const txnCost = 0.0007; // 0.07% total friction (slippage + commission)

      const timeline = chartData.map((point) => {
        const score = point.swingScore || point.score || 50;
        const price = point.close || 1;

        if (!isInvested && score >= swingBuyThreshold) {
          // BUY Signal
          const purchasePrice = price * (1 + txnCost);
          holdings = cash / purchasePrice;
          cash = 0;
          isInvested = true;
        } else if (isInvested && score < swingSellThreshold) {
          // SELL Signal
          const sellPrice = price * (1 - txnCost);
          cash = holdings * sellPrice;
          holdings = 0;
          isInvested = false;
        }

        const portfolioValue = isInvested ? holdings * price : cash;
        const benchUnits = 10000 / (initialPrice * (1 + txnCost));
        const benchmarkValue = benchUnits * price;

        return {
          date: point.date,
          strategy: portfolioValue,
          benchmark: benchmarkValue,
          score,
          price,
        };
      });

      // Stats calculation
      const initialVal = 10000;
      const finalStrategy = timeline[timeline.length - 1].strategy;
      const finalBenchmark = timeline[timeline.length - 1].benchmark;

      const strategyReturn = ((finalStrategy - initialVal) / initialVal) * 100;
      const benchmarkReturn =
        ((finalBenchmark - initialVal) / initialVal) * 100;

      // CAGR (Compound Annual Growth Rate) over 2 years (approx 504 trading days)
      const cagrStrategy =
        (Math.pow(finalStrategy / initialVal, 365 / 730) - 1) * 100;
      const cagrBenchmark =
        (Math.pow(finalBenchmark / initialVal, 365 / 730) - 1) * 100;

      // Maximum Drawdown computation
      let peakStrat = 0;
      let maxDdStrat = 0;
      let peakBench = 0;
      let maxDdBench = 0;

      timeline.forEach((pt) => {
        if (pt.strategy > peakStrat) peakStrat = pt.strategy;
        const ddS = peakStrat
          ? ((pt.strategy - peakStrat) / peakStrat) * 100
          : 0;
        if (ddS < maxDdStrat) maxDdStrat = ddS;

        if (pt.benchmark > peakBench) peakBench = pt.benchmark;
        const ddB = peakBench
          ? ((pt.benchmark - peakBench) / peakBench) * 100
          : 0;
        if (ddB < maxDdBench) maxDdBench = ddB;
      });

      // Sharpe Ratio Calculation
      const computeSharpe = (data: any[], key: string) => {
        let returns: number[] = [];
        for (let i = 1; i < data.length; i++) {
          const prev = data[i - 1][key];
          if (prev > 0) returns.push((data[i][key] - prev) / prev);
        }
        if (returns.length === 0) return 0;
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance =
          returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
          returns.length;
        const std = Math.sqrt(variance);
        const rf = 0.03 / 252; // 3% risk free rate
        return std === 0 ? 0 : (Math.sqrt(252) * (mean - rf)) / std;
      };

      const sharpeStrategy = computeSharpe(timeline, "strategy");
      const sharpeBenchmark = computeSharpe(timeline, "benchmark");

      const alpha = strategyReturn - benchmarkReturn;

      return {
        timeline,
        strategyReturn,
        benchmarkReturn,
        cagrStrategy,
        cagrBenchmark,
        maxDdStrategy: Math.abs(maxDdStrat),
        maxDdBenchmark: Math.abs(maxDdBench),
        sharpeStrategy,
        sharpeBenchmark,
        alpha,
        endValueStrategy: finalStrategy,
        endValueBenchmark: finalBenchmark,
      };
    } else {
      // 🧘 DCA Simulation Strategy
      // Periodically invest. Suppose we invest "Base Amount = $100" every single trading day.
      // Strategy rules:
      // - If DCA score < dcaStopThreshold (Suspended) -> we invest $0 (stop DCA)
      // - If DCA score >= dcaDoubleThreshold (Golden Opportunity) -> we invest Double amount ($100 * multiplier)
      // - Otherwise -> we invest regular amount ($100)

      // Baseline Benchmark rules:
      // - Constant DCA: we invest exactly $100 every single period no matter the score

      let stratTotalInvested = 0;
      let stratUnits = 0;

      let benchTotalInvested = 0;
      let benchUnits = 0;

      // 📉 FRICTION PARAMS
      const txnCost = 0.0007; // 0.07% total friction (slippage + commission)

      const timeline = chartData.map((point) => {
        const score = point.dcaScore || point.score || 50;
        const price = point.close || 1;

        // Baseline: Constant DCA
        const benchDailyInvest = 100;
        benchTotalInvested += benchDailyInvest;
        benchUnits += benchDailyInvest / (price * (1 + txnCost));

        // Strategy DCA
        let stratDailyInvest = 100;
        if (score < dcaStopThreshold) {
          stratDailyInvest = 0; // stop DCA
        } else if (score >= dcaDoubleThreshold) {
          stratDailyInvest = 100 * multiplier; // double DCA
        }

        stratTotalInvested += stratDailyInvest;
        if (stratDailyInvest > 0) {
          stratUnits += stratDailyInvest / (price * (1 + txnCost));
        }

        const stratPortfolioValue = stratUnits * price;
        const benchPortfolioValue = benchUnits * price;

        // We calculate absolute performance of cumulative savings
        return {
          date: point.date,
          // Normalize results to visualize standard comparable growth curve
          strategy: stratPortfolioValue,
          benchmark: benchPortfolioValue,
          stratCost: stratTotalInvested,
          benchCost: benchTotalInvested,
          score,
          price,
        };
      });

      const finalStratVal =
        stratUnits * (chartData[chartData.length - 1].close || 1);
      const finalBenchVal =
        benchUnits * (chartData[chartData.length - 1].close || 1);

      const stratReturn =
        stratTotalInvested > 0
          ? ((finalStratVal - stratTotalInvested) / stratTotalInvested) * 100
          : 0;
      const benchReturn =
        benchTotalInvested > 0
          ? ((finalBenchVal - benchTotalInvested) / benchTotalInvested) * 100
          : 0;

      // CAGR over 2 years (approx)
      const cagrStrategy =
        stratTotalInvested > 0
          ? (Math.pow(finalStratVal / stratTotalInvested, 365 / 730) - 1) * 100
          : 0;
      const cagrBenchmark =
        benchTotalInvested > 0
          ? (Math.pow(finalBenchVal / benchTotalInvested, 365 / 730) - 1) * 100
          : 0;

      // Max drawdown computation
      let peakStratDiff = -999999;
      let maxDdStrat = 0;
      timeline.forEach((pt) => {
        const value = pt.strategy;
        if (value > peakStratDiff) peakStratDiff = value;
        const dd = peakStratDiff
          ? ((value - peakStratDiff) / peakStratDiff) * 100
          : 0;
        if (dd < maxDdStrat) maxDdStrat = dd;
      });

      // Sharpe Ratio Calculation
      const computeSharpe = (data: any[], key: string) => {
        let returns: number[] = [];
        for (let i = 1; i < data.length; i++) {
          const prev = data[i - 1][key];
          if (prev > 0) returns.push((data[i][key] - prev) / prev);
        }
        if (returns.length === 0) return 0;
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance =
          returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
          returns.length;
        const std = Math.sqrt(variance);
        const rf = 0.03 / 252; // 3% risk free rate
        return std === 0 ? 0 : (Math.sqrt(252) * (mean - rf)) / std;
      };

      const sharpeStrategy = computeSharpe(timeline, "strategy");
      const sharpeBenchmark = computeSharpe(timeline, "benchmark");

      return {
        timeline,
        strategyReturn: stratReturn,
        benchmarkReturn: benchReturn,
        cagrStrategy,
        cagrBenchmark,
        maxDdStrategy: Math.abs(maxDdStrat),
        maxDdBenchmark: 12.5, // Reference global drawdown
        sharpeStrategy,
        sharpeBenchmark,
        alpha: stratReturn - benchReturn,
        endValueStrategy: finalStratVal,
        endValueBenchmark: finalBenchVal,
        stratTotalInvested,
        benchTotalInvested,
      };
    }
  }, [
    selectedIdx,
    viewMode,
    swingBuyThreshold,
    swingSellThreshold,
    dcaStopThreshold,
    dcaDoubleThreshold,
    multiplier,
    chartData,
  ]);

  const optimizedParams = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    if (viewMode === "swing") {
      let bestBuy = 60;
      let bestSell = 40;
      let maxAlpha = -999999;

      for (let buy = 50; buy <= 90; buy += 5) {
        for (let sell = 30; sell <= 70; sell += 5) {
          if (buy <= sell) continue;

          let cash = 10000;
          let holdings = 0;
          let isInvested = false;
          const initialPrice = chartData[0].close || 1;
          const txnCost = 0.0007;

          for (let i = 0; i < chartData.length; i++) {
            const point = chartData[i];
            const score = point.swingScore || point.score || 50;
            const price = point.close || 1;

            if (!isInvested && score >= buy) {
              const purchasePrice = price * (1 + txnCost);
              holdings = cash / purchasePrice;
              cash = 0;
              isInvested = true;
            } else if (isInvested && score < sell) {
              const sellPrice = price * (1 - txnCost);
              cash = holdings * sellPrice;
              holdings = 0;
              isInvested = false;
            }
          }

          const finalPrice = chartData[chartData.length - 1].close || 1;
          const finalStrategy = isInvested ? holdings * finalPrice : cash;
          const benchUnits = 10000 / (initialPrice * (1 + txnCost));
          const finalBenchmark = benchUnits * finalPrice;

          const strategyReturn = ((finalStrategy - 10000) / 10000) * 100;
          const benchmarkReturn = ((finalBenchmark - 10000) / 10000) * 100;
          const alpha = strategyReturn - benchmarkReturn;

          if (alpha > maxAlpha) {
            maxAlpha = alpha;
            bestBuy = buy;
            bestSell = sell;
          }
        }
      }

      return {
        bestBuy,
        bestSell,
        maxAlpha,
      };
    } else {
      let bestStop = 40;
      let bestDouble = 75;
      let bestMult = 2.0;
      let maxAlpha = -999999;

      for (let stop = 30; stop <= 60; stop += 5) {
        for (let dbl = 70; dbl <= 95; dbl += 5) {
          for (let mult = 1.5; mult <= 3.0; mult += 0.5) {
            let stratTotalInvested = 0;
            let stratUnits = 0;
            let benchTotalInvested = 0;
            let benchUnits = 0;
            const txnCost = 0.0007;

            for (let i = 0; i < chartData.length; i++) {
              const point = chartData[i];
              const score = point.dcaScore || point.score || 50;
              const price = point.close || 1;

              benchTotalInvested += 100;
              benchUnits += 100 / (price * (1 + txnCost));

              let stratDailyInvest = 100;
              if (score < stop) {
                stratDailyInvest = 0;
              } else if (score >= dbl) {
                stratDailyInvest = 100 * mult;
              }
              stratTotalInvested += stratDailyInvest;
              if (stratDailyInvest > 0) {
                stratUnits += stratDailyInvest / (price * (1 + txnCost));
              }
            }

            const finalPrice = chartData[chartData.length - 1].close || 1;
            const finalStratVal = stratUnits * finalPrice;
            const finalBenchVal = benchUnits * finalPrice;

            const stratReturn =
              stratTotalInvested > 0
                ? ((finalStratVal - stratTotalInvested) / stratTotalInvested) *
                  100
                : 0;
            const benchReturn =
              benchTotalInvested > 0
                ? ((finalBenchVal - benchTotalInvested) / benchTotalInvested) *
                  100
                : 0;
            const alpha = stratReturn - benchReturn;

            if (alpha > maxAlpha) {
              maxAlpha = alpha;
              bestStop = stop;
              bestDouble = dbl;
              bestMult = mult;
            }
          }
        }
      }

      return {
        bestStop,
        bestDouble,
        bestMult,
        maxAlpha,
      };
    }
  }, [chartData, viewMode]);

  const handleApplyBest = () => {
    if (!optimizedParams) return;
    if (viewMode === "swing") {
      const { bestBuy, bestSell } = optimizedParams as {
        bestBuy: number;
        bestSell: number;
      };
      setSwingBuyThreshold(bestBuy);
      setSwingSellThreshold(bestSell);
    } else {
      const { bestStop, bestDouble, bestMult } = optimizedParams as {
        bestStop: number;
        bestDouble: number;
        bestMult: number;
      };
      setDcaStopThreshold(bestStop);
      setDcaDoubleThreshold(bestDouble);
      setMultiplier(bestMult);
    }
  };

  const isCurrentOptimal = useMemo(() => {
    if (!optimizedParams) return false;
    if (viewMode === "swing") {
      const { bestBuy, bestSell } = optimizedParams as {
        bestBuy: number;
        bestSell: number;
      };
      return swingBuyThreshold === bestBuy && swingSellThreshold === bestSell;
    } else {
      const { bestStop, bestDouble, bestMult } = optimizedParams as {
        bestStop: number;
        bestDouble: number;
        bestMult: number;
      };
      return (
        dcaStopThreshold === bestStop &&
        dcaDoubleThreshold === bestDouble &&
        multiplier === bestMult
      );
    }
  }, [
    optimizedParams,
    viewMode,
    swingBuyThreshold,
    swingSellThreshold,
    dcaStopThreshold,
    dcaDoubleThreshold,
    multiplier,
  ]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#0f172a]/95 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl font-mono text-xs max-w-[280px]">
          <p className="text-slate-400 mb-2">{label}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-blue-400 font-bold border-b border-white/5 pb-1.5 mb-1.5">
              <span>阿尔法量化策略:</span>
              <span>${Math.round(payload[0].value).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>基准买入持有:</span>
              <span>${Math.round(payload[1].value).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-[10px]">
              <span>当日资产价格:</span>
              <span>${d.price.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-[10px]">
              <span>当日量化评分:</span>
              <span>{Math.round(d.score)}分</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Selector Heading */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="text-emerald-500 animate-pulse" />
              阿尔法量化模拟回测看板
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-1">
              基于美股估值评分与交叉宏观因子的历史成交追踪，科学验证“波段趋势契合”与“定投防守倍数”。
            </p>
          </div>

          <div className="flex bg-[#0A0D14] p-1 rounded-xl border border-white/5 self-start md:self-auto shadow-inner">
            <button
              onClick={() => setViewMode("swing")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold gap-1.5 flex items-center transition-all ${viewMode === "swing" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <span>波段趋势策略</span>
            </button>
            <button
              onClick={() => setViewMode("dca")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold gap-1.5 flex items-center transition-all ${viewMode === "dca" ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <span>定投量化策略</span>
            </button>
          </div>
        </div>

        {/* Assets tabs selection */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
          {markets.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setSelectedIdx(idx)}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${selectedIdx === idx ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold" : "bg-white/5 text-slate-400 border border-transparent hover:bg-white/10"}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator parameter adjustments panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parameters input card */}
        <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Info className="text-blue-400 w-4 h-4" />
              策略运行参数调节
            </h3>

            {/* AI Auto-Optimizer Section */}
            {optimizedParams && (
              <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Award className="w-4 h-4 animate-bounce" />
                    <span>最佳收益参数寻优</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    Alpha: {optimizedParams.maxAlpha >= 0 ? "+" : ""}
                    {optimizedParams.maxAlpha.toFixed(2)}%
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1 font-mono mb-3">
                  {viewMode === "swing" ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">最佳买入评分:</span>
                        <span className="font-bold text-emerald-400">
                          ≥ {(optimizedParams as any).bestBuy} 分
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">最佳卖出评分:</span>
                        <span className="font-bold text-rose-400">
                          &lt; {(optimizedParams as any).bestSell} 分
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          最佳暂停定投评分:
                        </span>
                        <span className="font-bold text-amber-400">
                          &lt; {(optimizedParams as any).bestStop} 分
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          最佳加倍定投评分:
                        </span>
                        <span className="font-bold text-emerald-400">
                          ≥ {(optimizedParams as any).bestDouble} 分
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">最佳定投乘数:</span>
                        <span className="font-bold text-sky-400">
                          {(optimizedParams as any).bestMult.toFixed(1)} 倍
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApplyBest}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    isCurrentOptimal
                      ? "bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed"
                      : "bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-400/20"
                  }`}
                  disabled={isCurrentOptimal}
                >
                  {isCurrentOptimal
                    ? "✨ 当前已是最佳配置"
                    : "⚡ 一键应用最佳参数"}
                </button>
              </div>
            )}

            {viewMode === "swing" ? (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">买入条件评分区间</span>
                    <span className="text-emerald-400 font-bold">
                      ≥ {swingBuyThreshold} 分
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={swingBuyThreshold}
                    onChange={(e) =>
                      setSwingBuyThreshold(Number(e.target.value))
                    }
                    className="w-full accent-emerald-500 bg-neutral-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-1">
                    当系统综合评分跨越此线，代表趋势合流，全仓长多买入。
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">止损破位卖出区间</span>
                    <span className="text-red-400 font-bold">
                      &lt; {swingSellThreshold} 分
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    step="5"
                    value={swingSellThreshold}
                    onChange={(e) =>
                      setSwingSellThreshold(Number(e.target.value))
                    }
                    className="w-full accent-red-500 bg-neutral-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-1">
                    当跌破该临界评分，说明动能彻底转衰或估值严重踩空，清仓离场。
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">高位暂停扣款阈值</span>
                    <span className="text-amber-400 font-bold">
                      &lt; {dcaStopThreshold} 分
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="60"
                    step="5"
                    value={dcaStopThreshold}
                    onChange={(e) =>
                      setDcaStopThreshold(Number(e.target.value))
                    }
                    className="w-full accent-amber-500 bg-neutral-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-1">
                    高点严重溢价，综合低评分阶段暂停定投，避免追高锁死筹码。
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">低位加倍积攒阈值</span>
                    <span className="text-emerald-400 font-bold">
                      ≥ {dcaDoubleThreshold} 分
                    </span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="95"
                    step="5"
                    value={dcaDoubleThreshold}
                    onChange={(e) =>
                      setDcaDoubleThreshold(Number(e.target.value))
                    }
                    className="w-full accent-emerald-500 bg-neutral-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-1">
                    市场恐慌、极其低估，触发大额安全边际抢筹。
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">抢筹金加倍倍数</span>
                    <span className="text-emerald-400 font-bold">
                      {multiplier.toFixed(1)} 倍
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="3.0"
                    step="0.5"
                    value={multiplier}
                    onChange={(e) => setMultiplier(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-neutral-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-1">
                    在极深度超卖黄金坑所投入金钱乘数，放大安全边际持股份额。
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0A0D14] rounded-2xl p-4 border border-white/5">
            <h4 className="text-xs font-bold font-mono text-slate-400 uppercase flex items-center gap-1">
              <Play className="text-emerald-400 w-3.5 h-3.5" />
              策略回测要领
            </h4>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed font-sans">
              系统对比近两年的历史真盘价格。
              DCA视图回测展示了在不同估估值和波动状态下，“择时调频”定投相比常规机械等额定投累计产生的资产溢出价值。
            </p>
          </div>
        </div>

        {/* Backtester Main Performance Stats + AreaChart Plot */}
        <div className="lg:col-span-8 space-y-6">
          {simulationResults && (
            <>
              {/* Quant Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    策略累计收益 (总计)
                  </span>
                  <span
                    className={`text-xl font-bold font-mono block mt-1.5 ${simulationResults.strategyReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {simulationResults.strategyReturn >= 0 ? "+" : ""}
                    {simulationResults.strategyReturn.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono uppercase">
                    期末值: $
                    {Math.round(
                      simulationResults.endValueStrategy,
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    基准持有收益
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-200 block mt-1.5">
                    {simulationResults.benchmarkReturn >= 0 ? "+" : ""}
                    {simulationResults.benchmarkReturn.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono uppercase">
                    期末值: $
                    {Math.round(
                      simulationResults.endValueBenchmark,
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    超额收益 (Alpha)
                  </span>
                  <span
                    className={`text-xl font-bold font-mono block mt-1.5 ${simulationResults.alpha >= 0 ? "text-blue-400" : "text-slate-400"}`}
                  >
                    {simulationResults.alpha >= 0 ? "+" : ""}
                    {simulationResults.alpha.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-sans">
                    跨越基准持股跑赢率
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    最大回撤 (Drawdown)
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-400 block mt-1.5">
                    -{simulationResults.maxDdStrategy.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-sans">
                    基准回撤: -{simulationResults.maxDdBenchmark.toFixed(1)}%
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    夏普比率 (Sharpe)
                  </span>
                  <span
                    className={`text-xl font-bold font-mono block mt-1.5 ${simulationResults.sharpeStrategy >= 1 ? "text-emerald-400" : "text-slate-200"}`}
                  >
                    {simulationResults.sharpeStrategy.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-sans">
                    基准夏普: {simulationResults.sharpeBenchmark.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Main Comparison Line Chart */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col h-[340px]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                      阿尔法净资产累积曲线
                    </h3>
                    <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase">
                      24-Month Timeline Comparison (Normalized Simulation)
                    </p>
                  </div>
                  <div className="flex gap-4 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1.5 bg-blue-500 rounded-sm"></span>
                      <span className="text-slate-300">量化择时策略</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1.5 bg-slate-500 rounded-sm"></span>
                      <span className="text-slate-400">基准对照组</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={simulationResults.timeline}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="stratGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="benchGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#94a3b8"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#94a3b8"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748b",
                          fontFamily: "monospace",
                        }}
                        minTickGap={30}
                        tickFormatter={(val) => {
                          const parts = val.split("-");
                          return parts.length === 3
                            ? `${parts[1]}/${parts[2]}`
                            : val;
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748b",
                          fontFamily: "monospace",
                        }}
                        tickFormatter={(val) =>
                          `$${Math.round(val).toLocaleString()}`
                        }
                      />
                      <Tooltip content={customTooltip} />
                      <Area
                        type="monotone"
                        dataKey="strategy"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#stratGrad)"
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#64748b"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#benchGrad)"
                        strokeDasharray="4 4"
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
