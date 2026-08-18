import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ GUARANTEED FIX: Wipe old expired token when login screen loads
  useEffect(() => {
    const wipeOldToken = async () => {
      console.log('🧹 Wiping old storage to prevent 401 TokenExpiredError...');
      await AsyncStorage.multiRemove(['driverToken', 'token', 'userData', 'driverData']);
      console.log('✅ Old token wiped. Ready for fresh login.');
    };
    wipeOldToken();
  }, []);

  // ✅ NUCLEAR OPTION: Manually clear ALL AsyncStorage if the above fails
  const handleNuclearWipe = async () => {
    Alert.alert(
      'Clear App Cache',
      'This will delete all saved login data. You will need to log in again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Clear Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear(); // Nukes EVERYTHING in AsyncStorage
              console.log('💥 NUCLEAR WIPE COMPLETE. Storage is 100% empty.');
              Alert.alert('Success', 'Cache cleared! Please log in again with your credentials.');
            } catch (err) {
              console.error('Failed to clear storage:', err);
              Alert.alert('Error', 'Failed to clear cache.');
            }
          }
        }
      ]
    );
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Please enter both phone number and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log('🔄 Attempting login for:', phone);
      const result = await login(phone, password);
      
      if (result.success) {
        console.log('✅ Login successful! Fresh token saved.');
        // Navigation is usually handled automatically by App.js when 'user' state updates
      } else {
        console.log('❌ Login failed:', result.message);
        setError(result.message || 'Invalid credentials.');
      }
    } catch (err) {
      console.error('💥 Login crashed:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Driver <Text style={styles.titleAccent}>Portal</Text></Text>
          <Text style={styles.subtitle}>Sign in to start delivering</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <User size={20} color="#9ca3af" />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#9ca3af" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ✅ NUCLEAR WIPE BUTTON */}
        <TouchableOpacity onPress={handleNuclearWipe} style={styles.wipeBtn}>
          <Trash2 size={16} color="#ef4444" />
          <Text style={styles.wipeBtnText}>Clear Cache & Reset App Data</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  titleAccent: { color: '#FFC107' },
  subtitle: { fontSize: 16, color: '#9ca3af', marginTop: 8, fontWeight: '500' },
  
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', padding: 16, borderRadius: 12, marginBottom: 24, gap: 10, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { flex: 1, color: '#b91c1c', fontWeight: '600', fontSize: 14 },

  form: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 16, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, marginLeft: 12, color: '#fff', fontSize: 16, fontWeight: '500', height: '100%' },
  
  loginBtn: { backgroundColor: '#FFC107', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#FFC107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },

  wipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40, padding: 12 },
  wipeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }
});