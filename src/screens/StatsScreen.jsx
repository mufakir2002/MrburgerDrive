import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getDriverStats } from '../services/api';
import { Award, Star, Package, DollarSign, ArrowLeft } from 'lucide-react-native';

export default function StatsScreen({ navigation }) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await getDriverStats(token);
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#FFC107" />
      </SafeAreaView>
    );
  }

  const StatCard = ({ icon: Icon, label, value, subtext, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Icon size={28} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Performance</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
          <Text style={styles.driverStatus}>Active Driver</Text>
        </View>

        <StatCard 
          icon={Package} 
          label="Total Delivered" 
          value={stats?.totalDelivered || 0} 
          subtext="Successful deliveries"
          color="#3B82F6" 
        />
        
        <StatCard 
          icon={DollarSign} 
          label="Estimated Earnings" 
          value={`$${(stats?.estimatedEarnings || 0).toFixed(2)}`} 
          subtext="Based on completed orders"
          color="#10B981" 
        />

        <StatCard 
          icon={Star} 
          label="Average Rating" 
          value={`${stats?.averageRating || '0.0'} / 5.0`} 
          subtext={`${stats?.totalReviews || 0} customer reviews`}
          color="#FFC107" 
        />

        <View style={styles.tipCard}>
          <Award size={24} color="#FFC107" />
          <Text style={styles.tipText}>
            Keep up the great work! Drivers with a 4.8+ rating get priority on high-value orders.
          </Text>
        </View>
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
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  
  profileHeader: { marginBottom: 32, alignItems: 'center' },
  driverName: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  driverStatus: { fontSize: 14, color: '#10B981', fontWeight: '700', marginTop: 4, backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },

  statCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 4 },
  statSubtext: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFC10715', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#FFC10740', marginTop: 8, gap: 12 },
  tipText: { flex: 1, fontSize: 14, color: '#fbbf24', fontWeight: '600', lineHeight: 20 }
});