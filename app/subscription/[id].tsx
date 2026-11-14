import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { CategoryBadge } from '@/components/SubscriptionRow';
import { Banner, Button, Card, Divider, EmptyState, Header, KeyValue, Loading, Pill, Screen, SectionHeader, T } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { cycleLabel, daysUntil, monthlyAmount, todayYMD, yearlyAmount } from '@/lib/billing';
import { formatDate, formatMoney, relativeDays } from '@/lib/format';
import { colors, STATUS_META } from '@/theme';

export default function SubscriptionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useData();
  const [busy, setBusy] = useState(false);
  const sub = d.subscriptions.find((s) => s.id === id);

  if (d.loading && !sub) return <Loading />;
  if (!sub) {
    return (
      <Screen>
        <Header title="Subscription" />
        <EmptyState icon="help-circle-outline" title="Subscription not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const category = sub.category_id ? d.categories.find((c) => c.id === sub.category_id) : null;
  const meta = STATUS_META[sub.status];
  const history = d.payments.filter((p) => p.subscription_id === sub.id);
  const totalPaid = history.reduce((sum, p) => {
    const v = p.display_currency === d.displayCurrency ? p.converted_amount : d.toDisplay(p.converted_amount, p.display_currency);
    return sum + (v ?? 0);
  }, 0);
  const converted = sub.currency !== d.displayCurrency ? d.toDisplay(sub.amount, sub.currency) : null;
  const monthlyDisp = d.toDisplay(monthlyAmount(sub), sub.currency);
  const yearlyDisp = d.toDisplay(yearlyAmount(sub), sub.currency);
  const trialDaysLeft = sub.status === 'trial' && sub.trial_end_date ? daysUntil(sub.trial_end_date) : null;

  const run = async (action: () => Promise<string | null>, onDone?: () => void) => {
    setBusy(true);
    const err = await action();
    setBusy(false);
    if (err) Alert.alert('Something went wrong', err);
    else onDone?.();
  };

  const confirm = (title: string, message: string, label: string, action: () => Promise<string | null>, destructive = false, onDone?: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: destructive ? 'destructive' : 'default', onPress: () => run(action, onDone) },
    ]);

  const openSite = () => {
    if (sub.website_url) Linking.openURL(sub.website_url).catch(() => Alert.alert('Could not open link', sub.website_url ?? ''));
  };

  return (
    <Screen>
      <Header
        title="Details"
        right={
          <Pressable onPress={() => router.push({ pathname: '/subscription/form', params: { id: sub.id } })} hitSlop={10} accessibilityLabel="Edit subscription">
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </Pressable>
        }
      />

      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <CategoryBadge category={category} name={sub.name} size={64} />
        <T variant="h2" style={{ marginTop: 12, textAlign: 'center' }}>
          {sub.name}
        </T>
        <View style={{ marginTop: 6 }}>
          <Pill label={meta.label} color={meta.color} bg={meta.bg} />
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 14 }}>{formatMoney(sub.amount, sub.currency)}</Text>
        <T variant="small">{cycleLabel(sub)}</T>
        {converted !== null ? (
          <T variant="small" style={{ marginTop: 4 }}>
            ≈ {formatMoney(converted, d.displayCurrency)} in your currency
          </T>
        ) : null}
      </Card>

      {trialDaysLeft !== null ? (
        <View style={{ marginTop: 12 }}>
          <Banner
            tone={trialDaysLeft <= 3 ? 'warning' : 'info'}
            text={
              trialDaysLeft <= 0
                ? 'Your free trial ends today. You will be charged next.'
                : `Free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} (${formatDate(sub.trial_end_date)}). Cancel before then to avoid being charged.`
            }
          />
        </View>
      ) : null}

      <SectionHeader title="Overview" />
      <Card>
        {sub.next_billing_date ? <KeyValue label="Next payment" value={`${formatDate(sub.next_billing_date)} · ${relativeDays(sub.next_billing_date)}`} /> : null}
        <KeyValue label="Category" value={category?.name ?? 'Uncategorised'} />
        <KeyValue label="Started" value={formatDate(sub.start_date)} />
        {monthlyDisp !== null ? <KeyValue label="Monthly cost" value={formatMoney(monthlyDisp, d.displayCurrency)} /> : null}
        {yearlyDisp !== null ? <KeyValue label="Yearly cost" value={formatMoney(yearlyDisp, d.displayCurrency)} /> : null}
        {sub.is_trial || sub.trial_end_date ? (
          <>
            <Divider />
            {sub.trial_start_date ? <KeyValue label="Trial started" value={formatDate(sub.trial_start_date)} /> : null}
            <KeyValue label="Trial ends" value={formatDate(sub.trial_end_date)} />
          </>
        ) : null}
        {sub.payment_method || sub.website_url || sub.reminder_days_before !== null ? <Divider /> : null}
        {sub.payment_method ? <KeyValue label="Payment method" value={sub.payment_method} /> : null}
        {sub.reminder_days_before !== null ? (
          <KeyValue label="Reminder" value={sub.reminder_days_before === 0 ? 'On the day' : `${sub.reminder_days_before} day(s) before`} />
        ) : null}
        {sub.website_url ? (
          <KeyValue
            label="Website"
            value={
              <Pressable onPress={openSite} style={{ flexShrink: 1 }}>
                <T color={colors.primary} style={{ fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>
                  {sub.website_url.replace(/^https?:\/\//i, '')}
                </T>
              </Pressable>
            }
          />
        ) : null}
        {sub.cancelled_at ? <KeyValue label="Cancelled on" value={formatDate(sub.cancelled_at.slice(0, 10))} /> : null}
        {sub.notes ? (
          <>
            <Divider />
            <T variant="label">Notes</T>
            <T style={{ marginTop: 4, lineHeight: 21 }}>{sub.notes}</T>
          </>
        ) : null}
      </Card>

      <SectionHeader title="Manage" />
      <Card style={{ gap: 10 }}>
        {sub.status === 'trial' ? (
          <Button
            title="Keep it — convert to paid"
            icon="checkmark-circle-outline"
            loading={busy}
            onPress={() => confirm('Convert to paid?', 'The trial is over and this becomes a normal paid subscription.', 'Convert', () => d.convertTrial(sub.id))}
          />
        ) : null}
        {sub.status === 'active' ? (
          <Button
            title="Record a payment today"
            icon="cash-outline"
            variant="secondary"
            loading={busy}
            onPress={() =>
              confirm('Record payment?', `Add a payment of ${formatMoney(sub.amount, sub.currency)} dated ${formatDate(todayYMD())}.`, 'Record', () => d.recordPayment(sub))
            }
          />
        ) : null}
        {sub.status === 'active' ? (
          <Button title="Pause" icon="pause-circle-outline" variant="secondary" loading={busy} onPress={() => confirm('Pause subscription?', 'It stops counting towards your spending and reminders until you resume it.', 'Pause', () => d.setStatus(sub.id, 'paused'))} />
        ) : null}
        {sub.status === 'paused' ? (
          <Button title="Resume" icon="play-circle-outline" loading={busy} onPress={() => run(() => d.setStatus(sub.id, 'active'))} />
        ) : null}
        {sub.status === 'cancelled' || sub.status === 'expired' ? (
          <Button title="Reactivate" icon="refresh-circle-outline" loading={busy} onPress={() => confirm('Reactivate?', 'Billing and reminders will restart from today.', 'Reactivate', () => d.setStatus(sub.id, 'active'))} />
        ) : null}
        {sub.status === 'active' || sub.status === 'trial' || sub.status === 'paused' ? (
          <Button
            title={sub.status === 'trial' ? 'I cancelled this trial' : 'Mark as cancelled'}
            icon="close-circle-outline"
            variant="danger"
            loading={busy}
            onPress={() => confirm('Mark as cancelled?', 'Remember to also cancel with the provider so you are not charged. Reminders will stop.', 'Mark cancelled', () => d.setStatus(sub.id, 'cancelled'), true)}
          />
        ) : null}
        {sub.status === 'active' || sub.status === 'paused' ? (
          <Button title="Mark as expired" icon="time-outline" variant="ghost" loading={busy} onPress={() => confirm('Mark as expired?', 'Use this when the plan ended and was not renewed.', 'Mark expired', () => d.setStatus(sub.id, 'expired'))} />
        ) : null}
      </Card>

      <SectionHeader title="Payment history" />
      {history.length === 0 ? (
        <Card>
          <T variant="small">No payments recorded yet. Payments are added automatically on each billing date.</T>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          {history.slice(0, 24).map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{formatDate(p.paid_on)}</T>
                <T variant="small">
                  {p.auto_recorded ? 'Automatic' : 'Manual'}
                  {p.currency !== p.display_currency ? ` · rate ${p.exchange_rate.toFixed(4)} ${p.display_currency}` : ''}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={{ fontWeight: '700' }}>{formatMoney(p.amount, p.currency)}</T>
                {p.currency !== p.display_currency ? <T variant="small">≈ {formatMoney(p.converted_amount, p.display_currency)}</T> : null}
              </View>
              <Pressable
                hitSlop={10}
                accessibilityLabel="Delete payment"
                onPress={() => confirm('Delete this payment?', `${formatMoney(p.amount, p.currency)} on ${formatDate(p.paid_on)}`, 'Delete', () => d.deletePayment(p.id), true)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <Divider />
          <KeyValue label={`Total paid (${history.length})`} value={formatMoney(totalPaid, d.displayCurrency)} />
        </Card>
      )}

      <Button
        title="Delete subscription"
        variant="danger"
        icon="trash-outline"
        style={{ marginTop: 24 }}
        loading={busy}
        onPress={() =>
          confirm('Delete subscription?', `"${sub.name}" and its payment history will be permanently removed.`, 'Delete', () => d.deleteSubscription(sub.id), true, () => router.back())
        }
      />
    </Screen>
  );
}
