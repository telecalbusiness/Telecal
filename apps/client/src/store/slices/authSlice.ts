// ============================================================
// TELECAL — AUTH SLICE
// ============================================================

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRole } from '@mediconnect/shared';
import { apiGet, apiPost } from '../../services/api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
  isEmailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: false,
  isInitialized: false,
};

// ─── Thunks ───────────────────────────────────────────────────

export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async () => {
  const data = await apiGet<AuthUser>('/users/me');
  return data;
});

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }) => {
    await apiPost('/auth/login', credentials);
    const data = await apiGet<AuthUser>('/users/me');
    return data;
  },
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await apiPost('/auth/logout');
});

// ─── Slice ────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isInitialized = true;
    },
    clearAuth: (state) => {
      state.user = null;
    },
    setInitialized: (state) => {
      state.isInitialized = true;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    // fetchCurrentUser
    builder.addCase(fetchCurrentUser.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchCurrentUser.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isLoading = false;
      state.isInitialized = true;
    });
    builder.addCase(fetchCurrentUser.rejected, (state) => {
      state.user = null;
      state.isLoading = false;
      state.isInitialized = true;
    });

    // loginUser
    builder.addCase(loginUser.pending, (state) => { state.isLoading = true; });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isLoading = false;
    });
    builder.addCase(loginUser.rejected, (state) => { state.isLoading = false; });

    // logoutUser
    builder.addCase(logoutUser.fulfilled, (state) => { state.user = null; });
  },
});

export const { setUser, clearAuth, setInitialized } = authSlice.actions;
export default authSlice.reducer;
