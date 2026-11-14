import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CategoryBadge } from '@/components/SubscriptionRow';
import { Banner, Card, EmptyState, Loading, Screen, SectionHeader, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { addDaysYMD, todayYMD } from '@/lib/billing';
import { formatDate, formatMoney, relativeDays } from '@/lib/format';
import { spendTotals, upcomingBetween } from '@/lib/stats';
import { colors, radius, STATUS_META } from '@/theme';

export default function Home() {
  const { user } = useAuth();
  const { profile, subscriptions, categories, payments, toDisplay, displayCurrency, loading, refreshing, refresh, loadError, rates } = useData();

  const today = todayYMD();
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const totals = useMemo(() => spendTotals(subscriptions, toDisplay), [subscriptions, toDisplay]);
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const trialCount = subscriptions.filter((s) => s.status === 'trial').length;

  const upcoming = useMemo(() => upcomingBetween(subscriptions, today, addDaysYMD(today, 30)), [subscriptions, today]);
  const dueTotal = useMemo(
    () => upcoming.reduce((sum, u) => (u.kind === 'renewal' ? sum + (toDisplay(u.sub.amount, u.sub.currency) ?? 0) : sum), 0),
    [upcoming, toDisplay],
  );

  const activity = useMemo(() => {
    const subName = new Map(subscriptions.map((s) => [s.id, s.name]));
    const items: { key: string; when: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; text: string; sub: string; subId: string }[] = [];
    for (const p of payments.slice(0, 8)) {
      items.push({
        key: 'p' + p.id,
        when: p.created_at,
        icon: 'checkmark-circle',
        color: colors.success,
        text: `Paid ${subName.get(p.subscription_id) ?? 'subscription'}`,
        sub: `${formatMoney(p.amount, p.currency)} · ${formatDate(p.paid_on, false)}`,
        subId: p.subscription_id,
      });
    }
    for (const s of subscriptions.slice(0, 8)) {
      const m = STATUS_META[s.status];
      const created = Math.abs(new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) < 5000;
      items.push({
        key: 's' + s.id,
        when: s.updated_at,
        icon: created ? 'add-circle' : 'create',
        color: created ? colors.primary : m.color,
        text: created ? `Added ${s.name}` : `${s.name} · ${m.label}`,
        sub: formatDate(s.updated_at.slice(0, 10), false),
        subId: s.id,
      });
    }
    return items.sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 6);
  }, [payments, subscriptions]);

  if (loading && subscriptions.length === 0) return <Loading label="Loading your subscriptions…" />;

  const first = (profile?.display_name || user?.email || '').split(' ')[0].split('@')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View>
          <T variant="small">{formatDate(today)}</T>
          <T variant="h2">Hi{first ? `, ${first}` : ''} 👋</T>
        </View>
      </View>

      {loadError ? <Banner tone="danger" text={`${loadError} Showing saved data.`} actionLabel="Retry" onAction={refresh} /> : null}
      {!rates && subscriptions.some((s) => s.currency !== displayCurrency) ? (
        <Banner tone="warning" text="Exchange rates unavailable — foreign-currency totals are left out for now." actionLabel="Retry" onAction={refresh} />
      ) : null}

      <View style={{ backgroundColor: colors.primary, borderRadius: radius.xl, padding: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>Monthly spending</Text>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 }}>{formatMoney(totals.monthly, displayCurrency)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Yearly</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 }}>{formatMoney(totals.yearly, displayCurrency)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Active</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 }}>
              {activeCount} {activeCount === 1 ? 'subscription' : 'subscriptions'}
            </Text>
          </View>
        </View>
      </View>

      {subscriptions.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            icon="albums-outline"
            title="No subscriptions yet"
            message="Add your first subscription to see your spending, upcoming renewals and reminders."
            actionLabel="Add subscription"
            onAction={() => router.push('/subscription/form')}
          />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <Card style={{ flex: 1 }}>
              <T variant="small">Due in 30 days</T>
              <T variant="h2" style={{ marginTop: 4 }}>
                {formatMoney(dueTotal, displayCurrency)}
              </T>
            </Card>
            <Card style={{ flex: 1 }}>
              <T variant="small">Free trials</T>
              <T variant="h2" style={{ marginTop: 4 }}>
                {trialCount}
              </T>
            </Card>
          </View>

          <SectionHeader title="Upcoming payments" action="Calendar" onAction={() => router.push('/calendar')} />
          {upcoming.length === 0 ? (
            <Card>
              <T variant="small">Nothing due in the next 30 days.</T>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 6 }}>
              {upcoming.slice(0, 6).map((u, i) => (
                <View
                  key={u.sub.id + u.date + u.kind}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <CategoryBadge category={u.sub.category_id ? catMap.get(u.sub.category_id) : null} name={u.sub.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <T variant="h3" numberOfLines={1} style={{ fontSize: 15 }}>
                      {u.sub.name}
                    </T>
                    <T variant="small">
                      {u.kind === 'trial_end' ? 'Trial ends' : 'Renews'} {formatDate(u.date, false)} · {relativeDays(u.date)}
                    </T>
                  </View>
                  <T variant="h3" style={{ fontSize: 15 }} color={u.kind === 'trial_end' ? colors.info : colors.text}>
                    {u.kind === 'trial_end' ? 'Trial' : formatMoney(u.sub.amount, u.sub.currency)}
                  </T>
                </View>
              ))}
            </Card>
          )}

          <SectionHeader title="Recent activity" />
          <Card style={{ paddingVertical: 6 }}>
            {activity.map((a, i) => (
              <Pressable
                key={a.key}
                onPress={() => router.push(`/subscription/${a.subId}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <Ionicons name={a.icon} size={22} color={a.color} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={1}>
                    {a.text}
                  </T>
                  <T variant="small">{a.sub}</T>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
