import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native'; 
import { useAuth } from '../context/AuthContext';
import { getDriverOrders, updateOrderStatus, updateDriverLocation } from '../services/api';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Power, MapPin, Phone, Navigation, Package, List, Map, LogOut } from 'lucide-react-native';

export default function DashboardScreen() {
  const navigation = useNavigation(); 
  const { user } = useAuth(); // Token is handled by Axios interceptor
  
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const locationIntervalRef = useRef(null);

  // 1. Fetch orders when online
  useEffect(() => {
    if (isOnline) {
      fetchActiveOrders();
      const interval = setInterval(fetchActiveOrders, 10000); // Poll every 10s
      return () => clearInterval(interval);
    } else {
      setActiveOrder(null);
      stopLocationTracking();
    }
  }, [isOnline]);

  // 2. Automatically start/stop live GPS tracking based on order status
  useEffect(() => {
    if (isOnline && activeOrder?.status === 'ON_THE_WAY') {
      startLocationTracking(activeOrder.id);
    } else {
      stopLocationTracking();
    }
  }, [isOnline, activeOrder?.status, activeOrder?.id]);

  const fetchActiveOrders = async () => {
    try {
      const res = await getDriverOrders(); // No token needed - interceptor handles it
      const orders = res.data.data || [];
      const active = orders.find(o => ['ASSIGNED', 'ON_THE_WAY'].includes(o.status));
      setActiveOrder(active || null);
    } catch (err) {
      console.error('Fetch driver orders error:', err);
    }
  };

  const startLocationTracking = async (orderId) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable location access to share your live location with the customer.');
        return;
      }

      // Send initial location immediately
      await sendLocationUpdate(orderId);

      // Then send every 5 seconds
      locationIntervalRef.current = setInterval(() => {
        sendLocationUpdate(orderId);
      }, 5000);
      
      console.log('📍 Live location tracking started for order:', orderId);
    } catch (err) {
      console.error('❌ Error starting location tracking:', err);
    }
  };

  const sendLocationUpdate = async (orderId) => {
    try {
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await updateDriverLocation(location.coords.latitude, location.coords.longitude, orderId);
    } catch (err) {
      console.error('❌ Error sending location update:', err);
    }
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('🛑 Stopped location tracking');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!activeOrder) return;
    setUpdatingStatus(true);
    try {
      await updateOrderStatus(activeOrder.id, newStatus);
      Alert.alert('Success', `Order marked as ${newStatus.replace('_', ' ').toLowerCase()}`);
      fetchActiveOrders();
    } catch (err) {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCall = () => {
    if (activeOrder?.customer_phone) {
      Linking.openURL(`tel:${activeOrder.customer_phone}`);
    }
  };

  const handleNavigate = () => {
    const lat = activeOrder?.delivery_lat || 2.0469;
    const lng = activeOrder?.delivery_lng || 45.3182;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  // ✅ LOGOUT FUNCTION
    // ✅ CORRECT LOGOUT FUNCTION
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Stop location tracking before logout
              stopLocationTracking();
              
              // 2. Clear all auth data using AuthContext's logout function
              await logout(); // This clears storage AND sets user to null
              
              console.log('💥 Logged out successfully. App will show login screen.');
              
              // 3. No need to navigate manually!
              // The App.js navigator will automatically detect user === null
              // and switch to showing the Login screen.
            } catch (err) {
              console.error('Logout error:', err);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
        </View>
        
        <View style={styles.headerActions}>
          {/* ✅ LOGOUT BUTTON */}
          <TouchableOpacity 
            onPress={handleLogout} 
            style={styles.logoutBtn}
            activeOpacity={0.7}
          >
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => navigation.navigate('MyOrders')}
            activeOpacity={0.7}
          >
            <List size={24} color="#111827" />
          </TouchableOpacity>
          
          <View style={styles.onlineToggle}>
            <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              thumbColor={isOnline ? '#fff' : '#f4f4f5'}
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {!isOnline && (
          <View style={styles.stateCard}>
            <View style={styles.iconBoxGray}><Power size={48} color="#9ca3af" /></View>
            <Text style={styles.stateTitle}>You are currently offline</Text>
            <Text style={styles.stateSubtext}>Toggle the switch above to start receiving delivery requests and earn money.</Text>
          </View>
        )}

        {isOnline && !activeOrder && (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#FFC107" />
            <Text style={styles.stateTitle}>Looking for orders...</Text>
            <Text style={styles.stateSubtext}>Stay online! A new delivery request will appear here any moment.</Text>
          </View>
        )}

        {isOnline && activeOrder && (
          <View style={styles.activeOrderCard}>
            <View style={styles.orderHeader}>
              <View style={styles.orderBadge}>
                <Package size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNumber}>Order #{activeOrder.order_number}</Text>
                <Text style={styles.orderTime}>{new Date(activeOrder.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
              </View>
              <View style={styles.earningsBadge}>
                <Text style={styles.earningsText}>${Number(activeOrder.total_amount).toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconCircleRed}>
                <MapPin size={20} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Deliver to</Text>
                <Text style={styles.infoValue}>{activeOrder.customer_name}</Text>
                <Text style={styles.infoSubtext} numberOfLines={2}>{activeOrder.delivery_address}</Text>
              </View>
            </View>

            {/* ✅ Live Tracking Indicator */}
            {activeOrder.status === 'ON_THE_WAY' && (
              <View style={styles.trackingIndicator}>
                <Map size={16} color="#16a34a" />
                <Text style={styles.trackingText}>Live location sharing active</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCall} activeOpacity={0.8}>
                <Phone size={20} color="#111827" />
                <Text style={styles.actionBtnTextOutline}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={handleNavigate} activeOpacity={0.8}>
                <Navigation size={20} color="#111827" />
                <Text style={styles.actionBtnTextOutline}>Navigate</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statusSection}>
              {activeOrder.status === 'ASSIGNED' && (
                <TouchableOpacity 
                  style={styles.primaryBtn} 
                  onPress={() => handleStatusUpdate('ON_THE_WAY')}
                  disabled={updatingStatus}
                  activeOpacity={0.9}
                >
                  {updatingStatus ? <ActivityIndicator color="#111827" /> : <Text style={styles.primaryBtnText}>🛵 Mark On The Way</Text>}
                </TouchableOpacity>
              )}
              {activeOrder.status === 'ON_THE_WAY' && (
                <TouchableOpacity 
                  style={[styles.primaryBtn, styles.successBtn]} 
                  onPress={() => handleStatusUpdate('DELIVERED')}
                  disabled={updatingStatus}
                  activeOpacity={0.9}
                >
                  {updatingStatus ? <ActivityIndicator color="#fff" /> : <Text style={styles.successBtnText}>✅ Mark Delivered</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  greeting: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  driverName: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 2 },
  
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { backgroundColor: '#f3f4f6', padding: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { 
    backgroundColor: '#fef2f2', 
    padding: 10, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#fecaca'
  },
  
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9fafb', padding: 8, paddingHorizontal: 12, borderRadius: 30, borderWidth: 1, borderColor: '#e5e7eb' },
  onlineText: { fontSize: 12, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.5 },
  onlineTextActive: { color: '#16a34a' },

  content: { flex: 1, padding: 24 },

  stateCard: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 40, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  iconBoxGray: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  stateTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  stateSubtext: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },

  activeOrderCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4, borderWidth: 2, borderColor: '#FFC107' },
  orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  orderBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  orderNumber: { fontSize: 18, fontWeight: '800', color: '#111827' },
  orderTime: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  earningsBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  earningsText: { fontSize: 15, fontWeight: '800', color: '#16a34a' },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 20 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  iconCircleRed: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 2 },
  infoSubtext: { fontSize: 14, color: '#4b5563', marginTop: 4, lineHeight: 20 },

  trackingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 8, marginBottom: 16 },
  trackingText: { fontSize: 13, fontWeight: '700', color: '#16a34a' },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtnOutline: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', gap: 8 },
  actionBtnTextOutline: { fontSize: 15, fontWeight: '700', color: '#111827' },

  statusSection: { marginTop: 8 },
  primaryBtn: { backgroundColor: '#FFC107', paddingVertical: 20, borderRadius: 18, alignItems: 'center', shadowColor: '#FFC107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },
  successBtn: { backgroundColor: '#16a34a', shadowColor: '#16a34a' },
  successBtnText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }
});