import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginDriver } from '../services/api';

const AuthContext = createContext();

// ✅ Built-in JWT decoder (no external package needed!)
// JWT format: header.payload.signature (all base64 encoded)
const decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Base64 decode the payload (middle part)
    const payload = parts[1];
    // Add padding if needed for proper base64 decoding
    const paddedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(paddedPayload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('❌ JWT decode error:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        console.log('🏁 Checking stored auth...');
        const storedToken = await AsyncStorage.getItem('driverToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        if (storedToken && storedUser) {
          console.log('📦 Stored token: Found');
          console.log('📦 Stored user: Found');
          
          // ✅ CRITICAL FIX: Check if token is expired before auto-login
          const decoded = decodeJWT(storedToken);
          
          if (decoded && decoded.exp) {
            const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
            
            if (decoded.exp < currentTime) {
              console.log('⚠️ Token is EXPIRED. Clearing storage and showing login...');
              console.log(`   Expired at: ${new Date(decoded.exp * 1000).toLocaleString()}`);
              console.log(`   Current time: ${new Date(currentTime * 1000).toLocaleString()}`);
              await AsyncStorage.clear();
              setUser(null);
              setToken(null);
              setLoading(false);
              return;
            }
            
            const expiresIn = Math.floor((decoded.exp - currentTime) / 3600);
            console.log(`✅ Token is valid. Auto-login successful. Expires in ${expiresIn} hours.`);
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            console.log('❌ Token is corrupted or unreadable. Clearing storage...');
            await AsyncStorage.clear();
            setUser(null);
            setToken(null);
          }
        } else {
          console.log('ℹ️ No stored auth found. Showing login screen.');
        }
      } catch (error) {
        console.error('Failed to load auth state', error);
        await AsyncStorage.clear();
        setUser(null);
        setToken(null);
      } finally {
        console.log('🔄 Setting loading to false');
        setLoading(false);
      }
    };
    checkStoredAuth();
  }, []);

  const login = async (phoneNumber, password) => {
    try {
      setLoading(true);
      const response = await loginDriver({ phone_number: phoneNumber, password });
      
      if (response.data.success) {
        const userData = response.data.data.user;
        const authToken = response.data.data.token;
        
        setUser(userData);
        setToken(authToken);
        
        await AsyncStorage.setItem('driverToken', authToken);
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        
        console.log('✅ Login successful! Fresh token saved.');
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      console.error('💥 Login error:', error);
      return { success: false, message: error.response?.data?.message || 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setUser(null);
    setToken(null);
    console.log('👋 Logged out successfully.');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);