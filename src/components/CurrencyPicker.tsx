import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CURRENCIES } from '@/lib/currency';
import { colors, radius } from '@/theme';
import { T } from './ui';

export function CurrencyField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const insets = useSafeAreaInsets();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CURRENCIES;
    return CURRENCIES.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }, [q]);

  const current = CURRENCIES.find((c) => c.code === value);

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <T variant="label" style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          minHeight: 48,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{value}</Text>
        <Text style={{ flex: 1, fontSize: 14, color: colors.muted }} numberOfLines={1}>
          {current?.name ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T variant="h2">Select currency</T>
            <Pressable
              onPress={() => {
                setOpen(false);
                setQ('');
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search currency"
            placeholderTextColor="#A5A9BA"
            autoCapitalize="none"
            style={{
              backgroundColor: '#fff',
              borderRadius: radius.md,
              paddingHorizontal: 14,
              minHeight: 46,
              fontSize: 16,
              marginBottom: 10,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            ListEmptyComponent={<T variant="small" style={{ textAlign: 'center', marginTop: 30 }}>No matching currency.</T>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.code);
                  setOpen(false);
                  setQ('');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  backgroundColor: item.code === value ? colors.primarySoft : '#fff',
                  borderRadius: radius.md,
                  marginBottom: 6,
                  gap: 12,
                }}
              >
                <Text style={{ width: 48, fontWeight: '800', color: colors.text, fontSize: 15 }}>{item.code}</Text>
                <Text style={{ flex: 1, color: colors.muted, fontSize: 14 }}>{item.name}</Text>
                {item.code === value ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
