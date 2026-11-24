import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Phone, MapPin, Navigation, MessageCircle, Banknote, CheckCircle2, Bike, Package, FileText, Wallet, XCircle, ThumbsUp } from 'lucide-react-native';
import { getMyOrder, updateOrderStatus, getActiveOrders, acceptOrder, declineOrder } from '../services/api';
import { syncTracking } from '../services/locationTracker';
import { C, shadow } from '../theme';
import { money, timeOf, dateOf, apiError, normalizePhone } from '../utils/format';
import { Header, StatusBadge } from '../components/ui';
import DeliveryProofSheet from '../components/DeliveryProofSheet';
import { enqueue, pendingFor, flush } from '../services/offlineQueue';
import { openNavigation } from '../services/navigate';

export default function OrderDetailsScreen({ route, navigation }) {
  const orderId = route.params?.orderId || route.params?.order?.id;
  const [order, setOrder] = useState(route.params?.order || null); // show what we have instantly
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      await flush(); // send anything saved while offline before reading the order
      const res = await getMyOrder(orderId);
      const waiting = await pendingFor(res.data.data.id);
      setOrder(waiting.length ? { ...res.data.data, status: waiting[waiting.length - 1].status, _queued: true } : res.data.data);
      setError('');
    } catch (e) {
      if (e.response?.status === 404) setError('This order is not assigned to you.');
      else if (!order) setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const refreshTracking = async () => {
    try { const r = await getActiveOrders(); await syncTracking(r.data.data || []); } catch (e) { /* dashboard will retry */ }
  };

  const setStatus = async (status, extra = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status, extra);
      setProofOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
      await refreshTracking();
      if (status === 'DELIVERED') {
        Alert.alert('Delivered ✅', 'Great job! The order is complete.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      if (!e.response) {
        // No signal: keep the update on the phone and send it automatically when we are back online.
        await enqueue(order.id, status, extra);
        setProofOpen(false);
        setOrder((o) => ({ ...o, status, _queued: true }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert('Saved - no signal', 'Your update is saved on this phone and will be sent automatically as soon as you are online. Keep the app installed.', status === 'DELIVERED' ? [{ text: 'OK', onPress: () => navigation.goBack() }] : undefined);
        return;
      }
      if (status === 'DELIVERED') { await load(); }
      Alert.alert('Could not update', apiError(e, 'Failed to update the order. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const doAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acceptOrder(order.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
    } catch (e) {
      Alert.alert('Could not accept', apiError(e));
      await load();
    } finally { setBusy(false); }
  };

  const doDecline = async (reason) => {
    setDeclineOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      await declineOrder(order.id, reason);
      Alert.alert('Order declined', 'Dispatch has been told and will give it to another driver.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Could not decline', apiError(e));
      await load();
    } finally { setBusy(false); }
  };

  const startDelivery = () =>
    Alert.alert('Start delivery?', 'The customer will see you are on the way and can follow your location.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Start', onPress: async () => { await setStatus('ON_THE_WAY'); openNavigation(order); } },
    ]);

  const markDelivered = () => setProofOpen(true);

  const call = () => order?.customer_phone && Linking.openURL(`tel:${order.customer_phone}`);
  const whatsapp = () => order?.customer_phone && Linking.openURL(`https://wa.me/${normalizePhone(order.customer_phone)}`);
  const navigate = () => openNavigation(order);

  if (!order && loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#FFC107" /></SafeAreaView>;
  }
  if (!order) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
        <Header title="Order" onBack={() => navigation.goBack()} />
        <View style={s.center}><Text style={s.errText}>{error || 'Order not found.'}</Text></View>
      </SafeAreaView>
    );
  }

  const status = order.status;
  const steps = [
    { key: 'ASSIGNED', label: 'Assigned' },
    { key: 'ON_THE_WAY', label: 'On the way' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];
  const idx = steps.findIndex((x) => x.key === status);
  const cancelled = status === 'CANCELLED';

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      <Header title={`Order #${order.order_number}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.small}>{dateOf(order.created_at)} · {timeOf(order.created_at)}</Text>
            <StatusBadge status={status} />
          </View>
          {!cancelled && (
            <View style={s.stepper}>
              {steps.map((st, i) => (
                <View key={st.key} style={s.stepWrap}>
                  <View style={[s.dot, i <= idx && s.dotOn]}>{i <= idx ? <CheckCircle2 size={14} color="#111827" /> : null}</View>
                  <Text style={[s.stepLabel, i <= idx && { color: C.ink }]}>{st.label}</Text>
                  {i < steps.length - 1 && <View style={[s.bar, i < idx && s.barOn]} />}
                </View>
              ))}
            </View>
          )}
        </View>

        {order.cash_due ? (
          <View style={s.cash}>
            <Banknote size={26} color="#92400e" />
            <View style={{ flex: 1 }}>
              <Text style={s.cashLabel}>COLLECT CASH FROM CUSTOMER</Text>
              <Text style={s.cashAmt}>{money(order.total_amount)}</Text>
            </View>
          </View>
        ) : (
          <View style={s.paid}>
            <Wallet size={22} color="#166534" />
            <Text style={s.paidText}>{order.payment_method_name ? `Paid via ${order.payment_method_name}` : 'Paid'} — nothing to collect</Text>
            <Text style={s.paidAmt}>{money(order.total_amount)}</Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.title}>Customer</Text>
          <Text style={s.cust}>{order.customer_name}</Text>
          <Text style={s.small}>{order.customer_phone}</Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.outBtn} onPress={call}><Phone size={18} color={C.ink} /><Text style={s.outText}>Call</Text></TouchableOpacity>
            <TouchableOpacity style={s.outBtn} onPress={whatsapp}><MessageCircle size={18} color="#16a34a" /><Text style={s.outText}>WhatsApp</Text></TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Deliver to</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <MapPin size={18} color={C.red} style={{ marginTop: 2 }} />
            <Text style={s.addr}>{order.delivery_address || 'No address provided'}</Text>
          </View>
          <TouchableOpacity style={s.bigGo} onPress={navigate} activeOpacity={0.9}>
            <Navigation size={26} color="#fff" /><Text style={s.bigGoText}>GO TO CUSTOMER</Text>
          </TouchableOpacity>
          <Text style={s.bigGoHint}>Opens Google Maps with voice directions</Text>
        </View>

        {order.notes ? (
          <View style={[s.card, { backgroundColor: '#FFFBEB' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FileText size={16} color="#92400e" /><Text style={[s.title, { color: '#92400e' }]}>Customer note</Text></View>
            <Text style={[s.addr, { marginTop: 6 }]}>{order.notes}</Text>
          </View>
        ) : null}

        {order.items?.length ? (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Package size={16} color={C.ink} /><Text style={s.title}>Items</Text></View>
            {order.items.map((it, i) => (
              <View key={i} style={s.itemRow}>
                <Text style={s.itemQty}>{it.quantity}×</Text>
                <Text style={s.itemName}>{it.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {status === 'DELIVERED' && (
          <View style={s.earned}>
            <Text style={s.earnedLabel}>You earned</Text>
            <Text style={s.earnedAmt}>{money(order.driver_commission)}</Text>
          </View>
        )}
      </ScrollView>

      {status === 'ASSIGNED' && !order.accepted && (
        <View style={[s.footer, { flexDirection: 'row', gap: 12 }]}>
          <TouchableOpacity style={[s.primary, s.declineBtn]} onPress={() => setDeclineOpen(true)} disabled={busy} activeOpacity={0.85}>
            <XCircle size={19} color={C.red} /><Text style={[s.primaryText, { color: C.red, fontSize: 15 }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.primary, { flex: 1.4 }]} onPress={doAccept} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color="#111827" /> : <><ThumbsUp size={19} color="#111827" /><Text style={s.primaryText}>Accept order</Text></>}
          </TouchableOpacity>
        </View>
      )}

      <DeliveryProofSheet visible={proofOpen} order={order} busy={busy} onClose={() => setProofOpen(false)} onConfirm={(extra) => setStatus('DELIVERED', extra)} />

      <Modal visible={declineOpen} transparent animationType="slide" onRequestClose={() => setDeclineOpen(false)}>
        <View style={s.sheetBackdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Why are you declining?</Text>
            {['Too far from me', 'Vehicle problem', 'I am busy / on another order', 'Other reason'].map((r) => (
              <TouchableOpacity key={r} style={s.sheetRow} onPress={() => doDecline(r)} activeOpacity={0.7}>
                <Text style={s.sheetRowText}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.sheetRow, { borderBottomWidth: 0 }]} onPress={() => setDeclineOpen(false)}>
              <Text style={[s.sheetRowText, { color: C.sub, textAlign: 'center' }]}>Keep the order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {((status === 'ASSIGNED' && order.accepted) || status === 'ON_THE_WAY') && (
        <View style={s.footer}>
          {status === 'ASSIGNED' ? (
            <TouchableOpacity style={s.primary} onPress={startDelivery} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color="#111827" /> : <><Bike size={20} color="#111827" /><Text style={s.primaryText}>Start delivery</Text></>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.primary, { backgroundColor: C.green }]} onPress={markDelivered} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color="#fff" /> : <><CheckCircle2 size={20} color="#fff" /><Text style={[s.primaryText, { color: '#fff' }]}>Mark as delivered</Text></>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bigGo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#16a34a', borderRadius: 16, paddingVertical: 18, marginTop: 14 },
  bigGoText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
  bigGoHint: { textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 6, fontWeight: '600' },
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  errText: { color: C.sub, fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, ...shadow },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontSize: 12.5, color: C.sub, fontWeight: '600' },
  title: { fontSize: 13, fontWeight: '900', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepper: { flexDirection: 'row', marginTop: 18 },
  stepWrap: { flex: 1, alignItems: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  dotOn: { backgroundColor: C.accent },
  stepLabel: { fontSize: 11.5, fontWeight: '800', color: C.mute, marginTop: 6 },
  bar: { position: 'absolute', top: 12, left: '50%', width: '100%', height: 3, backgroundColor: C.line, zIndex: 1 },
  barOn: { backgroundColor: C.accent },
  cash: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.amberBg, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: '#FCD34D' },
  cashLabel: { fontSize: 11.5, fontWeight: '900', color: '#92400e', letterSpacing: 0.5 },
  cashAmt: { fontSize: 32, fontWeight: '900', color: '#78350f' },
  paid: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.greenBg, borderRadius: 18, padding: 14, marginBottom: 12 },
  paidText: { flex: 1, color: '#166534', fontWeight: '800', fontSize: 13 },
  paidAmt: { color: '#166534', fontWeight: '900', fontSize: 15 },
  cust: { fontSize: 18, fontWeight: '900', color: C.ink, marginTop: 6 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  outBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 14, paddingVertical: 13 },
  outText: { fontWeight: '800', color: C.ink, fontSize: 14 },
  addr: { flex: 1, fontSize: 15, color: C.ink, lineHeight: 22, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  itemQty: { fontWeight: '900', color: C.ink, width: 34 },
  itemName: { flex: 1, color: C.ink, fontWeight: '600', fontSize: 14.5 },
  earned: { backgroundColor: C.dark, borderRadius: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnedLabel: { color: '#9ca3af', fontWeight: '800' },
  earnedAmt: { color: C.accent, fontSize: 26, fontWeight: '900' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line },
  primary: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 16, paddingVertical: 17 },
  declineBtn: { flex: 1, backgroundColor: C.redBg },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 30 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: C.ink, marginBottom: 8 },
  sheetRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetRowText: { fontSize: 15.5, fontWeight: '700', color: C.ink },
  primaryText: { fontSize: 17, fontWeight: '900', color: '#111827' },
});
