// One place that shares the driver's live location with customers.
// Uses a foreground-service location task so it keeps working with the screen
// off / app in background. Import this file once at startup (App.js) so the
// task is registered before Android wakes the app for a location update.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDriverLocation } from './api';

const TASK = 'mrb-driver-location-task';
const IDS_KEY = 'mrb_tracked_order_ids';
const ASKED_BG_KEY = 'mrb_asked_bg_location';

let fgSub = null;          // fallback foreground watcher
let currentIds = '';       // last ids we configured, to avoid restarting needlessly

async function pushLocation(coords) {
  let ids = [];
  try { ids = JSON.parse((await AsyncStorage.getItem(IDS_KEY)) || '[]'); } catch (e) { ids = []; }
  if (!ids.length) return;
  await Promise.all(ids.map((id) => updateDriverLocation(coords.latitude, coords.longitude, id).catch(() => {})));
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const last = data.locations[data.locations.length - 1];
  await pushLocation(last.coords);
});

async function stopAll() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch (e) { /* not running */ }
  if (fgSub) { fgSub.remove(); fgSub = null; }
}

export async function stopTracking() {
  currentIds = '';
  await AsyncStorage.removeItem(IDS_KEY).catch(() => {});
  await stopAll();
}

// Call with every order that is currently ON_THE_WAY. Empty list = stop sharing.
export async function syncTracking(orders) {
  // share while heading to the restaurant (after accepting) and while delivering
  const ids = (orders || []).filter((o) => o.status === 'ON_THE_WAY' || (o.status === 'ASSIGNED' && o.accepted)).map((o) => o.id).sort();
  const key = ids.join(',');
  if (!ids.length) { if (currentIds) await stopTracking(); return { ok: true, tracking: false }; }
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids)).catch(() => {});
  if (key === currentIds) return { ok: true, tracking: true };

  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { ok: false, reason: 'PERMISSION' };

    // Ask for "all the time" access once; sharing still works while the app is open if refused.
    const asked = await AsyncStorage.getItem(ASKED_BG_KEY);
    if (!asked) {
      await AsyncStorage.setItem(ASKED_BG_KEY, '1');
      try { await Location.requestBackgroundPermissionsAsync(); } catch (e) { /* ignore */ }
    }

    await stopAll();
    try {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 8000,
        distanceInterval: 15,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Mr Burger delivery in progress',
          notificationBody: 'Sharing your live location with the customer.',
          notificationColor: '#FFC107',
        },
      });
    } catch (e) {
      // Fallback: only while the app is open
      fgSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 },
        (loc) => { pushLocation(loc.coords); }
      );
    }
    currentIds = key;
    return { ok: true, tracking: true };
  } catch (e) {
    return { ok: false, reason: 'ERROR' };
  }
}
