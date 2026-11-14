import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { CurrencyField } from '@/components/CurrencyPicker';
import { DateField } from '@/components/DateField';
import { Banner, Button, Card, Chip, Header, Input, Screen, T } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { computeNextBilling, CYCLE_LABELS, todayYMD } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';
import type { BillingCycle, CustomUnit, SubscriptionInput } from '@/types';

const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'];
const UNITS: CustomUnit[] = ['day', 'week', 'month', 'year'];
const SUGGESTIONS = ['Netflix', 'Spotify', 'YouTube Premium', 'Amazon Prime', 'Disney+', 'iCloud+', 'Google One', 'Microsoft 365'];
const REMINDER_OPTIONS: (number | null)[] = [null, 0, 1, 2, 3, 5, 7, 14];
const NEW_CATEGORY_COLORS = ['#E5484D', '#3E63DD', '#12A594', '#F76B15', '#8E4EC6', '#D6409F'];

export default function SubscriptionForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { subscriptions, categories, displayCurrency, addSubscription, updateSubscription, addCategory, profile } = useData();
  const editing = id ? subscriptions.find((s) => s.id === id) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [currency, setCurrency] = useState(editing?.currency ?? displayCurrency);
  const [cycle, setCycle] = useState<BillingCycle>(editing?.billing_cycle ?? 'monthly');
  const [customCount, setCustomCount] = useState(String(editing?.custom_interval_count ?? 1));
  const [customUnit, setCustomUnit] = useState<CustomUnit>(editing?.custom_interval_unit ?? 'month');
  const [startDate, setStartDate] = useState<string>(editing?.start_date ?? todayYMD());
  const [isTrial, setIsTrial] = useState(editing?.is_trial ?? false);
  const [trialStart, setTrialStart] = useState<string | null>(editing?.trial_start_date ?? null);
  const [trialEnd, setTrialEnd] = useState<string | null>(editing?.trial_end_date ?? null);
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method ?? '');
  const [website, setWebsite] = useState(editing?.website_url ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [reminder, setReminder] = useState<number | null>(editing?.reminder_days_before ?? null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Trials can only be switched on while creating one (or editing one that is still a trial)
  const canTrial = !editing || editing.is_trial;

  const nextPreview = useMemo(() => {
    const n = parseInt(customCount, 10);
    if (cycle === 'custom' && !(n >= 1)) return null;
    if (isTrial && !trialEnd) return null;
    try {
      return computeNextBilling({
        is_trial: isTrial,
        trial_end_date: trialEnd,
        start_date: isTrial ? trialStart ?? todayYMD() : startDate,
        billing_cycle: cycle,
        custom_interval_count: cycle === 'custom' ? n : null,
        custom_interval_unit: cycle === 'custom' ? customUnit : null,
      });
    } catch {
      return null;
    }
  }, [cycle, customCount, customUnit, startDate, isTrial, trialStart, trialEnd]);

  if (id && !editing) {
    return (
      <Screen>
        <Header title="Edit subscription" />
        <T variant="small">This subscription no longer exists.</T>
      </Screen>
    );
  }

  const submit = async () => {
    const e: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) e.name = 'Enter a name.';
    else if (trimmed.length > 80) e.name = 'Name is too long (80 characters max).';

    const amt = Number(amount.replace(',', '.'));
    if (!amount.trim() || !Number.isFinite(amt)) e.amount = 'Enter the amount you pay.';
    else if (amt <= 0) e.amount = 'Amount must be greater than zero.';
    else if (amt > 99999999) e.amount = 'Amount is too large.';

    const n = parseInt(customCount, 10);
    if (cycle === 'custom' && (!Number.isInteger(n) || n < 1 || n > 365)) e.custom = 'Enter a whole number between 1 and 365.';

    if (isTrial) {
      if (!trialEnd) e.trialEnd = 'Select when the trial ends.';
      else if (trialStart && trialEnd < trialStart) e.trialEnd = 'Trial end must be after the start.';
    }

    let url: string | null = website.trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      if (!/^https?:\/\/[^\s/.]+\.[^\s]{2,}$/i.test(url)) e.website = 'Enter a valid website address.';
    } else url = null;

    setErrors(e);
    if (Object.keys(e).length) return;

    const input: SubscriptionInput = {
      name: trimmed,
      category_id: categoryId,
      amount: Math.round(amt * 100) / 100,
      currency,
      billing_cycle: cycle,
      custom_interval_count: cycle === 'custom' ? n : null,
      custom_interval_unit: cycle === 'custom' ? customUnit : null,
      start_date: isTrial ? trialStart ?? todayYMD() : startDate,
      is_trial: isTrial,
      trial_start_date: isTrial ? trialStart : null,
      trial_end_date: isTrial ? trialEnd : null,
      payment_method: paymentMethod.trim() || null,
      website_url: url,
      notes: notes.trim() || null,
      reminder_days_before: reminder,
    };

    setBusy(true);
    if (editing) {
      const err = await updateSubscription(editing.id, input);
      setBusy(false);
      if (err) return Alert.alert('Could not save', err);
      router.back();
    } else {
      const res = await addSubscription(input);
      setBusy(false);
      if (res.error || !res.id) return Alert.alert('Could not save', res.error ?? 'Unknown error.');
      router.replace(`/subscription/${res.id}`);
    }
  };

  const createCategory = async () => {
    const res = await addCategory(newCat, NEW_CATEGORY_COLORS[categories.filter((c) => c.user_id).length % NEW_CATEGORY_COLORS.length]);
    if (res.error) return Alert.alert('Could not add category', res.error);
    if (res.category) setCategoryId(res.category.id);
    setNewCat('');
    setAddingCat(false);
  };

  return (
    <Screen>
      <Header title={editing ? 'Edit subscription' : 'Add subscription'} />

      {!editing ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => setName(s)} />
          ))}
        </ScrollView>
      ) : null}

      <Input label="Name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Netflix" maxLength={80} />

      <T variant="label" style={{ marginBottom: 8 }}>
        Category
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} icon={c.icon as React.ComponentProps<typeof Chip>['icon']} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
        ))}
        <Chip label="+ New" onPress={() => setAddingCat((a) => !a)} />
      </View>
      {addingCat ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Input value={newCat} onChangeText={setNewCat} placeholder="Category name" maxLength={40} />
          </View>
          <Button title="Add" variant="secondary" onPress={createCategory} style={{ minHeight: 48 }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Input label="Amount" value={amount} onChangeText={setAmount} error={errors.amount} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <View style={{ flex: 1 }}>
          <CurrencyField label="Currency" value={currency} onChange={setCurrency} />
        </View>
      </View>

      <T variant="label" style={{ marginBottom: 8 }}>
        Billing cycle
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {CYCLES.map((c) => (
          <Chip key={c} label={CYCLE_LABELS[c]} selected={cycle === c} onPress={() => setCycle(c)} />
        ))}
      </View>
      {cycle === 'custom' ? (
        <Card style={{ marginBottom: 14 }}>
          <Input label="Repeat every" value={customCount} onChangeText={setCustomCount} keyboardType="number-pad" error={errors.custom} maxLength={3} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {UNITS.map((u) => (
              <Chip key={u} label={`${u}${parseInt(customCount, 10) === 1 ? '' : 's'}`} selected={customUnit === u} onPress={() => setCustomUnit(u)} />
            ))}
          </View>
        </Card>
      ) : null}

      {canTrial ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginVertical: 8 }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <T variant="h3">Free trial</T>
            <T variant="small">Get reminded before you're first charged.</T>
          </View>
          <Switch value={isTrial} onValueChange={setIsTrial} trackColor={{ true: colors.primary, false: '#D5D8E3' }} thumbColor="#fff" />
        </View>
      ) : null}

      {isTrial ? (
        <>
          <DateField label="Trial started (optional)" value={trialStart} onChange={setTrialStart} optional onClear={() => setTrialStart(null)} />
          <DateField label="Trial ends" value={trialEnd} onChange={setTrialEnd} error={errors.trialEnd} />
        </>
      ) : (
        <DateField label="Start date (first payment)" value={startDate} onChange={setStartDate} />
      )}

      {nextPreview ? (
        <View style={{ marginBottom: 10 }}>
          <Banner tone="info" text={`${isTrial ? 'First charge' : 'Next payment'}: ${formatDate(nextPreview)}`} />
        </View>
      ) : null}

      <Input label="Payment method (optional)" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="e.g. Visa ending 4242" maxLength={60} />
      <Input label="Website (optional)" value={website} onChangeText={setWebsite} error={errors.website} autoCapitalize="none" keyboardType="url" placeholder="netflix.com" />

      <T variant="label" style={{ marginBottom: 8 }}>
        Reminder
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        {REMINDER_OPTIONS.map((r) => (
          <Chip
            key={String(r)}
            label={r === null ? `Default (${profile?.reminder_days_before ?? 3}d)` : r === 0 ? 'On the day' : `${r}d before`}
            selected={reminder === r}
            onPress={() => setReminder(r)}
          />
        ))}
      </ScrollView>

      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Anything worth remembering" maxLength={500} />

      <Button title={editing ? 'Save changes' : 'Add subscription'} onPress={submit} loading={busy} style={{ marginTop: 6 }} />
      <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 14 }}>
        <T color={colors.muted} style={{ fontWeight: '600' }}>
          Cancel
        </T>
      </Pressable>
    </Screen>
  );
}
