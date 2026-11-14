import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---------- Screen & header ---------------------------------------------------------------- */

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  bottomPad = 24,
  noTopInset = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  bottomPad?: number;
  noTopInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = noTopInset ? 0 : insets.top;
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: top }, style]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingTop: top + 8, paddingHorizontal: 16, paddingBottom: bottomPad + insets.bottom }, style]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Header({
  title,
  back = true,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityLabel="Go back" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerBtn, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/* ---------- Text --------------------------------------------------------------------------- */

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: 'title' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'big';
  color?: string;
  style?: StyleProp<import('react-native').TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[textStyles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  big: { fontSize: 30, fontWeight: '800', color: colors.text },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
});

/* ---------- Containers --------------------------------------------------------------------- */

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const content = [styles.card, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...content, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="h3">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Inputs & buttons --------------------------------------------------------------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: v.bg, borderColor: v.border }, off && { opacity: 0.55 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
          <Text style={{ color: v.fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Input({
  label,
  error,
  hint,
  right,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string; right?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <T variant="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <View style={[styles.inputWrap, error ? { borderColor: colors.danger } : null]}>
        <TextInput
          placeholderTextColor="#A5A9BA"
          {...props}
          style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]}
        />
        {right}
      </View>
      {error ? (
        <T variant="small" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </T>
      ) : hint ? (
        <T variant="small" style={{ marginTop: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
}) {
  const tint = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: tint, borderColor: tint } : null]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : tint} style={{ marginRight: 5 }} /> : null}
      <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? '#fff' : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Switcher<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.switcher}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.switchItem, value === o.value && styles.switchItemOn]}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: value === o.value ? colors.primary : colors.muted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- Feedback states ---------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <T variant="h3" style={{ marginTop: 14, textAlign: 'center' }}>
        {title}
      </T>
      <T variant="small" style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
        {message}
      </T>
      {actionLabel ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: 18, paddingHorizontal: 28 }} /> : null}
    </View>
  );
}

export function Banner({
  tone = 'info',
  text,
  actionLabel,
  onAction,
}: {
  tone?: 'info' | 'warning' | 'danger';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const map = {
    info: { bg: colors.infoSoft, fg: colors.info, icon: 'information-circle' as IconName },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' as IconName },
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'cloud-offline' as IconName },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <Ionicons name={map.icon} size={20} color={map.fg} />
      <Text style={{ flex: 1, color: map.fg, fontSize: 13, fontWeight: '600' }}>{text}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: map.fg, fontWeight: '800', fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <T variant="small">{label}</T> : null}
    </View>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityLabel="Add subscription" onPress={onPress} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={30} color="#fff" />
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 }} />;
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 16 }}>
      <T variant="small">{label}</T>
      {typeof value === 'string' ? (
        <T variant="body" style={{ flexShrink: 1, textAlign: 'right', fontWeight: '600' }}>
          {value}
        </T>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBtn: { width: 44, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  button: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  switcher: { flexDirection: 'row', backgroundColor: '#E9EAF3', borderRadius: radius.md, padding: 3 },
  switchItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm + 1 },
  switchItemOn: { backgroundColor: '#fff' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.25,
    elevation: 6,
  },
});
