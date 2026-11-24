import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword } from '../services/api';
import {
  ArrowLeft, User, Phone, Truck, Star, Package, DollarSign,
  Lock, LogOut, ChevronRight
} from 'lucide-react-native';

export default function DriverProfileScreen({ navigation }) {
  const { user, logout, updateUserData } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await getProfile();
      if (res.data.success) {
        setProfile(res.data.data);
        setName(res.data.data.name || '');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) {
      return Alert.alert('Error', 'Name cannot be empty');
    }
    setSavingName(true);
    try {
      const res = await updateProfile({ name: name.trim() });
      if (res.data.success) {
        updateUserData(res.data.data);
        setProfile((prev) => ({ ...prev, name: name.trim() }));
        Alert.alert('Success', 'Name updated successfully');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      return Alert.alert('Error', 'Please fill in all password fields');
    }
    if (newPwd.length < 6) {
      return Alert.alert('Error', 'New password must be at least 6 characters');
    }
    if (newPwd !== confirmPwd) {
      return Alert.alert('Error', 'New passwords do not match');
    }
    setSavingPwd(true);
    try {
      const res = await changePassword({ current_password: currentPwd, new_password: newPwd });
      if (res.data.success) {
        Alert.alert('Success', 'Password changed successfully');
        setShowPasswordForm(false);
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() }
    ]);
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#FFC107" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Vehicle / performance summary — read-only, sourced from admin-managed data */}
        {profile?.vehicle_type && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Truck size={18} color="#9ca3af" />
              <Text style={styles.summaryText}>{profile.vehicle_type} {profile.vehicle_number ? `• ${profile.vehicle_number}` : ''}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStat}>
                <Star size={16} color="#FFC107" />
                <Text style={styles.summaryStatValue}>{Number(profile.rating || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Package size={16} color="#3B82F6" />
                <Text style={styles.summaryStatValue}>{profile.total_deliveries || 0}</Text>
              </View>
              <View style={styles.summaryStat}>
                <DollarSign size={16} color="#10B981" />
                <Text style={styles.summaryStatValue}>${Number(profile.total_earnings || 0).toFixed(0)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Editable name + read-only verified phone */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Info</Text>

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputRow}>
            <User size={18} color="#9ca3af" />
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#6b7280" />
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.readOnlyRow}>
            <Phone size={18} color="#6b7280" />
            <Text style={styles.readOnlyText}>{profile?.phone_number || user?.phone_number}</Text>
            <View style={styles.verifiedBadge}><Text style={styles.verifiedBadgeText}>Verified</Text></View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingName && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={savingName || name.trim() === profile?.name}
          >
            {savingName ? <ActivityIndicator color="#111827" /> : <Text style={styles.saveBtnText}>Save Name</Text>}
          </TouchableOpacity>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowBetween} onPress={() => setShowPasswordForm(!showPasswordForm)}>
            <View style={styles.rowLeft}>
              <Lock size={18} color="#9ca3af" />
              <Text style={styles.cardTitle}>Change Password</Text>
            </View>
            <ChevronRight size={18} color="#6b7280" style={{ transform: [{ rotate: showPasswordForm ? '90deg' : '0deg' }] }} />
          </TouchableOpacity>

          {showPasswordForm && (
            <View style={{ marginTop: 16 }}>
              <TextInput
                style={styles.pwdInput}
                placeholder="Current password"
                placeholderTextColor="#6b7280"
                value={currentPwd}
                onChangeText={setCurrentPwd}
                secureTextEntry
              />
              <TextInput
                style={styles.pwdInput}
                placeholder="New password (min 6 characters)"
                placeholderTextColor="#6b7280"
                value={newPwd}
                onChangeText={setNewPwd}
                secureTextEntry
              />
              <TextInput
                style={styles.pwdInput}
                placeholder="Confirm new password"
                placeholderTextColor="#6b7280"
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.saveBtn, savingPwd && styles.saveBtnDisabled]}
                onPress={handleChangePassword}
                disabled={savingPwd}
              >
                {savingPwd ? <ActivityIndicator color="#111827" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, justifyContent: 'center', backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  summaryCard: { backgroundColor: '#1f2937', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  summaryDivider: { height: 1, backgroundColor: '#374151', marginVertical: 16 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryStatValue: { fontSize: 15, fontWeight: '800', color: '#fff' },

  card: { backgroundColor: '#1f2937', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  label: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#374151' },
  input: { flex: 1, color: '#fff', paddingVertical: 14, fontSize: 15, fontWeight: '500' },

  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#374151' },
  readOnlyText: { flex: 1, color: '#9ca3af', fontSize: 15, fontWeight: '500' },
  verifiedBadge: { backgroundColor: '#10B98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },

  saveBtn: { backgroundColor: '#FFC107', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 18 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#111827' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  pwdInput: { backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#374151' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7f1d1d20', borderWidth: 1, borderColor: '#7f1d1d', paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  logoutText: { fontSize: 15, fontWeight: '800', color: '#ef4444' },
});
