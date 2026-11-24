import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, XCircle, DollarSign, Banknote, Timer, Star, TrendingUp } from 'lucide-react-native';
import { getReport, getSettlements } from '../services/api';
import { C, shadow } from '../theme';
import { money, dayLabel, apiError } from '../utils/format';
import { Header, Chip } from '../components/ui';

const PERIODS = [['today', 'Today'], ['week', '7 days'], ['month', 'Month'], ['all', 'All time']];
const LABEL = { today: "Today's earnings", week: 'Earnings · last 7 days', month: 'Earnings · this month', all: 'Total earnings' };

function fillDays(daily, n) {
  const map = Object.fromEntries((daily || []).map((d) => [d.day, d]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3600 * 1000 - i * 86400000); // Mogadishu is UTC+3
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, commission: map[key]?.commission || 0, delivered: map[key]?.delivered || 0 });
  }
  return out;
}

export default function ReportsScreen({ navigation }) {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await getReport(period);
      setData(res.data.data);
      setError('');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { getSettlements().then((r) => setPayments(r.data.data || [])).catch(() => {}); }, []);

  const goOrders = (status) => navigation.navigate('MyOrders', { status, period });

  const days = data ? fillDays(data.daily, period === 'month' ? 14 : 7) : [];
  const max = Math.max(1, ...days.map((d) => d.commission));
  const rate = data?.commissionRate;
  const rateText = rate ? (rate.type === 'PERCENT' ? `${rate.value}% of each delivered order` : `${money(rate.value)} per delivered order`) : '';

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Reports" onBack={() => navigation.goBack()} />
      <View style={s.chips}>
        {PERIODS.map(([k, l]) => <Chip key={k} label={l} active={period === k} onPress={() => setPeriod(k)} />)}
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#FFC107" />
      ) : !data ? (
        <View style={s.err}><Text style={s.errText}>{error || 'No data'}</Text>
          <TouchableOpacity style={s.retry} onPress={() => { setLoading(true); load(); }}><Text style={s.retryText}>Try again</Text></TouchableOpacity></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFC107" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <Text style={s.heroLabel}>{LABEL[period]}</Text>
            <Text style={s.heroAmt}>{money(data.commission)}</Text>
            <View style={s.heroNote}><TrendingUp size={14} color="#FFC107" /><Text style={s.heroNoteText}>{rateText}</Text></View>
          </View>

          <View style={s.balanceCard}>
            <Text style={s.balanceTitle}>My balance</Text>
            <View style={s.balanceRow}>
              <View style={s.balanceCol}>
                <Text style={s.balanceLabel}>Cash to hand in</Text>
                <Text style={[s.balanceAmt, data.balance.cashOwed > 0 && { color: C.red }]}>{money(data.balance.cashOwed)}</Text>
                <Text style={s.balanceSub}>{money(data.balance.cashHandedIn)} of {money(data.balance.cashCollected)} handed in</Text>
              </View>
              <View style={s.balanceSep} />
              <View style={s.balanceCol}>
                <Text style={s.balanceLabel}>Commission to receive</Text>
                <Text style={[s.balanceAmt, data.balance.commissionUnpaid > 0 && { color: C.green }]}>{money(data.balance.commissionUnpaid)}</Text>
                <Text style={s.balanceSub}>{money(data.balance.commissionPaid)} of {money(data.balance.commissionEarned)} paid</Text>
              </View>
            </View>
            {payments.length > 0 && (
              <View style={s.payList}>
                <Text style={s.payHead}>Recent payments</Text>
                {payments.slice(0, 5).map((p) => (
                  <View key={p.id} style={s.payRow}>
                    <Text style={s.payType}>{p.type === 'CASH_RECEIVED' ? 'Cash handed in' : 'Commission paid to you'}</Text>
                    <Text style={[s.payAmt, { color: p.type === 'CASH_RECEIVED' ? C.ink : C.green }]}>{money(p.amount)}</Text>
                    <Text style={s.payDate}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={s.grid}>
            <Kpi icon={CheckCircle2} color={C.green} bg={C.greenBg} label="Completed" value={data.delivered} onPress={() => goOrders('delivered')} />
            <Kpi icon={Clock} color={C.blue} bg={C.blueBg} label="Pending now" value={data.pending}
              sub={data.pending ? `${data.assigned} assigned · ${data.onTheWay} on the way` : null} onPress={() => goOrders('active')} />
            <Kpi icon={XCircle} color={C.red} bg={C.redBg} label="Cancelled" value={data.cancelled} onPress={() => goOrders('cancelled')} />
            <Kpi icon={DollarSign} color="#7C3AED" bg="#EDE9FE" label="Sales delivered" value={money(data.sales)} />
            <Kpi icon={Banknote} color={C.amber} bg={C.amberBg} label="Cash collected" value={money(data.cashCollected)} sub={`${data.cashOrders} cash order${data.cashOrders === 1 ? '' : 's'}`} />
            <Kpi icon={Timer} color="#0891B2" bg="#CFFAFE" label="Avg delivery time" value={data.avgMinutes ? `${data.avgMinutes} min` : '—'} />
          </View>

          {period !== 'today' && period !== 'all' && (
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Daily earnings</Text>
              <View style={s.chart}>
                {days.map((d) => (
                  <View key={d.day} style={s.barCol}>
                    <Text style={s.barVal}>{d.commission > 0 ? `$${Math.round(d.commission)}` : ''}</Text>
                    <View style={s.barTrack}><View style={[s.bar, { height: `${Math.max(d.commission > 0 ? 6 : 0, (d.commission / max) * 100)}%` }]} /></View>
                    <Text style={s.barDay}>{period === 'month' ? d.day.slice(8) : dayLabel(d.day)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={s.ratingCard}>
            <View style={s.ratingLeft}>
              <Star size={22} color="#FFC107" fill="#FFC107" />
              <Text style={s.ratingNum}>{data.rating ? data.rating.toFixed(1) : '—'}</Text>
            </View>
            <Text style={s.ratingText}>{data.reviews} customer review{data.reviews === 1 ? '' : 's'}</Text>
          </View>

          <View style={s.allTime}>
            <Text style={s.allTimeTitle}>Since you joined</Text>
            <Text style={s.allTimeText}>{data.allTime.delivered} deliveries · {money(data.allTime.commission)} earned</Text>
          </View>
          <Text style={s.foot}>Earnings are counted when an order is marked delivered. Cancelled orders earn nothing.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Kpi({ icon: Icon, color, bg, label, value, sub, onPress }) {
  return (
    <TouchableOpacity style={s.kpi} activeOpacity={onPress ? 0.8 : 1} onPress={onPress} disabled={!onPress}>
      <View style={[s.kpiIcon, { backgroundColor: bg }]}><Icon size={18} color={color} /></View>
      <Text style={s.kpiVal}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  err: { alignItems: 'center', marginTop: 70, padding: 24 },
  errText: { color: C.sub, textAlign: 'center', fontSize: 15 },
  retry: { backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  retryText: { fontWeight: '900', color: '#111827' },
  hero: { backgroundColor: C.dark, borderRadius: 24, padding: 22, ...shadow },
  heroLabel: { color: '#9ca3af', fontWeight: '700', fontSize: 13 },
  heroAmt: { color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 4 },
  heroNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  heroNoteText: { color: '#FFC107', fontWeight: '700', fontSize: 12.5 },
  balanceCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginTop: 14, ...shadow },
  balanceTitle: { fontSize: 14, fontWeight: '900', color: C.ink, marginBottom: 12 },
  balanceRow: { flexDirection: 'row' },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceSep: { width: 1, backgroundColor: C.line },
  balanceLabel: { fontSize: 12, fontWeight: '800', color: C.sub },
  balanceAmt: { fontSize: 24, fontWeight: '900', color: C.mute, marginTop: 4 },
  balanceSub: { fontSize: 11, color: C.mute, fontWeight: '600', marginTop: 3 },
  payList: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  payHead: { fontSize: 12, fontWeight: '900', color: C.sub, marginBottom: 6 },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  payType: { flex: 1, fontSize: 13, fontWeight: '700', color: C.ink },
  payAmt: { fontSize: 13.5, fontWeight: '900', marginRight: 12 },
  payDate: { fontSize: 11.5, color: C.mute, fontWeight: '700', width: 48, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  kpi: { width: '47.8%', backgroundColor: '#fff', borderRadius: 20, padding: 14, ...shadow },
  kpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 10 },
  kpiLabel: { fontSize: 12.5, fontWeight: '700', color: C.sub, marginTop: 2 },
  kpiSub: { fontSize: 11, color: C.mute, marginTop: 4, fontWeight: '600' },
  chartCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginTop: 14, ...shadow },
  chartTitle: { fontSize: 14, fontWeight: '900', color: C.ink, marginBottom: 12 },
  chart: { flexDirection: 'row', height: 150, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, height: '100%', alignItems: 'center' },
  barVal: { fontSize: 9.5, fontWeight: '800', color: C.sub, height: 14 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', backgroundColor: C.accent, borderRadius: 6, minHeight: 0 },
  barDay: { fontSize: 10.5, color: C.mute, fontWeight: '700', marginTop: 6 },
  ratingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 14, ...shadow },
  ratingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingNum: { fontSize: 26, fontWeight: '900', color: C.ink },
  ratingText: { color: C.sub, fontWeight: '700', fontSize: 13 },
  allTime: { backgroundColor: C.dark2, borderRadius: 20, padding: 16, marginTop: 14 },
  allTimeTitle: { color: '#9ca3af', fontWeight: '800', fontSize: 12.5 },
  allTimeText: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 4 },
  foot: { textAlign: 'center', color: C.mute, fontSize: 11.5, marginTop: 14, paddingHorizontal: 20, lineHeight: 17 },
});
