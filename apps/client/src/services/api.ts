// ============================================================
// TELECAL — API CLIENT
// Axios instance with:
//  - Automatic token refresh on 401
//  - Consistent error handling
//  - Request/response logging in dev
// ============================================================

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send cookies (httpOnly auth tokens)
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Token refresh state ──────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(null);
  });
  refreshQueue = [];
};

// ─── Response interceptor ─────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 — attempt silent token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Extract error message from our API response shape
    const apiError = error.response?.data as {
      error?: { message?: string; code?: string };
    } | undefined;

    const message = apiError?.error?.message ?? error.message ?? 'An error occurred';
    const code = apiError?.error?.code;

    // Don't toast on 401/403 — handled by redirect or auth state
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      // Only toast server errors that aren't validation errors
      if (code !== 'VALIDATION_ERROR') {
        toast.error(message, { id: `api-error-${code ?? 'unknown'}` });
      }
    }

    return Promise.reject({ message, code, status: error.response?.status });
  },
);

// ─── Typed request helpers ────────────────────────────────────

export const apiGet = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<{ success: true; data: T }>(url, { params }).then((r) => r.data.data);

export const apiPost = <T>(url: string, data?: unknown) =>
  api.post<{ success: true; data: T; message?: string }>(url, data).then((r) => r.data);

export const apiPatch = <T>(url: string, data?: unknown) =>
  api.patch<{ success: true; data: T; message?: string }>(url, data).then((r) => r.data);

export const apiDelete = <T>(url: string) =>
  api.delete<{ success: true; data: T }>(url).then((r) => r.data.data);
