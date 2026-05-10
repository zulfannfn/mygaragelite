import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';
import { Toast } from '../src/components/ui/Toast';
import { theme } from '../src/constants/theme';
import { initDatabase } from '../src/database/db';
import { useAppStore } from '../src/store/useAppStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSettings = useAppStore((s) => s.loadSettings);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await loadSettings();
        setReady(true);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal inisialisasi database');
        setReady(true);
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, [loadSettings]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: theme.colors.accent,
            fontSize: 32,
            fontWeight: '800',
            marginBottom: 8,
          }}
        >
          MyGarage
        </Text>
        <Text style={{ color: theme.colors.textSecondary, marginBottom: 24 }}>Lite</Text>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: theme.colors.danger, fontSize: 16, textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="customer-form"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="sparepart-form"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="transaction-form"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="transaction-detail" />
          <Stack.Screen name="customer-detail" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="reminders" />
        </Stack>
        <Toast />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
