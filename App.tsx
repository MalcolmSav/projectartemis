import 'react-native-gesture-handler';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
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

import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { usePresenceBroadcast } from './src/hooks/usePresenceBroadcast';
import { useEvents } from './src/hooks/useEvents';
import { useEventCheckinReminders } from './src/hooks/useEventCheckinReminders';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Schedules calendar-linked check-in notifications. Rendered as a sibling so its
// realtime-driven re-renders don't churn the navigation theme (which flickers).
function CalendarReminders() {
  const { events } = useEvents();
  useEventCheckinReminders(events);
  return null;
}

function GatedApp() {
  const t = useTheme();
  const { loading, profileLoading, isRecovery, session, profile } = useAuth();
  usePresenceBroadcast();

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
    <NavigationContainer theme={navTheme}>
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

  return (
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
  );
}
