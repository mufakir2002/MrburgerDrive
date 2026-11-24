import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { C, STATUS } from '../theme';

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: C.sub, bg: C.line };
  return (
    <View style={[st.badge, { backgroundColor: s.bg }]}>
      <Text style={[st.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function Header({ title, onBack, right }) {
  return (
    <View style={st.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={st.back} hitSlop={10}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
      ) : <View style={{ width: 40 }} />}
      <Text style={st.headerTitle}>{title}</Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[st.chip, active && st.chipActive]}>
      <Text style={[st.chipText, active && st.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Empty({ icon, title, text }) {
  return (
    <View style={st.empty}>
      <View style={st.emptyIcon}>{icon}</View>
      <Text style={st.emptyTitle}>{title}</Text>
      {text ? <Text style={st.emptyText}>{text}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.dark, paddingHorizontal: 16, paddingVertical: 14 },
  back: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  chipActive: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: 13, fontWeight: '700', color: C.sub },
  chipTextActive: { color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center' },
  emptyText: { fontSize: 13.5, color: C.sub, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
