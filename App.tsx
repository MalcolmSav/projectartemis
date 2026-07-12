import 'react-native-gesture-handler';
// Must be imported before any component so TaskManager registers the task
// before the OS tries to deliver a background location update.
import './src/tasks/locationTask';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import {
  useFonts as useFraunces,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  useFonts as useDMSans,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { LanguageProvider } from './src/i18n';
import { AppStateProvider } from './src/state/AppState';
import { AuthProvider, useAuth } from './src/state/Auth';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OfflineBanner } from './src/components';
import { RootStackParamList } from './src/navigation/types';

import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { usePresenceBroadcast } from './src/hooks/usePresenceBroadcast';
import { useEvents } from './src/hooks/useEvents';
import { useEventCheckinReminders } from './src/hooks/useEventCheckinReminders';
import { registerPushToken } from './src/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Navigation ref used by the notification tap handler (outside NavigationContainer scope).
const navRef = createNavigationContainerRef<RootStackParamList>();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidMount() { SplashScreen.hideAsync().catch(() => {}); }
  componentDidCatch() { SplashScreen.hideAsync().catch(() => {}); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ScrollView contentContainerStyle={{ flex: 1, padding: 32, paddingTop: 80, backgroundColor: '#1A0908' }}>
        <Text style={{ color: '#FF6B6B', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
          App crashed on startup
        </Text>
        <Text style={{ color: '#F2EFE3', fontFamily: 'Courier', fontSize: 13, lineHeight: 20 }}>
          {error.message}
        </Text>
        {!!error.stack && (
          <Text style={{ color: 'rgba(242,239,227,0.5)', fontFamily: 'Courier', fontSize: 11, marginTop: 16, lineHeight: 16 }}>
            {error.stack}
          </Text>
        )}
      </ScrollView>
    );
  }
}

// Schedules calendar-linked check-in notifications. Rendered as a sibling so its
// realtime-driven re-renders don't churn the navigation theme (which flickers).
function CalendarReminders() {
  const { events } = useEvents();
  useEventCheckinReminders(events);
  return null;
}

function handleNotificationTap(data: Record<string, unknown> | undefined) {
  if (!data || !navRef.isReady()) return;
  const type = data.type as string | undefined;

  if (type === 'wellness_check') {
    // Open the response screen — friend is checking in on us
    navRef.navigate('WellnessIncoming', {
      fromId: data.fromId as string | undefined,
      fromName: data.fromName as string | undefined,
    });
  } else if (type === 'alarm') {
    // Open full-screen alarm — someone in circle raised an emergency
    navRef.navigate('AlarmActive');
  } else if (type === 'wellness_need_help') {
    // Friend needs help — go to their profile so we can act
    if (data.fromId) navRef.navigate('CirclePerson', { id: data.fromId as string });
    else navRef.navigate('Tabs');
  } else if (type === 'wellness_ok') {
    // Friend is OK — just open the app, HomeScreen shows the response
    navRef.navigate('Tabs');
  } else if (type === 'circle_invite' || type === 'circle_accepted') {
    // Open the app — Circle tab will show the pending invite or new member
    navRef.navigate('Tabs');
  } else if (type === 'trip_started' && data.tripId) {
    // Open the trip follow screen
    navRef.navigate('TripFollow', { tripId: data.tripId as string });
  } else if (type === 'trip_arrived' || type === 'trip_cancelled' || type === 'trip_escalated') {
    navRef.navigate('Tabs');
  } else if (type === 'message' && data.fromId) {
    // Open the chat with that person
    navRef.navigate('Chat', { userId: data.fromId as string });
  }
}

function GatedApp() {
  const t = useTheme();
  const { loading, profileLoading, isRecovery, session, profile } = useAuth();
  usePresenceBroadcast();

  // Register push token once the user is signed in and their profile is loaded.
  useEffect(() => {
    if (session?.user?.id && profile?.onboarded) {
      registerPushToken(session.user.id);
    }
  }, [session?.user?.id, profile?.onboarded]);

  const navTheme = useMemo(
    () => ({
      ...(t.mode === 'night' ? DarkTheme : DefaultTheme),
      colors: {
        ...(t.mode === 'night' ? DarkTheme.colors : DefaultTheme.colors),
        background: t.colors.ivoryBg,
        card: t.colors.parchment,
        text: t.colors.ink,
        border: t.colors.hairline,
        primary: t.colors.forest700,
      },
    }),
    [t.mode, t.colors],
  );

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (isRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!profile?.onboarded) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fr, frError] = useFraunces({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const [dm, dmError] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Hide splash once fonts are done — whether they succeeded or failed.
  // Without the error check the splash hangs forever if fonts don't load.
  const ready = (fr || !!frError) && (dm || !!dmError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Handle notification taps — both from background (listener) and cold-start
  // (getLastNotificationResponseAsync). navRef.isReady() guards against the
  // NavigationContainer not being mounted yet on cold launch.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    // Cold-start: if the user tapped a notification that launched the app
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        // Small delay to let NavigationContainer mount
        setTimeout(() => {
          handleNotificationTap(
            response.notification.request.content.data as Record<string, unknown>,
          );
        }, 500);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider initialMode="light">
            <LanguageProvider>
              <AuthProvider>
                <AppStateProvider>
                  <StatusBar style="dark" />
                  <GatedApp />
                  <CalendarReminders />
                  <OfflineBanner />
                </AppStateProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
