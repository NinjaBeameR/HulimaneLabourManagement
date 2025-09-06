import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  workers: [],
  categories: [],
  subcategories: [],
  entries: [],
  payments: [],
  // Outbox / deferred SMS messages
  deferredMessages: [],
  openingBalances: {}, // { workerId: amount }
  isInitialized: false,
};

const GlobalStoreContext = createContext();

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ALL': return { ...state, ...action.payload };
    case 'REFRESH_DATA': return { ...state }; // Force re-render
    case 'ADD_WORKER': return { ...state, workers: [...state.workers, action.payload] };
    case 'UPDATE_WORKER': return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'DELETE_WORKER': return { ...state, workers: state.workers.filter(w => w.id !== action.payload) };
    case 'ADD_CATEGORY': return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY': return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CATEGORY': {
      const deletedId = action.payload;
      // remove the category
      const nextCategories = state.categories.filter(c => c.id !== deletedId);
      // update subcategories: remove reference to deleted category from categoryIds
      const nextSubcategories = state.subcategories.map(s => {
        if (s.categoryIds && Array.isArray(s.categoryIds)) {
          const ids = s.categoryIds.filter(id => id !== deletedId);
          return { ...s, categoryIds: ids };
        }
        if (s.categoryId && s.categoryId === deletedId) {
          return { ...s, categoryId: null, categoryIds: [] };
        }
        return s;
      }).filter(s => {
        // drop orphaned subcategories that no longer belong to any category
        const hasIds = (s.categoryIds && s.categoryIds.length > 0) || (s.categoryId);
        return hasIds;
      });
      return { ...state, categories: nextCategories, subcategories: nextSubcategories };
    }
    case 'ADD_SUBCATEGORY': return { ...state, subcategories: [...state.subcategories, action.payload] };
    case 'UPDATE_SUBCATEGORY': return { ...state, subcategories: state.subcategories.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SUBCATEGORY': return { ...state, subcategories: state.subcategories.filter(s => s.id !== action.payload) };
    case 'ADD_ENTRY': return { ...state, entries: [...state.entries, action.payload] };
    case 'UPDATE_ENTRY': return { ...state, entries: state.entries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_ENTRY': return { ...state, entries: state.entries.filter(e => e.id !== action.payload) };
    case 'ADD_PAYMENT': return { ...state, payments: [...state.payments, action.payload] };
    case 'UPDATE_PAYMENT': return { ...state, payments: state.payments.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PAYMENT': return { ...state, payments: state.payments.filter(p => p.id !== action.payload) };
  case 'ADD_DEFERRED_MESSAGE': return { ...state, deferredMessages: [...(state.deferredMessages || []), action.payload] };
  case 'UPDATE_DEFERRED_MESSAGE': return { ...state, deferredMessages: (state.deferredMessages || []).map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
  case 'DELETE_DEFERRED_MESSAGE': return { ...state, deferredMessages: (state.deferredMessages || []).filter(m => m.id !== action.payload) };
    case 'SET_OPENING_BALANCE': return { ...state, openingBalances: { ...state.openingBalances, ...action.payload } };
    default: return state;
  }
}

export function GlobalStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from AsyncStorage on mount and run a safe, idempotent migration if needed
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('globalStore');
        if (data) {
          const parsedData = JSON.parse(data);

          // If store already has a schemaVersion >= 1, assume normalized
          const currentVersion = parsedData.schemaVersion || 0;
          if (currentVersion >= 1) {
            dispatch({ type: 'SET_ALL', payload: { ...parsedData, isInitialized: true } });
            return;
          }

          // Backup original store before any changes (safe-guard)
          try {
            const backupKey = `globalStore_backup_${Date.now()}`;
            await AsyncStorage.setItem(backupKey, data);
          } catch (backupErr) {
            console.warn('Failed to write globalStore backup', backupErr);
            // continue even if backup fails
          }

          // Normalization helpers
          const toNumber = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          };

          const normalizeWorker = (w) => ({
            id: w.id,
            name: w.name || (w.fullName || 'Unknown'),
            openingBalance: toNumber(w.openingBalance ?? w.opening_balance ?? 0),
            // keep other fields untouched
            ...Object.keys(w).reduce((acc, k) => (['id','name','openingBalance','opening_balance','fullName'].includes(k) ? acc : { ...acc, [k]: w[k] }), {}),
          });

          const normalizeEntry = (e) => ({
            id: e.id || Date.now().toString(),
            workerId: e.workerId || e.worker_id || null,
            date: e.date || e.day || null,
            status: ['P','H','A'].includes(e.status) ? e.status : (e.status === 'Half' ? 'H' : (e.status === 'Present' ? 'P' : 'A')),
            categoryId: e.categoryId ?? e.category_id ?? null,
            subcategoryId: e.subcategoryId ?? e.subcategory_id ?? null,
            amount: toNumber(e.amount ?? e.amt ?? 0),
            narration: e.narration ?? e.notes ?? '',
            // preserve any other fields
            ...Object.keys(e).reduce((acc, k) => (['id','workerId','worker_id','date','day','status','categoryId','category_id','subcategoryId','subcategory_id','amount','amt','narration','notes'].includes(k) ? acc : { ...acc, [k]: e[k] }), {}),
          });

          const normalizePayment = (p) => ({
            id: p.id || Date.now().toString(),
            workerId: p.workerId || p.worker_id || null,
            date: p.date || p.day || null,
            amount: toNumber(p.amount ?? p.amt ?? 0),
            paymentType: p.paymentType || p.type || 'Cash',
            notes: p.notes ?? p.narration ?? '',
            ...Object.keys(p).reduce((acc, k) => (['id','workerId','worker_id','date','day','amount','amt','paymentType','type','notes','narration'].includes(k) ? acc : { ...acc, [k]: p[k] }), {}),
          });

          const normalizeSubcategory = (s) => ({
            id: s.id,
            subcategoryName: s.subcategoryName || s.subcategory || '',
            // Ensure categoryIds is an array
            categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds : (s.categoryId ? [s.categoryId] : []),
            ...Object.keys(s).reduce((acc, k) => (['id','subcategoryName','subcategory','categoryIds','categoryId'].includes(k) ? acc : { ...acc, [k]: s[k] }), {}),
          });

          // Build normalized store with safe defaults
          const normalized = {
            workers: Array.isArray(parsedData.workers) ? parsedData.workers.map(normalizeWorker) : [],
            categories: Array.isArray(parsedData.categories) ? parsedData.categories : [],
            subcategories: Array.isArray(parsedData.subcategories) ? parsedData.subcategories.map(normalizeSubcategory) : [],
            entries: Array.isArray(parsedData.entries) ? parsedData.entries.map(normalizeEntry) : [],
            payments: Array.isArray(parsedData.payments) ? parsedData.payments.map(normalizePayment) : [],
            openingBalances: parsedData.openingBalances || {},
            schemaVersion: 1,
            isInitialized: true,
          };

          // Persist normalized store (overwrite) and load into app
          try {
            await AsyncStorage.setItem('globalStore', JSON.stringify(normalized));
          } catch (writeErr) {
            console.warn('Failed to write normalized globalStore', writeErr);
            // If write fails, still dispatch parsedData to avoid blocking the app
            dispatch({ type: 'SET_ALL', payload: { ...parsedData, isInitialized: true } });
            return;
          }

          dispatch({ type: 'SET_ALL', payload: normalized });
        } else {
          // First time - just mark as initialized with empty data
          dispatch({ type: 'SET_ALL', payload: { ...initialState, isInitialized: true } });
        }
      } catch (e) {
        console.log('Load error', e);
        // If error loading, start with empty data
        dispatch({ type: 'SET_ALL', payload: { ...initialState, isInitialized: true } });
      }
    })();
  }, []);

  // Persist to AsyncStorage on change (only after initialization)
  useEffect(() => {
    if (state.isInitialized) {
      AsyncStorage.setItem('globalStore', JSON.stringify(state)).catch(e => console.log('Save error', e));
    }
  }, [state]);

  // Refresh function to reload data from storage
  const refreshData = async () => {
    try {
      const data = await AsyncStorage.getItem('globalStore');
      if (data) {
        const parsedData = JSON.parse(data);
        dispatch({ type: 'SET_ALL', payload: parsedData });
      }
    } catch (e) {
      console.log('Refresh error', e);
    }
  };

  return (
    <GlobalStoreContext.Provider value={{ state, dispatch, refreshData }}>
      {children}
    </GlobalStoreContext.Provider>
  );
}

export function useGlobalStore() {
  return useContext(GlobalStoreContext);
}
