import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/banking';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  hydrated: false,
  error: null,
};

async function parseAuthResponse(res: Response): Promise<Record<string, unknown> | null> {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const hydrateSession = createAsyncThunk<
  { user: User; token: string } | null,
  void
>('auth/hydrateSession', async () => {
  try {
    const res = await fetch('/api/auth/me', { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await parseAuthResponse(res);
    if (!data || !data.user || typeof data.token !== 'string') return null;
    return data as unknown as { user: User; token: string };
  } catch {
    return null;
  }
});

export const loginUser = createAsyncThunk<
  { user: User; token: string },
  { email: string; password: string },
  { rejectValue: string }
>('auth/loginUser', async (credentials, { rejectWithValue }) => {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(credentials),
    });
    const data = await parseAuthResponse(res);
    if (!res.ok || !data) {
      const serverErr = typeof data?.error === 'string' ? data.error : '';
      return rejectWithValue(serverErr || `Authentication failed (HTTP ${res.status}).`);
    }
    return data as unknown as { user: User; token: string };
  } catch {
    return rejectWithValue('Unable to reach the banking server. Please check that the server is running.');
  }
});

export const registerCustomer = createAsyncThunk<
  { user: User; token: string },
  {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    password: string;
    pin: string;
  },
  { rejectValue: string }
>('auth/registerCustomer', async (payload, { rejectWithValue }) => {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await parseAuthResponse(res);
    if (!res.ok || !data) {
      const serverErr = typeof data?.error === 'string' ? data.error : '';
      return rejectWithValue(serverErr || `Registration failed (HTTP ${res.status}).`);
    }
    return data as unknown as { user: User; token: string };
  } catch {
    return rejectWithValue('Unable to reach the banking server. Please check that the server is running.');
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Clear local state regardless of network result
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.error = null;
      state.loading = false;
      state.hydrated = true;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.hydrated = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
        }
      })
      .addCase(hydrateSession.rejected, (state) => {
        state.hydrated = true;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Sign-in failed.';
      })
      .addCase(registerCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(registerCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Registration failed.';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.error = null;
        state.loading = false;
        state.hydrated = true;
      });
  },
});

export const { logout, setUser, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
