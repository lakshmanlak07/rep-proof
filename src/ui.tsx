// Shared UI: dark gym-floor theme, large tap targets, one accent for Start and Log.
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#0B0D10',
  card: '#15181D',
  border: '#262A31',
  text: '#F2F4F7',
  muted: '#9AA3AE',
  accent: '#C6F432',
  onAccent: '#0B0D10',
  danger: '#FF6B6B',
};

export function Screen({ children, scroll = true, edges }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={edges ?? ['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[s.screen, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl'; bold?: boolean };
export function T({ children, style, muted, size = 'md', bold }: TProps) {
  return (
    <Text style={[{ color: muted ? C.muted : C.text, fontSize: SIZES[size], lineHeight: SIZES[size] * 1.35, fontWeight: bold || size === 'xl' || size === 'lg' ? '700' : '400' }, style]}>
      {children}
    </Text>
  );
}
const SIZES = { sm: 13, md: 16, lg: 22, xl: 30 };

type BtnProps = { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> };
export function Button({ title, onPress, kind = 'secondary', disabled, loading, style }: BtnProps) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        primary && { backgroundColor: C.accent, borderColor: C.accent },
        kind === 'ghost' && { borderColor: 'transparent', backgroundColor: 'transparent' },
        (disabled || pressed) && { opacity: disabled ? 0.4 : 0.75 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={primary ? C.onAccent : C.text} /> : (
        <Text style={{ color: primary ? C.onAccent : kind === 'danger' ? C.danger : C.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// Pill options. multi = toggle list; otherwise single select.
export function Choice<V extends string | number>({ options, value, onChange }: { options: { value: V; label: string; hint?: string }[]; value: V | V[] | null; onChange: (v: V) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return (
          <Pressable key={String(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={[s.choice, on && { borderColor: C.accent, backgroundColor: '#1D2412' }]}>
            <T bold>{o.label}</T>
            {o.hint ? <T muted size="sm">{o.hint}</T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <T muted size="sm">{label}</T> : null}
      <TextInput placeholderTextColor={C.muted} style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Loading() {
  return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}><ActivityIndicator color={C.accent} size="large" /></View>;
}

export const s = StyleSheet.create({
  screen: { padding: 20, gap: 16, flexGrow: 1 },
  btn: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  choice: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 14, justifyContent: 'center', gap: 2 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, color: C.text, fontSize: 18, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
