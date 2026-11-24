import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { savePushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'New orders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#FFC107',
  });
}

// Registers this phone for push so dispatch can notify the driver. Safe to call repeatedly.
export async function registerForPushNotifications() {
  try {
    await ensureChannel();
    if (!Device.isDevice) return null;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token) await savePushToken(token);
    return token;
  } catch (e) {
    return null;
  }
}

export function setupForegroundNotificationListener() {
  return Notifications.addNotificationReceivedListener(() => {});
}

const openOrder = (navigationRef, data) => {
  const id = data?.orderId || data?.order_id;
  if (id && navigationRef?.isReady?.()) navigationRef.navigate('OrderDetails', { orderId: id });
};

export function setupNotificationResponseListener(navigationRef) {
  return Notifications.addNotificationResponseReceivedListener((r) => {
    openOrder(navigationRef, r.notification.request.content.data);
  });
}

// App opened by tapping a notification while it was closed
export async function handleInitialNotification(navigationRef) {
  try {
    const r = await Notifications.getLastNotificationResponseAsync();
    if (r) openOrder(navigationRef, r.notification.request.content.data);
  } catch (e) { /* ignore */ }
}
