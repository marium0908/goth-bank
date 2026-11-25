import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface LoanSliceState {
  selectedLoanId: number | null;
  statusFilter: string;
}

const initialState: LoanSliceState = {
  selectedLoanId: null,
  statusFilter: '',
};

const loanSlice = createSlice({
  name: 'loan',
  initialState,
  reducers: {
    setSelectedLoanId(state, action: PayloadAction<number | null>) {
      state.selectedLoanId = action.payload;
    },
    setLoanStatusFilter(state, action: PayloadAction<string>) {
      state.statusFilter = action.payload;
    },
  },
});

export const { setSelectedLoanId, setLoanStatusFilter } = loanSlice.actions;
export default loanSlice.reducer;
