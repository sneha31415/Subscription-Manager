import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconFocused: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconFocused : icon} size={size} color={color as string} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="home" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="subscriptions" options={tab('Subscriptions', 'albums-outline', 'albums')} />
      <Tabs.Screen name="calendar" options={tab('Calendar', 'calendar-outline', 'calendar')} />
      <Tabs.Screen name="analytics" options={tab('Analytics', 'pie-chart-outline', 'pie-chart')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
