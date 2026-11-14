import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '@/theme';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  size = 170,
  centerTop,
  centerBottom,
}: {
  slices: Slice[];
  size?: number;
  centerTop?: string;
  centerBottom?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const stroke = size * 0.16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF0F6" strokeWidth={stroke} fill="none" />
          {total > 0
            ? slices.map((s) => {
                const len = (s.value / total) * c;
                const el = (
                  <Circle
                    key={s.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={s.color}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', maxWidth: size * 0.6 }}>
        {centerTop ? (
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
            {centerTop}
          </Text>
        ) : null}
        {centerBottom ? <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{centerBottom}</Text> : null}
      </View>
    </View>
  );
}

export interface Bar {
  label: string;
  value: number;
  highlight?: boolean;
}

export function BarChart({ bars, height = 140, format }: { bars: Bar[]; height?: number; format: (n: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: height + 44, gap: 8 }}>
      {bars.map((b) => {
        const h = b.value > 0 ? Math.max(6, (b.value / max) * height) : 3;
        return (
          <View key={b.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 10.5, color: colors.muted, marginBottom: 4 }} numberOfLines={1} adjustsFontSizeToFit>
              {b.value > 0 ? format(b.value) : ''}
            </Text>
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: 7,
                backgroundColor: b.highlight ? colors.primary : colors.primary + '55',
              }}
            />
            <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 6 }}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
