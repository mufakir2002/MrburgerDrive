import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { Camera, CheckCircle2, KeyRound, Banknote } from 'lucide-react-native';
import { uploadDeliveryPhoto } from '../services/api';
import { C } from '../theme';
import { money, apiError } from '../utils/format';

const REASONS = ['Customer not answering', 'Left at the door', 'Customer has no app', 'Other'];

// Bottom sheet shown when the driver taps "Mark as delivered".
// The customer reads out a 4-digit code (shown in their app), or the driver takes a photo.
export default function DeliveryProofSheet({ visible, order, busy, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const hasPhoto = photo || order?.has_photo;
  const required = !!order?.proof_required;
  const cash = !!order?.cash_due;
  const codeOk = /^\d{4}$/.test(code);
  const hasProof = codeOk || hasPhoto;

  const takePhoto = async () => {
    setErr('');
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setErr('Camera permission is needed to take the photo.'); return; }
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
      if (shot.canceled || !shot.assets?.length) return;
      setUploading(true);
      const small = await ImageManipulator.manipulateAsync(
        shot.assets[0].uri, [{ resize: { width: 1000 } }], { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      await uploadDeliveryPhoto(order.id, small.base64);
      setPhoto(true);
    } catch (e) {
      setErr(apiError(e, 'Could not save the photo. Check your internet and try again.'));
    } finally { setUploading(false); }
  };

  const confirm = async () => {
    setErr('');
    if (required && !hasProof) { setErr("Enter the customer's code or take a photo first."); return; }
    const send = async () => {
      let lat; let lng;
      try {
        const p = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
        if (p) { lat = p.coords.latitude; lng = p.coords.longitude; }
      } catch (e) { /* location is optional */ }
      onConfirm({
        ...(codeOk ? { proof_code: code } : {}),
        ...(reason ? { proof_reason: reason } : {}),
        ...(lat !== undefined ? { proof_lat: lat, proof_lng: lng } : {}),
      });
    };
    if (!hasProof) {
      Alert.alert('No proof?', 'Without the code or a photo, nobody can check this delivery later. Continue anyway?', [
        { text: 'Go back', style: 'cancel' }, { text: 'Continue', onPress: send },
      ]);
      return;
    }
    send();
  };

  if (!order) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={st.title}>Confirm delivery</Text>
            {cash && (
              <View style={st.cash}><Banknote size={18} color={C.amber} /><Text style={st.cashText}>Collect {money(order.total_amount)} cash before you continue.</Text></View>
            )}

            <Text style={st.label}>1. Ask the customer for their code</Text>
            <View style={st.codeRow}>
              <KeyRound size={20} color={C.sub} />
              <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4}
                placeholder="4-digit code" placeholderTextColor={C.mute} style={st.codeInput} editable={!order.code_locked} />
              {codeOk && <CheckCircle2 size={20} color={C.green} />}
            </View>
            <Text style={st.hint}>It is shown in the customer's app while you are on the way.</Text>

            <Text style={[st.label, { marginTop: 16 }]}>2. Or take a photo</Text>
            <TouchableOpacity style={[st.photoBtn, hasPhoto && st.photoDone]} onPress={takePhoto} disabled={uploading} activeOpacity={0.85}>
              {uploading ? <ActivityIndicator color={C.ink} /> : hasPhoto
                ? <><CheckCircle2 size={20} color={C.green} /><Text style={[st.photoText, { color: C.green }]}>Photo saved · tap to retake</Text></>
                : <><Camera size={20} color={C.ink} /><Text style={st.photoText}>Take photo of the delivery</Text></>}
            </TouchableOpacity>

            {!codeOk && (
              <>
                <Text style={[st.label, { marginTop: 16 }]}>Note (optional)</Text>
                <View style={st.chips}>
                  {REASONS.map((r) => (
                    <TouchableOpacity key={r} onPress={() => setReason(reason === r ? '' : r)} style={[st.chip, reason === r && st.chipOn]} activeOpacity={0.8}>
                      <Text style={[st.chipText, reason === r && { color: '#111827' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!!err && <Text style={st.err}>{err}</Text>}
            {required && !hasProof && !err && <Text style={st.req}>Proof is required for this order.</Text>}

            <View style={st.actions}>
              <TouchableOpacity style={st.cancel} onPress={onClose} disabled={busy} activeOpacity={0.85}><Text style={st.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[st.ok, (busy || uploading || (required && !hasProof)) && { opacity: 0.5 }]} onPress={confirm}
                disabled={busy || uploading || (required && !hasProof)} activeOpacity={0.9}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.okText}>Confirm delivered</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, maxHeight: '88%' },
  title: { fontSize: 20, fontWeight: '900', color: C.ink, marginBottom: 12 },
  cash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, borderRadius: 12, padding: 12, marginBottom: 14 },
  cashText: { flex: 1, color: C.amber, fontWeight: '800', fontSize: 13.5 },
  label: { fontSize: 13, fontWeight: '900', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.bg },
  codeInput: { flex: 1, fontSize: 24, fontWeight: '900', letterSpacing: 8, color: C.ink, paddingVertical: 12 },
  hint: { fontSize: 12, color: C.mute, marginTop: 6 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingVertical: 15, backgroundColor: C.bg },
  photoDone: { borderColor: C.green, backgroundColor: C.greenBg },
  photoText: { fontSize: 15, fontWeight: '800', color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 13, fontWeight: '700', color: C.sub },
  err: { color: C.red, fontWeight: '700', fontSize: 13.5, marginTop: 14 },
  req: { color: C.amber, fontWeight: '700', fontSize: 13, marginTop: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancel: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: C.bg },
  cancelText: { fontWeight: '800', color: C.sub, fontSize: 15 },
  ok: { flex: 1.6, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: C.green },
  okText: { fontWeight: '900', color: '#fff', fontSize: 16 },
});
