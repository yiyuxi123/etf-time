import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Calendar, TrendingUp, HelpCircle, AlertCircle, Play, 
  Pause, CheckCircle2, Calculator, ArrowRight, DollarSign, Wallet, ArrowUpRight,
  Settings, Download, Upload, Info, RefreshCw, BarChart3, HelpCircle as HelpIcon, Sparkles,
  Search, CheckCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line
} from 'recharts';
import { MarketData, EtfInfo, SipPlan } from '../types';
import { checkIsMarketClosed, getNextTradingDay, getTradingDaysElapsed } from '../lib/calendar';
import { findEtfBySymbol as findEtfBySymbolShared, isOtcSymbol as isOtcSymbolShared } from '../utils/fund-helpers';
import SipCalculator from './sip/SipCalculator';
import SipPlanForm from './sip/SipPlanForm';

interface SipPlannerProps {
  markets: MarketData[];
}

export default function SipPlanner({ markets }: SipPlannerProps) {
  const [plans, setPlans] = useState<SipPlan[]>([]);

  // 薄包装：复用 fund-helpers 共享实现，markets 作为闭包注入。
  const findEtfBySymbol = (symbol: string): EtfInfo | null => findEtfBySymbolShared(symbol, markets) ?? null;
  const isOtcSymbol = (sym: string): boolean => isOtcSymbolShared(sym, markets);
  
  const getNextExecutionDate = (plan: SipPlan) => {
    let baseDateStr = '';
    if (plan.historyCount === 0) {
      baseDateStr = plan.startDate;
    } else {
      baseDateStr = plan.lastExecutedDate || plan.startDate;
    }
    if (!baseDateStr) return '';
    
    // Safely parse YYYY-MM-DD components to create a local Date of that day
    const parts = baseDateStr.split('-');
    if (parts.length !== 3) return baseDateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    
    if (plan.historyCount === 0) {
      if ((plan.frequency === 'weekly' || plan.frequency === 'biweekly') && plan.dayOfWeek !== undefined) {
        const currentDay = date.getDay(); // 0 is Sunday, 1..6
        const targetJsDay = plan.dayOfWeek === 7 ? 0 : plan.dayOfWeek;
        let diff = targetJsDay - currentDay;
        if (diff < 0) {
          diff += 7;
        }
        date.setDate(date.getDate() + diff);
      } else if (plan.frequency === 'daily') {
        while (date.getDay() === 0 || date.getDay() === 6) {
          date.setDate(date.getDate() + 1);
        }
      }
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    if (plan.frequency === 'daily') {
      date.setDate(date.getDate() + 1);
      while (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() + 1);
      }
    } else if (plan.frequency === 'weekly') {
      date.setDate(date.getDate() + 7);
    } else if (plan.frequency === 'biweekly') {
      date.setDate(date.getDate() + 14);
    } else if (plan.frequency === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    }
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDaysUntilNextExecution = (plan: SipPlan) => {
    const nextDateStr = getNextExecutionDate(plan);
    if (!nextDateStr) return 0;
    
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const parts = nextDateStr.split('-');
    if (parts.length !== 3) return 0;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const nextLocal = new Date(year, month, day);
    
    const diffTime = nextLocal.getTime() - todayLocal.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Custom non-blocking interactive states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [executingPlan, setExecutingPlan] = useState<SipPlan | null>(null);
  const [executingMessage, setExecutingMessage] = useState<{
    etfName: string;
    price: number;
    baseAmount: number;
    multiplier: number;
    finalAmount: number;
    fee: number;
    shares: number;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Custom smart scaling multipliers state
  const [multipliers, setMultipliers] = useState({
    extreme: 2.0, // score >= 75
    low: 1.5,     // score >= 60
    fair: 1.0,    // score >= 45
    high: 0.7,    // score >= 30
    bubble: 0.4   // score < 30
  });

  // Test Interactive DCA Simulator Score Slider
  const [testScore, setTestScore] = useState(65);

  // Form State for New Plan
  const [name, setName] = useState('');
  const [marketId, setMarketId] = useState('ndx');
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('1000');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [planDayOfWeek, setPlanDayOfWeek] = useState<number>(3); // 1-7 (Mon-Sun), default to Wednesday (3)
  const [isSmart, setIsSmart] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Batch Import States
  const [batchPlanId, setBatchPlanId] = useState<string>('');
  const [batchStartDate, setBatchStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [batchEndDate, setBatchEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [autoCheckExecuted, setAutoCheckExecuted] = useState(false);


  // Customizable transaction attributes (user can override at any time)
  const [rate, setRate] = useState('0.15');
  const [settlementDays, setSettlementDays] = useState('1');
  const [purchaseLimit, setPurchaseLimit] = useState('1000000');

  // AI-Grounded research state
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<{
    marketClosedToday: boolean;
    closureReason: string;
    queryDate: string;
    etfType: string;
    settlementDays: number;
    rate: number;
    purchaseLimit: number;
    analysis: string;
  } | null>(null);

  // Trigger search-grounded AI analysis of selected fund configuration on specific start date
  const triggerAiResearch = async () => {
    if (!symbol) return;
    setResearchLoading(true);
    setResearchResult(null);

    const activeMarket = markets.find(m => m.id === marketId);
    const etfName = activeMarket?.etfs.find(e => e.symbol === symbol)?.name || symbol;

    try {
      const res = await fetch('/api/sipplanner/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          name: etfName,
          dateStr: startDate,
          marketId
        })
      });

      if (!res.ok) {
        throw new Error('AI research service returned error');
      }

      const resJson = await res.json();
      if (resJson.success && resJson.parsed) {
        const info = resJson.parsed;
        setResearchResult(info);
        setRate(info.rate.toString());
        setSettlementDays(info.settlementDays.toString());
        setPurchaseLimit(info.purchaseLimit.toString());
        showToast('💡 AI 联网实时检索成功！交易费率、结算期及休市分析已自动填入！', 'success');
      } else {
        throw new Error('AI research could not be parsed as formatted output');
      }
    } catch (err: any) {
      console.error("AI research error:", err);
      showToast('⚠️ AI 检索遇到轻微延迟，请您先行根据主观常识核改表单。', 'info');
    } finally {
      setResearchLoading(false);
    }
  };

  // Plan card level AI research states
  const [planResearchResults, setPlanResearchResults] = useState<Record<string, any>>({});
  const [planResearchLoading, setPlanResearchLoading] = useState<Record<string, boolean>>({});

  // Trigger search-grounded AI analysis of an active plan
  const triggerPlanAiResearch = async (plan: SipPlan) => {
    setPlanResearchLoading(prev => ({ ...prev, [plan.id]: true }));
    try {
      const activeMarket = markets.find(m => m.id === plan.marketId);
      const etfName = activeMarket?.etfs.find(e => e.symbol === plan.symbol)?.name || plan.symbol;
      
      const res = await fetch('/api/sipplanner/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: plan.symbol,
          name: etfName,
          dateStr: new Date().toISOString().split('T')[0], // check current date
          marketId: plan.marketId
        })
      });

      if (!res.ok) throw new Error('AI research failed');
      const data = await res.json();
      if (data.success && data.parsed) {
        setPlanResearchResults(prev => ({ ...prev, [plan.id]: data.parsed }));
        showToast(`📊 针对投扣策略《${plan.name}》的今日交易与休市研判刷新成功！`, 'success');
      } else {
        throw new Error('AI parsing details returned an incorrect structure');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ AI 今日研判检索略有延迟，请稍后刷新重试。', 'info');
    } finally {
      setPlanResearchLoading(prev => ({ ...prev, [plan.id]: false }));
    }
  };

  // Backup / Import file helper element ref or trigger
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load plans & custom multipliers on mount
  useEffect(() => {
    // 1. Saved plans
    const savedPlans = localStorage.getItem('etf_sip_plans');
    if (savedPlans) {
      try {
        setPlans(JSON.parse(savedPlans));
      } catch (e) {}
    } else {
      // Seed an elegant default plan
      const defaultPlan: SipPlan = {
        id: 'default-sip-ndx',
        name: '美股纳指长期智能定投',
        marketId: 'ndx',
        symbol: 'f_016452',
        amount: 1500,
        frequency: 'monthly',
        isSmart: true,
        startDate: new Date().toISOString().split('T')[0],
        totalInvested: 3000,
        historyCount: 2,
        status: 'active',
        rate: 0.15,
        settlementDays: 2,
        purchaseLimit: 1000000
      };
      setPlans([defaultPlan]);
      localStorage.setItem('etf_sip_plans', JSON.stringify([defaultPlan]));
    }

    // 2. Saved multipliers
    const savedMults = localStorage.getItem('etf_sip_multipliers');
    if (savedMults) {
      try {
        setMultipliers(JSON.parse(savedMults));
      } catch (e) {}
    }
  }, []);

  // Update default symbol when market selection changes
  useEffect(() => {
    const market = markets.find(m => m.id === marketId);
    if (market && market.etfs && market.etfs.length > 0) {
      setSymbol(market.etfs[0].symbol);
    }
  }, [marketId, markets]);

  // Adjust defaults when symbol itself changes
  useEffect(() => {
    if (!symbol) return;
    const isOTC = isOtcSymbol(symbol);
    setRate(isOTC ? '0.15' : '0.01');
    const isNdx = marketId === 'ndx';
    setSettlementDays(isOTC && isNdx ? '2' : '1');
    setPurchaseLimit('1000000');
    setResearchResult(null); // Clear research status for new symbol
  }, [symbol, marketId]);

  // Dynamic Auto-Execution Trigger of reach-time due active plans
  useEffect(() => {
    if (plans.length === 0 || markets.length === 0 || autoCheckExecuted) return;
    setAutoCheckExecuted(true);
    
    const todayStr = new Date().toISOString().split('T')[0];
    let updatedPlans = [...plans];
    let hasChanges = false;
    let newRecordsToAdd: any[] = [];
    
    updatedPlans = updatedPlans.map(plan => {
      if (plan.status !== 'active') return plan;
      
      let p = { ...plan };
      let currentNextDate = getNextExecutionDate(p);
      let executedStepsForThisPlan = 0;
      
      while (currentNextDate && currentNextDate <= todayStr && executedStepsForThisPlan < 20) {
        hasChanges = true;
        executedStepsForThisPlan++;
        
        const execResult = autoExecuteSingleStep(p, currentNextDate, newRecordsToAdd, markets);
        if (execResult) {
          p.totalInvested += execResult.finalAmount;
          p.historyCount += 1;
          p.lastExecutedDate = currentNextDate;
          
          newRecordsToAdd.push(execResult.journalItem);
        }
        
        currentNextDate = getNextExecutionDate(p);
      }
      
      return p;
    });
    
    if (hasChanges) {
      setPlans(updatedPlans);
      localStorage.setItem('etf_sip_plans', JSON.stringify(updatedPlans));
      localStorage.setItem('local_last_updated', new Date().toISOString());
      
      try {
        const savedJournal = localStorage.getItem('etf_trading_journal');
        const journal = savedJournal ? JSON.parse(savedJournal) : [];
        journal.push(...newRecordsToAdd);
        localStorage.setItem('etf_trading_journal', JSON.stringify(journal));
      } catch (err) {
        console.error("Auto execute failed to append journal:", err);
      }
      
      window.dispatchEvent(new Event('trading_journal_updated'));
      showToast(`⚡ 定投时间已到！已自动为您执行 ${newRecordsToAdd.length} 笔到期扣划并记入账簿。`, 'success');
    }
  }, [markets, plans, autoCheckExecuted]);

  const savePlans = (newPlans: SipPlan[]) => {
    setPlans(newPlans);
    localStorage.setItem('etf_sip_plans', JSON.stringify(newPlans));
    localStorage.setItem('local_last_updated', new Date().toISOString());
    window.dispatchEvent(new Event('trading_journal_updated'));
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !symbol || !amount) return;
    
    const newPlan: SipPlan = {
      id: Date.now().toString(),
      name,
      marketId,
      symbol,
      amount: parseFloat(amount),
      frequency,
      dayOfWeek: (frequency === 'weekly' || frequency === 'biweekly') ? planDayOfWeek : undefined,
      isSmart,
      startDate,
      totalInvested: 0,
      historyCount: 0,
      status: 'active',
      rate: parseFloat(rate) || (isOtcSymbol(symbol) ? 0.15 : 0.01),
      settlementDays: parseInt(settlementDays) || 1,
      purchaseLimit: parseFloat(purchaseLimit) || 1000000
    };

    savePlans([...plans, newPlan]);
    
    // Reset Form
    setName('');
    const m = markets.find(m => m.id === marketId);
    if (m && m.etfs && m.etfs.length > 0) {
      setSymbol(m.etfs[0].symbol);
    }
    setResearchResult(null);
    showToast('🎉 成功创建新的定投计划！', 'success');
  };

  // Helper inside SipPlanner to generate historical execution dates
  const generateHistoryDates = (
    freq: 'daily' | 'weekly' | 'biweekly' | 'monthly',
    dayOfW: number | undefined,
    startStr: string,
    endStr: string
  ): string[] => {
    const dates: string[] = [];
    
    const parseLocalDate = (str: string) => {
      const parts = str.split('-');
      if (parts.length !== 3) return new Date();
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    const start = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    let current = new Date(start.getTime());
    let safetyCounter = 0;

    // Adjust start date for weekly/biweekly
    if ((freq === 'weekly' || freq === 'biweekly') && dayOfW !== undefined) {
      const currentDay = current.getDay(); // 0 = Sun, 1..6
      const targetJsDay = dayOfW === 7 ? 0 : dayOfW;
      let diff = targetJsDay - currentDay;
      if (diff < 0) {
        diff += 7;
      }
      current.setDate(current.getDate() + diff);
    }

    while (current <= end && safetyCounter < 1000) {
      safetyCounter++;
      
      const jsDay = current.getDay();
      
      if (freq === 'daily') {
        if (jsDay !== 0 && jsDay !== 6) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          dates.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
      } else {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        dates.push(dateStr);
        
        if (freq === 'weekly') {
          current.setDate(current.getDate() + 7);
        } else if (freq === 'biweekly') {
          current.setDate(current.getDate() + 14);
        } else if (freq === 'monthly') {
          current.setMonth(current.getMonth() + 1);
        }
      }
    }

    return dates;
  };

  // Helper inside SipPlanner to process auto-execution of a single step
  const autoExecuteSingleStep = (
    p: SipPlan,
    execDateStr: string,
    existingNewRecords: any[],
    marketDataList: MarketData[]
  ) => {
    const market = marketDataList.find(m => m.id === p.marketId);
    if (!market) return null;
    
    // Find closest price on execDateStr
    let price = 1.000;
    const historicPoint = market.chartData?.find(pt => pt.date === execDateStr);
    const etf = market.etfs.find(e => e.symbol === p.symbol || e.symbol.includes(p.symbol));
    const currentPrice = etf?.price || 1.000;

    if (historicPoint && historicPoint.close) {
      const currentIndexPrice = market.chartData && market.chartData.length > 0 
        ? (market.chartData[market.chartData.length - 1].close || 1.00) 
        : 1.00;
      price = Math.round(((historicPoint.close / currentIndexPrice) * currentPrice) * 10000) / 10000;
    } else {
      price = currentPrice;
    }
    
    // Determine score on execDateStr
    const score = (historicPoint && historicPoint.score !== undefined) ? historicPoint.score : market.dcaMarketScore;
    
    // Multiplier
    const smartMultiplier = p.isSmart ? getSmartDcaMultiplier(score).multiplier : 1.0;
    const finalAmount = p.amount * smartMultiplier;
    
    // Rate & isOTC
    const activeRate = p.rate !== undefined ? p.rate : (isOtcSymbol(p.symbol) ? 0.15 : 0.01);
    const isOTC = isOtcSymbol(p.symbol);
    
    let shares = 0;
    let fee = 0;
    
    if (isOTC) {
      fee = finalAmount * (activeRate / 100);
      const netAmount = finalAmount - fee;
      shares = Number((netAmount / price).toFixed(2));
    } else {
      shares = finalAmount / price;
      fee = finalAmount * (activeRate / 100);
    }
    
    // Calculate if today (or now) is less than settlement working days
    const todayStr = new Date().toISOString().split('T')[0];
    const elapsedWorkdays = getTradingDaysElapsed(execDateStr, todayStr, p.symbol);
    const settleDays = p.settlementDays !== undefined ? p.settlementDays : (isOTC && p.symbol.includes('016452') ? 2 : 1);
    const isPending = isOTC && (elapsedWorkdays < settleDays);
    
    const journalItem = {
      id: `${Date.now()}-${p.id}-${execDateStr}-${Math.random().toString(36).substr(2, 4)}`,
      date: execDateStr,
      type: 'BUY' as const,
      isSip: true,
      symbol: p.symbol,
      price: isPending ? 0 : price,
      shares: isPending ? 0 : shares,
      fee: fee,
      isPending: isPending ? true : undefined,
      pendingAmount: isPending ? finalAmount : undefined
    };
    
    return {
      journalItem,
      finalAmount
    };
  };

  const deletePlan = (id: string) => {
    savePlans(plans.filter(p => p.id !== id));
    showToast('🗑️ 定投计划已删除', 'info');
  };

  const handleBatchImportHistory = () => {
    if (!batchPlanId) {
      showToast('❌ 请选择需要批量补录历史的定投策略', 'error');
      return;
    }
    const plan = plans.find(p => p.id === batchPlanId);
    if (!plan) {
      showToast('❌ 选定的定投计划不存在', 'error');
      return;
    }

    if (!batchStartDate || !batchEndDate) {
      showToast('❌ 请指定历史补录的起点与终点日期', 'error');
      return;
    }

    if (batchStartDate > batchEndDate) {
      showToast('❌ 历史起点日期不能迟于终点日期', 'error');
      return;
    }

    const dates = generateHistoryDates(
      plan.frequency,
      plan.dayOfWeek,
      batchStartDate,
      batchEndDate
    );

    if (dates.length === 0) {
      showToast('⚠️ 在选定的日期区间及周期规则下，未找到可扣划的数据节点。', 'info');
      return;
    }

    // Determine actual trading days / postponed dates
    const adjustedDates: string[] = [];
    const isOTC = isOtcSymbol(plan.symbol);
    dates.forEach(dStr => {
      if (isOTC) {
        const ad = getNextTradingDay(dStr, plan.symbol);
        adjustedDates.push(ad);
      } else {
        const { closed } = checkIsMarketClosed(dStr, plan.symbol);
        if (!closed) {
          adjustedDates.push(dStr);
        }
      }
    });
    const uniqueAdjustedDates = Array.from(new Set(adjustedDates));

    if (uniqueAdjustedDates.length === 0) {
      showToast('⚠️ 在筛选与顺延交易日后，该日期区间内无有效的开市扣款交易日。', 'info');
      return;
    }

    const confirmRun = window.confirm(`⚙️ 一键补录历史对账确认：\n根据您的周期，在区间内共检索到 ${uniqueAdjustedDates.length} 期实际定投扣款扣息工作日（已自动顺延休市/剔除重复）。\n系统将自动回测历史行情并匹配当时估值多因子进行记账核算，若重复导入相同正常交易日的期数，账页将自动合并排重。是否现在执行导入？`);
    if (!confirmRun) return;

    let existingJournal: any[] = [];
    try {
      const savedJournal = localStorage.getItem('etf_trading_journal');
      existingJournal = savedJournal ? JSON.parse(savedJournal) : [];
    } catch (e) {}

    let totalImportedAmount = 0;
    let newRecords: any[] = [];
    let countImported = 0;

    const existingDates = new Set(
      existingJournal
        .filter((r: any) => r.isSip && r.symbol === plan.symbol)
        .map((r: any) => r.date)
    );

    uniqueAdjustedDates.forEach(dStr => {
      if (existingDates.has(dStr)) {
        return; // Deduplicate
      }

      const step = autoExecuteSingleStep(plan, dStr, newRecords, markets);
      if (step) {
        newRecords.push(step.journalItem);
        totalImportedAmount += step.finalAmount;
        countImported++;
      }
    });

    if (countImported === 0) {
      showToast('⚠️ 您所选周期及区间的定投数据已全部存在于记账本中，无需重复录入。', 'info');
      return;
    }

    // Update plans with the correct lastExecutedDate
    const lastDate = uniqueAdjustedDates[uniqueAdjustedDates.length - 1];
    const updatedPlans = plans.map(p => {
      if (p.id === plan.id) {
        return {
          ...p,
          totalInvested: p.totalInvested + totalImportedAmount,
          historyCount: p.historyCount + countImported,
          lastExecutedDate: lastDate > (p.lastExecutedDate || '') ? lastDate : p.lastExecutedDate
        };
      }
      return p;
    });

    savePlans(updatedPlans);

    const finalJournal = [...existingJournal, ...newRecords];
    localStorage.setItem('etf_trading_journal', JSON.stringify(finalJournal));
    window.dispatchEvent(new Event('trading_journal_updated'));

    const pendingCount = newRecords.filter(r => r.isPending).length;
    showToast(`🎉 成功一键批量导入历史定投 ${countImported} 期，本金共计 ¥${totalImportedAmount.toFixed(2)}！\n其中 ${countImported - pendingCount} 期已完成对账结算，有 ${pendingCount} 期由于属于近两日扣划（在T+2核准期内），已记为“净值待确定”状态。`, 'success');
  };

  const togglePlanStatus = (id: string) => {
    savePlans(plans.map(p => {
      if (p.id === id) {
        return { ...p, status: p.status === 'active' ? 'paused' : 'active' as const };
      }
      return p;
    }));
  };

  // Helper: Get scale config based on current dca score of a market
  const getSmartDcaMultiplier = (score: number) => {
    if (score >= 75) {
      return { 
        multiplier: multipliers.extreme, 
        tag: '极致便宜·极度低估·强力加仓', 
        color: 'text-red-400 bg-red-400/10 border-red-500/30 shadow-red-500/5',
        desc: `当前评分高(${score})，判定行业价格严重低于内在价值！触发 ${multipliers.extreme} 倍金额买入，加速布局，摊薄底层重仓成本。`
      };
    }
    if (score >= 60) {
      return { 
        multiplier: multipliers.low, 
        tag: '偏低区间·低估加码', 
        color: 'text-orange-400 bg-orange-400/10 border-orange-500/30 shadow-orange-500/5',
        desc: `当前评分偏高(${score})，属于性买入安全边际内。触发 ${multipliers.low} 倍金额，稳步追加筹码。`
      };
    }
    if (score >= 45) {
      return { 
        multiplier: multipliers.fair, 
        tag: '合理估值·按期扣款', 
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30 shadow-emerald-500/5',
        desc: `价格贴近公允价值(${score})。保持健康的基本比例投资，进行原点定投 (${multipliers.fair} 倍基准值)。`
      };
    }
    if (score >= 30) {
      return { 
        multiplier: multipliers.high, 
        tag: '偏高估值·微量防守', 
        color: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30 shadow-yellow-500/5',
        desc: `近期动能偏高或估值有微沫(${score})。防守性下调定投金额至 ${multipliers.high} 倍，收紧备用子弹。`
      };
    }
    return { 
      multiplier: multipliers.bubble, 
      tag: '泡沫沸腾·极端克制', 
      color: 'text-slate-400 bg-slate-400/10 border-slate-500/20 shadow-slate-500/5',
      desc: `市场高度拥挤并蕴含短期溢价回撤极大风险(${score})。定投缩减到最底限度 ${multipliers.bubble} 倍，最大限度防御估值顶摩擦！`
    };
  };

  const handleMultiplierChange = (key: keyof typeof multipliers, val: number) => {
    const next = { ...multipliers, [key]: Math.max(0, parseFloat(val.toFixed(2))) };
    saveMultipliers(next);
  };

  const saveMultipliers = (newMults: typeof multipliers) => {
    setMultipliers(newMults);
    localStorage.setItem('etf_sip_multipliers', JSON.stringify(newMults));
    localStorage.setItem('local_last_updated', new Date().toISOString());
    window.dispatchEvent(new Event('trading_journal_updated'));
  };

  // Restore multipliers defaults
  const resetMultipliers = () => {
    const defaults = { extreme: 2.0, low: 1.5, fair: 1.0, high: 0.7, bubble: 0.4 };
    saveMultipliers(defaults);
  };

  // Backup JSON Output
  const exportPlans = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ plans, multipliers }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `智能定投计划备份_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Backup JSON Upload Import
  const handleImportPlans = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          let listToImport: SipPlan[] = [];
          if (parsed && Array.isArray(parsed)) {
            listToImport = parsed;
          } else if (parsed && parsed.plans && Array.isArray(parsed.plans)) {
            listToImport = parsed.plans;
            if (parsed.multipliers) {
              saveMultipliers(parsed.multipliers);
            }
          }

          if (listToImport.length > 0) {
            const isValid = listToImport.every(p => p.id && p.name && p.amount !== undefined);
            if (isValid) {
              savePlans([...plans, ...listToImport]);
              showToast(`🎉 成功导入 ${listToImport.length} 个市场的定投计划！`, 'success');
            } else {
              showToast('❌ JSON 格式有误，缺少必要字段', 'error');
            }
          } else {
            showToast('❌ 未在文件中解析出合法的定投计划数组', 'error');
          }
        } catch (err) {
          showToast('❌ 解析失败，请确保导入的是合法的 JSON 备份文件', 'error');
        }
      };
    }
  };

  // One-Click Execution logs transaction in TradingJournal (State confirmed via modal overlay)
  const executePlanPurchase = (plan: SipPlan) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const { closed, reason } = checkIsMarketClosed(todayStr, plan.symbol);
    const isOTC = isOtcSymbol(plan.symbol);

    if (closed) {
      if (!isOTC) {
        showToast(`❌ 目前目标市场牌价为常规休市、非交易时间 (${reason})，无可用的场内实时对盘行情，场内ETF在此期间不可录入成交记录。`, 'error');
        return;
      }
    }

    const nextDateStr = getNextExecutionDate(plan);
    const daysLeft = getDaysUntilNextExecution(plan);
    if (daysLeft > 0) {
      const confirmEarly = window.confirm(`⚠️ 未到定投扣款时间：\n当前的下一次定投计划日在 ${nextDateStr}（距离今天还有 ${daysLeft} 天）。\n您确定要提前强行执行本期定投扣款吗？\n(这会更新最近一次执行记录并自动计划下一期时间)`);
      if (!confirmEarly) {
        return;
      }
    }

    const market = markets.find(m => m.id === plan.marketId);
    if (!market) return;
    const etf = market.etfs.find(e => e.symbol === plan.symbol || e.symbol.includes(plan.symbol));
    const price = etf?.price || 1.000;
    
    const dcaScore = market.dcaMarketScore;
    const smartMultiplier = plan.isSmart ? getSmartDcaMultiplier(dcaScore).multiplier : 1.0;
    const finalAmount = plan.amount * smartMultiplier;
    
    // Automatically match real transactional rates (honor plan's custom rate if configured)
    const activeRate = plan.rate !== undefined ? plan.rate : (isOtcSymbol(plan.symbol) ? 0.15 : 0.01);
    
    let shares = 0;
    let fee = 0;
    
    if (isOTC) {
      fee = finalAmount * (activeRate / 100);
      const netAmount = finalAmount - fee;
      shares = Number((netAmount / price).toFixed(2));
    } else {
      shares = finalAmount / price;
      fee = finalAmount * (activeRate / 100);
    }

    setExecutingPlan(plan);
    setExecutingMessage({
      etfName: etf ? etf.name : plan.symbol,
      price,
      baseAmount: plan.amount,
      multiplier: smartMultiplier,
      finalAmount,
      fee,
      shares
    });
  };

  // Real-time Synthetic Historical 24-Month Data Backtest to prove Smart DCA > Standard DCA
  const generateSipBacktestData = () => {
    const months = 24;
    const baseAmount = 1000;
    
    let regularWealth = 0;
    let regularUnits = 0;
    let regularInput = 0;

    let smartWealth = 0;
    let smartUnits = 0;
    let smartInput = 0;

    const dataList = [];

    // Simulate high-volatility 2-year market cycle
    for (let m = 1; m <= months; m++) {
      // price cycle: starts 1.0 -> down to 0.65 (high score/extreme value) -> up to 1.45 (low score/bubble) -> finishes 1.15
      const angle = (m / months) * Math.PI * 2 - (Math.PI / 1.6);
      const price = 1.05 + Math.sin(angle) * 0.40; // range [0.65, 1.45]
      
      // score inverse to price: lower price = higher score, higher price = lower score
      const pricePct = (price - 0.65) / 0.8; // normalized 0 to 1
      const score = Math.round(92 - pricePct * 75); // scores in range [17, 92]
      
      // select multiplier
      let mult = multipliers.fair;
      if (score >= 75) mult = multipliers.extreme;
      else if (score >= 60) mult = multipliers.low;
      else if (score >= 45) mult = multipliers.fair;
      else if (score >= 30) mult = multipliers.high;
      else mult = multipliers.bubble;

      // Regular DCA accumulators
      regularInput += baseAmount;
      regularUnits += baseAmount / price;
      regularWealth = regularUnits * price;

      // Smart DCA accumulators
      const actualSmartBuy = baseAmount * mult;
      smartInput += actualSmartBuy;
      smartUnits += actualSmartBuy / price;
      smartWealth = smartUnits * price;

      dataList.push({
        month: `M${m}`,
        '指数均价': parseFloat(price.toFixed(4)),
        '估值评分': score,
        '等额累计本金': Math.round(regularInput),
        '等额定投市值': Math.round(regularWealth),
        '智能累计本金': Math.round(smartInput),
        '智能定投市值': Math.round(smartWealth),
        '等额收益率(%)': parseFloat(((regularWealth - regularInput) / regularInput * 100).toFixed(1)),
        '智能收益率(%)': parseFloat(((smartWealth - smartInput) / smartInput * 100).toFixed(1))
      });
    }
    return dataList;
  };

  const simulatedCycleHistory = generateSipBacktestData();
  const simRegularReturn = simulatedCycleHistory[simulatedCycleHistory.length - 1]['等额收益率(%)'];
  const simSmartReturn = simulatedCycleHistory[simulatedCycleHistory.length - 1]['智能收益率(%)'];
  const simAlphaGain = parseFloat((simSmartReturn - simRegularReturn).toFixed(1));

  // Current testing score live configuration
  const curentTestDca = getSmartDcaMultiplier(testScore);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Overview Intro Banner */}
      <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/5 to-transparent border border-white/10 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -z-10" />
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono flex items-center gap-1">
              <Sparkles size={10} className="animate-pulse" />
              SIP / Advanced DCA
            </span>
            <span className="text-slate-500 text-xs">• 多因子双维度智能定投体系</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            智能定投周期计划中心 (Quantitative DCA Center)
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            定投（定期定额申购）是抹平价格估值高峰、利用复利奇迹的绝佳实战武器。本中心为您整合
            基于市场打分引擎的<strong>「智能定投 (Smart DCA)」量化策略</strong>
            ——在指数大跌、评分处于极佳买入区间时自动成倍「吸筹加码」，在虚胖高溢价区「极度防守」！
          </p>
        </div>
        <div className="flex flex-wrap gap-4 self-stretch md:self-auto shrink-0 bg-black/40 border border-white/5 p-4 rounded-2xl">
          <div className="text-center min-w-[100px]">
             <div className="text-[10px] text-slate-500 font-mono uppercase">激活中计划</div>
             <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
               {plans.filter(p => p.status === 'active').length}
             </div>
          </div>
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <div className="text-center min-w-[100px]">
             <div className="text-[10px] text-slate-500 font-mono uppercase">计划总本金</div>
             <div className="text-2xl font-bold font-mono text-white mt-1">
               ¥{plans.reduce((acc, p) => acc + p.totalInvested, 0).toLocaleString()}
             </div>
          </div>
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <div className="text-center min-w-[100px]">
             <div className="text-[10px] text-slate-500 font-mono uppercase">定投历史次数</div>
             <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
               {plans.reduce((acc, p) => acc + p.historyCount, 0)} 次
             </div>
          </div>
        </div>
      </div>

      {/* Backup controls & actions toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info size={14} className="text-emerald-400" />
          <span>配置数据实时保存在本地，支持随时导入与导出备份。</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportPlans} 
            accept=".json" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Upload size={12} /> 导入计划配置 
          </button>
          <button
            onClick={exportPlans}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Download size={12} /> 导出备份 JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Active Plans Card Grid */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Wallet size={16} className="text-emerald-400" />
              当前活跃的定投计划 ({plans.length})
            </h3>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              最新估值评分直接绑定扣款系数
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map(plan => {
              const market = markets.find(m => m.id === plan.marketId);
              const etf = market?.etfs.find(e => e.symbol === plan.symbol || e.symbol.includes(plan.symbol));
              const dcaScore = market ? market.dcaMarketScore : 50;
              const smartConfig = getSmartDcaMultiplier(dcaScore);
              
              const currentMultiplier = plan.isSmart ? smartConfig.multiplier : 1.0;
              const actualPaymentThisPeriod = plan.amount * currentMultiplier;

              const nextDateStr = getNextExecutionDate(plan);
              const daysLeft = getDaysUntilNextExecution(plan);
              const isAheadOfTime = daysLeft > 0;

              return (
                <div 
                  key={plan.id}
                  className={`bg-white/5 border rounded-3xl p-5 relative overflow-hidden transition-all duration-300 flex flex-col h-full ${
                    plan.status === 'paused' 
                      ? 'border-white/5 opacity-50' 
                      : 'border-white/10 hover:border-emerald-500/20 shadow-lg shadow-black/30'
                  }`}
                >
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <h4 className="font-bold text-slate-100 text-base flex flex-wrap items-center gap-1.5">
                        {plan.name}
                        {plan.isSmart && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-mono font-medium tracking-wider">
                            SMART-DCA
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        起投: {plan.startDate} | 频次: {
                          plan.frequency === 'daily' ? '每日定投' :
                          plan.frequency === 'weekly' ? `每周定投 (${['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][plan.dayOfWeek || 3]})` :
                          plan.frequency === 'biweekly' ? `每双周定投 (${['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][plan.dayOfWeek || 3]})` : '每月定投'
                        }
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => togglePlanStatus(plan.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          plan.status === 'active' 
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500'
                        }`}
                        title={plan.status === 'active' ? '暂停定投' : '启动定投'}
                      >
                        {plan.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      
                      {deletingPlanId === plan.id ? (
                        <div className="flex items-center gap-1 bg-red-950/20 border border-red-500/20 p-0.5 rounded-lg animate-in fade-in duration-200">
                          <button
                            onClick={() => {
                              deletePlan(plan.id);
                              setDeletingPlanId(null);
                            }}
                            className="text-[9px] bg-red-500 hover:bg-red-600 px-1.5 py-1 rounded-md text-slate-950 font-bold"
                          >
                            确定
                          </button>
                          <button
                            onClick={() => setDeletingPlanId(null)}
                            className="text-[9px] bg-slate-800 hover:bg-slate-700 px-1.5 py-1 rounded-md text-slate-300"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingPlanId(plan.id)}
                          className="p-1.5 rounded-lg bg-red-400/5 hover:bg-red-400/15 text-red-400 border border-red-400/10 transition-colors"
                          title="删除计划"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-3 bg-black/20 p-3.5 rounded-2xl border border-white/5 mb-4 flex-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">交易标的</span>
                      <span className="text-slate-200 font-semibold font-sans">{etf ? etf.name : plan.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">标的代码 / 类型</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {plan.symbol} ({isOtcSymbol(plan.symbol) ? '场外OTC申购' : '场内交易所买入'})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">单期基准投资额</span>
                      <span className="text-slate-100 font-mono font-bold">¥{plan.amount.toLocaleString()}</span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-white/5 space-y-1.5 text-[11px] text-slate-400">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">交易费率比</span>
                        <span className="font-mono text-slate-300">{(plan.rate !== undefined ? plan.rate : (isOtcSymbol(plan.symbol) ? 0.15 : 0.01))}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">确权时间 (结算期)</span>
                        <span className="text-slate-300">T+{plan.settlementDays !== undefined ? plan.settlementDays : (isOtcSymbol(plan.symbol) && plan.marketId === 'ndx' ? 2 : 1)} 工作日</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">单日申购最大限额</span>
                        <span className="font-mono text-slate-300">
                          {plan.purchaseLimit && plan.purchaseLimit < 1000000 
                            ? `¥${plan.purchaseLimit.toLocaleString()}` 
                            : '无硬性限制'}
                        </span>
                      </div>
                    </div>

                    {/* AI Closure checking and feasibility report per plan */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => triggerPlanAiResearch(plan)}
                        disabled={planResearchLoading[plan.id]}
                        className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${
                          planResearchLoading[plan.id]
                            ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-cyan-500/5 border-cyan-500/10 hover:bg-cyan-500/10 hover:border-cyan-500/20 text-cyan-400 active:scale-[0.98]'
                        }`}
                      >
                        <Sparkles size={11} className={planResearchLoading[plan.id] ? "animate-spin" : ""} />
                        {planResearchLoading[plan.id] ? '正在联网核对今日开市开班...' : '📅 AI 研判今日休市与定投可能完成度'}
                      </button>
                      
                      {planResearchResults[plan.id] && (
                        <div className="mt-2 bg-[#0c1524] border border-cyan-500/10 rounded-xl p-2.5 text-[10px] leading-relaxed text-slate-300 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center font-bold text-cyan-400 mb-1">
                            <span>今日交易判断:</span>
                            <span>
                              {planResearchResults[plan.id].marketClosedToday ? '🔴 闭市休休顺延' : '🟢 正常正常交易'}
                            </span>
                          </div>
                          {planResearchResults[plan.id].closureReason && (
                            <p className="text-slate-400 text-[10px] mb-1">
                              <strong>今日状态:</strong> {planResearchResults[plan.id].closureReason}
                            </p>
                          )}
                          <p className="text-slate-300 leading-normal text-[10px]">
                            <strong>限额/完成可行比:</strong> {planResearchResults[plan.id].analysis}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {plan.isSmart && (
                      <div className="pt-2.5 border-t border-white/5 space-y-2 mt-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-orange-400/80">关联市场打分 (DCA)</span>
                          <span className="font-mono text-xs font-bold text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                            {dcaScore} 分
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">多因子执行倍数</span>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${smartConfig.color}`}>
                            {currentMultiplier} 倍
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">
                          系数释义: {smartConfig.tag}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary Totals & Execution footer */}
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">累计投资本金 / 期数</div>
                        <div className="text-xs font-mono font-bold text-slate-200 mt-1">
                          ¥{plan.totalInvested.toLocaleString()} <span className="text-slate-500 font-normal">({plan.historyCount} 期)</span>
                        </div>
                      </div>
                      
                      {plan.status === 'active' ? (
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-mono">本期应投金额</div>
                          <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
                            ¥{actualPaymentThisPeriod.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic mt-1 font-mono">定投现已暂停</div>
                      )}
                    </div>

                    {plan.status === 'active' && (
                      <div className="flex justify-between items-center text-[11px] pb-2 border-b border-white/5 mb-3">
                        <span className="text-slate-500 font-medium">下次计划扣款</span>
                        <span className={`font-mono font-semibold ${isAheadOfTime ? 'text-amber-500' : 'text-emerald-400'}`}>
                          {nextDateStr} {isAheadOfTime ? `(⌛ 剩 ${daysLeft} 天)` : '(🟢 已到期)'}
                        </span>
                      </div>
                    )}

                    {plan.status === 'active' && (
                      <button
                        onClick={() => executePlanPurchase(plan)}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <CheckCircle2 size={13} /> 确认并执行本次投扣 (计入账页)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {plans.length === 0 && (
              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                <Wallet className="w-10 h-10 text-slate-600 animate-pulse" />
                <p className="text-slate-400 text-sm">暂无活跃的定投计划，请在右侧面板添加您的第一套定投策略</p>
              </div>
            )}
          </div>

          {/* NEW SECTION: Historical BIP Batch Importer */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">历史定投数据一键批量导入 (Auto-BackRecord)</h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  输入历史区间段，一键为你补齐补录期间的所有定投，并自动匹配扣款日的历史估值多因子乘数与行情净值。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">选择所涉定投策略</label>
                <select
                  value={batchPlanId}
                  onChange={e => setBatchPlanId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">-- 请选择对应策略 --</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold font-sans">定投开始日期</label>
                <input
                  type="date"
                  value={batchStartDate}
                  onChange={e => setBatchStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold font-sans">定投结束日期</label>
                <input
                  type="date"
                  value={batchEndDate}
                  onChange={e => setBatchEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* QDII T+2 Notice / Regulatory Compliance Banner */}
            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-4 text-[10px] space-y-1 text-slate-400 leading-normal">
              <p className="font-bold text-yellow-500 flex items-center gap-1">
                <Info size={11} />
                <span>支付宝场外基金 (QDII) T+2 结算核销规范：</span>
              </p>
              <p>
                1. <strong>T+2才确定净值：</strong>根据规则，QDII及场外公募在扣款日当天(T+0)其成交预测份额，但确切持仓净值将在 T+2 由系统确认并更新。
              </p>
              <p>
                2. <strong>自动化对账：</strong>批量补录时，处于 <strong>T+2 之前（即昨天或今天扣款）</strong> 的近期补录交易将自动进入 <strong>“待确定”</strong> 状态；而 <strong>T+2 及更早之前</strong> 的历史定投则自动套用历史日的实际估值并核算出持仓记入流水。这确保了账本的绝对真实性。
              </p>
            </div>

            <button
              onClick={handleBatchImportHistory}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 text-xs"
            >
              <Download size={14} /> 一键安全导入该时间段所有历史定投
            </button>
          </div>
        </div>

        {/* Right Side: Add Plan Form */}
        <div className="lg:col-span-4 h-full space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sticky top-24 space-y-6">
            <div>
              <h3 className="font-bold text-white text-base">新建长期定投计划</h3>
              <p className="text-xs text-slate-400 mt-1">配置资产跟扣款频次，支持多因子动态智能增减额</p>
            </div>

            <SipPlanForm
              name={name}
              marketId={marketId}
              symbol={symbol}
              amount={amount}
              frequency={frequency}
              planDayOfWeek={planDayOfWeek}
              isSmart={isSmart}
              startDate={startDate}
              rate={rate}
              settlementDays={settlementDays}
              purchaseLimit={purchaseLimit}
              researchLoading={researchLoading}
              researchResult={researchResult}
              markets={markets}
              onNameChange={setName}
              onMarketIdChange={setMarketId}
              onSymbolChange={setSymbol}
              onAmountChange={setAmount}
              onFrequencyChange={v => setFrequency(v)}
              onPlanDayOfWeekChange={v => setPlanDayOfWeek(v)}
              onIsSmartChange={setIsSmart}
              onStartDateChange={setStartDate}
              onRateChange={setRate}
              onSettlementDaysChange={setSettlementDays}
              onPurchaseLimitChange={setPurchaseLimit}
              onTriggerAiResearch={triggerAiResearch}
              onSubmit={handleCreatePlan}
            />
          </div>
        </div>
      </div>

      {/* NEW SECTION: Customizable Quant Multipliers Settings */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="text-emerald-400" />
              智能定投乘数参数配置 (Smart DCA Multiplier Params)
            </h3>
            <p className="text-xs text-slate-400">
              您可以个性化调节不同评分层级下的申购额倍率。例如设置极度便宜时多买 2.5 倍，虚高泡沫区间仅买 0.2 倍。
            </p>
          </div>
          <button
            onClick={resetMultipliers}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all self-start sm:self-auto shrink-0"
          >
            重置参数为系统标准
          </button>
        </div>

        {/* The Multiplier Inputs Table */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          <div className="bg-[#0f172a]/60 border border-red-500/20 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 font-sans">极致便宜区 (Score ≥ 75)</span>
                <span className="text-[10px] bg-red-400/10 text-red-300 font-bold font-mono px-1.5 rounded">多倍买入</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                估值处于极佳安全边际，提供最高的配置安全距离，适合大手笔吸货。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.1" 
                min="1.0"
                max="5.0"
                value={multipliers.extreme}
                onChange={e => handleMultiplierChange('extreme', parseFloat(e.target.value) || 1.0)}
                className="w-full bg-black/30 border border-white/10 text-white font-mono text-center text-sm rounded-xl px-2.5 py-1.5 focus:border-red-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">倍</span>
            </div>
          </div>

          <div className="bg-[#0f172a]/60 border border-orange-500/20 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 font-sans">偏低低估区 (60-74分)</span>
                <span className="text-[10px] bg-orange-400/10 text-orange-300 font-bold font-mono px-1.5 rounded">适度加码</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                价格显现合理低水位。适度调高申购比例，稳步抢跑布局。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.1" 
                min="1.0"
                max="3.0"
                value={multipliers.low}
                onChange={e => handleMultiplierChange('low', parseFloat(e.target.value) || 1.0)}
                className="w-full bg-black/30 border border-white/10 text-white font-mono text-center text-sm rounded-xl px-2.5 py-1.5 focus:border-orange-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">倍</span>
            </div>
          </div>

          <div className="bg-[#0f172a]/60 border border-slate-700 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-sans">合理公允区 (45-59分)</span>
                <span className="text-[10px] bg-emerald-400/10 text-emerald-300 font-bold font-mono px-1.5 rounded">标准扣款</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                估值无偏离，价格回归正态中轴。原比例开展常态平移定扣。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.1" 
                min="0.5"
                max="1.5"
                value={multipliers.fair}
                onChange={e => handleMultiplierChange('fair', parseFloat(e.target.value) || 1.0)}
                className="w-full bg-black/30 border border-white/10 text-white font-mono text-center text-sm rounded-xl px-2.5 py-1.5 focus:border-emerald-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">倍</span>
            </div>
          </div>

          <div className="bg-[#0f172a]/60 border border-yellow-500/20 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 font-sans">偏高高估区 (30-44分)</span>
                <span className="text-[10px] bg-yellow-400/10 text-yellow-300 font-bold font-mono px-1.5 rounded">防守收缩</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                积压获利筹码偏多或有溢价成本。少买防御，留足部分子弹防冲高。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                max="1.0"
                value={multipliers.high}
                onChange={e => handleMultiplierChange('high', parseFloat(e.target.value) || 0.7)}
                className="w-full bg-black/30 border border-white/10 text-white font-mono text-center text-sm rounded-xl px-2.5 py-1.5 focus:border-yellow-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">倍</span>
            </div>
          </div>

          <div className="bg-[#0f172a]/60 border border-slate-500/20 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 font-sans">超买泡沫区 (Score &lt; 30)</span>
                <span className="text-[10px] bg-slate-400/10 text-slate-300 font-bold font-mono px-1.5 rounded">防御限额</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                短期估值处于泡沫阶段，高概率发生盈亏逆差，保持极高警惕。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.1" 
                min="0.0"
                max="0.8"
                value={multipliers.bubble}
                onChange={e => handleMultiplierChange('bubble', parseFloat(e.target.value) || 0.4)}
                className="w-full bg-black/30 border border-white/10 text-white font-mono text-center text-sm rounded-xl px-2.5 py-1.5 focus:border-slate-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">倍</span>
            </div>
          </div>

        </div>

        {/* Dynamic score slider sandbox */}
        <div className="bg-black/20 border border-white/5 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} className="text-cyan-400" />
                智能定投虚拟执行沙盘 (Interactive Coefficient Sandbox)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">拖动滑块模拟不同的评分，直观了解智能定投逻辑的自动调配成效</p>
            </div>
            <div className="text-right shrink-0">
               <span className="text-[10px] text-slate-400 block font-mono">当前模拟评分值</span>
               <span className="text-xl font-bold text-white font-mono">{testScore}分</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            
            <div className="sm:col-span-8 flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono">0分 (极高泡沫)</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={testScore} 
                onChange={e => setTestScore(parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-xl h-2" 
              />
              <span className="text-xs text-slate-500 font-mono">100分 (绝对黄金谷)</span>
            </div>

            <div className="sm:col-span-4 p-3 bg-[#0c0f16] border border-white/5 rounded-xl text-center">
              <div className="text-[10px] text-slate-500 font-mono uppercase">¥1000 定投基准实际调整额</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                ¥{(1000 * curentTestDca.multiplier).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-sans truncate">
                 状态：<strong>{curentTestDca.tag.split('·')[0]}</strong> ({curentTestDca.multiplier}倍拉伸)
              </div>
            </div>

          </div>

          <p className="text-[11px] text-slate-400 bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/10 leading-relaxed font-sans">
             <strong>⚙️ 判定决策机制细则: </strong> {curentTestDca.desc}
          </p>
        </div>
      </div>

      {/* NEW SECTION: Synthetic Historical Backtester comparative proof */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-emerald-400" />
            实战效能演练：智能定投与传统定投累计收益率对比 (24M Backtest Proof)
          </h3>
          <p className="text-xs text-slate-400">
            通过一个全周期(24个月，包含深幅熊市下跌吸筹期，中段波折磨底，后段牛市修复上涨阶段)来进行量化横向模拟。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-4 space-y-4">
            
            <div className="p-5 bg-gradient-to-br from-[#0e211b] to-black rounded-2xl border border-emerald-500/20">
              <div className="text-[10px] text-slate-400 uppercase font-mono">24个月全周期模拟完结战报</div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">等额普通定投资产率</span>
                  <span className="text-lg font-bold text-white font-mono">{simRegularReturn > 0 ? '+' : ''}{simRegularReturn}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400/80 font-mono block">智能多因子定投资产率</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">{simSmartReturn > 0 ? '+' : ''}{simSmartReturn}%</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-slate-400">智能定投多斩获额外阿尔法(Alpha)比율</span>
                <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  +{simAlphaGain}%
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
              <h5 className="font-bold text-slate-200">🔍 为什么能大幅胜出？</h5>
              <p>
                普通定投(等额)在估值 1.4 元(泡沫)跟 0.6 元(低谷)买入完全一样多的钱(都是 1000)。
              </p>
              <p className="text-slate-300">
                而<strong>智能定投 (Smart DCA)</strong>在价格 0.6 元(评分极佳)时自动配资 2000 元，大举夺下廉价筹码；在价格 1.4 元(评分危言)时仅仅支出 400 元，成功避开头顶折溢价摩擦与高成本套牢。两相轮换，长期持平的均价远远更低，这也是复利的根本所在！
              </p>
            </div>

          </div>

          <div className="lg:col-span-8">
            <div className="w-full h-[280px] bg-black/10 rounded-2xl p-4 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart
                    data={simulatedCycleHistory}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                 >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis 
                       stroke="#475569" 
                       fontSize={11} 
                       tickLine={false} 
                       axisLine={false}
                       tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                       labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                       itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Line 
                       type="monotone" 
                       dataKey="等额收益率(%)" 
                       stroke="#3b82f6" 
                       strokeWidth={1.5}
                       dot={false}
                       name="普通等额定投收益率"
                    />
                    <Line 
                       type="monotone" 
                       dataKey="智能收益率(%)" 
                       stroke="#10b981" 
                       strokeWidth={2.5}
                       dot={false}
                       name="Smart-DCA 智能定投"
                    />
                 </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2.5 text-[10px] text-slate-500 font-mono px-4">
              <span>M1: 开始下跌</span>
              <span>M8: 周期至谷底(评分极高200%买入)</span>
              <span>M16: 估值疯涨见顶(评分超低40%防守)</span>
              <span>M24: 回归中枢</span>
            </div>
          </div>

        </div>
      </div>

      {/* DCA Projection / Compound Tool Area */}
      <SipCalculator />

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-bottom-4 duration-300 bg-slate-900/95 backdrop-blur-lg border-emerald-500/20 text-slate-200 text-xs font-semibold">
          <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-red-400' : toast.type === 'info' ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Dynamic Smart DCA Executing Confirmation Dialog Modal */}
      {executingPlan && executingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <Sparkles className="text-emerald-400 animate-pulse" size={16} />
              <h3 className="font-bold text-white text-sm">智能定投执行确认</h3>
            </div>
            
            {(() => {
               const todayStr = new Date().toISOString().split('T')[0];
               const { closed, reason } = checkIsMarketClosed(todayStr, executingPlan.symbol);
               let finalExecDate = todayStr;
               if (closed && isOtcSymbol(executingPlan.symbol)) {
                 finalExecDate = getNextTradingDay(todayStr, executingPlan.symbol);
               }
               
               return (
                 <>
                   <div className="space-y-3.5 text-xs text-slate-300">
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
                       <div className="flex justify-between">
                         <span className="text-slate-500">计划策略</span>
                         <span className="font-bold text-slate-200">{executingPlan.name}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-slate-500">资产标的</span>
                         <span className="font-semibold text-emerald-400">{executingMessage.etfName}</span>
                       </div>
                       <div className="flex justify-between font-mono">
                         <span className="text-slate-500">最新价格/净值</span>
                         <span className="text-slate-200">¥{executingMessage.price.toFixed(4)}</span>
                       </div>
                       <div className="flex justify-between font-sans">
                         <span className="text-slate-500">扣划日期</span>
                         <span className={"font-semibold " + (finalExecDate !== todayStr ? "text-amber-400 font-bold" : "text-slate-200")}>
                           {finalExecDate} {finalExecDate !== todayStr ? '(🕒 顺延休市)' : ''}
                         </span>
                       </div>
                     </div>

                     <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2 font-mono">
                       <div className="flex justify-between">
                         <span className="text-slate-400">基本单期额</span>
                         <span>¥{executingMessage.baseAmount.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-slate-400">智能调节系数</span>
                         <span className="text-cyan-400 font-bold">{executingMessage.multiplier.toFixed(1)} 倍</span>
                       </div>
                       <div className="flex justify-between pt-2 border-t border-white/5 font-sans">
                         <span className="text-slate-200 font-bold">实际扣款金额</span>
                         <span className="text-base font-bold text-emerald-400">¥{executingMessage.finalAmount.toFixed(2)}</span>
                       </div>
                     </div>

                     <div className="p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10 space-y-1 text-[10px]">
                       <div className="flex justify-between text-yellow-500/80">
                         <span>预估摩擦损耗:</span>
                         <span>¥{executingMessage.fee.toFixed(2)}</span>
                       </div>
                       {isOtcSymbol(executingPlan.symbol) ? (
                         <div className="text-yellow-400 mt-1.5 pt-1.5 border-t border-yellow-500/10 flex flex-col font-sans space-y-1 leading-relaxed">
                           <span className="font-bold text-[10px] text-yellow-300">⚠️ 场外买入 / T+2 待确认模式:</span>
                           <span>由于该标的属于场外公募基金，今日扣本金后（若今日休市顺延至下一商定扣划日 ${finalExecDate}），官方成交结算份额净值将在 T+2 公布确认。</span>
                         </div>
                       ) : (
                         <div className="flex justify-between text-slate-400">
                           <span>最终实得份额:</span>
                           <span className="font-mono text-white font-semibold">{executingMessage.shares.toFixed(2)} 份</span>
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="flex items-center gap-3">
                     <button
                       onClick={() => {
                         const plan = executingPlan;
                         const finalAmount = executingMessage.finalAmount;
                         const price = executingMessage.price;
                         const shares = executingMessage.shares;
                         const fee = executingMessage.fee;

                         const updatedPlans = plans.map(p => {
                           if (p.id === plan.id) {
                             return {
                               ...p,
                               totalInvested: p.totalInvested + finalAmount,
                               historyCount: p.historyCount + 1,
                               lastExecutedDate: finalExecDate
                             };
                           }
                           return p;
                         });
                         savePlans(updatedPlans);

                         const isOTC = isOtcSymbol(plan.symbol);
                         const journalItem = {
                           id: Date.now().toString(),
                           date: finalExecDate,
                           type: 'BUY' as const,
                           isSip: true,
                           symbol: plan.symbol,
                           price: price,
                           shares: shares,
                           fee: fee,
                           isPending: isOTC ? true : undefined,
                           pendingAmount: isOTC ? finalAmount : undefined,
                           navStatus: isOTC ? 'temp' : 'updated'
                         };

                         try {
                           const savedJournal = localStorage.getItem('etf_trading_journal');
                           const journal = savedJournal ? JSON.parse(savedJournal) : [];
                           journal.push(journalItem);
                           localStorage.setItem('etf_trading_journal', JSON.stringify(journal));
                         } catch (err) {}

                         window.dispatchEvent(new Event('trading_journal_updated'));

                         setExecutingPlan(null);
                         setExecutingMessage(null);
                         if (isOTC) {
                           showToast('⏳ 已完成扣划！因场外基金T+2确认，已自动顺延至下一交易日' + finalExecDate + '起扣，并记为“净值待确定”状态。', 'success');
                         } else {
                           showToast('🎉 扣款 ¥' + finalAmount.toFixed(2) + ' 已记入流水并完成吸纳！', 'success');
                         }
                       }}
                       className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
                     >
                       确认执行
                     </button>
                     <button
                       onClick={() => {
                         setExecutingPlan(null);
                         setExecutingMessage(null);
                       }}
                       className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-all text-xs"
                     >
                       取消
                     </button>
                   </div>
                 </>
               );
             })()}
          </div>
        </div>
      )}

    </div>
  );
}
