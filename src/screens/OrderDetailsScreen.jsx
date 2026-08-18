import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location'; // ✅ NEW IMPORT
import { useAuth } from '../context/AuthContext';
import { updateOrderStatus, updateDriverLocation } from '../services/api'; // ✅ NEW IMPORT
import { Phone, MapPin, ChevronLeft, CheckCircle, Navigation } from 'lucide-react-native';

export default function OrderDetailsScreen({ route, navigation }) {
  const { order } = route.params;
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [locationSubscription, setLocationSubscription] = useState(null);

  // ✅ LIVE LOCATION TRACKING EFFECT
  useEffect(() => {
    let subscription = null;

    const startTracking = async () => {
      // Only track if the order is actively being delivered
      if (currentStatus === 'ON_THE_WAY' || currentStatus === 'ASSIGNED') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          return;
        }

        // Watch position and update backend every 10 seconds (10000ms)
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10, // Update if moved 10 meters
          },
          async (location) => {
            try {
              await updateDriverLocation(token, location.coords.latitude, location.coords.longitude);
            } catch (err) {
              console.error('Failed to update location:', err);
            }
          }
        );
        setLocationSubscription(subscription);
      }
    };

    startTracking();

    // Cleanup: stop tracking when component unmounts or status changes to DELIVERED
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [currentStatus, token]);

  const handleStatusUpdate = async (newStatus) => {
    setLoading(true);
    try {
      await updateOrderStatus(token, order.id, newStatus);
      setCurrentStatus(newStatus);
      Alert.alert('Success', `Order marked as ${newStatus.replace('_', ' ')}`);
      
      if (newStatus === 'DELIVERED') {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update status. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const callCustomer = () => Linking.openURL(`tel:${order.customer_phone}`);
  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#FFC107" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_number}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{order.customer_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{order.customer_phone}</Text>
            <TouchableOpacity onPress={callCustomer} style={styles.actionBtn}>
              <Phone size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Location</Text>
          <Text style={styles.address}>{order.delivery_address}</Text>
          <TouchableOpacity onPress={openMaps} style={styles.mapBtn}>
            <Navigation size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.mapBtnText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionArea}>
          {currentStatus === 'ASSIGNED' && (
            <TouchableOpacity style={[styles.actionButton, styles.blueBtn]} onPress={() => handleStatusUpdate('ON_THE_WAY')} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>🛵 Start Delivery (On the Way)</Text>}
            </TouchableOpacity>
          )}

          {currentStatus === 'ON_THE_WAY' && (
            <View style={styles.trackingIndicator}>
              <View style={styles.pulse} />
              <Text style={styles.trackingText}>📡 Live Location Broadcasting...</Text>
            </View>
          )}

          {currentStatus === 'ON_THE_WAY' && (
            <TouchableOpacity style={[styles.actionButton, styles.greenBtn]} onPress={() => handleStatusUpdate('DELIVERED')} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>✅ Mark as Delivered</Text>}
            </TouchableOpacity>
          )}

          {currentStatus === 'DELIVERED' && (
            <View style={styles.completedBadge}>
              <CheckCircle size={24} color="#22c55e" />
              <Text style={styles.completedText}>Order Successfully Delivered!</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, backgroundColor: '#111827', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFC107' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, color: '#6b7280', width: 60 },
  value: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  actionBtn: { backgroundColor: '#22c55e', padding: 8, borderRadius: 8 },
  address: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC107', padding: 14, borderRadius: 12 },
  mapBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  actionArea: { marginTop: 8 },
  actionButton: { padding: 18, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, marginBottom: 12 },
  blueBtn: { backgroundColor: '#3b82f6' },
  greenBtn: { backgroundColor: '#22c55e' },
  actionButtonText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#22c55e' },
  completedText: { fontSize: 16, fontWeight: '700', color: '#15803d', marginLeft: 8 },
  trackingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#3b82f6' },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 8 },
  trackingText: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' }
});