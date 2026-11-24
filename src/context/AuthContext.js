import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginDriver, getProfile, setUnauthorizedHandler, setOnlineStatus } from '../services/api';
import { saveToken, getToken, deleteToken } from '../utils/secureStorage';
import { registerForPushNotifications } from '../services/notifications';
import { stopTracking } from '../services/locationTracker';

const AuthContext = createContext();
const USER_KEY = 'userData';

const decodeJWT = (token) => {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);   // only for the first app start
  const [signingIn, setSigningIn] = useState(false);

  const logout = useCallback(async () => {
    try { await setOnlineStatus(false); } catch (e) { /* best effort */ }
    try { await stopTracking(); } catch (e) { /* ignore */ }
    await deleteToken().catch(() => {});
    await AsyncStorage.multiRemove([USER_KEY, 'mrb_tracked_order_ids', 'mrb_driver_online']).catch(() => {});
    setUser(null);
  }, []);

  // Any 401 from the server means the session is over.
  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const cached = await AsyncStorage.getItem(USER_KEY);
        if (token && cached) {
          const exp = decodeJWT(token)?.exp;
          if (exp && exp * 1000 < Date.now()) {
            await logout();
          } else {
            setUser(JSON.parse(cached));          // open the app immediately, even offline
            registerForPushNotifications();
            // Refresh the profile quietly; a 401 logs out via the handler, network errors are ignored.
            getProfile().then((r) => {
              const fresh = r?.data?.data;
              if (fresh?.name) {
                setUser((u) => {
                  const merged = { ...u, name: fresh.name };
                  AsyncStorage.setItem(USER_KEY, JSON.stringify(merged)).catch(() => {});
                  return merged;
                });
              }
            }).catch(() => {});
          }
        }
      } catch (e) {
        // A storage hiccup must not wipe the saved login
      } finally {
        setLoading(false);
      }
    })();
  }, [logout]);

  const login = async (phoneNumber, password) => {
    setSigningIn(true);
    try {
      const response = await loginDriver({ phone_number: String(phoneNumber).trim(), password });
      if (!response.data.success) return { success: false, message: response.data.message || 'Login failed' };
      const { user: u, token } = response.data.data;
      if (u?.role && u.role !== 'driver') {
        return { success: false, message: 'This account is not a driver account.' };
      }
      await saveToken(token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
      registerForPushNotifications();
      return { success: true };
    } catch (error) {
      if (error.response?.data?.message) return { success: false, message: error.response.data.message };
      if (error.code === 'ECONNABORTED') return { success: false, message: 'The server took too long to respond. Try again.' };
      return { success: false, message: 'Cannot reach the server. Check your internet connection.' };
    } finally {
      setSigningIn(false);
    }
  };

  const updateUserData = async (fields) => {
    setUser((prev) => {
      const next = { ...prev, ...fields };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signingIn, login, logout, updateUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
