import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TripProvider } from '../state/TripProvider';
import { colors } from '../theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <TripProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: 'fade',
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="search"
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
              contentStyle: { backgroundColor: colors.paper },
            }}
          />
          <Stack.Screen name="details" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="navigate"
            options={{
              animation: 'fade',
              animationDuration: 320,
              contentStyle: { backgroundColor: colors.navInk },
            }}
          />
        </Stack>
      </TripProvider>
    </SafeAreaProvider>
  );
}
