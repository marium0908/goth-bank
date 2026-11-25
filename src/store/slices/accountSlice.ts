import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AccountState {
  selectedAccountId: number | null;
  searchQuery: string;
  statusFilter: string;
}

const initialState: AccountState = {
  selectedAccountId: null,
  searchQuery: '',
  statusFilter: '',
};

const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    setSelectedAccountId(state, action: PayloadAction<number | null>) {
      state.selectedAccountId = action.payload;
    },
    setAccountSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setAccountStatusFilter(state, action: PayloadAction<string>) {
      state.statusFilter = action.payload;
    },
    resetAccountFilters(state) {
      state.selectedAccountId = null;
      state.searchQuery = '';
      state.statusFilter = '';
    },
  },
});

export const {
  setSelectedAccountId,
  setAccountSearchQuery,
  setAccountStatusFilter,
  resetAccountFilters,
} = accountSlice.actions;
export default accountSlice.reducer;
