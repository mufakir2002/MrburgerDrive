import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications (Expo Go compatible)
 */
export async function registerForPushNotifications() {
  let token;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push token for push notification!');
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('✅ Push token:', token);
    return token;
  } catch (error) {
    console.log('❌ Error registering for notifications:', error);
    return null;
  }
}

/**
 * Setup foreground notification listener
 */
export function setupForegroundNotificationListener(navigationRef) {
  return Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 Notification received in foreground:', notification);
  });
}

/**
 * Setup notification response listener (when user taps notification)
 */
export function setupNotificationResponseListener(navigationRef) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 User tapped notification:', response);
  });
}

/**
 * Simulate incoming notification (for testing in Expo Go)
 */
export function simulateIncomingNotification(title, body, data = {}) {
  Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}