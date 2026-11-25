import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { bankingApi } from './api/bankingApi';
import accountReducer from './slices/accountSlice';
import authReducer from './slices/authSlice';
import loanReducer from './slices/loanSlice';
import transactionReducer from './slices/transactionSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    account: accountReducer,
    transaction: transactionReducer,
    loan: loanReducer,
    ui: uiReducer,
    [bankingApi.reducerPath]: bankingApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(bankingApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
