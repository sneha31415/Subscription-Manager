import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { parseYMD, toYMD } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { colors, radius } from '@/theme';
import { T } from './ui';

export function DateField({
  label,
  value,
  onChange,
  error,
  optional,
  onClear,
}: {
  label: string;
  value: string | null;
  onChange: (ymd: string) => void;
  error?: string | null;
  optional?: boolean;
  onClear?: () => void;
}) {
  const [showIos, setShowIos] = useState(false);
  const date = value ? parseYMD(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(toYMD(selected));
        },
      });
    } else {
      setShowIos((s) => !s);
    }
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <T variant="label" style={{ marginBottom: 6 }}>
        {label}
      </T>
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          minHeight: 48,
          gap: 10,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 16, color: value ? colors.text : '#A5A9BA' }}>
          {value ? formatDate(value) : optional ? 'Not set' : 'Select a date'}
        </Text>
        {optional && value && onClear ? (
          <Pressable onPress={onClear} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {showIos && Platform.OS !== 'android' ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          onChange={(_, selected) => {
            if (selected) onChange(toYMD(selected));
          }}
        />
      ) : null}
      {error ? (
        <T variant="small" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}
