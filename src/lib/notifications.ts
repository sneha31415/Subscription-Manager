import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Profile, Subscription } from '@/types';
import {
  addDaysYMD,
  anchorOf,
  intervalForSub,
  occurrencesBetween,
  parseYMD,
  todayYMD,
} from './billing';
import { formatMoney } from './format';

const CHANNEL_ID = 'renewals';
const HORIZON_DAYS = 90; // how far ahead we schedule on-device reminders
const MAX_SCHEDULED = 60; // keep well below OS limits

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Renewal reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#6C5CE7',
    });
  }
}

/** Asks for permission if we don't have it yet. Returns true when notifications are allowed. */
export async function ensurePermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function whenText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * Cancels everything we scheduled before and schedules a fresh set. Rebuilding from scratch every
 * time means changed dates / paused / cancelled subscriptions can never leave stale or duplicate
 * reminders behind.
 */
export async function syncLocalReminders(subs: Subscription[], profile: Profile): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!profile.notifications_enabled || profile.reminder_mode !== 'local') return 0;
  if (!(await ensurePermission())) return 0;

  const today = todayYMD();
  const horizon = addDaysYMD(today, HORIZON_DAYS + 30);
  const now = Date.now();

  interface Planned {
    id: string;
    fireAt: Date;
    title: string;
    body: string;
    subscriptionId: string;
  }
  const planned: Planned[] = [];

  for (const s of subs) {
    if (s.status !== 'active' && s.status !== 'trial') continue;
    const lead = s.reminder_days_before ?? profile.reminder_days_before;
    const isTrial = s.status === 'trial' && !!s.trial_end_date;
    const dates = isTrial
      ? [s.trial_end_date as string]
      : occurrencesBetween(anchorOf(s), intervalForSub(s), today, horizon);

    for (const due of dates) {
      const remindOn = parseYMD(addDaysYMD(due, -lead));
      remindOn.setHours(profile.reminder_hour, 0, 0, 0);
      if (remindOn.getTime() <= now) continue;
      if (remindOn.getTime() > now + HORIZON_DAYS * 86400000) continue;
      const days = lead;
      planned.push({
        id: `sub:${s.id}:${isTrial ? 'trial' : 'renewal'}:${due}`,
        fireAt: remindOn,
        subscriptionId: s.id,
        title: isTrial ? 'Free trial ending soon' : 'Upcoming renewal',
        body: isTrial
          ? `${s.name} free trial ends ${whenText(days)}. Cancel now if you don't want to be charged.`
          : `${s.name} renews ${whenText(days)} · ${formatMoney(s.amount, s.currency)}`,
      });
    }
  }

  planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  const chosen = planned.slice(0, MAX_SCHEDULED);

  for (const p of chosen) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        data: { subscriptionId: p.subscriptionId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.fireAt,
        channelId: CHANNEL_ID,
      },
    });
  }
  return chosen.length;
}

export async function cancelAllLocalReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export interface PushResult {
  token: string | null;
  error?: string;
}

/** Gets an Expo push token for cloud reminders. Needs a real device and a development/production build. */
export async function registerForPush(): Promise<PushResult> {
  if (!Device.isDevice) return { token: null, error: 'Push notifications need a real phone, not an emulator.' };
  if (!(await ensurePermission())) return { token: null, error: 'Notification permission was not granted.' };
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    return { token: null, error: 'Missing EAS project id. Run "eas init" once (see README).' };
  }
  try {
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: t.data };
  } catch (e) {
    return { token: null, error: e instanceof Error ? e.message : 'Could not get a push token.' };
  }
}
