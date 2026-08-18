import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Ensure this matches your actual backend IP/URL
const API_URL = 'http://192.145.173.109:5000/api'; 

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ✅ PRODUCTION-READY: Axios Interceptor to automatically attach the token
// This prevents "undefined" token errors and cleans up your function calls.
api.interceptors.request.use(
  async (config) => {
    try {
      // ⚠️ CRITICAL: Ensure 'driverToken' matches the EXACT key used in your Driver Login screen!
      // If your login screen saves it as 'token' or 'authToken', change 'driverToken' to match.
      const token = await AsyncStorage.getItem('driverToken'); 
      
      if (token && token !== 'undefined' && token !== 'null') {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('⚠️ [API Interceptor] No valid driver token found in storage!');
      }
    } catch (error) {
      console.error('❌ [API Interceptor] Error reading token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- AUTH ---
export const loginDriver = (data) => api.post('/auth/login', data);

// --- DRIVER ORDERS ---
// Note: No need to pass `token` manually anymore! The interceptor handles it.
// ⚠️ Ensure this route matches your backend `order.routes.js` exactly (e.g., '/drivers/my-orders')
export const getDriverOrders = () => api.get('/orders/driver/my-orders');

export const updateOrderStatus = (orderId, status) => api.put(`/orders/${orderId}/status`, { status });

// --- DRIVER LOCATION ---
// Added order_id so the backend can broadcast to the specific customer's map via Socket.io
export const updateDriverLocation = (lat, lng, orderId) => api.put('/orders/driver/location', { 
  lat, 
  lng, 
  order_id: orderId 
});

export const getDriverStats = () => api.get('/orders/driver/stats');

export const getDriverOrderHistory = (status = 'all') => 
  api.get(`/orders/driver/order-history?status=${status}`);

export default api;