import { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from 'react';
import type { SipPlan } from '../types';

const STORAGE_KEY = 'etf_sip_plans';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface SipState {
  plans: SipPlan[];
  loaded: boolean;
}

const initialState: SipState = { plans: [], loaded: false };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SipAction =
  | { type: 'LOAD'; plans: SipPlan[] }
  | { type: 'SET_PLANS'; plans: SipPlan[] }
  | { type: 'ADD'; plan: SipPlan }
  | { type: 'UPDATE'; id: string; patch: Partial<SipPlan> }
  | { type: 'DELETE'; id: string }
  | { type: 'CLEAR' };

function reducer(state: SipState, action: SipAction): SipState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, plans: action.plans, loaded: true };
    case 'SET_PLANS':
      return { ...state, plans: action.plans };
    case 'ADD':
      return { ...state, plans: [...state.plans, action.plan] };
    case 'UPDATE':
      return {
        ...state,
        plans: state.plans.map(p => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'DELETE':
      return { ...state, plans: state.plans.filter(p => p.id !== action.id) };
    case 'CLEAR':
      return { ...state, plans: [] };
    default:
      return state;
  }
}

function persist(plans: SipPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    localStorage.setItem('local_last_updated', new Date().toISOString());
  } catch (e) {
    console.error('Failed to persist sip plans:', e);
  }
}

function loadFromStorage(): SipPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SipPlan[];
  } catch (e) {
    console.error('Failed to load sip plans:', e);
  }
  return [];
}

interface SipStoreValue {
  state: SipState;
  dispatch: Dispatch<SipAction>;
  addPlan: (p: SipPlan) => void;
  updatePlan: (id: string, patch: Partial<SipPlan>) => void;
  deletePlan: (id: string) => void;
  setPlans: (ps: SipPlan[]) => void;
  clearPlans: () => void;
}

const SipStoreContext = createContext<SipStoreValue | null>(null);

export function SipStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: 'LOAD', plans: loadFromStorage() });
  }, []);

  useEffect(() => {
    if (state.loaded) persist(state.plans);
  }, [state.plans, state.loaded]);

  const value: SipStoreValue = {
    state,
    dispatch,
    addPlan: p => dispatch({ type: 'ADD', plan: p }),
    updatePlan: (id, patch) => dispatch({ type: 'UPDATE', id, patch }),
    deletePlan: id => dispatch({ type: 'DELETE', id }),
    setPlans: ps => dispatch({ type: 'SET_PLANS', plans: ps }),
    clearPlans: () => dispatch({ type: 'CLEAR' }),
  };

  return <SipStoreContext.Provider value={value}>{children}</SipStoreContext.Provider>;
}

export function useSipStore(): SipStoreValue {
  const ctx = useContext(SipStoreContext);
  if (!ctx) throw new Error('useSipStore must be used within SipStoreProvider');
  return ctx;
}

export { STORAGE_KEY as SIP_PLANS_KEY };
