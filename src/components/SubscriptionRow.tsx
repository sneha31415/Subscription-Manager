import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { cycleLabel } from '@/lib/billing';
import { formatDate, formatMoney, relativeDays } from '@/lib/format';
import { colors, radius, STATUS_META } from '@/theme';
import type { Category, Subscription } from '@/types';
import { Pill } from './ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function CategoryBadge({ category, name, size = 44 }: { category?: Category | null; name: string; size?: number }) {
  const color = category?.color ?? colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {category ? (
        <Ionicons name={category.icon as IconName} size={size * 0.48} color={color} />
      ) : (
        <Text style={{ color, fontWeight: '800', fontSize: size * 0.4 }}>{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

export function SubscriptionRow({
  sub,
  category,
  onPress,
  converted,
}: {
  sub: Subscription;
  category?: Category | null;
  onPress: () => void;
  /** Same amount expressed in the preferred currency (shown when different from the original) */
  converted?: string | null;
}) {
  const meta = STATUS_META[sub.status];
  const date = sub.status === 'trial' ? sub.trial_end_date : sub.next_billing_date;
  const subtitle =
    sub.status === 'trial'
      ? `Trial ends ${formatDate(date, false)} · ${relativeDays(date)}`
      : sub.status === 'active' && date
        ? `Renews ${formatDate(date, false)} · ${cycleLabel(sub)}`
        : `${cycleLabel(sub)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          padding: 12,
          borderRadius: radius.lg,
          marginBottom: 10,
          gap: 12,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <CategoryBadge category={category} name={sub.name} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
            {sub.name}
          </Text>
          {sub.status !== 'active' ? <Pill label={meta.label} color={meta.color} bg={meta.bg} /> : null}
        </View>
        <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 3 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{formatMoney(sub.amount, sub.currency)}</Text>
        {converted ? <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>≈ {converted}</Text> : null}
      </View>
    </Pressable>
  );
}
