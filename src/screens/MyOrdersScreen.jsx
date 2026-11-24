import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MapPin, Inbox, Banknote } from 'lucide-react-native';
import { getHistory } from '../services/api';
import { C, shadow } from '../theme';
import { money, timeOf, dateOf, apiError } from '../utils/format';
import { Header, StatusBadge, Chip, Empty } from '../components/ui';

const STATUSES = [['all', 'All'], ['active', 'Pending'], ['delivered', 'Completed'], ['cancelled', 'Cancelled']];
const PERIODS = [['today', 'Today'], ['week', '7 days'], ['month', 'This month'], ['all', 'All time']];
const PAGE = 30;

export default function MyOrdersScreen({ navigation, route }) {
  const [status, setStatus] = useState(route.params?.status || 'all');
  const [period, setPeriod] = useState(route.params?.period || 'week');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async (reset = true) => {
    const my = ++reqId.current;
    try {
      if (!reset) setMore(true);
      const res = await getHistory({ status, period, limit: PAGE, offset: reset ? 0 : orders.length });
      if (my !== reqId.current) return; // a newer filter was chosen meanwhile
      setOrders((prev) => (reset ? res.data.data : [...prev, ...res.data.data]));
      setHasMore(!!res.data.hasMore);
      setError('');
    } catch (e) {
      if (my === reqId.current) setError(apiError(e));
    } finally {
      if (my === reqId.current) { setLoading(false); setRefreshing(false); setMore(false); }
    }
  }, [status, period, orders.length]);

  useEffect(() => { setLoading(true); load(true); /* eslint-disable-next-line */ }, [status, period]);

  const total = orders.reduce((a, o) => a + (o.status === 'DELIVERED' ? Number(o.commission) : 0), 0);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => navigation.navigate('OrderDetails', { order: item })}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.no}>#{item.order_number}</Text>
          <View style={s.time}><Clock size={12} color={C.mute} /><Text style={s.timeText}>{dateOf(item.updated_at)} · {timeOf(item.updated_at)}</Text></View>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <Text style={s.cust}>{item.customer_name}</Text>
      <View style={s.addrRow}><MapPin size={14} color={C.mute} /><Text style={s.addr} numberOfLines={1}>{item.delivery_address}</Text></View>
      <View style={s.bottom}>
        <View style={s.amtRow}>
          {item.payment_method_code === 'CASH' ? <Banknote size={15} color={C.amber} /> : null}
          <Text style={s.amt}>{money(item.total_amount)}</Text>
        </View>
        {item.status === 'DELIVERED' ? <Text style={s.comm}>+{money(item.commission)} earned</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      <Header title="My Orders" onBack={() => navigation.goBack()} />
      <View style={s.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {STATUSES.map(([k, l]) => <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipRow, { marginTop: 8 }]}>
          {PERIODS.map(([k, l]) => <Chip key={k} label={l} active={period === k} onPress={() => setPeriod(k)} />)}
        </ScrollView>
      </View>

      {!loading && orders.length > 0 && (
        <View style={s.summary}>
          <Text style={s.summaryText}>{orders.length}{hasMore ? '+' : ''} order{orders.length === 1 ? '' : 's'}</Text>
          {total > 0 ? <Text style={s.summaryEarn}>Earned {money(total)}</Text> : null}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#FFC107" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 6, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#FFC107" />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && !more && !loading) load(false); }}
          ListFooterComponent={more ? <ActivityIndicator style={{ margin: 16 }} color="#FFC107" /> : null}
          ListEmptyComponent={
            <Empty
              icon={<Inbox size={36} color={C.mute} />}
              title={error ? 'Could not load orders' : 'No orders here'}
              text={error || 'Try a different filter or time range.'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  filters: { paddingTop: 14, paddingBottom: 6 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  summaryText: { color: C.sub, fontWeight: '700', fontSize: 13 },
  summaryEarn: { color: C.green, fontWeight: '900', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, ...shadow },
  top: { flexDirection: 'row', alignItems: 'center' },
  no: { fontSize: 16, fontWeight: '900', color: C.ink },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  timeText: { fontSize: 12, color: C.mute, fontWeight: '600' },
  cust: { fontSize: 14.5, fontWeight: '800', color: C.ink, marginTop: 12 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addr: { flex: 1, fontSize: 13, color: C.sub },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  amtRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amt: { fontSize: 15, fontWeight: '900', color: C.ink },
  comm: { fontSize: 13, fontWeight: '900', color: C.green },
});
