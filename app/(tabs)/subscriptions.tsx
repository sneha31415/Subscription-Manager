import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SubscriptionRow } from '@/components/SubscriptionRow';
import { Chip, EmptyState, Fab, Input, Loading, Screen, Switcher, T } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { formatMoney } from '@/lib/format';
import { STATUS_META } from '@/theme';
import type { SubStatus } from '@/types';

type StatusFilter = 'all' | SubStatus;
type Sort = 'due' | 'price' | 'name';

export default function Subscriptions() {
  const { subscriptions, categories, toDisplay, displayCurrency, loading, refreshing, refresh } = useData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<Sort>('due');

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const usedCategories = useMemo(() => {
    const ids = new Set(subscriptions.map((s) => s.category_id).filter(Boolean) as string[]);
    return categories.filter((c) => ids.has(c.id));
  }, [subscriptions, categories]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = subscriptions.filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (categoryId === 'all' || s.category_id === categoryId) &&
        (!needle || s.name.toLowerCase().includes(needle)),
    );
    const key = (s: (typeof subscriptions)[number]) => (s.status === 'trial' ? s.trial_end_date : s.next_billing_date);
    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'price') return (toDisplay(b.amount, b.currency) ?? 0) - (toDisplay(a.amount, a.currency) ?? 0);
      const ka = key(a);
      const kb = key(b);
      if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : 0;
      if (ka) return -1;
      if (kb) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [subscriptions, q, status, categoryId, sort, toDisplay]);

  if (loading && subscriptions.length === 0) return <Loading />;

  const statuses: StatusFilter[] = ['all', 'active', 'trial', 'paused', 'cancelled', 'expired'];

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} bottomPad={96}>
        <T variant="title" style={{ marginBottom: 14 }}>
          Subscriptions
        </T>
        <Input value={q} onChangeText={setQ} placeholder="Search subscriptions" autoCapitalize="none" style={{ minHeight: 44 }} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {statuses.map((s) => (
            <Chip
              key={s}
              label={s === 'all' ? 'All' : STATUS_META[s].label}
              selected={status === s}
              color={s === 'all' ? undefined : STATUS_META[s].color}
              onPress={() => setStatus(s)}
            />
          ))}
        </ScrollView>
        {usedCategories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <Chip label="All categories" selected={categoryId === 'all'} onPress={() => setCategoryId('all')} />
            {usedCategories.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} color={c.color} onPress={() => setCategoryId(c.id)} />
            ))}
          </ScrollView>
        ) : null}
        <View style={{ marginVertical: 8 }}>
          <Switcher<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'due', label: 'Next due' },
              { value: 'price', label: 'Price' },
              { value: 'name', label: 'Name' },
            ]}
          />
        </View>

        {subscriptions.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No subscriptions yet"
            message="Track Netflix, Spotify, your gym — anything that bills you regularly."
            actionLabel="Add subscription"
            onAction={() => router.push('/subscription/form')}
          />
        ) : list.length === 0 ? (
          <EmptyState icon="search-outline" title="No matches" message="Try a different search or clear the filters." />
        ) : (
          <View style={{ marginTop: 8 }}>
            {list.map((s) => {
              const conv = s.currency !== displayCurrency ? toDisplay(s.amount, s.currency) : null;
              return (
                <SubscriptionRow
                  key={s.id}
                  sub={s}
                  category={s.category_id ? catMap.get(s.category_id) : null}
                  converted={conv !== null ? formatMoney(conv, displayCurrency) : null}
                  onPress={() => router.push(`/subscription/${s.id}`)}
                />
              );
            })}
          </View>
        )}
      </Screen>
      <Fab onPress={() => router.push('/subscription/form')} />
    </View>
  );
}
