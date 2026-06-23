import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../src/components/ui/Toast';
import { darkTheme, lightTheme } from '../src/constants/theme';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { initDatabase } from '../src/database/db';
import { initializeAds } from '../src/services/adsInit';
import { useAppStore } from '../src/store/useAppStore';
import { checkOnline } from '../src/utils/network';

function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOnlineRef = useRef<boolean | null>(null);
  const resetOfflineTxCount = useAppStore((s) => s.resetOfflineTxCount);

  useEffect(() => {
    const check = async () => {
      const result = await checkOnline();
      setOnline(result);
      if (result && prevOnlineRef.current === false) {
        resetOfflineTxCount();
      }
      prevOnlineRef.current = result;
    };
    check();
    timerRef.current = setInterval(check, 12000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [resetOfflineTxCount]);

  if (online) return null;

  return (
    <View
      style={{
        backgroundColor: '#B45309',
        paddingTop: insets.top + 7,
        paddingBottom: 7,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={15} color="#FEF3C7" />
      <Text style={{ color: '#FEF3C7', fontSize: 12, fontWeight: '600', flex: 1 }}>
        Offline · Butuh internet untuk kelancaran transaksi
      </Text>
    </View>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await loadSettings();
        setReady(true);
        initializeAds().catch(() => {});
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
          backgroundColor: darkTheme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: darkTheme.colors.accent,
            fontSize: 32,
            fontWeight: '800',
            marginBottom: 8,
          }}
        >
          MyGarage
        </Text>
        <Text style={{ color: darkTheme.colors.textSecondary, marginBottom: 24 }}>Lite</Text>
        <ActivityIndicator color={darkTheme.colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: darkTheme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: darkTheme.colors.danger, fontSize: 16, textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider isDarkMode={isDarkMode}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: isDarkMode ? darkTheme.colors.background : lightTheme.colors.background },
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
              name="sparepart-import"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="transaction-form"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="transaction-detail" />
            <Stack.Screen name="customer-detail" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="reminders" />
            <Stack.Screen name="service-reminders" />
            <Stack.Screen name="purchase-orders" />
            <Stack.Screen name="purchase-order-detail" />
            <Stack.Screen
              name="purchase-order-form"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          <Toast />
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
