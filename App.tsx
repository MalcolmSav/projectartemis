import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
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
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AppStateProvider } from './src/state/AppState';
import { AuthProvider, useAuth } from './src/state/Auth';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PinModal } from './src/components/PinModal';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { usePresenceBroadcast } from './src/hooks/usePresenceBroadcast';

SplashScreen.preventAutoHideAsync().catch(() => {});

function GatedApp() {
  const t = useTheme();
  const { loading, session, profile } = useAuth();
  usePresenceBroadcast();

  const navTheme = {
    ...(t.mode === 'night' ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.mode === 'night' ? DarkTheme.colors : DefaultTheme.colors),
      background: t.colors.ivoryBg,
      card: t.colors.parchment,
      text: t.colors.ink,
      border: t.colors.hairline,
      primary: t.colors.forest700,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (profile && !profile.onboarded) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
      <PinModal />
    </NavigationContainer>
  );
}

export default function App() {
  const [fr] = useFraunces({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const [dm] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const ready = fr && dm;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  void ready;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialMode="light">
          <AuthProvider>
            <AppStateProvider>
              <StatusBar style="dark" />
              <GatedApp />
            </AppStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
