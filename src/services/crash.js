// Crash reporting (Sentry). Does nothing until you put a DSN in app.json -> expo.extra.sentryDsn,
// so the app is safe to build before the Sentry account exists.
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

const dsn = Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN || '';
let on = false;
try {
  if (dsn) {
    Sentry.init({
      dsn,
      enabled: !__DEV__,
      tracesSampleRate: 0,        // crashes only: keeps data use minimal on weak connections
      sendDefaultPii: false,      // never send names, phones or tokens
      release: Constants.expoConfig?.version,
      beforeSend(event) { if (event.request) delete event.request.cookies; return event; },
    });
    on = true;
  }
} catch (e) { /* never break the app because of reporting */ }

export const wrapApp = (App) => (on ? Sentry.wrap(App) : App);
export const setCrashUser = (id) => { if (on) try { Sentry.setUser(id ? { id: String(id) } : null); } catch (e) { /* ignore */ } };
export const reportError = (e, ctx) => { if (on) try { Sentry.captureException(e, ctx ? { extra: ctx } : undefined); } catch (x) { /* ignore */ } };
