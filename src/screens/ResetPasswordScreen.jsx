import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';
import { requestOtp, resetPassword } from '../services/api';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';

export default function ResetPasswordScreen({ navigation, route }) {
  const { phone } = route.params;

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    try {
      const res = await requestOtp(phone, 'PASSWORD_RESET');
      setResendCooldown(60);
      if (res.data.dev_otp_code) {
        Alert.alert('Dev Mode', `SMS provider is mocked. Your code is: ${res.data.dev_otp_code}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (code.length !== 6) {
      return Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your phone.');
    }
    if (newPassword.length < 6) {
      return Alert.alert('Weak Password', 'New password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Mismatch', 'Passwords do not match.');
    }

    setSubmitting(true);
    try {
      const res = await resetPassword(phone, code, newPassword);
      if (res.data.success) {
        Alert.alert('Success', 'Your password has been reset. Please sign in with your new password.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Failed', res.data.message || 'Could not reset password.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={32} color="#FFC107" />
          </View>
          <Text style={styles.title}>Reset Your Password</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to {phone}, then choose a new password.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor="#374151"
            maxLength={6}
            autoFocus
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="New Password (min 6 chars)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor="#6b7280"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (submitting || code.length !== 6) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || code.length !== 6}
          >
            {submitting ? <ActivityIndicator color="#111827" /> : <Text style={styles.submitButtonText}>Reset Password</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resendCooldown > 0}>
            <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  backButton: { padding: 20, paddingBottom: 0 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 10, justifyContent: 'center', marginTop: -40 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1f2937',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#374151'
  },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20, marginBottom: 24, fontWeight: '500' },
  codeInput: {
    fontSize: 30, fontWeight: '800', letterSpacing: 10, color: '#fff',
    textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#FFC107',
    paddingVertical: 10, width: '100%', marginBottom: 20
  },
  inputContainer: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 16, height: 56, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 14, width: '100%' },
  input: { color: '#fff', fontSize: 15, fontWeight: '500' },
  submitButton: {
    backgroundColor: '#FFC107', height: 56, borderRadius: 16,
    width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
    shadowColor: '#FFC107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '800', color: '#111827' },
  resendButton: { padding: 8 },
  resendText: { fontSize: 14, color: '#FFC107', fontWeight: '600' },
  resendTextDisabled: { color: '#4b5563' },
});
