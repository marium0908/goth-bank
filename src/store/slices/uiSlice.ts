import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface UiState {
  activeSection: string;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  toast: ToastMessage | null;
}

const initialState: UiState = {
  activeSection: 'overview',
  theme: 'light',
  sidebarOpen: false,
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveSection(state, action: PayloadAction<string>) {
      state.activeSection = action.payload;
      state.sidebarOpen = false;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    showToast(state, action: PayloadAction<Omit<ToastMessage, 'id'>>) {
      state.toast = {
        ...action.payload,
        id: String(Date.now()),
      };
    },
    clearToast(state) {
      state.toast = null;
    },
  },
});

export const { setActiveSection, toggleTheme, setSidebarOpen, showToast, clearToast } =
  uiSlice.actions;
export default uiSlice.reducer;
