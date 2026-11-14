import * as Notifications from 'expo-notifications';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import SetupRequired from '@/components/SetupRequired';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { session, loading, recovering } = useAuth();
  const segments = useSegments();
  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  // Route guard: signed-out people only see the auth screens; signed-in people never see them
  useEffect(() => {
    if (loading || !isSupabaseConfigured) return;
    if (recovering) {
      if (first !== 'reset-password') router.replace('/reset-password');
      return;
    }
    const isPublic = first === '(auth)' || first === 'reset-password' || first === 'auth-callback';
    if (!session && !isPublic) router.replace('/welcome');
    else if (session && first === '(auth)') router.replace('/home');
  }, [session, loading, recovering, first]);

  // Tapping a reminder opens that subscription
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.content.data?.subscriptionId;
      if (typeof id === 'string' && session) router.push(`/subscription/${id}`);
    });
    return () => sub.remove();
  }, [session]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F7FB' } }} />
      {loading ? (
        <View style={StyleSheet.absoluteFill}>
          <Loading />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  if (!isSupabaseConfigured) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SetupRequired />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DataProvider>
          <Gate />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
