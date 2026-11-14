import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CategoryBadge } from '@/components/SubscriptionRow';
import { Card, EmptyState, Screen, SectionHeader, T } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { addDaysYMD, daysInMonth, todayYMD, toYMD } from '@/lib/billing';
import { formatDate, formatMonthYear, formatMoney, relativeDays } from '@/lib/format';
import { monthRange, upcomingBetween } from '@/lib/stats';
import { colors, radius } from '@/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const { subscriptions, categories, toDisplay, displayCurrency } = useData();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = todayYMD();
  const [selected, setSelected] = useState<string>(today);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const { from, to } = monthRange(year, month);
  const items = useMemo(() => upcomingBetween(subscriptions, from, to), [subscriptions, from, to]);
  const byDate = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);

  const monthTotal = items.reduce((sum, i) => (i.kind === 'renewal' ? sum + (toDisplay(i.sub.amount, i.sub.currency) ?? 0) : sum), 0);

  const lead = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(toYMD(d));
  };

  const dayItems = byDate.get(selected) ?? [];
  const upcoming30 = useMemo(() => upcomingBetween(subscriptions, today, addDaysYMD(today, 30)), [subscriptions, today]);

  return (
    <Screen>
      <T variant="title" style={{ marginBottom: 14 }}>
        Calendar
      </T>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <T variant="h3">{formatMonthYear(year, month)}</T>
          <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700', paddingBottom: 6 }}>
              {w}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
            const ymd = toYMD(new Date(year, month, d));
            const has = byDate.get(ymd);
            const isToday = ymd === today;
            const isSel = ymd === selected;
            return (
              <Pressable key={i} onPress={() => setSelected(ymd)} style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? colors.primary : isToday ? colors.primarySoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: isToday || isSel ? '800' : '500', color: isSel ? '#fff' : colors.text }}>{d}</Text>
                  {has ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: isSel ? '#fff' : has.some((h) => h.kind === 'trial_end') ? colors.info : colors.primary,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <T variant="small">{items.length} payment{items.length === 1 ? '' : 's'} this month</T>
          <T variant="small" style={{ fontWeight: '700' }}>
            {formatMoney(monthTotal, displayCurrency)}
          </T>
        </View>
      </Card>

      <SectionHeader title={formatDate(selected)} />
      {dayItems.length === 0 ? (
        <Card>
          <T variant="small">No payments on this day.</T>
        </Card>
      ) : (
        dayItems.map((u) => (
          <Pressable
            key={u.sub.id + u.kind}
            onPress={() => router.push(`/subscription/${u.sub.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: radius.lg, marginBottom: 10 }}
          >
            <CategoryBadge category={u.sub.category_id ? catMap.get(u.sub.category_id) : null} name={u.sub.name} size={40} />
            <View style={{ flex: 1 }}>
              <T variant="h3" style={{ fontSize: 15 }}>
                {u.sub.name}
              </T>
              <T variant="small">{u.kind === 'trial_end' ? 'Free trial ends — first charge follows' : 'Renewal'}</T>
            </View>
            <T variant="h3" style={{ fontSize: 15 }}>
              {formatMoney(u.sub.amount, u.sub.currency)}
            </T>
          </Pressable>
        ))
      )}

      <SectionHeader title="Next 30 days" />
      {upcoming30.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="Nothing coming up" message="Upcoming renewals and trial endings will appear here." />
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          {upcoming30.map((u, i) => (
            <Pressable
              key={u.sub.id + u.date + u.kind}
              onPress={() => router.push(`/subscription/${u.sub.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
            >
              <View style={{ width: 44, alignItems: 'center' }}>
                <T variant="small" style={{ fontWeight: '700' }}>
                  {formatDate(u.date, false)}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }} numberOfLines={1}>
                  {u.sub.name}
                </T>
                <T variant="small">
                  {u.kind === 'trial_end' ? 'Trial ends' : 'Renews'} · {relativeDays(u.date)}
                </T>
              </View>
              <T style={{ fontWeight: '700' }}>{formatMoney(u.sub.amount, u.sub.currency)}</T>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
