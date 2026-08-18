import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getDriverOrderHistory } from '../services/api';
import { ArrowLeft, Package, Clock, CheckCircle, MapPin } from 'lucide-react-native';

export default function MyOrdersScreen({ navigation }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'pending', 'delivered'

  useEffect(() => {
    fetchOrders();
  }, [activeFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await getDriverOrderHistory(token, activeFilter);
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'ASSIGNED': { bg: '#3B82F6', text: 'Assigned' },
      'ON_THE_WAY': { bg: '#F59E0B', text: 'On The Way' },
      'DELIVERED': { bg: '#10B981', text: 'Delivered' },
      'CANCELLED': { bg: '#EF4444', text: 'Cancelled' },
    };
    return styles[status] || { bg: '#6B7280', text: status };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const renderOrder = ({ item }) => {
    const statusBadge = getStatusBadge(item.status);
    
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <View style={styles.dateTime}>
              <Clock size={12} color="#9CA3AF" />
              <Text style={styles.dateText}>{formatDate(item.created_at)} • {formatTime(item.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <Text style={styles.statusText}>{statusBadge.text}</Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <View style={styles.addressRow}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.addressText} numberOfLines={2}>{item.delivery_address}</Text>
            </View>
          </View>
          <Text style={styles.amount}>${Number(item.total_amount).toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]} 
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'pending' && styles.filterTabActive]} 
          onPress={() => setActiveFilter('pending')}
        >
          <Text style={[styles.filterText, activeFilter === 'pending' && styles.filterTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'delivered' && styles.filterTabActive]} 
          onPress={() => setActiveFilter('delivered')}
        >
          <Text style={[styles.filterText, activeFilter === 'delivered' && styles.filterTextActive]}>Delivered</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC107" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={64} color="#4B5563" />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptyText}>
            {activeFilter === 'all' ? 'You haven\'t completed any deliveries yet.' : `No ${activeFilter} orders.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  
  filterContainer: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  filterTab: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1F2937', alignItems: 'center' },
  filterTabActive: { backgroundColor: '#FFC107' },
  filterText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  filterTextActive: { color: '#111827' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  listContent: { padding: 24 },
  orderCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  dateTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  
  orderBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customerInfo: { flex: 1, marginRight: 16 },
  customerName: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  addressText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  
  amount: { fontSize: 18, fontWeight: '800', color: '#FFC107' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 }
});