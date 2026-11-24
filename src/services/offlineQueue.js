import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateOrderStatus, getMyOrder } from './api';

// Status updates ("on the way", "delivered") that could not reach the server because the phone had no
// signal. They are saved on the phone and sent automatically, in order, as soon as the connection is back.
// Photos are NOT queued: they need a connection at the moment of delivery.
const KEY = 'offline_status_queue_v1';
let flushing = false;
const listeners = new Set();

async function read() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch (e) { return []; }
}
async function write(list) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  listeners.forEach((l) => { try { l(list.length); } catch (e) { /* ignore */ } });
}

export async function enqueue(orderId, status, extra = {}) {
  const list = (await read()).filter((i) => !(i.orderId === orderId && i.status === status));
  list.push({ orderId, status, extra, at: Date.now() });
  await write(list);
}
export async function pendingCount() { return (await read()).length; }
export async function pendingFor(orderId) { return (await read()).filter((i) => i.orderId === orderId); }
export function subscribe(fn) { listeners.add(fn); pendingCount().then(fn); return () => listeners.delete(fn); }

// An update the server refused for good (4xx) is dropped, unless the order is already in that state.
async function alreadyApplied(item) {
  try { const r = await getMyOrder(item.orderId); return r.data?.data?.status === item.status; } catch (e) { return false; }
}

// Returns { sent, dropped } - dropped holds items the server rejected (shown to the driver once).
export async function flush() {
  if (flushing) return { sent: 0, dropped: [] };
  flushing = true;
  const out = { sent: 0, dropped: [] };
  try {
    let list = await read();
    while (list.length) {
      const item = list[0];
      try {
        await updateOrderStatus(item.orderId, item.status, item.extra || {});
        out.sent += 1;
      } catch (e) {
        const code = e.response?.status;
        if (!e.response || code >= 500 || code === 408 || code === 429) break; // still offline / server busy: keep and retry later
        if (await alreadyApplied(item)) out.sent += 1;
        else out.dropped.push({ ...item, message: e.response?.data?.message || 'The server did not accept this update.' });
      }
      list = list.slice(1);
      await write(list);
    }
  } finally { flushing = false; }
  return out;
}
