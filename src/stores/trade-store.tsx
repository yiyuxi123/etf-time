import { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from 'react';
import type { TradeRecord, GroupMode } from '../types';

// localStorage key 与跨组件同步事件名 —— 必须与现有组件保持一致，否则会破坏
// App.tsx / PositionAdviceCard / FundSettingsModal / SipPlanner 对交易记录的读取与监听。
const STORAGE_KEY = 'etf_trading_journal';
const SYNC_EVENT = 'trading_journal_updated';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TradeFilters {
  symbol: string; // 'ALL' 或具体代码
  type: 'ALL' | 'BUY' | 'SELL' | 'SIP' | 'PENDING';
  sortBy: 'time-desc' | 'time-asc' | 'symbol' | 'type';
  groupMode: GroupMode;
}

export interface NavSyncLog {
  id: string;
  message: string;
  type: 'syncing' | 'success' | 'error';
}

interface TradeState {
  records: TradeRecord[];
  filters: TradeFilters;
  navSyncLogs: NavSyncLog[];
  loaded: boolean;
}

const initialState: TradeState = {
  records: [],
  filters: { symbol: 'ALL', type: 'ALL', sortBy: 'time-desc', groupMode: 'category' },
  navSyncLogs: [],
  loaded: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type TradeAction =
  | { type: 'LOAD'; records: TradeRecord[] }
  | { type: 'SET_RECORDS'; records: TradeRecord[] }
  | { type: 'ADD'; record: TradeRecord }
  | { type: 'UPDATE'; id: string; patch: Partial<TradeRecord> }
  | { type: 'DELETE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'SET_FILTER'; patch: Partial<TradeFilters> }
  | { type: 'UPSERT_NAV_LOG'; log: NavSyncLog }
  | { type: 'REMOVE_NAV_LOG'; id: string };

function reducer(state: TradeState, action: TradeAction): TradeState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, records: action.records, loaded: true };
    case 'SET_RECORDS':
      return { ...state, records: action.records };
    case 'ADD':
      return { ...state, records: [...state.records, action.record] };
    case 'UPDATE':
      return {
        ...state,
        records: state.records.map(r => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case 'DELETE':
      return { ...state, records: state.records.filter(r => r.id !== action.id) };
    case 'CLEAR':
      return { ...state, records: [] };
    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case 'UPSERT_NAV_LOG': {
      const rest = state.navSyncLogs.filter(l => l.id !== action.log.id);
      return { ...state, navSyncLogs: [...rest, action.log] };
    }
    case 'REMOVE_NAV_LOG':
      return { ...state, navSyncLogs: state.navSyncLogs.filter(l => l.id !== action.id) };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 持久化：records 变化即写 localStorage 并广播同步事件。
// 监听 trading_journal_updated 事件以接收 SipPlanner 等其它写入方的变更。
// ---------------------------------------------------------------------------

function persist(records: TradeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch (e) {
    console.error('Failed to persist trading journal:', e);
  }
}

function loadFromStorage(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TradeRecord[];
  } catch (e) {
    console.error('Failed to load trading journal:', e);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TradeStoreValue {
  state: TradeState;
  dispatch: Dispatch<TradeAction>;
  // 便捷 action
  addRecord: (r: TradeRecord) => void;
  updateRecord: (id: string, patch: Partial<TradeRecord>) => void;
  deleteRecord: (id: string) => void;
  clearRecords: () => void;
  setRecords: (rs: TradeRecord[]) => void;
  setFilter: (patch: Partial<TradeFilters>) => void;
}

const TradeStoreContext = createContext<TradeStoreValue | null>(null);

export function TradeStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 初始加载 + 监听跨组件同步事件
  useEffect(() => {
    dispatch({ type: 'LOAD', records: loadFromStorage() });
    const onSync = () => dispatch({ type: 'SET_RECORDS', records: loadFromStorage() });
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  // records 变化即持久化（首次 LOAD 不触发写，避免无意义覆盖）
  useEffect(() => {
    if (state.loaded) persist(state.records);
  }, [state.records, state.loaded]);

  const value: TradeStoreValue = {
    state,
    dispatch,
    addRecord: r => dispatch({ type: 'ADD', record: r }),
    updateRecord: (id, patch) => dispatch({ type: 'UPDATE', id, patch }),
    deleteRecord: id => dispatch({ type: 'DELETE', id }),
    clearRecords: () => dispatch({ type: 'CLEAR' }),
    setRecords: rs => dispatch({ type: 'SET_RECORDS', records: rs }),
    setFilter: patch => dispatch({ type: 'SET_FILTER', patch }),
  };

  return <TradeStoreContext.Provider value={value}>{children}</TradeStoreContext.Provider>;
}

export function useTradeStore(): TradeStoreValue {
  const ctx = useContext(TradeStoreContext);
  if (!ctx) throw new Error('useTradeStore must be used within TradeStoreProvider');
  return ctx;
}

// 导出常量供非 hook 调用方（如 SipPlanner 迁移期）继续复用同一 key/事件。
export { STORAGE_KEY as TRADE_JOURNAL_KEY, SYNC_EVENT as TRADE_JOURNAL_SYNC_EVENT };
