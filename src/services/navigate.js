// One tap = turn-by-turn voice navigation. Drivers do not need to read an address or type anything.
import { Linking, Platform, Alert } from 'react-native';

const ok = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0;

export function km(a, b) {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

export const stopOf = (o) => (ok(o.delivery_lat, o.delivery_lng) ? { lat: Number(o.delivery_lat), lng: Number(o.delivery_lng) } : null);

// Nearest-first order for several drops (greedy: always the closest next stop). `from` = {lat,lng} or null.
export function planStops(orders, from) {
  const withPos = orders.filter((o) => stopOf(o));
  const noPos = orders.filter((o) => !stopOf(o));
  const left = [...withPos];
  const out = [];
  let cur = from || (left[0] ? stopOf(left[0]) : null);
  while (left.length) {
    let bi = 0; let bd = Infinity;
    left.forEach((o, i) => { const d = cur ? km(cur, stopOf(o)) : 0; if (d < bd) { bd = d; bi = i; } });
    const o = left.splice(bi, 1)[0];
    out.push({ order: o, legKm: cur ? km(cur, stopOf(o)) : null });
    cur = stopOf(o);
  }
  return [...out, ...noPos.map((o) => ({ order: o, legKm: null }))];
}

async function tryOpen(urls) {
  for (const u of urls) {
    try { if (await Linking.canOpenURL(u)) { await Linking.openURL(u); return true; } } catch (e) { /* next */ }
  }
  // canOpenURL can be false on newer Android without <queries>; just try the web link
  try { await Linking.openURL(urls[urls.length - 1]); return true; } catch (e) { return false; }
}

// Start navigation to ONE customer.
export async function openNavigation(order) {
  const p = stopOf(order);
  if (!p && !order.delivery_address) { Alert.alert('No address', 'This order has no delivery address.'); return false; }
  const web = p
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving&dir_action=navigate`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving&dir_action=navigate`;
  const urls = [];
  if (p && Platform.OS === 'android') urls.push(`google.navigation:q=${p.lat},${p.lng}&mode=d`); // starts voice navigation at once
  if (p && Platform.OS === 'ios') urls.push(`comgooglemaps://?daddr=${p.lat},${p.lng}&directionsmode=driving`);
  urls.push(web);
  return tryOpen(urls);
}

// Google Maps route that visits several customers in the planned order (max 9 stops).
export async function openRoute(plan, from) {
  const stops = plan.map((x) => stopOf(x.order)).filter(Boolean).slice(0, 9);
  if (!stops.length) return false;
  if (stops.length === 1) return openNavigation(plan[0].order);
  const dest = stops[stops.length - 1];
  const mid = stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join('|');
  const origin = from ? `&origin=${from.lat},${from.lng}` : '';
  const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest.lat},${dest.lng}&waypoints=${encodeURIComponent(mid)}&travelmode=driving&dir_action=navigate`;
  try { await Linking.openURL(url); return true; } catch (e) { return false; }
}
