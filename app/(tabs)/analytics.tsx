import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, DonutChart } from '@/components/charts';
import { Banner, Card, EmptyState, Screen, SectionHeader, Switcher, T } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { monthlyAmount, yearlyAmount } from '@/lib/billing';
import { formatMoney } from '@/lib/format';
import { categoryBreakdown, paymentHistoryByMonth, spendTotals } from '@/lib/stats';
import { colors } from '@/theme';

type Period = 'monthly' | 'yearly';

export default function Analytics() {
  const { subscriptions, categories, payments, toDisplay, displayCurrency } = useData();
  const [period, setPeriod] = useState<Period>('monthly');
  const factor = period === 'monthly' ? 1 : 12;

  const totals = useMemo(() => spendTotals(subscriptions, toDisplay), [subscriptions, toDisplay]);
  const total = period === 'monthly' ? totals.monthly : totals.yearly;
  const breakdown = useMemo(() => categoryBreakdown(subscriptions, categories, toDisplay, factor), [subscriptions, categories, toDisplay, factor]);
  const history = useMemo(
    () => paymentHistoryByMonth(payments, period === 'monthly' ? 6 : 12, displayCurrency, toDisplay),
    [payments, period, displayCurrency, toDisplay],
  );
  const paidInRange = history.reduce((a, b) => a + b.value, 0);

  const top = useMemo(() => {
    return subscriptions
      .filter((s) => s.status === 'active')
      .map((s) => ({ s, v: toDisplay(period === 'monthly' ? monthlyAmount(s) : yearlyAmount(s), s.currency) }))
      .filter((x): x is { s: (typeof subscriptions)[number]; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
  }, [subscriptions, toDisplay, period]);

  const hasActive = subscriptions.some((s) => s.status === 'active');
  const fmt = (n: number) => formatMoney(n, displayCurrency);
  const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));

  return (
    <Screen>
      <T variant="title" style={{ marginBottom: 14 }}>
        Analytics
      </T>
      <Switcher<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />

      {totals.missing > 0 ? <View style={{ marginTop: 12 }}><Banner tone="warning" text={`${totals.missing} subscription(s) left out — exchange rate unavailable.`} /></View> : null}

      {!hasActive && payments.length === 0 ? (
        <EmptyState icon="pie-chart-outline" title="No data yet" message="Add an active subscription and your spending breakdown will show up here." />
      ) : (
        <>
          <Card style={{ marginTop: 14, alignItems: 'center' }}>
            <T variant="small">{period === 'monthly' ? 'Monthly equivalent' : 'Yearly equivalent'}</T>
            <T variant="title" style={{ marginTop: 2 }}>
              {fmt(total)}
            </T>
            <View style={{ marginTop: 16 }}>
              <DonutChart
                slices={breakdown.map((b) => ({ label: b.label, value: b.value, color: b.color }))}
                centerTop={fmt(total)}
                centerBottom={period === 'monthly' ? 'per month' : 'per year'}
              />
            </View>
            <View style={{ alignSelf: 'stretch', marginTop: 16, gap: 10 }}>
              {breakdown.map((b) => (
                <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: b.color }} />
                  <T style={{ flex: 1 }}>{b.label}</T>
                  <T variant="small">{total > 0 ? Math.round((b.value / total) * 100) : 0}%</T>
                  <T style={{ fontWeight: '700', minWidth: 80, textAlign: 'right' }}>{fmt(b.value)}</T>
                </View>
              ))}
            </View>
          </Card>

          <SectionHeader title={period === 'monthly' ? 'Spending trend · last 6 months' : 'Spending trend · last 12 months'} />
          <Card>
            <BarChart bars={history.map((h) => ({ label: h.label, value: h.value, highlight: h.isCurrent }))} format={short} />
            <T variant="small" style={{ marginTop: 10 }}>
              Actual payments recorded: {fmt(paidInRange)}. Each payment keeps the exchange rate from the day it was recorded.
            </T>
          </Card>

          {top.length > 0 ? (
            <>
              <SectionHeader title="Biggest subscriptions" />
              <Card>
                {top.map(({ s, v }, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                    <T variant="small" style={{ width: 18 }}>
                      {i + 1}
                    </T>
                    <T style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                      {s.name}
                    </T>
                    <T style={{ fontWeight: '700' }}>{fmt(v)}</T>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
