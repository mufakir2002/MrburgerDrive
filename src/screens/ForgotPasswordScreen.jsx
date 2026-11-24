import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { requestOtp } from '../services/api';
import { ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!phone.trim()) return Alert.alert('Error', 'Please enter your phone number');
    setLoading(true);
    try {
      const res = await requestOtp(phone.trim(), 'PASSWORD_RESET');
      if (res.data.success) {
        navigation.navigate('ResetPassword', { phone: phone.trim() });
        if (res.data.dev_otp_code) {
          Alert.alert('Dev Mode', `SMS provider is mocked. Your code is: ${res.data.dev_otp_code}`);
        }
      } else {
        Alert.alert('Error', res.data.message || 'Failed to send code');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ArrowLeft size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>🔑 Reset Password</Text>
        <Text style={styles.subtitle}>Enter your registered phone number to receive a verification code.</Text>
        
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Phone Number (e.g. +252...)" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad"
            placeholderTextColor="#6b7280"
          />
        </View>
        
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#111827" /> : <Text style={styles.buttonText}>Send Code</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  backBtn: { padding: 20, paddingBottom: 0 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, marginTop: -60 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFC107', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#9ca3af', textAlign: 'center', marginBottom: 40, fontWeight: '500', lineHeight: 22 },
  inputContainer: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 16, height: 56, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 20 },
  input: { color: '#fff', fontSize: 16, fontWeight: '500' },
  button: { backgroundColor: '#FFC107', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#FFC107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },
});
