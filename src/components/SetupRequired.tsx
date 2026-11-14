import React from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';
import { Card, Screen, T } from './ui';

/** Shown instead of a crash when the .env file has not been filled in yet. */
export default function SetupRequired() {
  return (
    <Screen>
      <View style={{ marginTop: 40 }}>
        <T variant="title">Almost there</T>
        <T variant="small" style={{ marginTop: 6, lineHeight: 20 }}>
          SubTrack can't reach its backend yet because the Supabase settings are missing.
        </T>
        <Card style={{ marginTop: 20 }}>
          <T variant="h3">What to do</T>
          <T style={{ marginTop: 8, lineHeight: 22 }}>1. Copy the file ".env.example" to ".env".</T>
          <T style={{ marginTop: 4, lineHeight: 22 }}>
            2. Paste your Supabase project URL and anon key into it (Supabase → Project Settings → API).
          </T>
          <T style={{ marginTop: 4, lineHeight: 22 }}>3. Stop the dev server and start it again with "npx expo start -c".</T>
          <T variant="small" color={colors.muted} style={{ marginTop: 10 }}>
            The README has the full step-by-step guide.
          </T>
        </Card>
      </View>
    </Screen>
  );
}
