import { createContext, useContext, useEffect, useReducer, useCallback, type ReactNode, type Dispatch } from 'react';
import { queryFundNav, readNavDb } from '../services/nav-service';
import type { NavQueryResult } from '../types';

// 查询状态键：symbol|date
const qkey = (symbol: string, date: string) => `${symbol}|${date.split('T')[0]}`;

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface QueryEntry {
  status: QueryStatus;
  result: NavQueryResult | null;
  error: string | null;
}

interface NavState {
  queries: Record<string, QueryEntry>;
}

const initialState: NavState = { queries: {} };

type NavAction =
  | { type: 'SET_LOADING'; key: string }
  | { type: 'SET_SUCCESS'; key: string; result: NavQueryResult }
  | { type: 'SET_ERROR'; key: string; error: string };

function reducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, queries: { ...state.queries, [action.key]: { status: 'loading', result: null, error: null } } };
    case 'SET_SUCCESS':
      return { ...state, queries: { ...state.queries, [action.key]: { status: 'success', result: action.result, error: null } } };
    case 'SET_ERROR':
      return { ...state, queries: { ...state.queries, [action.key]: { status: 'error', result: null, error: action.error } } };
    default:
      return state;
  }
}

interface NavStoreValue {
  state: NavState;
  dispatch: Dispatch<NavAction>;
  /** 触发净值查询，返回结果并更新响应式状态。 */
  queryNav: (symbol: string, date: string) => Promise<NavQueryResult>;
  /** 读某 symbol+date 的查询状态（未查询过则 idle）。 */
  getQuery: (symbol: string, date: string) => QueryEntry;
  /** 直接读 nav_db 缓存中的净值（不触发网络查询）。 */
  getCachedNav: (symbol: string, date: string) => number | null;
}

const NavStoreContext = createContext<NavStoreValue | null>(null);

export function NavStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const queryNav = useCallback(async (symbol: string, date: string): Promise<NavQueryResult> => {
    const key = qkey(symbol, date);
    dispatch({ type: 'SET_LOADING', key });
    try {
      const result = (await queryFundNav(symbol, date)) as NavQueryResult;
      dispatch({ type: 'SET_SUCCESS', key, result });
      return result;
    } catch (e: any) {
      const msg = e?.message || '查询失败';
      dispatch({ type: 'SET_ERROR', key, error: msg });
      throw e;
    }
  }, []);

  const getQuery = useCallback(
    (symbol: string, date: string): QueryEntry => {
      return state.queries[qkey(symbol, date)] || { status: 'idle', result: null, error: null };
    },
    [state.queries],
  );

  const getCachedNav = useCallback((symbol: string, date: string): number | null => {
    const db = readNavDb();
    const clean = symbol.toUpperCase().replace('F_', '').replace('SH', '').replace('SZ', '').trim();
    const d = date.split('T')[0];
    return db[clean]?.[d]?.nav ?? null;
  }, []);

  const value: NavStoreValue = { state, dispatch, queryNav, getQuery, getCachedNav };

  return <NavStoreContext.Provider value={value}>{children}</NavStoreContext.Provider>;
}

export function useNavStore(): NavStoreValue {
  const ctx = useContext(NavStoreContext);
  if (!ctx) throw new Error('useNavStore must be used within NavStoreProvider');
  return ctx;
}
