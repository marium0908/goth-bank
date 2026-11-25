import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BankTransaction } from '../../types/banking';

interface TransactionFilterState {
  search: string;
  txType: string;
  status: string;
  flaggedOnly: boolean;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
  selectedTransaction: BankTransaction | null;
}

const initialState: TransactionFilterState = {
  search: '',
  txType: '',
  status: '',
  flaggedOnly: false,
  startDate: '',
  endDate: '',
  page: 1,
  limit: 10,
  selectedTransaction: null,
};

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    setTxSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
    },
    setTxTypeFilter(state, action: PayloadAction<string>) {
      state.txType = action.payload;
      state.page = 1;
    },
    setTxStatusFilter(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
    },
    setTxFlaggedOnly(state, action: PayloadAction<boolean>) {
      state.flaggedOnly = action.payload;
      state.page = 1;
    },
    setTxDateRange(state, action: PayloadAction<{ startDate: string; endDate: string }>) {
      state.startDate = action.payload.startDate;
      state.endDate = action.payload.endDate;
      state.page = 1;
    },
    setTxPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    setSelectedTransaction(state, action: PayloadAction<BankTransaction | null>) {
      state.selectedTransaction = action.payload;
    },
    resetTxFilters(state) {
      state.search = '';
      state.txType = '';
      state.status = '';
      state.flaggedOnly = false;
      state.startDate = '';
      state.endDate = '';
      state.page = 1;
    },
  },
});

export const {
  setTxSearch,
  setTxTypeFilter,
  setTxStatusFilter,
  setTxFlaggedOnly,
  setTxDateRange,
  setTxPage,
  setSelectedTransaction,
  resetTxFilters,
} = transactionSlice.actions;
export default transactionSlice.reducer;
