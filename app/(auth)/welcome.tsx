import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '@/components/ui';
import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'wallet-outline', title: 'See what you really spend', text: 'Monthly and yearly totals across every subscription.' },
  { icon: 'notifications-outline', title: 'Never get surprised', text: 'Reminders before renewals and when free trials end.' },
  { icon: 'globe-outline', title: 'Any currency', text: 'Track in USD, EUR, INR… and view everything in your own.' },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="repeat" size={44} color="#fff" />
        </View>
        <T variant="title" color="#fff" style={{ marginTop: 18, fontSize: 34 }}>
          SubTrack
        </T>
        <T color="rgba(255,255,255,0.85)" style={{ marginTop: 6, textAlign: 'center' }}>
          Every subscription. One calm place.
        </T>
      </View>

      <View style={{ marginTop: 36, gap: 18 }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={f.icon} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="h3" color="#fff">
                {f.title}
              </T>
              <T variant="small" color="rgba(255,255,255,0.8)">
                {f.text}
              </T>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Button title="Create account" onPress={() => router.push('/signup')} style={{ backgroundColor: '#fff', borderColor: '#fff' }} />
      <View style={{ height: 10 }} />
      <Button
        title="I already have an account"
        variant="ghost"
        onPress={() => router.push('/login')}
        style={{ borderColor: 'rgba(255,255,255,0.5)' }}
      />
    </View>
  );
}
