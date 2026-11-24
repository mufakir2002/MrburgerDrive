import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  setupForegroundNotificationListener,
  setupNotificationResponseListener,
  handleInitialNotification,
} from './src/services/notifications';
import './src/services/locationTracker'; // registers the background location task at startup

import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import MyOrdersScreen from './src/screens/MyOrdersScreen';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import { wrapApp } from './src/services/crash';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFC107" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!user ? (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

function App() {
  const navigationRef = useNavigationContainerRef();

  // Listeners are attached once, when the navigator is ready (the old code checked
  // isReady() too early, so notification taps never worked).
  const onReady = () => {
    handleInitialNotification(navigationRef);
  };
  useEffect(() => {
    const a = setupForegroundNotificationListener();
    const b = setupNotificationResponseListener(navigationRef);
    return () => { a.remove(); b.remove(); };
  }, [navigationRef]);

  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer ref={navigationRef} onReady={onReady}>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
});

export default wrapApp(App);
