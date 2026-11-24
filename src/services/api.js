import axios from 'axios';
import { getToken } from '../utils/secureStorage';

// Same server as the customer app.
export const SERVER_URL = 'https://mrburgersomalia.com';
const API_URL = `${SERVER_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Called when the server says the session is no longer valid (expired / revoked token).
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) { /* no token available: request goes out unauthenticated and gets a 401 */ }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    // Weak connection: quietly retry READ requests twice (never writes, so nothing is ever done twice).
    const cfg = error?.config;
    const transient = (!error?.response && (error?.code === 'ECONNABORTED' || error?.message === 'Network Error')) || [502, 503, 504].includes(error?.response?.status);
    if (cfg && String(cfg.method || '').toLowerCase() === 'get' && transient && (cfg.__retries || 0) < 2) {
      cfg.__retries = (cfg.__retries || 0) + 1;
      await new Promise((r) => setTimeout(r, 900 * cfg.__retries));
      return api.request(cfg);
    }
    const url = error?.config?.url || '';
    if (error?.response?.status === 401 && !url.includes('/auth/login') && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// --- AUTH ---
export const loginDriver = (data) => api.post('/auth/login', data);
export const requestOtp = (phone_number, purpose = 'PASSWORD_RESET') => api.post('/auth/otp/request', { phone_number, purpose });
export const resetPassword = (phone_number, code, new_password) => api.post('/auth/reset-password', { phone_number, code, new_password });

// --- DRIVER ORDERS (new endpoints: need backend update) ---
export const getActiveOrders = () => api.get('/app/driver/orders');
export const getMyOrder = (id) => api.get(`/app/driver/orders/${id}`);
export const getHistory = (params) => api.get('/app/driver/history', { params });
export const getReport = (period) => api.get('/app/driver/report', { params: { period } });

export const setOnlineStatus = (online) => api.put('/app/driver/online', { online });
export const acceptOrder = (id) => api.post(`/app/driver/orders/${id}/accept`);
export const declineOrder = (id, reason) => api.post(`/app/driver/orders/${id}/decline`, { reason });
export const getSettlements = () => api.get('/app/driver/settlements');

export const updateOrderStatus = (orderId, status, extra = {}) => api.put(`/orders/${orderId}/status`, { status, ...extra });
export const uploadDeliveryPhoto = (orderId, image_base64) => api.post(`/orders/${orderId}/delivery-photo`, { image_base64 }, { timeout: 60000 });

// --- LOCATION (also broadcasts to the customer's tracking screen) ---
export const updateDriverLocation = (lat, lng, orderId) =>
  api.put('/orders/driver/location', { lat, lng, order_id: orderId }, { timeout: 8000 });

// --- PROFILE ---
export const getProfile = () => api.get('/users/profile');
export const updateProfile = (data) => api.put('/users/profile', data);
export const changePassword = (data) => api.put('/users/change-password', data);
export const savePushToken = (expo_push_token) => api.put('/users/push-token', { expo_push_token });

export default api;
