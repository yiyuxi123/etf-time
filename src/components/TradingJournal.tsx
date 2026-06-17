import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Target, ArrowDownRight, ArrowUpRight, Download, Upload, ShieldAlert, Check, X, Search, Settings, Pencil, Sparkles, Cpu } from 'lucide-react';
import { MarketData, EtfInfo, TradeRecord, GroupMode } from '../types';
import { checkIsMarketClosed, getNextTradingDay, getTradingDaysElapsed } from '../lib/calendar';
import { findEtfBySymbol as findEtfBySymbolShared, isOtcSymbol as isOtcSymbolShared } from '../utils/fund-helpers';
import TradeStats from './journal/TradeStats';
import NavSyncStatus from './journal/NavSyncStatus';
import TradeFilters from './journal/TradeFilters';
import PortfolioChart from './journal/PortfolioChart';
import TradeList from './journal/TradeList';
import TradeGroupCard from './journal/TradeGroupCard';
import { TradeFormConfirm, TradeFormEdit, TradeFormAdd } from './journal/TradeForm';
import AiParsePanel from './journal/AiParsePanel';

// Module-level sync guard for OTC NAV backfill — replaces the fragile window.__isSyncingOtcNavs flag.
// Scope is the page (not window global), resets cleanly on reload, and won't leak across tabs.
let otcSyncBusy = false;

interface TradingJournalProps {
  markets: MarketData[];
  onManageStocks?: () => void;
}

export default function TradingJournal({ markets, onManageStocks }: TradingJournalProps) {
  const [records, setRecords] = useState<TradeRecord[]>([]);

  // 薄包装：复用 fund-helpers 的共享实现，markets 作为闭包注入，调用点无需改动。
  const findEtfBySymbol = (sym: string) => findEtfBySymbolShared(sym, markets);
  const isOtcSymbol = (sym: string): boolean => isOtcSymbolShared(sym, markets);

  // 全部 markets 的 ETF 扁平列表，供下拉/检索使用。
  const allEtfs = markets.flatMap(m => m.etfs || []);

  const [selectedMarketId, setSelectedMarketId] = useState<string>('ALL');
  const [symbol, setSymbol] = useState('513100');
  const [type, setType] = useState<'BUY' | 'SELL' | 'SIP'>('BUY');
  const [tradeMode, setTradeMode] = useState<'ETF' | 'OTC'>('ETF');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [feeRate, setFeeRate] = useState('0.01'); // 默认万一 %
  const [customFee, setCustomFee] = useState(''); // 精确实际手续费数额 (元)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Inline styling Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Safety confirmation states
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<TradeRecord | null>(null);

  const [isPending, setIsPending] = useState(false);
  const [confirmingPendingRecord, setConfirmingPendingRecord] = useState<TradeRecord | null>(null);
  const [pendingConfirmPrice, setPendingConfirmPrice] = useState('');
  const [navSyncLogs, setNavSyncLogs] = useState<{ id: string; message: string; type: 'syncing' | 'success' | 'error' }[]>([]);

  // Points analysis state
  const [pointAnalysisData, setPointAnalysisData] = useState<any>(null);
  const [isAnalyzingPoints, setIsAnalyzingPoints] = useState(false);

  // Symbol cross check validation state
  const [verifyingSymbol, setVerifyingSymbol] = useState(false);
  const [symbolCheckResult, setSymbolCheckResult] = useState<any>(null);
  const [showSymbolAlarm, setShowSymbolAlarm] = useState(false);

  // Error correction feedback loop states
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionSymbol, setCorrectionSymbol] = useState('');
  const [correctionDate, setCorrectionDate] = useState('');
  const [correctionOriginalNav, setCorrectionOriginalNav] = useState('');
  const [correctionNewNav, setCorrectionNewNav] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionRecordId, setCorrectionRecordId] = useState<string | null>(null);

  // Filter states
  const [filterSymbol, setFilterSymbol] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'SIP' | 'PENDING'>('ALL');
  const [sortBy, setSortBy] = useState<'time-desc' | 'time-asc' | 'symbol' | 'type'>('time-desc');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [groupMode, setGroupMode] = useState<GroupMode>('category');
  const [activeChartSymbol, setActiveChartSymbol] = useState<string>('');

  // Edit form states
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<'BUY' | 'SELL'>('BUY');
  const [editIsSip, setEditIsSip] = useState(false);
  const [editSymbol, setEditSymbol] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editShares, setEditShares] = useState('');
  const [editFee, setEditFee] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editFeeRate, setEditFeeRate] = useState('0.15');
  const [isEditSyncingNav, setIsEditSyncingNav] = useState(false);

  // AI interactive parsing states
  const [aiTextInput, setAiTextInput] = useState('');
  const [aiImgData, setAiImgData] = useState<string | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndSetImage(file);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      readAndSetImage(file);
    }
  };

  const readAndSetImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ 智能识单格式错误：只能上传图片格式的文件', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAiImgData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Clipboard Paste listener – Allows pasting screenshots from standard OS buffers (Win+Shift+S / Cmd+Shift+4) directly!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          readAndSetImage(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleAiParseSubmit = async () => {
    try {
      setIsAiParsing(true);
      
      const provider = localStorage.getItem('ai_default_provider') || 'gemini';
      const deepseekKey = localStorage.getItem('deepseek_api_key') || '';
      const qwenKey = localStorage.getItem('qwen_api_key') || '';

      // Context of user customized watch lists for accurate mapping
      const portfolioContext = markets.flatMap((m: any) => 
        (m.etfs || m.etfSymbols || []).map((e: any) => ({
          symbol: e.symbol,
          name: e.name
        }))
      );

      const response = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          deepseekKey,
          qwenKey,
          text: aiTextInput,
          image: aiImgData,
          portfolioContext
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      if (!resData.success || !resData.parsed) {
        throw new Error('AI parsing failed. Please verify API configurations.');
      }

      const { type: parsedType, symbol: parsedSymbol, price: parsedPrice, shares: parsedShares, fee: parsedFee, date: parsedDate } = resData.parsed;

      // Fill values
      if (parsedType === 'BUY' || parsedType === 'SELL') {
        setType(parsedType);
      } else if (parsedType === 'SIP') {
        setType('SIP');
      }

      let mappedSymbol = parsedSymbol || '';
      if (mappedSymbol) {
        // Look up by our robust matcher to align with actual portfolio symbol (e.g. including dynamic prefixes)
        const matchedEtf = findEtfBySymbol(mappedSymbol);
        if (matchedEtf) {
          mappedSymbol = matchedEtf.symbol;
        }
        handleSymbolChange(mappedSymbol);
      }
      if (parsedPrice) {
        setPrice(parsedPrice.toString());
      }
      if (parsedShares) {
        setShares(parsedShares.toString());
      }
      if (parsedFee !== undefined) {
        setCustomFee(parsedFee.toString());
      }
      if (parsedDate) {
        setDate(parsedDate);
      }

      // Notify user
      showToast('🎉 AI 提炼成交细节成功！已为您自动填入下表，请核对后再点击 [保存当前交易记录] 归档！', 'success');

    } catch (err: any) {
      console.error('AI Processing error:', err);
      showToast(err.message || 'AI 识单异常，请核对大语言模型 API 密钥配置。', 'error');
    } finally {
      setIsAiParsing(false);
    }
  };

  useEffect(() => {
    if (editingRecord) {
      setEditDate(editingRecord.date);
      setEditType(editingRecord.type);
      setEditIsSip(!!editingRecord.isSip);
      setEditSymbol(editingRecord.symbol);
      setEditPrice(editingRecord.price.toString());
      setEditShares(editingRecord.shares.toString());
      setEditFee(editingRecord.fee.toString());
      
      const isOtc = isOtcSymbol(editingRecord.symbol);
      const feeRateVal = isOtc ? '0.15' : '0.01';
      setEditFeeRate(feeRateVal);

      // Estimate initial amount
      const amt = editingRecord.pendingAmount || (editingRecord.shares * editingRecord.price + editingRecord.fee);
      setEditAmount(amt.toFixed(2));
    }
  }, [editingRecord]);

  // Recalculating inside editing record modal
  const handleEditRecalculate = (
    amtStr: string,
    rateStr: string,
    priceStr: string,
    customFeeStr?: string,
    symStr?: string
  ) => {
    const amt = parseFloat(amtStr);
    const rate = parseFloat(rateStr) || 0;
    const p = parseFloat(priceStr);
    const targetSym = symStr || editSymbol;
    const isOtc = isOtcSymbol(targetSym);

    if (isNaN(amt) || amt <= 0) {
      return;
    }

    let calculatedFee = 0;
    if (customFeeStr !== undefined && customFeeStr.trim() !== '') {
      calculatedFee = parseFloat(customFeeStr) || 0;
    } else {
      calculatedFee = Number((amt * (rate / 100)).toFixed(isOtc ? 2 : 4));
    }

    if (customFeeStr === undefined) {
      setEditFee(calculatedFee.toString());
    }

    if (!isNaN(p) && p > 0) {
      const netAmount = amt - calculatedFee;
      const s = netAmount / p;
      setEditShares(isNaN(s) ? '' : s.toFixed(isOtc ? 2 : 4));
    }
  };

  const handleEditQueryNav = async () => {
    if (!editSymbol || !editDate) {
      showToast('❌ 请先填写交易代码和日期后再查询净值', 'error');
      return;
    }
    setIsEditSyncingNav(true);
    try {
      const { deductionDate } = getOtcDates(editDate, editSymbol);
      const res = await fetch('/api/query-fund-nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: editSymbol, date: deductionDate })
      });
      const data = await res.json();
      if (data && data.success && data.isPublished && typeof data.nav === 'number' && data.nav > 0) {
        setEditPrice(data.nav.toString());
        handleEditRecalculate(editAmount, editFeeRate, data.nav.toString(), editFee);
        showToast(`✅ [对账历史成功] 成功查询到扣款结算日 ${deductionDate} 官方发布净值为 ${data.nav}`, 'success');
      } else {
        showToast(`⏳ [暂无历史净值] 官方暂未公布 ${deductionDate} 的净值估价。`, 'info');
      }
    } catch (err: any) {
      console.error(err);
      showToast('❌ 联网检索超时，请稍后重试', 'error');
    } finally {
      setIsEditSyncingNav(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    const p = parseFloat(editPrice);
    const s = parseFloat(editShares);
    const f = parseFloat(editFee);
    if (isNaN(p) || isNaN(s) || isNaN(f)) {
      showToast('请输入有效的成交价、份额、服务费用', 'error');
      return;
    }

    let finalEditDate = editDate;
    const { closed, reason } = checkIsMarketClosed(finalEditDate, editSymbol);
    if (closed) {
      if (!isOtcSymbol(editSymbol)) {
        showToast(`❌ 非交易日/常规休市日无法保存场内交易登记。原因: ${reason}`, 'error');
        return;
      } else {
        const nextDay = getNextTradingDay(finalEditDate, editSymbol);
        showToast(`⚠️ 编辑修改的归档时间为非交易日 (${reason})。场外交易将顺延至下一交易日 [${nextDay}] 扣款记账。`, 'info');
        finalEditDate = nextDay;
      }
    }

    const updatedRecords = records.map(r => {
      if (r.id === editingRecord.id) {
        const isConfirmed = p > 0 && s > 0;
        return {
          ...r,
          date: finalEditDate,
          type: editType,
          isSip: editIsSip,
          symbol: editSymbol,
          price: p,
          shares: s,
          fee: f,
          isPending: isConfirmed ? false : r.isPending,
          pendingAmount: editAmount ? parseFloat(editAmount) : undefined
        };
      }
      return r;
    });
    saveRecords(updatedRecords);
    setEditingRecord(null);
    showToast('🎉 交易记录修改成功！', 'success');
  };

  useEffect(() => {
    if (confirmingPendingRecord) {
      const matched = findEtfBySymbol(confirmingPendingRecord.symbol);
      if (matched && matched.price) {
        setPendingConfirmPrice(matched.price.toString());
      } else {
        setPendingConfirmPrice('');
      }
    }
  }, [confirmingPendingRecord]);

  const handleConfirmPendingRecord = () => {
    if (!confirmingPendingRecord) return;
    if (!pendingConfirmPrice) {
      showToast('请输入最终确定的成交单价/单位净值', 'error');
      return;
    }
    const priceVal = parseFloat(pendingConfirmPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      showToast('请输入有效的成交均价', 'error');
      return;
    }

    const isOtc = isOtcSymbol(confirmingPendingRecord.symbol);
    const netBuyAmount = (confirmingPendingRecord.pendingAmount || 0) - confirmingPendingRecord.fee;
    const computedShares = Number((netBuyAmount / priceVal).toFixed(isOtc ? 2 : 4));

    const updatedRecords = records.map(r => {
      if (r.id === confirmingPendingRecord.id) {
        return {
          ...r,
          price: priceVal,
          shares: computedShares,
          isPending: false,
          hasConflict: false,
          isVerified: true,
          navStatus: 'updated'
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setConfirmingPendingRecord(null);
    setPendingConfirmPrice('');
    showToast('🎉 该笔申购已成功核销净值，正式记入持仓！', 'success');
  };

  useEffect(() => {
    const saved = localStorage.getItem('etf_trading_journal');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Background self-correction and auto-update of OTC net asset values
  useEffect(() => {
    const runOtcSync = async () => {
      if (otcSyncBusy) return;

      const pendingOtcRecords = records.filter(r => {
        const isOTC = isOtcSymbol(r.symbol);
        if (!isOTC) return false;
        return r.isPending || r.navStatus === 'temp' || r.navStatus === 'not_updated' || !r.navStatus;
      });

      if (pendingOtcRecords.length === 0) return;

      otcSyncBusy = true;
      try {
      for (const record of pendingOtcRecords) {
        const currentSaved = localStorage.getItem('etf_trading_journal');
        if (!currentSaved) continue;
        const currentRecords = JSON.parse(currentSaved);
        const recordInStorage = currentRecords.find((r: any) => r.id === record.id);
        if (!recordInStorage) continue;

        if (recordInStorage.navStatus === 'updated' && !recordInStorage.isPending) continue;

        const { deductionDate, confirmDate } = getOtcDates(record.date, record.symbol);
        const todayStr = new Date().toISOString().split('T')[0];

        if (todayStr < confirmDate) {
          // Confirm date has not been reached yet! Do NOT query yet, leave it pending
          continue;
        }

        try {
          setNavSyncLogs(prev => [...prev, { id: record.id, message: `正在联网核销 ${record.symbol} 扣款日 [${deductionDate}] 官方确权净值...`, type: 'syncing' }]);

          const res = await fetch('/api/query-fund-nav', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: record.symbol, date: deductionDate })
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          if (data && data.success && data.isPublished && typeof data.nav === 'number' && data.nav > 0) {
            const finalNav = data.nav;

            const freshSaved = localStorage.getItem('etf_trading_journal');
            if (freshSaved) {
              const freshRecords = JSON.parse(freshSaved);
              const updated = freshRecords.map((r: any) => {
                if (r.id === record.id) {
                  const isOtcStr = isOtcSymbol(r.symbol);
                  const shares = r.type === 'BUY'
                    ? Number((((r.pendingAmount || r.price * r.shares || 0) - r.fee) / finalNav).toFixed(isOtcStr ? 2 : 4))
                    : r.shares;
                  return {
                    ...r,
                    price: finalNav,
                    shares: shares,
                    isPending: false,
                    hasConflict: data.hasConflict || false,
                    conflictDetails: data.conflictDetails || null,
                    isVerified: data.isVerified ?? true,
                    navSources: data.source || null,
                    navStatus: 'updated' as const
                  };
                }
                return r;
              });

              localStorage.setItem('etf_trading_journal', JSON.stringify(updated));
              setRecords(updated);
              window.dispatchEvent(new Event('trading_journal_updated'));
              showToast(`✅ [智能核实已更新] ${record.symbol} 扣款日 ${deductionDate} 净值纠错更新为 ${finalNav}并校准份额！`, 'success');
              setNavSyncLogs(prev => [...prev.filter(l => l.id !== record.id), { id: record.id, message: `🎉 成功纠错已更新: ${record.symbol} ${deductionDate} -> ${finalNav}`, type: 'success' }]);
            }
          } else {
            const isConfirmationPassed = todayStr >= confirmDate;
            const targetStatus = isConfirmationPassed ? 'not_updated' : 'temp';

            const freshSaved = localStorage.getItem('etf_trading_journal');
            if (freshSaved) {
              const freshRecords = JSON.parse(freshSaved);
              const updated = freshRecords.map((r: any) => {
                if (r.id === record.id) {
                  return {
                    ...r,
                    navStatus: targetStatus as any
                  };
                }
                return r;
              });

              localStorage.setItem('etf_trading_journal', JSON.stringify(updated));
              setRecords(updated);
              window.dispatchEvent(new Event('trading_journal_updated'));

              if (targetStatus === 'not_updated') {
                setNavSyncLogs(prev => [...prev.filter(l => l.id !== record.id), { id: record.id, message: `⏳ ${record.symbol} 已到确权日 (${confirmDate}) 但官方未公布该日净值 (暂未更新)`, type: 'error' }]);
              } else {
                setNavSyncLogs(prev => [...prev.filter(l => l.id !== record.id), { id: record.id, message: `⏱ ${record.symbol} 尚未到确权日 (${confirmDate})，当前使用最新收市价估算`, type: 'error' }]);
              }
            }
          }
        } catch (e: any) {
          console.error("Auto Sync OTC NAV failed:", e.message);
          setNavSyncLogs(prev => [...prev.filter(l => l.id !== record.id), { id: record.id, message: `⚠️ 联网对账服务忙: ${e.message}`, type: 'error' }]);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      } finally {
        otcSyncBusy = false;
      }
    };

    if (records.length > 0) {
      runOtcSync();
    }
  }, [records.length]);

  // Sync to local journal changes from SipPlanner or this page
  useEffect(() => {
    const handleJournalUpdate = () => {
      const saved = localStorage.getItem('etf_trading_journal');
      if (saved) {
        try {
          setRecords(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener('trading_journal_updated', handleJournalUpdate);
    return () => window.removeEventListener('trading_journal_updated', handleJournalUpdate);
  }, []);

  // 1. Fetch points analysis
  const fetchPointsAnalysis = async (customRecordsList = records) => {
    if (!customRecordsList || customRecordsList.length === 0) return;
    setIsAnalyzingPoints(true);
    try {
      const res = await fetch('/api/analyze-trade-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: customRecordsList })
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setPointAnalysisData(data);
        }
      }
    } catch (e) {
      console.error("Failed to analyze points:", e);
    } finally {
      setIsAnalyzingPoints(false);
    }
  };

  useEffect(() => {
    if (records.length > 0) {
      fetchPointsAnalysis(records);
    }
  }, [records.length]);

  // 2. Clear symbol cache / verify symbol before trade record insertion
  const verifySymbolCode = async (code: string) => {
    if (!code || code.trim() === '') return;
    setVerifyingSymbol(true);
    setSymbolCheckResult(null);
    try {
      const res = await fetch('/api/verify-symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: code })
      });
      if (res.ok) {
        const data = await res.json();
        setSymbolCheckResult(data);
        if (data.hasConflict) {
          setShowSymbolAlarm(true);
          showToast('⚠️ 标的代码多源核验发现显著不匹配冲突！请进行人工选择。', 'error');
        } else {
          showToast(`✅ [安全检验通过] 代码 ${code} 交叉核实为: ${data.name || '未知资产'} (${data.assetType || 'ETF'})`, 'success');
        }
      }
    } catch (e) {
      console.error("Symbol validation link failure:", e);
    } finally {
      setVerifyingSymbol(false);
    }
  };

  // 3. User Correction Feedback Submission
  const submitCorrectionReport = async () => {
    const navVal = parseFloat(correctionNewNav);
    if (isNaN(navVal) || navVal <= 0) {
      showToast('请输入有效的修正后的单位净值（数字）', 'error');
      return;
    }
    
    setIsSubmittingCorrection(true);
    try {
      const res = await fetch('/api/report-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: correctionSymbol,
          date: correctionDate,
          originalNav: parseFloat(correctionOriginalNav) || null,
          userCorrectedNav: navVal
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || '🎉 纠正已成功采纳并安全自愈更新！', 'success');
        
        // Update local state record price and recalculate shares!
        if (correctionRecordId) {
          const freshRecords = records.map(r => {
            if (r.id === correctionRecordId) {
              const isOtcStr = isOtcSymbol(r.symbol);
              const computedS = r.type === 'BUY'
                ? Number((((r.pendingAmount || r.price * r.shares || 0) - r.fee) / navVal).toFixed(isOtcStr ? 2 : 4))
                : r.shares;
              return {
                ...r,
                price: navVal,
                shares: computedS,
                isPending: false,
                hasConflict: false,
                isVerified: true,
                navStatus: 'updated' as const
              };
            }
            return r;
          });
          saveRecords(freshRecords);
        }

        setShowCorrectionModal(false);
        setCorrectionSymbol('');
        setCorrectionDate('');
        setCorrectionOriginalNav('');
        setCorrectionNewNav('');
        setCorrectionRecordId(null);
      } else {
        alert(`❌ 【安全核查警告】:\n${data.error || '手动修正已被安全防护网阻拦，请检查拼写及正确资产。'}\n\n诊断日志:\n${data.auditDetail || '未提供'}`);
      }
    } catch (err: any) {
      showToast('网络交互出错，请重试', 'error');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Helper to calculate actual Deduction Date and T+2 Confirmation Date for OTC funds
  function getOtcDates(dateStr: string, symbol: string): { deductionDate: string; confirmDate: string; isPostponed: boolean } {
    const isClosed = checkIsMarketClosed(dateStr, symbol).closed;
    const deductionDate = getNextTradingDay(dateStr, symbol);
    
    // T+2 open days after deductionDate
    let current = deductionDate;
    let count = 0;
    let safety = 0;
    while (count < 2 && safety < 100) {
      const parts = current.split('-');
      if (parts.length !== 3) break;
      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dateObj.setDate(dateObj.getDate() + 1);
      
      const yStr = dateObj.getFullYear();
      const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dStr = String(dateObj.getDate()).padStart(2, '0');
      current = `${yStr}-${mStr}-${dStr}`;
      
      const { closed } = checkIsMarketClosed(current, symbol);
      if (!closed) {
        count++;
      }
      safety++;
    }
    
    return {
      deductionDate,
      confirmDate: current,
      isPostponed: isClosed
    };
  }

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveRecords = (newRecords: TradeRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('etf_trading_journal', JSON.stringify(newRecords));
    localStorage.setItem('local_last_updated', new Date().toISOString());
    window.dispatchEvent(new Event('trading_journal_updated'));
  };

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
    const isOTC = isOtcSymbol(newSymbol);
    setTradeMode(isOTC ? 'OTC' : 'ETF');
    setFeeRate(isOTC ? '0.15' : '0.01'); // 场内场外默认费率
    setIsPending(isOTC);
    
    // Auto lookup real-time price as a default
    const matched = findEtfBySymbol(newSymbol);
    if (matched && matched.price) {
      setPrice(matched.price.toString());
    } else {
      setPrice('');
    }
    setShares('');
    setTotalAmount('');
  };

  const recalculateFromAmount = (amtVal: string) => {
    setTotalAmount(amtVal);
    const amt = parseFloat(amtVal);
    if (isNaN(amt) || amt <= 0) {
      setShares('');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;

    const rate = parseFloat(feeRate) || 0;
    const exactFeeVal = customFee.trim() !== '' ? parseFloat(customFee) : null;
    const isOtc = isOtcSymbol(symbol);

    let netAmount = 0;
    if (exactFeeVal !== null) {
      netAmount = amt - exactFeeVal;
    } else {
      netAmount = amt - amt * (rate / 100);
    }
    const s = netAmount / p;
    setShares(isNaN(s) ? '' : s.toFixed(isOtc ? 2 : 4));
  };

  const recalculateFromShares = (sharesVal: string) => {
    setShares(sharesVal);
    const s = parseFloat(sharesVal);
    if (isNaN(s) || s <= 0) {
      setTotalAmount('');
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;

    const rate = parseFloat(feeRate) || 0;
    const exactFeeVal = customFee.trim() !== '' ? parseFloat(customFee) : null;

    const netAmount = s * p;
    let amt = 0;
    if (exactFeeVal !== null) {
      amt = netAmount + exactFeeVal;
    } else {
      amt = netAmount / (1 - rate / 100);
    }
    setTotalAmount(isNaN(amt) ? '' : amt.toFixed(2));
  };

  const handlePriceChangeHelper = (pVal: string) => {
    setPrice(pVal);
    const p = parseFloat(pVal);
    if (isNaN(p) || p <= 0) return;

    const rate = parseFloat(feeRate) || 0;
    const exactFeeVal = customFee.trim() !== '' ? parseFloat(customFee) : null;
    const isOtc = isOtcSymbol(symbol);

    // If totalAmount was provided, let's recal shares from it
    if (totalAmount) {
      const amt = parseFloat(totalAmount);
      if (!isNaN(amt) && amt > 0) {
        let netAmount = 0;
        if (exactFeeVal !== null) {
          netAmount = amt - exactFeeVal;
        } else {
          netAmount = amt - amt * (rate / 100);
        }
        const s = netAmount / p;
        setShares(isNaN(s) ? '' : s.toFixed(isOtc ? 2 : 4));
        return;
      }
    }

    // Otherwise, if shares is provided, let's recal amount from shares
    if (shares) {
      const s = parseFloat(shares);
      if (!isNaN(s) && s > 0) {
        const netAmount = s * p;
        let amt = 0;
        if (exactFeeVal !== null) {
          amt = netAmount + exactFeeVal;
        } else {
          amt = netAmount / (1 - rate / 100);
        }
        setTotalAmount(isNaN(amt) ? '' : amt.toFixed(2));
      }
    }
  };

  const recalculateWithNewFees = (newRateStr: string, newCustomFeeStr: string) => {
    const rate = newRateStr !== undefined ? (parseFloat(newRateStr) || 0) : (parseFloat(feeRate) || 0);
    const exactFeeVal = newCustomFeeStr !== undefined 
      ? (newCustomFeeStr.trim() !== '' ? parseFloat(newCustomFeeStr) : null)
      : (customFee.trim() !== '' ? parseFloat(customFee) : null);
      
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;
    const isOtc = isOtcSymbol(symbol);

    if (totalAmount) {
      const amt = parseFloat(totalAmount);
      if (!isNaN(amt) && amt > 0) {
        let netAmount = 0;
        if (exactFeeVal !== null) {
          netAmount = amt - exactFeeVal;
        } else {
          netAmount = amt - amt * (rate / 100);
        }
        const s = netAmount / p;
        setShares(isNaN(s) ? '' : s.toFixed(isOtc ? 2 : 4));
        return;
      }
    }

    if (shares) {
      const s = parseFloat(shares);
      if (!isNaN(s) && s > 0) {
        const netAmount = s * p;
        let amt = 0;
        if (exactFeeVal !== null) {
          amt = netAmount + exactFeeVal;
        } else {
          amt = netAmount / (1 - rate / 100);
        }
        setTotalAmount(isNaN(amt) ? '' : amt.toFixed(2));
      }
    }
  };

  const addRecord = (e: React.FormEvent) => {
    e.preventDefault();
    
    let isSip = type === 'SIP';
    let realType: 'BUY' | 'SELL' = (type === 'SELL') ? 'SELL' : 'BUY';

    let finalDate = date || new Date().toISOString().split('T')[0];
    const { closed, reason } = checkIsMarketClosed(finalDate, symbol);
    
    if (closed) {
      if (tradeMode === 'ETF') {
        showToast(`❌ 非交易日/常规休市日无法成交场内交易。原因: ${reason}`, 'error');
        return;
      } else {
        const nextDay = getNextTradingDay(finalDate, symbol);
        showToast(`⚠️ 您选择的归档时间为非交易休市日 (${reason})。根据规则，“休市日购买的场外etf将等到开市日扣款执行”。已为您自动延顺至下一交易开市日 [${nextDay}] 扣划。`, 'info');
        finalDate = nextDay;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const elapsedWorkdays = getTradingDaysElapsed(finalDate, todayStr, symbol);
    const isUnderSettlePeriod = elapsedWorkdays < 2; // T+2 settlement rule
    
    const recordIsPending = (isPending || (isUnderSettlePeriod && realType === 'BUY')) && tradeMode === 'OTC';

    let p = 0;
    if (recordIsPending) {
      const matched = findEtfBySymbol(symbol);
      p = price ? parseFloat(price) : (matched?.price || 1.0);
    } else {
      if (!price) {
        showToast('请输入成交价格/净值', 'error');
        return;
      }
      p = parseFloat(price);
    }
    
    let s = 0;
    let fee = 0;
    const rate = parseFloat(feeRate) || 0;
    const exactFeeVal = customFee.trim() !== '' ? parseFloat(customFee) : null;
    
    const isOtc = isOtcSymbol(symbol);
    if (tradeMode === 'OTC') {
       if (realType === 'BUY') {
         if (!totalAmount) {
           showToast('申购总额不能为空', 'error');
           return;
         }
         const amt = parseFloat(totalAmount);
         let netAmount = 0;
         if (exactFeeVal !== null) {
           fee = exactFeeVal;
           netAmount = amt - fee;
         } else {
           fee = amt * (rate / 100);
           netAmount = amt - fee; 
         }
         
         s = isOtc ? Number((netAmount / p).toFixed(2)) : netAmount / p;
       } else {
         if (!shares) {
            showToast('确认份额不能为空', 'error');
            return;
         }
         s = parseFloat(shares);
         const amtRaw = s * p;
         if (exactFeeVal !== null) {
           fee = exactFeeVal;
         } else {
           fee = amtRaw * (rate / 100);
         }
       }
    } else {
       if (!shares) {
         showToast('成交份额不能为空', 'error');
         return;
       }
       s = parseFloat(shares);
       const amtRaw = s * p;
       if (exactFeeVal !== null) {
         fee = exactFeeVal;
       } else {
         fee = amtRaw * (rate / 100);
       }
    }

    const newRecord: TradeRecord = {
      id: Date.now().toString(),
      date: finalDate,
      type: realType,
      isSip,
      symbol,
      price: p,
      shares: s,
      fee,
      isPending: recordIsPending ? true : undefined,
      pendingAmount: recordIsPending ? parseFloat(totalAmount) : undefined,
      navStatus: recordIsPending ? 'temp' : 'updated'
    };
    
    saveRecords([...records, newRecord]);
    setPrice('');
    setShares('');
    setTotalAmount('');
    setCustomFee(''); // 清空精确手续费
    setIsPending(false);
    showToast(recordIsPending ? '⏳ 扣款交易已记入流水 (智能纠错对账引擎已在后台启动)' : '🎉 交易记入账成功！', 'success');
  };

  const removeRecord = (id: string) => {
    saveRecords(records.filter(r => r.id !== id));
  };

  const clearRecords = () => {
    saveRecords([]);
  };

  const handleExport = () => {
    if (records.length === 0) {
      showToast('当前没有历史记录可供导出', 'info');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "trading_journal.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('📥 数据已成功导出为 JSON 文件', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
       const reader = new FileReader();
       reader.onload = (event) => {
         try {
           const imported = JSON.parse(event.target?.result as string);
           if (Array.isArray(imported)) {
             const newMapped = imported.filter(i => !records.some(r => r.id === i.id));
             saveRecords([...records, ...newMapped]);
             showToast("🎉 交易流水导入完成！", "success");
           } else {
             showToast("❌ 导入格式不正确，不是合法的交易记录数组", "error");
           }
         } catch {
           showToast("❌ 读取 JSON 文件失败，请检查文件内容", "error");
         }
       };
       reader.readAsText(e.target.files[0]);
    }
  };

  // Get active ETFs based on chosen mother market
  const activeEtfsRefList = selectedMarketId === 'ALL' 
    ? allEtfs 
    : (markets.find(m => m.id === selectedMarketId)?.etfs || []);

  // Clean duplication of listings
  const getUniqueEtfRefs = () => {
    const seen = new Set<string>();
    const uniques: EtfInfo[] = [];
    activeEtfsRefList.forEach(e => {
      if (!seen.has(e.symbol)) {
        seen.add(e.symbol);
        uniques.push(e);
      }
    });
    return uniques;
  };
  const uniqueEtfsToShow = getUniqueEtfRefs();

  // Sort chronologically and build holdings positions
  let totalFees = 0;
  let realizedPnL = 0;
  let realizedFees = 0;
  
  const positions: Record<string, { shares: number, cost: number, heldBuyFees: number }> = {};
  const chronological = [...records].sort((a, b) => a.id.localeCompare(b.id));

  let exactWins = 0;
  let exactLosses = 0;
  let sellCount = 0;

  chronological.forEach(r => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isOTC = isOtcSymbol(r.symbol);
    const actualDeductionDate = isOTC ? getNextTradingDay(r.date, r.symbol) : r.date;
    if (actualDeductionDate > todayStr) {
      return; // 待扣款: not yet deducted, skip completely
    }
    totalFees += r.fee;
    if (r.isPending) {
      return; // 待确认: deducted but NAV pending, skip from holdings
    }
    if (!positions[r.symbol]) {
      positions[r.symbol] = { shares: 0, cost: 0, heldBuyFees: 0 };
    }
    const pos = positions[r.symbol];

    if (r.type === 'BUY') {
      pos.cost += r.price * r.shares;
      pos.shares += r.shares;
      pos.heldBuyFees += r.fee;
    } else {
      if (pos.shares > 0) {
        const sold_shares = Math.min(r.shares, pos.shares);
        const avg = pos.cost / pos.shares;
        const avg_buy_fee = pos.heldBuyFees / pos.shares;

        if (r.price > avg) exactWins++;
        else exactLosses++;
        
        const profit = (r.price - avg) * sold_shares;
        realizedPnL += profit;
        
        const allocated_buy_fee = avg_buy_fee * sold_shares;
        const sell_fee = r.fee;
        realizedFees += (allocated_buy_fee + sell_fee);
        
        pos.cost -= avg * sold_shares;
        pos.heldBuyFees -= allocated_buy_fee;
        pos.shares -= sold_shares;
        
        if (pos.shares <= 0.00001) {
          pos.shares = 0;
          pos.cost = 0;
          pos.heldBuyFees = 0;
        }
        sellCount++;
      }
    }
  });

  const winRate = sellCount > 0 ? (exactWins / sellCount * 100) : 0;
  const netRealizedPnL = realizedPnL - realizedFees;
  
  let unrealizedPnL = 0;
  Object.entries(positions).forEach(([sym, pos]) => {
    if (pos.shares > 0) {
      const currentEtf = findEtfBySymbol(sym);
      const currentPrice = currentEtf?.price || (pos.cost / pos.shares);
      unrealizedPnL += (currentPrice * pos.shares) - pos.cost - pos.heldBuyFees;
    }
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieData = Object.entries(positions)
    .filter(([_, pos]) => pos.shares > 0)
    .map(([sym, pos], index) => {
      const currentEtf = findEtfBySymbol(sym);
      const value = currentEtf ? currentEtf.price * pos.shares : (pos.cost / pos.shares) * pos.shares;
      const name = currentEtf ? currentEtf.name.split(' ')[0] : sym;
      return {
        name,
        value: Number(value.toFixed(4)),
        fill: COLORS[index % COLORS.length]
      };
    })
    .sort((a, b) => b.value - a.value);

  // Filter lists based on UI tab selections
  const filteredRecords = records.filter(r => {
    if (filterSymbol !== 'ALL' && r.symbol !== filterSymbol) return false;
    if (filterType !== 'ALL') {
      if (filterType === 'PENDING' && !r.isPending) return false;
      if (filterType === 'SIP' && (!r.isSip || r.isPending)) return false;
      if (filterType === 'BUY' && (r.type !== 'BUY' || r.isSip || r.isPending)) return false;
      if (filterType === 'SELL' && r.type !== 'SELL') return false;
    }
    return true;
  });

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (sortBy === 'time-desc') {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    } else if (sortBy === 'time-asc') {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    } else if (sortBy === 'symbol') {
      return a.symbol.localeCompare(b.symbol);
    } else if (sortBy === 'type') {
      return a.type.localeCompare(b.type);
    }
    return 0;
  });

  const getHistoricalPricesForSymbol = (symbol: string) => {
    const market = markets.find(m => m.etfs.some(e => e.symbol === symbol || e.symbol.includes(symbol)));
    if (!market) return [];
    
    const etf = market.etfs.find(e => e.symbol === symbol || e.symbol.includes(symbol));
    const currentPrice = etf?.price || 1.000;
    const currentIndexPrice = market.chartData && market.chartData.length > 0
      ? (market.chartData[market.chartData.length - 1].close || 1.0)
      : 1.0;
      
    return (market.chartData || []).map(pt => {
      let derivedPrice = currentPrice;
      if (pt.close) {
        derivedPrice = (pt.close / currentIndexPrice) * currentPrice;
      }
      
      const daysTrades = records.filter(r => r.symbol === symbol && r.date === pt.date && !r.isPending);
      const buys = daysTrades.filter(r => r.type === 'BUY');
      const sells = daysTrades.filter(r => r.type === 'SELL');
      
      return {
        ...pt,
        price: Number(derivedPrice.toFixed(4)),
        buyPrice: buys.length > 0 ? Number(buys[0].price.toFixed(4)) : null,
        sellPrice: sells.length > 0 ? Number(sells[0].price.toFixed(4)) : null,
        buys,
        sells
      };
    });
  };

  const cleanChartSymbol = activeChartSymbol || (Object.entries(positions).find(([_, p]) => p.shares > 0)?.[0] || (allEtfs.length > 0 ? allEtfs[0].symbol : ''));
  const selectedSymbolChartData = cleanChartSymbol ? getHistoricalPricesForSymbol(cleanChartSymbol) : [];
  const matchedChartEtf = findEtfBySymbol(cleanChartSymbol);
  const matchedChartEtfName = matchedChartEtf ? matchedChartEtf.name : cleanChartSymbol;

  return (
    <div id="trading_journal_wrapper" className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-bottom-4 duration-300 bg-slate-900/95 backdrop-blur-lg border-emerald-500/20 text-slate-200 text-xs font-semibold">
          <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-red-400' : toast.type === 'info' ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Metrics Header */}
      <TradeStats
        netRealizedPnL={netRealizedPnL}
        unrealizedPnL={unrealizedPnL}
        winRate={winRate}
        exactWins={exactWins}
        exactLosses={exactLosses}
        totalFees={totalFees}
      />

      {/* 📊 Buy/Sell Point Placement Accuracy Panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 p-1 rounded"><Target size={14} /></span>
              <span>🎯 场内标的交易买卖定位深度分析 (买卖点分析引擎)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              结合当日OHLC历史线，动态定位您的实际成交价在当天振幅价格区间内的相对百分比精确度及买卖之后持有期表现。
            </p>
          </div>
          <div className="flex gap-2">
            {isAnalyzingPoints ? (
              <span className="text-[10px] text-emerald-400 animate-pulse flex items-center gap-1 bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Cpu size={11} className="animate-spin" />
                正在深度回溯历史振幅点阵...
              </span>
            ) : (
              <button
                type="button"
                onClick={() => fetchPointsAnalysis(records)}
                className="text-[10px] text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/15 duration-200 px-2.5 py-1 rounded-full border border-white/10 hover:border-emerald-500/30 font-bold"
              >
                🔄 刷新分析诊断
              </button>
            )}
          </div>
        </div>

        {!pointAnalysisData || records.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            📢 暂无分析记录。添加场内ETF/股票普通买卖交易账目后，系统将自动从联网多源高精度对账单中，抓取该标的在交易日的日内极限高低价并绘制本诊断报告。
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* BUY PLACEMENT CARD */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <ArrowUpRight size={14} className="bg-emerald-400/10 p-0.5 rounded" />
                  <span>普通买入偏离精度 (多单落位分析)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">有效统计笔数</span>
                  <span className="text-xs font-mono font-bold text-slate-300">{pointAnalysisData.buyAnalysis?.count || 0} 笔</span>
                </div>
              </div>

              {/* Progress/relative accuracy track */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>当日最低价 (0%)</span>
                  <span>当日最高价 (100%)</span>
                </div>
                
                <div className="relative w-full h-2.5 bg-slate-800 rounded-full my-3">
                  {/* Position pinpoint */}
                  {pointAnalysisData.buyAnalysis?.count > 0 ? (
                    (() => {
                      const rawPct = pointAnalysisData.buyAnalysis?.avgDistance ?? 50;
                      // Safe clamping
                      const pct = Math.max(0, Math.min(100, rawPct));
                      return (
                        <>
                          {/* Left shaded cover */}
                          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 rounded-l-full" style={{ width: `${pct}%` }} />
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[0_0_10px_#34d399] flex items-center justify-center transition-all duration-300"
                            style={{ left: `calc(${pct}% - 8px)` }}
                          >
                            <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                          </div>
                        </>
                      );
                    })()
                  ) : null}
                </div>
                <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-lg text-[11px]">
                  <span className="text-slate-400">平均成交点距最低点：</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {pointAnalysisData.buyAnalysis?.avgDistance !== undefined 
                      ? `${pointAnalysisData.buyAnalysis.avgDistance.toFixed(2)}%` 
                      : '0%'}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 leading-normal">
                  * 越靠近左侧最低价表明建仓的时机与入场价格优势越明显，0%代表每一次买入都精确买在每日绝对最低价。
                </p>
              </div>

              {/* Forecast performance grid */}
              <div className="pt-2 border-t border-white/5">
                <div className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-1">
                  <span>📊 申购建仓后各周期后市表现平均胜率与涨幅</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: '当晚 D0', key: 'd0' },
                    { label: '次日 D1', key: 'd1' },
                    { label: '3日 D3', key: 'd3' },
                    { label: '5日 D5', key: 'd5' },
                    { label: '30日 D30', key: 'd30' }
                  ].map((item, idx) => {
                    const chg = pointAnalysisData.buyAnalysis?.subsequentPerf?.[item.key];
                    const hasVal = chg !== undefined && chg !== null;
                    return (
                      <div key={idx} className="bg-slate-900/80 p-1.5 rounded border border-white/5">
                        <span className="text-[9px] text-slate-500 block">{item.label}</span>
                        <span className={`text-[10.5px] font-mono font-bold ${!hasVal ? 'text-slate-600' : chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {hasVal ? (chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`) : '--'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SELL PLACEMENT CARD */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                  <ArrowDownRight size={14} className="bg-blue-400/10 p-0.5 rounded" />
                  <span>单边卖出偏离精度 (空单割肉/获利落袋定位)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">有效统计笔数</span>
                  <span className="text-xs font-mono font-bold text-slate-300">{pointAnalysisData.sellAnalysis?.count || 0} 笔</span>
                </div>
              </div>

              {/* Progress/relative accuracy track */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>当日最低价 (100%)</span>
                  <span>当日最高价 (0%)</span>
                </div>
                
                <div className="relative w-full h-2.5 bg-slate-800 rounded-full my-3">
                  {/* Position pinpoint */}
                  {pointAnalysisData.sellAnalysis?.count > 0 ? (
                    (() => {
                      const rawPct = pointAnalysisData.sellAnalysis?.avgDistance ?? 30;
                      // Distance from daily high (0 is best = 100 on right)
                      const pctFromLow = 100 - Math.max(0, Math.min(100, rawPct));
                      return (
                        <>
                          {/* Right shaded cover representing profit capture */}
                          <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-blue-500/20 to-blue-500/5 rounded-r-full" style={{ width: `${100 - pctFromLow}%` }} />
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-400 border-2 border-slate-950 shadow-[0_0_10px_#60a5fa] flex items-center justify-center transition-all duration-300"
                            style={{ left: `calc(${pctFromLow}% - 8px)` }}
                          >
                            <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                          </div>
                        </>
                      );
                    })()
                  ) : null}
                </div>
                <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 px-3 py-2 rounded-lg text-[11px]">
                  <span className="text-slate-400">平均成交点距最高价：</span>
                  <span className="font-mono font-bold text-blue-400 text-xs">
                    {pointAnalysisData.sellAnalysis?.avgDistance !== undefined 
                      ? `${pointAnalysisData.sellAnalysis.avgDistance.toFixed(2)}%` 
                      : '0%'}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 leading-normal">
                  * 越靠近右侧最高价代表卖出避险/止盈落袋非常精准，0%代表每次都完美精准抛售在当日成交的最高光顶点。
                </p>
              </div>

              {/* Forecast performance grid for SELL */}
              <div className="pt-2 border-t border-white/5">
                <div className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-1">
                  <span>📊 赎回卖出离场后价格变动胜率 (越下跌证明出货越睿智)</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: '离场 D0', key: 'd0' },
                    { label: '次日 D1', key: 'd1' },
                    { label: '3日 D3', key: 'd3' },
                    { label: '5日 D5', key: 'd5' },
                    { label: '30日 D30', key: 'd30' }
                  ].map((item, idx) => {
                    const chg = pointAnalysisData.sellAnalysis?.subsequentPerf?.[item.key];
                    const hasVal = chg !== undefined && chg !== null;
                    // For SELL, if price dropped after sale (chg < 0), it shows we successfully locked in profits!
                    // So we color NEGATIVE changes as emerald (success!) and POSITIVE changes (missed out on rally) as red
                    const isGreatSale = chg <= 0;
                    return (
                      <div key={idx} className="bg-slate-900/80 p-1.5 rounded border border-white/5">
                        <span className="text-[9px] text-slate-500 block">{item.label}</span>
                        <span className={`text-[10.5px] font-mono font-bold ${!hasVal ? 'text-slate-600' : isGreatSale ? 'text-emerald-400' : 'text-red-400'}`}>
                          {hasVal ? (chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`) : '--'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}
        {pointAnalysisData && records.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 bg-slate-900/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-amber-400 text-[11px] animate-pulse">💡 避险大师妙计：</span>
            <span className="text-[10.5px] text-slate-400 leading-relaxed">
              基金及场内股票在您离场离场抛售后如果价格持续录得负值（即跌幅，呈<strong>绿字</strong>），
              说明此交易决策高瞻远瞩，成功避免了砸盘回撤，是业内公赞的高精尖套现节点！
            </span>
          </div>
        )}
      </div>

      {/* Form and Data Area */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
           <div>
             <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
               <span>录入交易记录</span>
               {false && (
                 <button 
                   type="button" 
                   onClick={onManageStocks}
                   className="text-[10px] text-emerald-400 bg-emerald-400/5 px-1.5 py-0.5 rounded hover:bg-emerald-400/15 transition border border-emerald-500/10 flex items-center ml-2"
                 >
                   <Settings size={10} className="mr-1 animate-spin duration-1000" /> 管理自选股
                 </button>
               )}
             </h3>
             <p className="text-[11px] text-slate-500 mt-1">
               选择关联板块或输入您需要记账的对应基金代码，一键计提智能多因子扣划账单。
             </p>
           </div>
           
           <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={handleExport} 
                className="flex items-center text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/15 hover:bg-emerald-400/15 transition-colors font-bold"
              >
                 <Download size={12} className="mr-1" /> 导出 JSON
              </button>
              <label className="flex items-center text-[10px] text-blue-400 bg-blue-400/10 px-2.5 py-1.5 rounded-lg border border-blue-500/15 cursor-pointer hover:bg-blue-400/15 transition-colors font-bold">
                 <Upload size={12} className="mr-1" /> 导入 JSON
                 <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
           </div>
        </div>

         <AiParsePanel
           aiTextInput={aiTextInput}
           aiImgData={aiImgData}
           isAiParsing={isAiParsing}
           onAiTextInputChange={setAiTextInput}
           onAiImgDataChange={setAiImgData}
           onDragOver={handleImageDragOver}
           onDrop={handleImageDrop}
           onImageSelect={handleImageSelect}
           onSubmit={handleAiParseSubmit}
         />

        <TradeFormAdd
          selectedMarketId={selectedMarketId}
          symbol={symbol}
          type={type}
          tradeMode={tradeMode}
          price={price}
          shares={shares}
          totalAmount={totalAmount}
          feeRate={feeRate}
          customFee={customFee}
          date={date}
          isPending={isPending}
          verifyingSymbol={verifyingSymbol}
          symbolCheckResult={symbolCheckResult}
          markets={markets}
          allEtfs={allEtfs}
          uniqueEtfsToShow={uniqueEtfsToShow}
          findEtfBySymbol={findEtfBySymbol}
          showToast={showToast}
          onSelectedMarketIdChange={setSelectedMarketId}
          onSymbolChange={handleSymbolChange}
          onTypeChange={v => setType(v)}
          onPriceChange={handlePriceChangeHelper}
          onTotalAmountChange={recalculateFromAmount}
          onSharesChange={recalculateFromShares}
          onFeeRateChange={setFeeRate}
          onCustomFeeChange={setCustomFee}
          onDateChange={setDate}
          onIsPendingChange={setIsPending}
          onVerifySymbol={verifySymbolCode}
          onMarketChange={marketId => {
            const relevantEtfs = marketId === 'ALL'
              ? allEtfs
              : (markets.find(m => m.id === marketId)?.etfs || []);
            if (relevantEtfs.length > 0) {
              handleSymbolChange(relevantEtfs[0].symbol);
            }
          }}
          onRecalcFromAmount={recalculateFromAmount}
          onRecalcFromShares={recalculateFromShares}
          onRecalcFees={recalculateWithNewFees}
          onSubmit={addRecord}
          onFillRealtimePrice={() => {
            const matched = findEtfBySymbol(symbol);
            if (matched && matched.price) {
              handlePriceChangeHelper(matched.price.toString());
              showToast(`⭐ 已成功填入实时价: ${matched.price}`);
            } else {
              showToast(`❌ 未能查询到该标的的实时最新价`, 'error');
            }
          }}
        />
      </div>

      {/* 待对账交易快速通道 */}
      {records.some(r => r.isPending) && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-yellow-500 animate-ping" />
            <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
              您有 {records.filter(r => r.isPending).length} 笔场外基金申购在等待核销最新净值
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            由于场外公募基金（特别是美股 QDII 基金）在申购扣划本金当日，其成交结算净值尚未确定（QDII 基金通常需要 T+2 确认），此期间申购记录仅记为“扣款待确认”。请在官方净值公布后，点击下方或列表中 <strong>确认净值</strong>，填入成交价后将自动折算份额并正式记入持仓。
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {records.filter(r => r.isPending).map(record => {
              const matchedEtf = findEtfBySymbol(record.symbol);
              return (
                <button
                  key={record.id}
                  onClick={() => setConfirmingPendingRecord(record)}
                  className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <span>确认 {record.date} [{matchedEtf?.name.split(' ')[0] || record.symbol}] 扣款 ¥{(record.pendingAmount || 0).toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 智能对账及纠错后台服务状态显示 */}
      <NavSyncStatus logs={navSyncLogs} />

      {/* Historical Ledger Record Panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <TradeFilters
          filterType={filterType}
          sortBy={sortBy}
          onFilterTypeChange={v => setFilterType(v)}
          onSortByChange={v => setSortBy(v)}
          hasRecords={records.length > 0}
          onClear={() => {
            clearRecords();
            showToast('🗑️ 全部交易流水已清空', 'info');
          }}
        />

        {/* 视图模式切换：平铺表格 / 分组折叠 */}
        {records.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setViewMode('flat')}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors ${viewMode === 'flat' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              平铺表格
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors ${viewMode === 'grouped' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              分组折叠
            </button>
            {viewMode === 'grouped' && (
              <select
                value={groupMode}
                onChange={e => setGroupMode(e.target.value as GroupMode)}
                className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 font-sans focus:outline-none focus:border-emerald-500/50"
              >
                <option value="category">大类 → 基金</option>
                <option value="source">定投 vs 手动</option>
                <option value="month">按月份</option>
                <option value="status">按状态</option>
              </select>
            )}
          </div>
        )}

        {viewMode === 'grouped' ? (
          <TradeGroupCard
            records={filteredRecords}
            markets={markets}
            findEtfBySymbol={findEtfBySymbol}
            groupMode={groupMode}
          />
        ) : (
          <TradeList
            sortedRecords={sortedRecords}
            filteredRecords={filteredRecords}
            deletingRecordId={deletingRecordId}
            isOtcSymbol={isOtcSymbol}
            getOtcDates={getOtcDates}
            getNextTradingDay={getNextTradingDay}
            onConfirmPending={setConfirmingPendingRecord}
            onEdit={setEditingRecord}
            onRequestDelete={setDeletingRecordId}
            onDelete={id => {
              removeRecord(id);
              setDeletingRecordId(null);
              showToast('🗑️ 该行流水记录已作废', 'info');
            }}
            onCancelDelete={() => setDeletingRecordId(null)}
            onReportCorrection={record => {
              setCorrectionSymbol(record.symbol);
              setCorrectionDate(record.date);
              setCorrectionOriginalNav(record.price.toString());
              setCorrectionNewNav(record.price.toString());
              setCorrectionRecordId(record.id);
              setShowCorrectionModal(true);
            }}
          />
        )}
      </div>

      <PortfolioChart
        positions={positions}
        pieData={pieData}
        cleanChartSymbol={cleanChartSymbol}
        selectedSymbolChartData={selectedSymbolChartData}
        matchedChartEtfName={matchedChartEtfName}
        activeChartSymbol={activeChartSymbol}
        onActiveChartSymbolChange={setActiveChartSymbol}
        findEtfBySymbol={findEtfBySymbol}
        allEtfs={allEtfs}
      />

      {/* Edit Record Modal */}
      {editingRecord && (
        <TradeFormEdit
          editType={editType}
          editIsSip={editIsSip}
          editDate={editDate}
          editSymbol={editSymbol}
          editAmount={editAmount}
          editFeeRate={editFeeRate}
          editFee={editFee}
          editPrice={editPrice}
          editShares={editShares}
          isEditSyncingNav={isEditSyncingNav}
          isOtcSymbol={isOtcSymbol}
          onEditTypeChange={setEditType}
          onEditIsSipChange={setEditIsSip}
          onEditDateChange={setEditDate}
          onEditSymbolChange={setEditSymbol}
          onEditAmountChange={setEditAmount}
          onEditFeeRateChange={setEditFeeRate}
          onEditFeeChange={setEditFee}
          onEditPriceChange={setEditPrice}
          onEditSharesChange={setEditShares}
          onRecalculate={handleEditRecalculate}
          onQueryNav={handleEditQueryNav}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}

      {/* 确认场外买入成交价与折算份额 Modal */}
      {confirmingPendingRecord && (
        <TradeFormConfirm
          record={confirmingPendingRecord}
          pendingConfirmPrice={pendingConfirmPrice}
          onPendingConfirmPriceChange={setPendingConfirmPrice}
          findEtfBySymbol={findEtfBySymbol}
          onConfirm={handleConfirmPendingRecord}
          onCancel={() => setConfirmingPendingRecord(null)}
        />
      )}

      {/* ⚠️ LOUD SYMBOL CONFLICT ALARM MODAL */}
      {showSymbolAlarm && symbolCheckResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-red-500/40 w-full max-w-lg rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-4 text-slate-200 animate-bounce-short">
            <div className="flex items-center gap-3 pb-3 border-b border-white/5">
              <div className="bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/30 animate-pulse">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-red-400 font-sans tracking-wide">⚠️ 标的代码多渠道交叉核验对账警报 (Critical Symbol Mismatch Alert)</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">多路金融信息源（东方财富、新浪、徐秋）反馈数据冲突</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-2">
                <span className="font-bold text-slate-300">代码: {symbolCheckResult.symbol} 出现了定位分歧：</span>
                <p className="text-[11px] leading-relaxed text-slate-400 font-sans">
                  我们在多渠道同步对账搜索中发现此代码在不同平台的命名、甚至资产归类存在冲突分歧。如果强行归档，可能会造成账本无法匹配，数据无法自动校准！
                </p>
              </div>

              {/* Verified details table */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">各信道实时抓取对账明细</span>
                <div className="grid grid-cols-3 gap-2 text-center text-[10.5px]">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-500 block font-sans">新浪财经 (Sina)</span>
                    <span className="font-bold text-white block mt-1">{symbolCheckResult.namesInSources?.sina || '未寻获'}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-500 block font-sans">东方财富 (Eastmoney)</span>
                    <span className="font-bold text-white block mt-1">{symbolCheckResult.namesInSources?.eastmoney || '未寻获'}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-500 block font-sans">其他三源 (Yahoo/Other)</span>
                    <span className="font-bold text-white block mt-1">{symbolCheckResult.namesInSources?.third || '未寻获'}</span>
                  </div>
                </div>
              </div>

              {symbolCheckResult.explanation && (
                <div className="p-3 bg-slate-950 rounded-xl text-[11px] leading-relaxed text-slate-400 font-mono">
                  <span className="text-yellow-400 font-bold block mb-1">🔍 综合AI对账逻辑分析：</span>
                  {symbolCheckResult.explanation}
                </div>
              )}
              
              <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 text-slate-400 text-[10.5px] leading-relaxed">
                👉 <strong>安全选项：</strong>如果您确定这是一只新发行或特殊代码，您可以<strong>“强制采纳，强行记账”</strong>，系统会自动录入其第一个有效名称；或者您可以<strong>“重新填写代码”</strong>，检查是否有手误。
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowSymbolAlarm(false);
                  showToast('⚠️ 已强行豁免安全机制，允许录入该代码。', 'info');
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition-all text-xs shadow-md active:scale-95"
              >
                🚨 豁免安全限制、强行记账
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSymbolAlarm(false);
                  setSymbol('');
                  // Focus input if easy, else just flash
                  showToast('请重新输入正确的证券代码', 'info');
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-all text-xs"
              >
                我要重新检查代码
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ SMART NAV CORRECTION / SELF-HEALING MODAL */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Cpu className="text-emerald-400 animate-pulse" size={16} />
                <h3 className="font-bold text-sm text-white font-sans">智能对账校准与纠错自愈大坝</h3>
              </div>
              <button 
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectionRecordId(null);
                }}
                className="text-slate-400 hover:text-white bg-slate-800/40 p-1.5 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl space-y-2 border border-white/5">
                <div className="flex justify-between">
                  <span className="text-slate-500">纠错标的：</span>
                  <span className="text-white font-bold font-mono">{correctionSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">交易清算日：</span>
                  <span className="text-white font-bold font-mono">{correctionDate}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                  <span className="text-slate-500">当前存储争端净值：</span>
                  <span className="text-amber-500 font-bold font-mono">¥{parseFloat(correctionOriginalNav).toFixed(4)}</span>
                </div>
              </div>

              <div className="p-3 bg-red-950/20 text-red-400 rounded-xl border border-red-900/30 text-[10.5px] leading-relaxed">
                🛡️ <strong>【防数据污染安全哨兵保障】</strong><br />
                提交此纠错后，服务器将立即启动 <strong>Gemini Live + 全球金融多平台联网搜索引擎进行交叉验证</strong>。
                严禁随意输入恶意的随意基金虚假数值。对于安全、合理的正确纠正，账目将立刻一键自愈，并全网更新此缓存校正！
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-[11px] text-slate-400 font-semibold uppercase block">
                  请输入官方权威渠道在该日的实际单位净值 (NAV)
                </label>
                <input
                  type="number"
                  step="any"
                  value={correctionNewNav}
                  onChange={e => setCorrectionNewNav(e.target.value)}
                  placeholder="如: 1.2588"
                  className="w-full bg-black/40 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-emerald-500/5"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                disabled={isSubmittingCorrection}
                onClick={submitCorrectionReport}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs flex items-center justify-center gap-1"
              >
                {isSubmittingCorrection ? (
                  <>
                    <Cpu size={12} className="animate-spin" />
                    联网搜寻多方财报审计中...
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    提交权威核验证明自愈
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isSubmittingCorrection}
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectionRecordId(null);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-all text-xs"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
