import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert, ScrollView, RefreshControl, AppState, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Package, MapPin, Banknote, Home, ClipboardList, BarChart3, User as UserIcon, Radio, Wifi, WifiOff, Bell, ChevronRight, Navigation, Route,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import * as Location from 'expo-location';
import { getActiveOrders, getReport, setOnlineStatus, updateDriverLocation } from '../services/api';
import { syncTracking } from '../services/locationTracker';
import { flush, subscribe } from '../services/offlineQueue';
import { C, shadow } from '../theme';
import { money, timeOf, ago } from '../utils/format';
import { StatusBadge } from '../components/ui';
import { planStops, openNavigation, openRoute, km } from '../services/navigate';

const ONLINE_KEY = 'mrb_driver_online';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [online, setOnline] = useState(true);
  const [orders, setOrders] = useState([]);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineNet, setOfflineNet] = useState(false);
  const [queued, setQueued] = useState(0);
  useEffect(() => subscribe(setQueued), []);
  const [trackWarn, setTrackWarn] = useState(false);
  const [pos, setPos] = useState(null); // {lat,lng} last known position, used to order the stops nearest-first
  const [newOrderBanner, setNewOrderBanner] = useState(null);
  const knownIds = useRef(null);
  const focused = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(ONLINE_KEY).then((v) => { if (v === '0') setOnline(false); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      // Send status updates saved while offline; tell the driver once if the server refused any of them.
      const q = await flush();
      if (q.dropped.length) Alert.alert('An update was not accepted', q.dropped.map((d) => d.message).join('\n'));
      const [o, r] = await Promise.all([getActiveOrders(), getReport('today').catch(() => null)]);
      const list = o.data.data || [];
      setOrders(list);
      if (r?.data?.data) setToday(r.data.data);
      setOfflineNet(false);

      // New assignment alert
      const assigned = list.filter((x) => x.status === 'ASSIGNED').map((x) => x.id);
      if (knownIds.current) {
        const fresh = list.find((x) => x.status === 'ASSIGNED' && !knownIds.current.has(x.id));
        if (fresh) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setNewOrderBanner(fresh);
          setTimeout(() => setNewOrderBanner((b) => (b?.id === fresh.id ? null : b)), 8000);
        }
      }
      knownIds.current = new Set([...(knownIds.current || []), ...assigned, ...list.map((x) => x.id)]);

      try {
        const p = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60000 });
        if (p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      } catch (e) { /* no permission yet */ }

      const t = await syncTracking(list);
      setTrackWarn(t.ok === false);
    } catch (e) {
      if (!e.response) setOfflineNet(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Poll every 8s while this screen is visible and the app is in the foreground
  useFocusEffect(useCallback(() => {
    focused.current = true;
    load();
    const t = setInterval(() => { if (AppState.currentState === 'active') load(); }, 8000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    return () => { focused.current = false; clearInterval(t); sub.remove(); };
  }, [load]));

  // Tell the restaurant whether we are available (shown in the admin portal)
  useEffect(() => { setOnlineStatus(online).catch(() => {}); }, [online]);

  // While online and idle, share the last known position every 2 minutes (low battery) so dispatch can suggest the nearest driver.
  useEffect(() => {
    if (!online) return undefined;
    let stop = false;
    const ping = async () => {
      try {
        if (AppState.currentState !== 'active') return;
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted || stop) return;
        const p = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60000 }) || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (p && !stop) await updateDriverLocation(p.coords.latitude, p.coords.longitude);
      } catch (e) { /* best effort */ }
    };
    ping();
    const t = setInterval(ping, 120000);
    return () => { stop = true; clearInterval(t); };
  }, [online]);

  const toggleOnline = (v) => {
    if (!v && orders.length) {
      Alert.alert('You have active deliveries', 'Finish your current orders before going offline.');
      return;
    }
    setOnline(v);
    AsyncStorage.setItem(ONLINE_KEY, v ? '1' : '0').catch(() => {});
  };

  // Several orders: show them as stops 1, 2, 3 in the best order (closest first) and offer ONE route for all of them.
  const plan = planStops(orders, pos);
  const multi = plan.length > 1;
  const spread = multi && plan.length > 1 ? Math.max(...plan.slice(1).map((x, i) => (plan[i].order.delivery_lat && x.order.delivery_lat ? km({ lat: Number(plan[i].order.delivery_lat), lng: Number(plan[i].order.delivery_lng) }, { lat: Number(x.order.delivery_lat), lng: Number(x.order.delivery_lng) }) : 0))) : 0;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = (user?.name || 'Driver').split(' ')[0];

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greet}>{greet},</Text>
          <Text style={s.name} numberOfLines={1}>{first} 👋</Text>
        </View>
        <View style={[s.onlinePill, online ? s.pillOn : s.pillOff]}>
          {online ? <Wifi size={14} color="#16a34a" /> : <WifiOff size={14} color="#9ca3af" />}
          <Text style={[s.pillText, { color: online ? '#16a34a' : '#9ca3af' }]}>{online ? 'Online' : 'Offline'}</Text>
          <Switch
            value={online}
            onValueChange={toggleOnline}
            trackColor={{ false: '#374151', true: '#22c55e' }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </View>

      {offlineNet && (
        <View style={s.warn}><WifiOff size={15} color="#92400e" /><Text style={s.warnText}>No connection — retrying…</Text></View>
      )}
      {queued > 0 && (
        <View style={s.warn}><WifiOff size={15} color="#92400e" /><Text style={s.warnText}>{queued} update{queued === 1 ? '' : 's'} saved on this phone - will send when you are online.</Text></View>
      )}
      {trackWarn && (
        <TouchableOpacity style={s.warn} onPress={() => navigation.navigate('DriverProfile')}>
          <MapPin size={15} color="#92400e" />
          <Text style={s.warnText}>Location is off — customers can't see you. Allow location in Settings.</Text>
        </TouchableOpacity>
      )}
      {newOrderBanner && (
        <TouchableOpacity
          style={s.newBanner}
          onPress={() => { const o = newOrderBanner; setNewOrderBanner(null); navigation.navigate('OrderDetails', { order: o }); }}
        >
          <Bell size={18} color="#111827" />
          <Text style={s.newBannerText}>New order #{newOrderBanner.order_number} — tap to view</Text>
          <ChevronRight size={18} color="#111827" />
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFC107" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Today summary */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Reports')} style={s.todayCard}>
          <View style={s.todayTop}>
            <Text style={s.todayLabel}>Today's earnings</Text>
            <View style={s.todayLink}><Text style={s.todayLinkText}>Reports</Text><ChevronRight size={14} color="#FFC107" /></View>
          </View>
          <Text style={s.todayAmount}>{money(today?.commission)}</Text>
          <View style={s.todayRow}>
            <View style={s.todayStat}><Text style={s.todayNum}>{today?.delivered ?? 0}</Text><Text style={s.todayCap}>Delivered</Text></View>
            <View style={s.todaySep} />
            <View style={s.todayStat}><Text style={s.todayNum}>{orders.length}</Text><Text style={s.todayCap}>Active</Text></View>
            <View style={s.todaySep} />
            <View style={s.todayStat}><Text style={s.todayNum}>{money(today?.cashCollected)}</Text><Text style={s.todayCap}>Cash collected</Text></View>
          </View>
        </TouchableOpacity>

        {today?.balance && (today.balance.cashOwed > 0 || today.balance.commissionUnpaid > 0) && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Reports')} style={s.balanceCard}>
            <View style={s.balanceCol}>
              <Text style={s.balanceLabel}>Cash to hand in</Text>
              <Text style={[s.balanceAmt, today.balance.cashOwed > 0 && { color: '#dc2626' }]}>{money(today.balance.cashOwed)}</Text>
            </View>
            <View style={s.balanceSep} />
            <View style={s.balanceCol}>
              <Text style={s.balanceLabel}>Commission to receive</Text>
              <Text style={[s.balanceAmt, today.balance.commissionUnpaid > 0 && { color: '#16a34a' }]}>{money(today.balance.commissionUnpaid)}</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={s.section}>Active deliveries</Text>

        {loading && <ActivityIndicator style={{ marginTop: 30 }} color="#FFC107" />}

        {!loading && !online && (
          <View style={s.stateCard}>
            <View style={s.stateIcon}><WifiOff size={38} color="#9ca3af" /></View>
            <Text style={s.stateTitle}>You're offline</Text>
            <Text style={s.stateText}>Switch on "Online" so dispatch knows you're available for orders.</Text>
          </View>
        )}

        {!loading && online && orders.length === 0 && (
          <View style={s.stateCard}>
            <View style={s.stateIcon}><Radio size={38} color="#FFC107" /></View>
            <Text style={s.stateTitle}>Waiting for dispatch</Text>
            <Text style={s.stateText}>When the restaurant assigns you an order it appears here with a vibration and a notification.</Text>
          </View>
        )}

        {multi && (
          <View style={s.planCard}>
            <View style={s.planHead}><Route size={20} color="#111827" /><Text style={s.planTitle}>{plan.length} orders - follow this order</Text></View>
            <Text style={s.planSub}>{spread > 3 ? 'These customers are far apart. Take them one by one, starting with stop 1.' : 'The customers are close together. Deliver stop 1, then 2' + (plan.length > 2 ? ', then 3' : '') + '.'}</Text>
            <TouchableOpacity style={s.planBtn} activeOpacity={0.9} onPress={() => openRoute(plan, pos)}>
              <Navigation size={20} color="#fff" /><Text style={s.planBtnText}>Start route for all orders</Text>
            </TouchableOpacity>
          </View>
        )}

        {plan.map(({ order: o, legKm }, idx) => (
          <TouchableOpacity key={o.id} style={s.orderCard} activeOpacity={0.9} onPress={() => navigation.navigate('OrderDetails', { order: o })}>
            <View style={s.orderTop}>
              {multi ? <View style={s.stopNo}><Text style={s.stopNoText}>{idx + 1}</Text></View> : <View style={s.orderIcon}><Package size={18} color="#111827" /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.orderNo}>{multi ? `Stop ${idx + 1} · ` : ''}Order #{o.order_number}</Text>
                <Text style={s.orderSub}>{o.item_count} item{o.item_count === 1 ? '' : 's'} · {ago(o.updated_at || o.created_at)}{legKm != null ? ` · ${legKm < 1 ? Math.round(legKm * 1000) + ' m' : legKm.toFixed(1) + ' km'} away` : ''}</Text>
              </View>
              <StatusBadge status={o.status} />
            </View>
            {o.status === 'ASSIGNED' && !o.accepted ? (
              <View style={s.respond}><Bell size={14} color="#1d4ed8" /><Text style={s.respondText}>New — accept or decline</Text></View>
            ) : null}
            <View style={s.orderRow}>
              <MapPin size={16} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.cust}>{o.customer_name}</Text>
                <Text style={s.addr} numberOfLines={2}>{o.delivery_address}</Text>
              </View>
            </View>
            {o.cash_due ? (
              <View style={s.cashBox}>
                <Banknote size={18} color="#92400e" />
                <Text style={s.cashText}>Collect cash: <Text style={{ fontWeight: '900' }}>{money(o.total_amount)}</Text></Text>
              </View>
            ) : (
              <View style={s.paidBox}><Text style={s.paidText}>Paid · nothing to collect</Text><Text style={s.orderTotal}>{money(o.total_amount)}</Text></View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={s.goBtn} activeOpacity={0.9} onPress={() => openNavigation(o)}>
                <Navigation size={22} color="#fff" /><Text style={s.goText}>GO</Text>
              </TouchableOpacity>
              <View style={[s.cta, { flex: 1, marginTop: 0 }]}>
                <Text style={s.ctaText}>{o.status === 'ASSIGNED' ? (o.accepted ? 'Open & start delivery' : 'Review order') : 'Open delivery'}</Text>
                <ChevronRight size={18} color="#111827" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TabBtn icon={Home} label="Home" active />
        <TabBtn icon={ClipboardList} label="Orders" onPress={() => navigation.navigate('MyOrders')} />
        <TabBtn icon={BarChart3} label="Reports" onPress={() => navigation.navigate('Reports')} />
        <TabBtn icon={UserIcon} label="Profile" onPress={() => navigation.navigate('DriverProfile')} />
      </View>
    </SafeAreaView>
  );
}

function TabBtn({ icon: Icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={s.tab} onPress={onPress} activeOpacity={0.7} disabled={active}>
      <Icon size={22} color={active ? '#111827' : '#9ca3af'} />
      <Text style={[s.tabText, active && { color: '#111827' }]}>{label}</Text>
      {active ? <View style={s.tabDot} /> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dark, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  greet: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  name: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 4, borderRadius: 999 },
  pillOn: { backgroundColor: '#052e16' }, pillOff: { backgroundColor: '#1f2937' },
  pillText: { fontSize: 12.5, fontWeight: '800' },
  warn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 10 },
  warnText: { color: '#92400e', fontSize: 12.5, fontWeight: '700', flex: 1 },
  newBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 14 },
  newBannerText: { flex: 1, fontWeight: '800', color: '#111827', fontSize: 14 },
  todayCard: { backgroundColor: C.dark, borderRadius: 24, padding: 20, ...shadow },
  todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { color: '#9ca3af', fontWeight: '700', fontSize: 13 },
  todayLink: { flexDirection: 'row', alignItems: 'center' },
  todayLinkText: { color: '#FFC107', fontWeight: '800', fontSize: 12.5 },
  todayAmount: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 4 },
  todayRow: { flexDirection: 'row', marginTop: 16, backgroundColor: '#1f2937', borderRadius: 16, paddingVertical: 12 },
  todayStat: { flex: 1, alignItems: 'center' },
  todaySep: { width: 1, backgroundColor: '#374151' },
  todayNum: { color: '#fff', fontWeight: '900', fontSize: 16 },
  todayCap: { color: '#9ca3af', fontSize: 11, fontWeight: '700', marginTop: 2 },
  balanceCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 14, marginTop: 14, ...shadow },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceSep: { width: 1, backgroundColor: C.line },
  balanceLabel: { fontSize: 11.5, fontWeight: '800', color: C.sub },
  balanceAmt: { fontSize: 20, fontWeight: '900', color: C.mute, marginTop: 3 },
  respond: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.blueBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12, alignSelf: 'flex-start' },
  respondText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '900', color: C.ink, marginTop: 24, marginBottom: 12 },
  stateCard: { backgroundColor: '#fff', borderRadius: 22, alignItems: 'center', padding: 28, ...shadow },
  stateIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stateTitle: { fontSize: 17, fontWeight: '900', color: C.ink },
  stateText: { fontSize: 13.5, color: C.sub, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  orderCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 14, ...shadow },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  orderNo: { fontSize: 16, fontWeight: '900', color: C.ink },
  orderSub: { fontSize: 12, color: C.sub, marginTop: 2, fontWeight: '600' },
  orderRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cust: { fontSize: 14.5, fontWeight: '800', color: C.ink },
  addr: { fontSize: 13, color: C.sub, marginTop: 2, lineHeight: 18 },
  cashBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amberBg, borderRadius: 14, padding: 12, marginTop: 14 },
  cashText: { color: '#92400e', fontSize: 14, fontWeight: '700' },
  paidBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.greenBg, borderRadius: 14, padding: 12, marginTop: 14 },
  paidText: { color: '#166534', fontSize: 13, fontWeight: '800' },
  orderTotal: { color: '#166534', fontSize: 14, fontWeight: '900' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, marginTop: 14 },
  ctaText: { fontWeight: '900', color: '#111827', fontSize: 15 },
  planCard: { backgroundColor: '#FFF8E1', borderWidth: 1.5, borderColor: '#FFC107', borderRadius: 20, padding: 16, marginBottom: 14 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { fontSize: 16, fontWeight: '900', color: C.ink },
  planSub: { fontSize: 13.5, color: '#92400e', fontWeight: '600', marginTop: 6, lineHeight: 19 },
  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, marginTop: 12 },
  planBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  stopNo: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  stopNoText: { color: '#FFC107', fontWeight: '900', fontSize: 20 },
  goBtn: { width: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14 },
  goText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 1 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { fontSize: 11, fontWeight: '800', color: '#9ca3af' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 1 },
});
