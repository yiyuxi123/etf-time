import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Target, ArrowDownRight, ArrowUpRight, Download, Upload, ShieldAlert, Check, X, Search, Settings, Pencil, Sparkles, Cpu } from 'lucide-react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Line } from 'recharts';
import { MarketData, EtfInfo, TradeRecord } from '../types';
import { checkIsMarketClosed, getNextTradingDay, getTradingDaysElapsed } from '../lib/calendar';
import { findEtfBySymbol as findEtfBySymbolShared, isOtcSymbol as isOtcSymbolShared } from '../utils/fund-helpers';

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
  const [isClearingReal, setIsClearingReal] = useState(false);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
            {netRealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
            已实现净盈亏
          </div>
          <div className={`text-lg font-mono font-bold ${netRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netRealizedPnL >= 0 ? '+' : ''}{netRealizedPnL.toFixed(2)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
            {unrealizedPnL >= 0 ? <ArrowUpRight size={12} className="mr-1 text-emerald-400" /> : <ArrowDownRight size={12} className="mr-1 text-red-400" />}
            总持仓预估浮盈
          </div>
          <div className={`text-lg font-mono font-bold ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
             <Target size={12} className="mr-1 text-cyan-400" />
             平仓胜率
          </div>
          <div className="flex items-end gap-1">
            <div className="text-lg font-mono font-bold text-white">{winRate.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 mb-0.5 font-mono">({exactWins}/{exactLosses})</div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-[10px] mb-1 uppercase tracking-widest flex items-center select-none">
             <ArrowDownRight size={12} className="mr-1 text-yellow-500" />
             累计手续费
          </div>
          <div className="text-lg font-mono font-bold text-yellow-500">
            ¥{totalFees.toFixed(4)}
          </div>
        </div>
      </div>

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

         {/* AI Smart Import Block */}
         <div className="mb-6 bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/20 p-5 rounded-2xl space-y-4">
           {/* Header */}
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
             <div className="flex items-center gap-2">
               <div className="bg-emerald-500/15 p-1.5 rounded-lg text-emerald-400 border border-emerald-500/20 animate-pulse">
                 <Sparkles size={16} />
               </div>
               <div>
                 <span className="font-bold text-xs text-white font-sans">AI 智能辅助记账识单</span>
                 <p className="text-[10px] text-slate-500 mt-0.5">
                   支持输入一句话描述，或拖入/粘贴交易成交单、券商截图，由 AI 自动解析并填充下表。
                 </p>
               </div>
             </div>
             
             {/* Engine feedback indicator */}
             <div className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded bg-black/40 border border-white/5 text-slate-400 flex items-center gap-1.5 shrink-0">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
               当前引擎: <span className="text-emerald-400">{
                 (localStorage.getItem('ai_default_provider') || 'gemini').toUpperCase()
               }</span>
             </div>
           </div>

           {/* Input panel row */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Text input */}
             <div className="space-y-1.5">
               <label className="text-[10px] text-slate-400 font-semibold block uppercase">一句话极速描述</label>
               <textarea
                 rows={3}
                 value={aiTextInput}
                 onChange={(e) => setAiTextInput(e.target.value)}
                 placeholder="例：今天以1.312元买入纳指ETF五千三百份，手续费0.2元，日期是2月19日。"
                 className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans resize-none leading-relaxed"
               />
             </div>

             {/* Screenshot upload */}
             <div className="space-y-1.5">
               <label className="text-[10px] text-slate-400 font-semibold block uppercase">成交截图识别 (Drag or Paste)</label>
               <div 
                 onDragOver={handleImageDragOver}
                 onDrop={handleImageDrop}
                 onClick={() => document.getElementById('ai_image_selector')?.click()}
                 className={`border border-dashed rounded-xl h-[76px] flex flex-col items-center justify-center cursor-pointer transition-all ${
                   aiImgData ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 hover:border-white/25 bg-black/20'
                 }`}
               >
                 <input 
                   id="ai_image_selector" 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={handleImageSelect} 
                 />
                 {aiImgData ? (
                   <div className="flex items-center gap-3 px-4 w-full">
                     <img src={aiImgData} className="w-10 h-10 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                     <div className="text-left flex-1 truncate">
                       <span className="text-[10px] text-emerald-400 font-bold block font-sans">已成功载入成交截图</span>
                       <span className="text-[9px] text-slate-500 block truncate">点击或拖拽可重新上传</span>
                     </div>
                     <button 
                       type="button" 
                       onClick={(e) => { e.stopPropagation(); setAiImgData(null); }}
                       className="text-[10px] font-bold text-slate-500 hover:text-red-400 shrink-0 bg-slate-800/40 px-2 py-1 rounded font-sans"
                     >
                       清空图片
                     </button>
                   </div>
                 ) : (
                   <div className="text-center">
                     <span className="text-[10px] text-slate-400 font-bold block font-sans">拖拽/粘贴或点击上传成交单截图</span>
                     <span className="text-[9px] text-slate-600 block mt-0.5">支持主流券商交易完成状态图 (限20MB)</span>
                   </div>
                 )}
               </div>
             </div>
           </div>

           {/* Submit */}
           <div className="flex justify-end pt-1">
             <button
               type="button"
               disabled={isAiParsing || (!aiTextInput && !aiImgData)}
               onClick={handleAiParseSubmit}
               className={`text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                 (isAiParsing) 
                   ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' 
                   : (!aiTextInput && !aiImgData)
                     ? 'bg-white/5 text-slate-600 border border-white/10 cursor-not-allowed'
                     : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 active:scale-95 shadow-emerald-500/10 hover:shadow-emerald-500/20'
               }`}
             >
               {isAiParsing ? (
                 <>
                   <Cpu size={14} className="animate-spin text-emerald-400" />
                   AI 正在提炼账单细节...
                 </>
               ) : (
                 <>
                   <Cpu size={14} />
                   AI 智能解析并自动填表
                 </>
               )}
             </button>
           </div>
         </div>

        <form onSubmit={addRecord} className="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Market Link Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">关联母市场板块</label>
              <select
                value={selectedMarketId}
                onChange={e => {
                  setSelectedMarketId(e.target.value);
                  // Auto fill first option symbol of the selected market to prevent disjoint states
                  const relevantEtfs = e.target.value === 'ALL' 
                    ? allEtfs 
                    : (markets.find(m => m.id === e.target.value)?.etfs || []);
                  if (relevantEtfs.length > 0) {
                    handleSymbolChange(relevantEtfs[0].symbol);
                  }
                }}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="ALL">全部关联标的 (ALL)</option>
                {markets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Direct Trade Type Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">动作类型</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50"
              >
                {tradeMode === 'OTC' ? (
                  <>
                    <option value="BUY">基金申购 🟢</option>
                    <option value="SIP">定时定投 (SIP) 🔄</option>
                    <option value="SELL">基金赎回 🔴</option>
                  </>
                ) : (
                  <>
                    <option value="BUY">普通买入 🟢</option>
                    <option value="SIP">定投买入 (SIP) 🔄</option>
                    <option value="SELL">资金卖出 🔴</option>
                  </>
                )}
              </select>
            </div>

            {/* Symbols listing */}
            <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
              <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                <span>交易标的代码</span>
                <span className="text-[10px] text-slate-500">输入代码/首字母快速检索</span>
              </label>
              <div className="relative">
                <input 
                  list="journal_etfs_list"
                  value={symbol}
                  onChange={e => {
                    handleSymbolChange(e.target.value);
                  }}
                  onBlur={() => verifySymbolCode(symbol)}
                  placeholder="如: 513100 或 f_016452"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <datalist id="journal_etfs_list">
                  {uniqueEtfsToShow.map(e => (
                    <option key={e.symbol} value={e.symbol}>{e.name} ({e.symbol})</option>
                  ))}
                </datalist>

                {verifyingSymbol && (
                  <div className="absolute right-3 top-2.5 flex items-center justify-center">
                    <Cpu size={14} className="text-emerald-400 animate-spin" />
                  </div>
                )}
                
                {symbolCheckResult && !symbolCheckResult.hasConflict && (
                  <div className="absolute right-3 top-2.5 flex items-center justify-center text-emerald-400">
                    <Check size={14} />
                  </div>
                )}
              </div>

              {symbolCheckResult && !symbolCheckResult.hasConflict && (
                <div className="text-[10px] text-emerald-400 mt-1 font-sans flex items-center gap-1 animate-in fade-in">
                  <span>✨ 官方三源交叉验证无误：<strong>{symbolCheckResult.name}</strong> ({symbolCheckResult.assetType === 'OTC' ? '场外公募型配资' : '场内交易品种'})</span>
                </div>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 pt-1">
            
            {/* Fees */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">自定摩擦费率 (%)</label>
              <input 
                type="number" 
                step="any"
                value={feeRate}
                onChange={e => {
                  setFeeRate(e.target.value);
                  recalculateWithNewFees(e.target.value, customFee);
                }}
                className="bg-slate-900 border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-orange-400 focus:outline-none focus:border-orange-500 bg-orange-500/5 font-mono"
              />
            </div>

            {/* Exact Fee Override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                <span>精确手续费 (元)</span>
                <span className="text-[10px] text-orange-500/55">覆盖费率</span>
              </label>
              <input 
                type="number" 
                step="any"
                value={customFee}
                onChange={e => {
                  setCustomFee(e.target.value);
                  recalculateWithNewFees(feeRate, e.target.value);
                }}
                placeholder="选填精确规费(元)"
                className="bg-slate-900 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 bg-emerald-500/5 font-mono placeholder:text-slate-600"
              />
            </div>

            {/* Trading Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">交易归档时间</label>
              <input 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
              />
            </div>

            {/* Price input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                <span>{tradeMode === 'OTC' ? '成交扣减净值' : '成交单价 (元)'}</span>
                {!isPending && allEtfs.some(e => e.symbol === symbol) && (
                  <button
                    type="button"
                    onClick={() => {
                      const matched = findEtfBySymbol(symbol);
                      if (matched && matched.price) {
                        handlePriceChangeHelper(matched.price.toString());
                        showToast(`⭐ 已成功填入实时价: ${matched.price}`);
                      } else {
                        showToast(`❌ 未能查询到该标的的实时最新价`, 'error');
                      }
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium decoration-dotted underline"
                  >
                    实时价
                  </button>
                )}
              </label>
              <input 
                type="number" 
                step="0.0001"
                value={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '' : price}
                disabled={isPending && tradeMode === 'OTC' && type !== 'SELL'}
                onChange={e => handlePriceChangeHelper(e.target.value)}
                placeholder={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '待公布后确认' : '建仓/结算交易价'}
                className={`bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono ${isPending && tradeMode === 'OTC' && type !== 'SELL' ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-500' : ''}`}
              />
            </div>

            {/* Amount Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">
                {type === 'SELL' ? '回笼账款金额 (元)' : '注入资金/申购总额 (元)'}
              </label>
              <input 
                type="number" 
                step="0.01"
                value={totalAmount}
                onChange={e => recalculateFromAmount(e.target.value)}
                placeholder="输入交易本金"
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono placeholder:text-slate-600"
              />
            </div>

            {/* Shares Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">
                {isPending && tradeMode === 'OTC' && type !== 'SELL' ? '自动估算/待确认' : '成交份额 (份)'}
              </label>
              <input 
                type="number" 
                step="any"
                value={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '' : shares}
                disabled={isPending && tradeMode === 'OTC' && type !== 'SELL'}
                onChange={e => recalculateFromShares(e.target.value)}
                placeholder={isPending && tradeMode === 'OTC' && type !== 'SELL' ? '待确权后入账' : '所换得的单位份额'}
                className={`bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-full font-mono placeholder:text-slate-600 ${isPending && tradeMode === 'OTC' && type !== 'SELL' ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-500' : ''}`}
              />
            </div>

          </div>

          {/* Pending confirmation checkbox for OTC trades */}
          {tradeMode === 'OTC' && type !== 'SELL' && (
            <div className="flex items-center gap-2 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/15">
              <input
                type="checkbox"
                id="pending_confirmation_checkbox"
                checked={isPending}
                onChange={e => setIsPending(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-yellow-500 focus:ring-yellow-500/50 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="pending_confirmation_checkbox" className="text-xs text-yellow-400 font-semibold cursor-pointer select-none">
                场外交易：暂不确定最终成交价与份额 (等净值确认后再做对账过账，适合 QDII 等 T+1 / T+2 公募基金)
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-[11px] text-slate-500 font-mono">
              [类型: {tradeMode === 'OTC' ? '场外OTC认申' : '场内交易所撮合'}] [费度: {feeRate}%]
            </span>
            <button 
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-2 rounded-lg text-xs transition-all flex items-center shadow-lg shadow-emerald-500/10 active:scale-95"
            >
              <Plus size={14} className="mr-1" /> 保存记录
            </button>
          </div>
        </form>
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
      {navSyncLogs.length > 0 && (
        <div className="bg-[#0b1716] border border-emerald-500/15 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-duration-1000"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <h4 className="text-xs font-bold text-emerald-400 font-sans uppercase tracking-wider flex items-center gap-1">
                <span>🔄 公募基金智能纠错对账引擎 (Auto-Syncing Engine)</span>
              </h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              后台自动轮询纠错 · 实现T+2绝对合规计账
            </span>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 font-mono">
            {navSyncLogs.slice(-4).map((log, index) => (
              <div key={index} className="flex gap-2 text-[11px] leading-relaxed animate-in fade-in slide-in-from-left-1 duration-150">
                <span className="text-slate-600">»</span>
                <span className={`font-medium ${
                  log.type === 'syncing' ? 'text-amber-400 animate-pulse' :
                  log.type === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-400'
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Ledger Record Panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">历史收支核销流水</h3>
            
            {/* Filter selectors to reduce clutter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 font-sans focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">全部操作 (ALL)</option>
              <option value="BUY">普通买入</option>
              <option value="SIP">定投买入</option>
              <option value="SELL">单边卖出</option>
              <option value="PENDING">待对账确认</option>
            </select>

            {/* Sort selectors */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 font-sans focus:outline-none focus:border-emerald-500/50"
            >
              <option value="time-desc">⏳ 交易时间降序 (最新在前)</option>
              <option value="time-asc">⌛ 交易时间升序 (最早在前)</option>
              <option value="symbol">🗂️ 按资产代码分类 (A-Z)</option>
              <option value="type">🔄 按买/卖类型聚类</option>
            </select>
          </div>

          {records.length > 0 && (
            <div className="flex items-center">
              {isClearingReal ? (
                <div className="flex items-center gap-2 bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/50 animate-in fade-in duration-200">
                  <span className="text-[11px] text-red-400 font-semibold">确定清除全部流水吗？关联持仓也可能清零：</span>
                  <button 
                    onClick={() => {
                      clearRecords();
                      setIsClearingReal(false);
                      showToast('🗑️ 全部交易流水已清空', 'info');
                    }}
                    className="text-[10px] bg-red-600 hover:bg-red-500 text-slate-950 font-bold px-2 py-0.5 rounded"
                  >
                    确定
                  </button>
                  <button 
                    onClick={() => setIsClearingReal(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-white/10"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsClearingReal(true)}
                  className="text-[10px] text-red-400 hover:text-red-300 px-2.5 py-1 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors font-bold"
                >
                  清空流水
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10 select-none">
              <tr>
                <th className="pb-3 pl-2">过账日期</th>
                <th className="pb-3">动作类型</th>
                <th className="pb-3">资产代码</th>
                <th className="pb-3 text-right">价格/净值</th>
                <th className="pb-3 text-right">交易份额</th>
                <th className="pb-3 text-right">划款扣费</th>
                <th className="pb-3 text-right pr-2">安全剔除</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-white/5">
              {sortedRecords.map((record, i) => (
                <tr key={`${record.id}-${i}`} className="hover:bg-white/5 transition-colors group">
                  <td className="py-3 pl-2 text-xs">
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOTC = isOtcSymbol(record.symbol);
                      
                      if (isOTC) {
                        const { deductionDate, confirmDate, isPostponed } = getOtcDates(record.date, record.symbol);
                        const isDeductionPending = deductionDate > todayStr;
                        
                        return (
                          <div className="flex flex-col gap-0.5 leading-normal">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">扣款日:</span>
                              <span className="text-slate-200 font-mono text-[11px] font-medium">{deductionDate}</span>
                              {isPostponed && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 font-semibold scale-90 origin-left">顺延</span>
                              )}
                              {isDeductionPending && (
                                <span className="text-[9px] px-1 py-0.1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold scale-90 origin-left">待扣款</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">确权日:</span>
                              <span className="text-slate-400 font-mono text-[11px]">{confirmDate}</span>
                              {!isDeductionPending && record.isPending && record.navStatus === 'not_updated' && (
                                <span className="text-[9px] px-1 py-0.1 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-semibold scale-90 origin-left">未更新</span>
                              )}
                              {!isDeductionPending && record.isPending && record.navStatus !== 'not_updated' && (
                                <span className="text-[9px] px-1 py-0.1 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-semibold scale-90 origin-left animate-pulse">待确权</span>
                              )}
                              {!isDeductionPending && !record.isPending && record.navStatus === 'updated' && (
                                <span className="text-[9px] px-1 py-0.1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold scale-90 origin-left">已更新</span>
                              )}
                              {!isDeductionPending && !record.isPending && record.navStatus !== 'updated' && (
                                <span className="text-[9px] px-1 py-0.1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold scale-90 origin-left">已确权</span>
                              )}
                              {isDeductionPending && (
                                <span className="text-[9px] text-slate-600 scale-90 origin-left">(预期确权)</span>
                              )}
                            </div>
                            {!isDeductionPending && record.isPending && record.navStatus === 'not_updated' && (
                              <div className="text-[9.5px] text-red-400 font-sans font-semibold mt-0.5 animate-pulse flex items-center gap-1">
                                <span>⚠️ 净值暂未公布</span>
                              </div>
                            )}
                            {!isDeductionPending && !record.isPending && record.navStatus === 'updated' && (
                              <div className="text-[10px] text-emerald-500/80 font-sans font-semibold mt-0.5 flex items-center gap-1">
                                <span>✓ 自动校对已更新</span>
                              </div>
                            )}
                            {isPostponed && (
                              <div className="text-[9.5px] text-slate-500 font-sans leading-none mt-0.5 opacity-80">
                                (计划: {record.date} 休市)
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return <span className="text-slate-400 font-mono">{record.date}</span>;
                      }
                    })()}
                  </td>
                  <td className={`py-3 text-xs font-bold ${record.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {record.isSip ? '🔄 定投' : (record.type === 'BUY' ? '买入' : '卖出')}
                  </td>
                  <td className="py-3 text-xs text-slate-300 font-semibold">{record.symbol}</td>
                  <td className="py-3 text-right text-xs text-slate-200">
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOTC = isOtcSymbol(record.symbol);
                      const actualDeductionDate = isOTC ? getNextTradingDay(record.date, record.symbol) : record.date;
                      
                      if (actualDeductionDate > todayStr) {
                        return (
                          <span className="text-amber-500 font-semibold italic text-[11px]">
                            扣 ¥{(record.pendingAmount || record.price * record.shares || 0).toFixed(2)} [待扣款]
                          </span>
                        );
                      } else if (record.isPending) {
                        return (
                          <span className="text-yellow-500 font-semibold italic text-[11px] animate-pulse">
                            扣 ¥{(record.pendingAmount || 0).toFixed(2)} [待确认]
                          </span>
                        );
                      } else {
                        return (
                          <div className="flex flex-col items-end">
                            <span className={record.hasConflict ? "text-amber-400 font-bold font-mono" : "text-slate-250 font-mono"}>
                              ¥{record.price.toFixed(4)}
                            </span>
                            {record.hasConflict && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionSymbol(record.symbol);
                                  setCorrectionDate(record.date);
                                  setCorrectionOriginalNav(record.price.toString());
                                  setCorrectionNewNav(record.price.toString());
                                  setCorrectionRecordId(record.id);
                                  setShowCorrectionModal(true);
                                }}
                                className="text-[9px] bg-red-500/20 text-red-300 hover:bg-red-500/35 border border-red-500/30 px-1 py-0.5 rounded cursor-pointer mt-0.5"
                                title={record.conflictDetails || "多源对账单校准存在冲突"}
                              >
                                ⚠️ 对账冲突(点击纠错)
                              </button>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </td>
                  <td className="py-3 text-right text-xs text-slate-300">
                    {record.isPending ? (
                      <span className="text-slate-500 text-[11px]">- -</span>
                    ) : (
                      record.shares.toFixed(2)
                    )}
                  </td>
                  <td className="py-3 text-right text-xs text-yellow-400 font-semibold">¥{record.fee.toFixed(2)}</td>
                  <td className="py-3 text-right pr-2">
                    {deletingRecordId === record.id ? (
                      <div className="flex items-center justify-end gap-1.5 animate-in fade-in duration-100">
                        <button
                          onClick={() => {
                            removeRecord(record.id);
                            setDeletingRecordId(null);
                            showToast('🗑️ 该行流水记录已作废', 'info');
                          }}
                          className="text-[10px] bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded text-slate-950 font-bold"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setDeletingRecordId(null)}
                          className="text-[10px] bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-white/5"
                        >
                          否
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end items-center gap-1">
                        {record.isPending && (
                          <button
                            onClick={() => setConfirmingPendingRecord(record)}
                            className="text-[10px] bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-2 py-0.5 rounded transition-all active:scale-95 flex items-center mr-1"
                            title="立刻确认该日净值"
                          >
                            确认净值
                          </button>
                        )}
                        <button
                          onClick={() => setEditingRecord(record)}
                          className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg sm:opacity-0 group-hover:opacity-100"
                          title="修改交易记录"
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          onClick={() => setDeletingRecordId(record.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg sm:opacity-80 group-hover:opacity-100"
                          title="删除单条数据"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs select-none">暂无对应检索条件的交易记录。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realtime hold stats */}
      {Object.values(positions).some(p => p.shares > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Detailed positions ledger list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:col-span-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">当前持仓组合明细表</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] text-slate-500 uppercase border-b border-white/10 select-none">
                  <tr>
                    <th className="pb-3 pl-2">标的资产</th>
                    <th className="pb-3 text-right">持仓总额</th>
                    <th className="pb-3 text-right">平均买入价</th>
                    <th className="pb-3 text-right">现时估值</th>
                    <th className="pb-3 text-right pr-1">累积浮盈/亏</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono divide-y divide-white/5">
                  {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).map(([sym, pos]) => {
                    const currentEtf = findEtfBySymbol(sym);
                    const avgCost = pos.cost / pos.shares;
                    const currentPrice = currentEtf?.price || avgCost;
                    const unrealized = (currentPrice * pos.shares) - pos.cost - pos.heldBuyFees;
                    return (
                      <tr 
                        key={sym} 
                        onClick={() => setActiveChartSymbol(sym)}
                        className={`hover:bg-white/10 cursor-pointer transition-all ${cleanChartSymbol === sym ? 'bg-emerald-500/5 font-semibold text-slate-100' : ''}`}
                        title="💡 点击此行即可查看该标的历史净值曲线与买卖交易点"
                      >
                        <td className="py-3 pl-2 text-slate-300 font-sans font-semibold">
                          <div className="flex items-center gap-1.5">
                            {cleanChartSymbol === sym && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            <span>{currentEtf ? currentEtf.name : sym}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sym}</div>
                        </td>
                        <td className="py-3 text-right text-slate-400">{pos.shares.toFixed(2)}</td>
                        <td className="py-3 text-right text-slate-400">¥{avgCost.toFixed(4)}</td>
                        <td className="py-3 text-right text-slate-200">¥{currentPrice.toFixed(4)}</td>
                        <td className={`py-3 text-right font-bold pr-1 ${unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {unrealized >= 0 ? '+' : ''}{unrealized.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation visual display */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-widest select-none">
                  综合资产配置比例
                </h3>
                <p className="text-[11px] text-slate-500 mb-2">
                  实时持仓总市值的占比拆解图。
                </p>
              </div>
              <div className="w-full h-[180px] relative">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', zIndex: 1000}}
                        itemStyle={{color: '#fff', fontSize: '11px'}}
                        formatter={(value: number) => [`¥${value.toLocaleString()}`, '市价资产']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-xs text-center">
                    暂无有效持仓数据比例
                  </div>
                )}
              </div>
          </div>

        </div>
      )}

      {/* Dynamic Asset NAV Curve and Transaction points Chart overlay */}
      {selectedSymbolChartData.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex flex-wrap items-center gap-1.5 font-sans">
                <span>📈 个股/标的历史净值走势与成交买卖观察点</span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold tracking-wide border border-emerald-500/15">
                  {matchedChartEtfName} ({cleanChartSymbol})
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                基于指数历史行情与您的实时持仓智能对账。历史价格中：<span className="text-emerald-400 font-semibold">🟢 绿钻</span> 代表买入成交点，<span className="text-red-400 font-semibold">🔴 红钻</span> 代表卖出点位。
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold select-none">切换标的:</span>
              <select
                value={cleanChartSymbol}
                onChange={e => setActiveChartSymbol(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-sans"
              >
                {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).map(([sym]) => {
                  const etfInfo = findEtfBySymbol(sym);
                  return (
                    <option key={sym} value={sym}>
                      💼 {etfInfo ? etfInfo.name : sym} ({sym})
                    </option>
                  );
                })}
                {Object.entries(positions).filter(([_, pos]) => pos.shares > 0).length > 0 && (
                  <option disabled>─────── 全部监控列表 ───────</option>
                )}
                {allEtfs.map(e => (
                  <option key={e.symbol} value={e.symbol}>
                    🔍 {e.name} ({e.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full h-[320px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedSymbolChartData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="navPriceColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `¥${val.toFixed(2)}`}
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                  orientation="right"
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a]/95 backdrop-blur-md p-3.5 border border-slate-800 rounded-xl space-y-2 text-xs font-mono shadow-2xl">
                          <p className="text-slate-400 font-sans font-semibold border-b border-white/5 pb-1 mb-1">{label}</p>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-400">参考预估净值:</span>
                            <span className="text-white font-extrabold">¥{data.price.toFixed(4)}</span>
                          </div>
                          {data.buys && data.buys.length > 0 && (
                            <div className="border-t border-emerald-500/20 pt-1.5 mt-1.5 space-y-1">
                              {data.buys.map((b: any, idx: number) => (
                                <div key={idx} className="text-[#10b981] text-[11px] font-sans font-medium flex items-center gap-1">
                                  <span>🟢 [我的买入] </span>
                                  <span className="font-mono font-bold text-slate-200">{b.shares.toFixed(4)} 份</span>
                                  <span>@ ¥{b.price.toFixed(4)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {data.sells && data.sells.length > 0 && (
                            <div className="border-t border-red-500/20 pt-1.5 mt-1.5 space-y-1">
                              {data.sells.map((s: any, idx: number) => (
                                <div key={idx} className="text-[#ef4444] text-[11px] font-sans font-medium flex items-center gap-1">
                                  <span>🔴 [我的卖出] </span>
                                  <span className="font-mono font-bold text-slate-200">{s.shares.toFixed(4)} 份</span>
                                  <span>@ ¥{s.price.toFixed(4)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#10b981" 
                  strokeWidth={1.8}
                  fillOpacity={1} 
                  fill="url(#navPriceColor)" 
                  name="参考净值走势"
                />
                <Line 
                  type="monotone" 
                  dataKey="buyPrice" 
                  stroke="none" 
                  dot={{ r: 6, fill: '#10b981', stroke: '#1c1917', strokeWidth: 1.5 }} 
                  name="买入交易点" 
                />
                <Line 
                  type="monotone" 
                  dataKey="sellPrice" 
                  stroke="none" 
                  dot={{ r: 6, fill: '#ef4444', stroke: '#1c1917', strokeWidth: 1.5 }} 
                  name="卖出交易点" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Pencil className="text-emerald-400" size={16} />
                <h3 className="font-bold text-sm text-white font-sans">修改历史交易记录</h3>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-white bg-slate-800/40 p-1.5 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              {/* Type and isSip checkbox row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">动作类型</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BUY">买入 (BUY)</option>
                    <option value="SELL">卖出 (SELL)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5 pl-2">
                  <input
                    type="checkbox"
                    id="editIsSip"
                    checked={editIsSip}
                    onChange={(e) => setEditIsSip(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-800 border-slate-700 mr-2 accent-emerald-400"
                  />
                  <label htmlFor="editIsSip" className="text-[10px] text-slate-400 font-semibold cursor-pointer select-none">🔄 划归为定投交易</label>
                </div>
              </div>

              {/* Date and Ticker row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">过账日期</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">交易代码</label>
                  <input
                    value={editSymbol}
                    onChange={(e) => setEditSymbol(e.target.value)}
                    placeholder="如 513100"
                    className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Amount, rate, custom fee inputs */}
              {editType === 'BUY' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">申购总额 (元)</label>
                    <input
                      type="number"
                      step="any"
                      value={editAmount}
                      onChange={(e) => {
                        setEditAmount(e.target.value);
                        handleEditRecalculate(e.target.value, editFeeRate, editPrice, undefined, editSymbol);
                      }}
                      className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">费率 (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={editFeeRate}
                      onChange={(e) => {
                        setEditFeeRate(e.target.value);
                        handleEditRecalculate(editAmount, e.target.value, editPrice, undefined, editSymbol);
                      }}
                      className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">手续费 (元)</label>
                    <input
                      type="number"
                      step="any"
                      value={editFee}
                      onChange={(e) => {
                        setEditFee(e.target.value);
                        handleEditRecalculate(editAmount, editFeeRate, editPrice, e.target.value, editSymbol);
                      }}
                      className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Price, Shares, Fee inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1 flex items-center justify-between">
                    <span>成交单价/净值 (¥)</span>
                    {isOtcSymbol(editSymbol) && (
                      <button
                        type="button"
                        disabled={isEditSyncingNav}
                        onClick={handleEditQueryNav}
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors disabled:opacity-50"
                      >
                        {isEditSyncingNav ? '查询中...' : '🔍 联网确权净值'}
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editPrice}
                    onChange={(e) => {
                      setEditPrice(e.target.value);
                      handleEditRecalculate(editAmount, editFeeRate, e.target.value, editFee, editSymbol);
                    }}
                    className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">
                    成交/确权份额 (份)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editShares}
                    onChange={(e) => setEditShares(e.target.value)}
                    placeholder="可输入进行手动纠错"
                    className="w-full bg-black/40 border border-slate-700 border-dashed rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {editType === 'SELL' && (
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold block mb-1">手续费用 (元)</label>
                  <input
                    type="number"
                    step="any"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Quick calculations display */}
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1 font-mono text-[10px] text-slate-400">
                {editType === 'BUY' ? (
                  <>
                    <div className="flex justify-between">
                      <span>入账支付金额 (A):</span>
                      <span className="text-white font-bold">¥{parseFloat(editAmount || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>损耗服务费 (开销 R%):</span>
                      <span className="text-yellow-400">¥{parseFloat(editFee || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>实投资确认额 (A - F):</span>
                      <span className="text-emerald-400 font-bold">¥{Math.max(0, parseFloat(editAmount || '0') - parseFloat(editFee || '0')).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                      <span>计算总成交增量值:</span>
                      <span className="text-white">{(parseFloat(editShares) || 0).toFixed(isOtcSymbol(editSymbol) ? 2 : 4)} 份</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>成交总对价:</span>
                      <span className="text-white font-bold">¥{((parseFloat(editPrice)||0) * (parseFloat(editShares)||0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>服务扣税息 (F):</span>
                      <span className="text-red-400">¥{parseFloat(editFee || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                      <span>销户实落袋金额:</span>
                      <span className="text-white">¥{Math.max(0, ((parseFloat(editPrice)||0) * (parseFloat(editShares)||0)) - parseFloat(editFee || '0')).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2 rounded-xl transition-all shadow-md active:scale-95 text-xs"
              >
                保存修改
              </button>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl transition-all text-xs"
              >
                放弃修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认场外买入成交价与折算份额 Modal */}
      {confirmingPendingRecord && (() => {
        const record = confirmingPendingRecord;
        const matchedEtf = findEtfBySymbol(record.symbol);
        const netPrincipal = (record.pendingAmount || 0) - record.fee;
        const priceVal = parseFloat(pendingConfirmPrice);
        const computedS = !isNaN(priceVal) && priceVal > 0 ? (netPrincipal / priceVal) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Check className="text-yellow-400" size={16} />
                  <h3 className="font-bold text-sm text-white font-sans">确认场外成交净值</h3>
                </div>
                <button 
                  onClick={() => setConfirmingPendingRecord(null)}
                  className="text-slate-400 hover:text-white bg-slate-800/40 p-1.5 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">标的代码 / 名称:</span>
                    <span className="text-white font-semibold font-mono">{record.symbol} {matchedEtf?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">扣款过账日期:</span>
                    <span className="text-white font-semibold font-mono">{record.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">扣划总本金:</span>
                    <span className="text-yellow-400 font-bold font-mono">¥{(record.pendingAmount || 0).toFixed(2)} 元</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">扣划损耗佣金:</span>
                    <span className="text-slate-300 font-mono">¥{record.fee.toFixed(4)} 元</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1.5">
                    <span className="text-slate-400 font-medium">确认实投本金:</span>
                    <span className="text-emerald-400 font-bold font-mono">¥{netPrincipal.toFixed(4)} 元</span>
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="text-[11px] text-slate-400 font-semibold uppercase block">输入确认时成交单元净值 (元)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.0001"
                      value={pendingConfirmPrice}
                      onChange={e => setPendingConfirmPrice(e.target.value)}
                      placeholder="例如 1.2345"
                      className="flex-1 bg-black/40 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-yellow-500"
                    />
                    {matchedEtf && matchedEtf.price && (
                      <button
                        type="button"
                        onClick={() => setPendingConfirmPrice(String(matchedEtf.price))}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 font-semibold text-[11px] px-3 py-2 rounded-lg transition-colors"
                      >
                        填实时最新价
                      </button>
                    )}
                  </div>
                  {matchedEtf && matchedEtf.price && (
                    <span className="text-[10px] text-slate-500 font-mono block">
                      💡 当前最新实时价预测参考: ¥{matchedEtf.price} (净值一般在当夜20点前公布完毕)
                    </span>
                  )}
                </div>

                <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/15 flex justify-between font-mono text-xs">
                  <span className="text-yellow-500 font-semibold">折算实得份额:</span>
                  <span className="text-white font-extrabold text-sm">{computedS.toFixed(4)} 份</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleConfirmPendingRecord}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
                >
                  确认对账入账
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingPendingRecord(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-all text-xs"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
