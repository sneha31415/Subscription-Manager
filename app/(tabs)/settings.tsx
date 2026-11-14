import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import { CurrencyField } from '@/components/CurrencyPicker';
import { Button, Card, Chip, Input, KeyValue, Screen, SectionHeader, Switcher, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { formatDate, formatHour } from '@/lib/format';
import { ensurePermission, registerForPush } from '@/lib/notifications';
import { colors } from '@/theme';
import type { ReminderMode } from '@/types';

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
const HOUR_OPTIONS = [7, 8, 9, 12, 18, 20];

export default function Settings() {
  const { user, signOut, deleteAccount } = useAuth();
  const { profile, updateProfile, rates, refreshRates } = useData();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  if (!profile) return <Screen><T variant="small">Loading profile…</T></Screen>;

  const fail = (msg: string | null) => {
    if (msg) Alert.alert('Could not save', msg);
  };

  const saveName = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Please enter your name.');
    setSavingName(true);
    fail(await updateProfile({ display_name: name.trim() }));
    setSavingName(false);
  };

  const toggleNotifications = async (on: boolean) => {
    if (on) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert('Notifications are blocked', 'Allow notifications for SubTrack in your phone settings to get reminders.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    fail(await updateProfile({ notifications_enabled: on }));
  };

  const changeMode = async (mode: ReminderMode) => {
    if (mode === profile.reminder_mode) return;
    if (mode === 'cloud') {
      const res = await registerForPush();
      if (!res.token) {
        Alert.alert('Cloud push unavailable', `${res.error ?? 'Could not set up push notifications.'}\n\nOn-device reminders keep working.`);
        return;
      }
      fail(await updateProfile({ reminder_mode: 'cloud', push_token: res.token }));
    } else {
      fail(await updateProfile({ reminder_mode: 'local' }));
    }
  };

  const doRefreshRates = async () => {
    setRefreshing(true);
    const ok = await refreshRates();
    setRefreshing(false);
    if (!ok) Alert.alert('Could not refresh', 'Exchange rates could not be fetched. Check your connection.');
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, all subscriptions and payment history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you absolutely sure?', 'Your data will be erased immediately.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Yes, delete',
                style: 'destructive',
                onPress: async () => {
                  const res = await deleteAccount();
                  if (res.error) Alert.alert('Could not delete account', res.error);
                },
              },
            ]),
        },
      ],
    );

  return (
    <Screen>
      <T variant="title" style={{ marginBottom: 6 }}>
        Settings
      </T>

      <SectionHeader title="Profile" />
      <Card>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <KeyValue label="Email" value={user?.email ?? ''} />
        <Button title="Save name" variant="secondary" onPress={saveName} loading={savingName} disabled={name.trim() === (profile.display_name ?? '')} style={{ marginTop: 8 }} />
      </Card>

      <SectionHeader title="Currency" />
      <Card>
        <CurrencyField label="Preferred currency" value={profile.preferred_currency} onChange={async (c) => fail(await updateProfile({ preferred_currency: c }))} />
        <T variant="small">
          Totals and charts are shown in this currency. Each subscription keeps its own original currency, and past payments keep the exchange rate they were recorded with.
        </T>
        <View style={{ marginTop: 10 }}>
          <KeyValue label="Exchange rates from" value={rates ? formatDate(rates.date) : 'Not available'} />
        </View>
        <Button title="Refresh rates" variant="secondary" onPress={doRefreshRates} loading={refreshing} />
      </Card>

      <SectionHeader title="Reminders" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <T variant="h3">Renewal reminders</T>
            <T variant="small">Get notified before you're charged.</T>
          </View>
          <Switch
            value={profile.notifications_enabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: colors.primary, false: '#D5D8E3' }}
            thumbColor="#fff"
          />
        </View>

        {profile.notifications_enabled ? (
          <>
            <T variant="label" style={{ marginTop: 18, marginBottom: 8 }}>
              Remind me
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DAY_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={d === 0 ? 'On the day' : d === 1 ? '1 day before' : `${d} days before`}
                  selected={profile.reminder_days_before === d}
                  onPress={async () => fail(await updateProfile({ reminder_days_before: d }))}
                />
              ))}
            </View>
            <T variant="label" style={{ marginTop: 10, marginBottom: 8 }}>
              At
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {HOUR_OPTIONS.map((h) => (
                <Chip key={h} label={formatHour(h)} selected={profile.reminder_hour === h} onPress={async () => fail(await updateProfile({ reminder_hour: h }))} />
              ))}
            </View>
            <T variant="label" style={{ marginTop: 10, marginBottom: 8 }}>
              Delivery
            </T>
            <Switcher<ReminderMode>
              value={profile.reminder_mode}
              onChange={changeMode}
              options={[
                { value: 'local', label: 'On this device' },
                { value: 'cloud', label: 'Cloud push' },
              ]}
            />
            <T variant="small" style={{ marginTop: 8 }}>
              {profile.reminder_mode === 'local'
                ? 'Reminders are scheduled on your phone and work offline. You can override the timing per subscription.'
                : 'Reminders are sent from the server. Only one delivery type is active at a time, so you never get duplicates.'}
            </T>
          </>
        ) : null}
      </Card>

      <SectionHeader title="Account" />
      <Card>
        <Button title="Log out" variant="secondary" onPress={confirmLogout} />
        <View style={{ height: 10 }} />
        <Button title="Delete account" variant="danger" onPress={confirmDelete} />
      </Card>

      <T variant="small" style={{ textAlign: 'center', marginTop: 24 }}>
        SubTrack v{Constants.expoConfig?.version ?? '1.0.0'}
      </T>
    </Screen>
  );
}
