// RepProof UI kit (Design System v1.0). Presentational only: props in, callbacks out.
// Every color, size, radius, shadow and font comes from src/theme/tokens.ts. Nothing here imports Supabase,
// the router, data hooks or calculations.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { breakpoint, color, font, gutter, radius, shadow, touch, type } from '@/theme/tokens';

// ───────────────────────── Tokens (semantic aliases used across the screens) ─────────────────────────
export const C = {
  bg: color.bg,
  card: color.surface,
  sunken: color.sand,
  border: color.line,
  control: color.control, // edges and rings of inputs, radios, checkboxes (3:1 or better)
  text: color.ink,
  text2: color.ink2,
  muted: color.muted,
  faint: '#A8959E', // decorative only (placeholders, inactive chevrons); never body text
  accent: color.primary,
  accentPressed: color.primaryPressed,
  accentSoft: color.primaryTint,
  accentBorder: color.primaryBorder,
  raspberry: color.accent,
  onAccent: '#FFFFFF',
  onAccentMuted: color.onPrimaryMuted, // secondary text on the burgundy hero
  ink: color.ink,
  pos: color.success, posSoft: color.successTint,
  warn: color.caution, warnSoft: color.cautionTint,
  danger: color.danger, dangerSoft: color.dangerTint,
  scrim: color.scrim,
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: radius.sm, md: radius.md, lg: radius.xl, pill: radius.pill } as const;
export const SHADOW: ViewStyle = shadow.s2;

/** Wide layouts (desktop web) get the left rail and a wider content column. */
export const BREAKPOINT = breakpoint.rail;
export const useWide = () => useWindowDimensions().width >= BREAKPOINT;

// ───────────────────────── Typography ─────────────────────────
type Size = 'micro' | 'sm' | 'md' | 'lg' | 'xl' | 'display';
const TYPE: Record<Size, TextStyle> = {
  micro: type.overline,
  sm: type.caption,
  md: type.body,
  lg: type.h3,
  xl: type.h1,
  display: type.display,
};
const HEADINGS = new Set<Size>(['lg', 'xl', 'display']);
type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; size?: Size; bold?: boolean; color?: string; numberOfLines?: number; onPress?: () => void; header?: boolean; label?: string };
/** Text. With onPress it is an inline link (announced as a link to screen readers). */
export function T({ children, style, muted, size = 'md', bold, color: c, numberOfLines, onPress, header, label }: TProps) {
  const weight = bold && !HEADINGS.has(size) && size !== 'micro' ? { fontFamily: font.bodyBold } : null;
  return (
    <Text numberOfLines={numberOfLines} onPress={onPress} accessibilityLabel={label} accessibilityRole={onPress ? 'link' : header ? 'header' : undefined} suppressHighlighting
      style={[{ color: c ?? (muted ? C.muted : C.text) }, TYPE[size], weight, size === 'micro' && !c && { color: C.accent }, style]}>
      {children}
    </Text>
  );
}

/**
 * Error or status message that screen readers announce when it appears or changes. Live regions are Android-only,
 * so this announces on iOS too (and is ignored by the web build, which is development only).
 */
export function ErrorText({ children }: { children: string }) {
  useEffect(() => { if (children) AccessibilityInfo.announceForAccessibility(children); }, [children]);
  return <T style={{ color: C.danger }}>{children}</T>;
}

// ───────────────────────── Layout ─────────────────────────
export function Screen({ children, scroll = true, edges, pad = true }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[]; pad?: boolean }) {
  const inner = [s.screen, !pad && { padding: 0 }];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={edges ?? ['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ alignItems: 'center', flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[inner, { width: '100%', maxWidth: 760 }]}>{children}</View>
        </ScrollView>
      ) : (
        // Fills the screen (a flexGrow child pushes buttons to the bottom) yet still scrolls when large text makes the
        // content taller than the screen (WCAG 1.4.4). Children grow with flexGrow, never flex: 1, which would shrink them.
        <ScrollView contentContainerStyle={{ alignItems: 'center', flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[inner, { flexGrow: 1, width: '100%', maxWidth: 760 }]}>{children}</View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: SP.sm }]}>
      <View style={{ flex: 1, gap: 4 }}>
        {kicker ? <T size="sm" muted>{kicker}</T> : null}
        <T size="xl" header>{title}</T>
      </View>
      {right}
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: SP.md }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="lg" header>{title}</T>
        {action ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center' }}><T size="sm" bold color={C.accent}>{action}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />;

// ───────────────────────── Press feedback ─────────────────────────
const OUTER_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical']);
/** Pressable with a quiet 100 ms press feedback (no bounce). All tappable cards and buttons use it. */
export function Press({ children, onPress, style, disabled, scaleTo = 0.98, ...rest }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; scaleTo?: number;
  accessibilityLabel?: string; accessibilityRole?: 'button' | 'link' | 'checkbox' | 'radio'; accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean }; hitSlop?: number;
}) {
  const k = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  // Sizing in a row (flex, width, alignSelf, margins) must sit on the Pressable itself, or a card
  // asked to fill its row shrinks to its content.
  const flat = StyleSheet.flatten(style) ?? {};
  const outer = Object.fromEntries(Object.entries(flat).filter(([key]) => OUTER_KEYS.has(key))) as ViewStyle;
  const inner = Object.fromEntries(Object.entries(flat).filter(([key]) => !key.startsWith('margin'))) as ViewStyle;
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" style={outer} {...rest}
      onPressIn={() => { k.set(withTiming(scaleTo, { duration: 100 })); }}
      onPressOut={() => { k.set(withSpring(1, { damping: 20, stiffness: 300 })); }}>
      <Animated.View style={[a, inner]}>{children}</Animated.View>
    </Pressable>
  );
}

// ───────────────────────── Buttons ─────────────────────────
type BtnKind = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark' | 'light';
type BtnProps = {
  title: string; onPress: () => void; kind?: BtnKind; size?: 'md' | 'sm'; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; icon?: keyof typeof Ionicons.glyphMap;
  /** Screen-reader name when the visible title repeats on the screen; must contain the visible title. */
  label?: string;
};
const BTN: Record<BtnKind, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.accent, fg: C.onAccent, border: C.accent },
  secondary: { bg: C.accentSoft, fg: C.accent, border: C.accentSoft },
  outline: { bg: 'transparent', fg: C.accent, border: C.accentBorder },
  ghost: { bg: 'transparent', fg: C.accent, border: 'transparent' },
  danger: { bg: C.danger, fg: C.onAccent, border: C.danger },
  dark: { bg: C.ink, fg: C.onAccent, border: C.ink },
  light: { bg: C.card, fg: C.accent, border: C.card }, // on the burgundy hero card
};
/** Pill button. Height 52 (44 small). Loading keeps the label, swaps the icon for a spinner and locks the button. */
export function Button({ title, onPress, kind = 'secondary', size = 'md', disabled, loading, style, icon, label }: BtnProps) {
  const off = disabled && !loading;
  const v = off ? { bg: C.sunken, fg: C.muted, border: C.sunken } : BTN[kind];
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} onPress={onPress} disabled={disabled || loading} scaleTo={0.97}
      style={[s.btn, size === 'sm' && { minHeight: touch.min, paddingHorizontal: 16 }, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      <View style={s.row}>
        {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
        <Text style={[type.label, { color: v.fg, fontSize: size === 'sm' ? 14 : 15 }]}>{title}</Text>
      </View>
    </Press>
  );
}

export function IconButton({ icon, onPress, label, tone }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; tone?: 'accent' }) {
  return (
    <Press accessibilityLabel={label} onPress={onPress} hitSlop={8} scaleTo={0.92}
      style={[{ width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: tone === 'accent' ? C.accent : C.card, borderWidth: 1, borderColor: tone === 'accent' ? C.accent : C.border, alignItems: 'center', justifyContent: 'center' }, shadow.s1]}>
      <Ionicons name={icon} size={20} color={tone === 'accent' ? C.onAccent : C.text} />
    </Press>
  );
}

// ───────────────────────── Cards ─────────────────────────
export type CardVariant = 'raised' | 'flat' | 'tint' | 'hero';
const CARD: Record<CardVariant, ViewStyle> = {
  raised: { backgroundColor: C.card, borderColor: 'transparent', ...shadow.s2 },
  flat: { backgroundColor: C.card, borderColor: C.border },
  tint: { backgroundColor: C.accentSoft, borderColor: C.accentSoft },
  hero: { backgroundColor: C.accent, borderColor: C.accent, ...shadow.s2 },
};
/** Raised (default), flat (lists, nested), tint (highlights), hero (today's workout only). Pressable only with onPress. */
export function Card({ children, style, onPress, flat, variant }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; flat?: boolean; variant?: CardVariant }) {
  const body = [s.card, CARD[variant ?? (flat ? 'flat' : 'raised')], style];
  if (!onPress) return <View style={body}>{children}</View>;
  return <Press onPress={onPress} style={body}>{children}</Press>;
}

/** Feature icon inside a burgundy-50 tile. */
export function IconTile({ name, tone = 'accent', size = 44 }: { name: keyof typeof Ionicons.glyphMap; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

// ───────────────────────── Chips & badges ─────────────────────────
export type Tone = 'neutral' | 'accent' | 'pos' | 'warn' | 'danger' | 'direct' | 'principle' | 'rule';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.sunken, fg: C.text2 },
  accent: { bg: C.accentSoft, fg: C.accent },
  pos: { bg: C.posSoft, fg: C.pos },
  warn: { bg: C.warnSoft, fg: C.warn },
  danger: { bg: C.dangerSoft, fg: C.danger },
  direct: { bg: color.directTint, fg: color.direct },
  principle: { bg: color.principleTint, fg: color.principle },
  rule: { bg: color.ruleTint, fg: color.rule },
};
export const toneColor = (t: Tone) => TONES[t].fg;
export const toneSoft = (t: Tone) => TONES[t].bg;

/** Badge chip: always icon or words, never color alone (evidence, source, status). */
export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = TONES[tone];
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, backgroundColor: t.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[type.caption, { color: t.fg, fontFamily: font.bodyBold, fontSize: 12, lineHeight: 16 }]}>{label}</Text>
    </View>
  );
}

/** Filter pill (toggle). */
export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: on }} scaleTo={0.96} hitSlop={5} // 38 + 2×5 = 48 dp touch target
      style={{ paddingHorizontal: 16, minHeight: 38, borderRadius: R.pill, justifyContent: 'center', backgroundColor: on ? C.accent : C.card, borderWidth: 1, borderColor: on ? C.accent : C.border }}>
      <Text style={[type.label, { fontSize: 14, color: on ? C.onAccent : C.text }]}>{label}</Text>
    </Press>
  );
}

/** Segmented control: sand track, white selected segment. */
export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.sunken, borderRadius: R.pill, padding: 4 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
            style={[{ flex: 1, minHeight: 48, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: C.card, ...shadow.s1 }]}>
            <Text style={[type.label, { fontSize: 14, color: on ? C.accent : C.text2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────────────────── Selection ─────────────────────────
type Opt<V> = { value: V; label: string; hint?: string; icon?: keyof typeof Ionicons.glyphMap };
/** Option tiles. Single select shows a radio; pass an array value for multi-select (checkbox). */
export function Choice<V extends string | number>({ options, value, onChange }: { options: Opt<V>[]; value: V | V[] | null; onChange: (v: V) => void }) {
  const multi = Array.isArray(value);
  return (
    <View style={{ gap: 10 }} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {options.map((o) => {
        const on = multi ? (value as V[]).includes(o.value) : value === o.value;
        return (
          <Press key={String(o.value)} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} scaleTo={0.985}
            style={[s.choice, on && { borderColor: C.accent, backgroundColor: C.accentSoft }]}>
            <View style={[{ width: 22, height: 22, borderRadius: multi ? 6 : 11, borderWidth: 2, borderColor: on ? C.accent : C.control, alignItems: 'center', justifyContent: 'center' }, multi && on && { backgroundColor: C.accent }]}>
              {on ? (multi ? <Ionicons name="checkmark" size={14} color={C.onAccent} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />) : null}
            </View>
            {o.icon ? <IconTile name={o.icon} tone={on ? 'accent' : 'neutral'} size={36} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <T bold>{o.label}</T>
              {o.hint ? <T muted size="sm">{o.hint}</T> : null}
            </View>
          </Press>
        );
      })}
    </View>
  );
}

/** Text field: label always visible; error shown with an icon and words, never color alone. */
export function Field(props: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const { label, error, hint, style, ...rest } = props;
  const [focus, setFocus] = useState(false);
  // Decimal-comma keyboards type "72,5": store "72.5" so every Number() downstream reads it correctly.
  const onChangeText = rest.keyboardType === 'decimal-pad' && rest.onChangeText
    ? (t: string) => rest.onChangeText!(t.replace(',', '.')) : rest.onChangeText;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[type.label, { color: C.text }]}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.muted} accessibilityLabel={rest.accessibilityLabel ?? label} accessibilityHint={rest.accessibilityHint ?? error ?? hint} {...rest}
        onChangeText={onChangeText} onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }} onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: C.accent, borderWidth: 2 }, error ? { borderColor: C.danger } : null, style]} />
      {error ? (
        <View style={[s.row, { gap: 6 }]} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={16} color={C.danger} importantForAccessibility="no" />
          <T size="sm" color={C.danger} style={{ flex: 1 }}>{error}</T>
        </View>
      ) : hint ? <T size="sm" muted>{hint}</T> : null}
    </View>
  );
}

/** − value + number stepper (weights, reps). Tinted round buttons; the value stays directly editable. */
export function Stepper({ value, onChange, step, unit, min = 0, big, label = 'Value' }: { value: string; onChange: (v: string) => void; step: number; unit?: string; min?: number; big?: boolean; label?: string }) {
  // "62,5" from comma keyboards is 62.5: pressing + must not reset it to 0 + step.
  const n = Number(value.replace(',', '.')) || 0;
  const bump = (d: number) => {
    const next = Math.max(min, Math.round((n + d) * 100) / 100);
    onChange(String(next));
    AccessibilityInfo.announceForAccessibility(`${label} ${next}${unit ? ` ${unit}` : ''}`);
  };
  const btn = (icon: 'remove' | 'add', d: number) => (
    <Press accessibilityLabel={`${icon === 'add' ? 'Increase' : 'Decrease'} ${label.toLowerCase()} by ${step}`} onPress={() => bump(d)} scaleTo={0.9}
      style={{ width: big ? 52 : touch.min, height: big ? 52 : touch.min, borderRadius: 26, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={big ? 24 : 20} color={C.accent} />
    </Press>
  );
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      {btn('remove', -step)}
      <View style={[{ alignItems: 'center', flex: 1 }, !big && { borderWidth: 1.5, borderColor: C.control, borderRadius: R.md, backgroundColor: C.card, minHeight: touch.primary, justifyContent: 'center' }]}>
        <TextInput value={value} onChangeText={(t) => onChange(t.replace(',', '.'))} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel={unit ? `${label} in ${unit}` : label}
          accessibilityActions={[{ name: 'increment', label: `Increase ${label.toLowerCase()}` }, { name: 'decrement', label: `Decrease ${label.toLowerCase()}` }]}
          onAccessibilityAction={(e) => bump(e.nativeEvent.actionName === 'increment' ? step : -step)}
          maxFontSizeMultiplier={big ? 1.3 : undefined}
          style={[big ? type.numeric : type.h3, { color: C.text, textAlign: 'center', minWidth: 90, padding: 0, fontVariant: ['tabular-nums'] }]} />
        {unit ? <T muted size="sm">{unit}</T> : null}
      </View>
      {btn('add', step)}
    </View>
  );
}

// ───────────────────────── Progress & data ─────────────────────────
/** Horizontal bar. `zone` draws a soft "productive range" band behind the fill. */
export function ProgressBar({ value, max = 1, tone = 'accent', height = 8, zone, label }: { value: number; max?: number; tone?: Tone; height?: number; zone?: [number, number]; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(pct, { duration: 500 }); }, [pct, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: '#EFE4DC', overflow: 'hidden' }}
      accessible={!!label} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      {zone ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%`, backgroundColor: C.accentBorder }} /> : null}
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: TONES[tone].fg }, a]} />
    </View>
  );
}

/** Big tabular number with a small unit and optional delta. */
export function Stat({ value, unit, label, delta, tone }: { value: string | number; unit?: string; label?: string; delta?: string; tone?: Tone }) {
  return (
    <View style={{ gap: 2 }}>
      {label ? <T size="micro">{label}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={[type.h1, { color: C.text, fontVariant: ['tabular-nums'] }]}>{value}</Text>
        {unit ? <T muted size="sm">{unit}</T> : null}
      </View>
      {delta ? <T size="sm" bold color={toneColor(tone ?? 'pos')}>{delta}</T> : null}
    </View>
  );
}

/** Minimal line chart built from views (no chart dependency): one burgundy line, last point marked. */
export function LineChart({ values, height = 140, label }: { values: number[]; height?: number; label: string }) {
  const [w, setW] = useState(0);
  if (values.length < 2) {
    return <View style={{ height: 60, justifyContent: 'center' }}><T muted size="sm">Log a few more sessions to see a trend.</T></View>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 14;
  const pts = values.map((v, i) => ({ x: pad + (i * (w - pad * 2)) / (values.length - 1), y: pad + (1 - (v - min) / span) * (height - pad * 2) }));
  return (
    <View style={{ height }} accessible accessibilityRole="image" onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityLabel={`${label}: ${values.length} points, first ${values[0]}, latest ${values[values.length - 1]}, lowest ${min}, highest ${max}`}>
      {[0, 0.5, 1].map((g) => <View key={g} style={{ position: 'absolute', left: 0, right: 0, top: pad + g * (height - pad * 2), height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />)}
      {w > 0 && pts.slice(1).map((p, i) => {
        const a = pts[i];
        const len = Math.hypot(p.x - a.x, p.y - a.y);
        const ang = Math.atan2(p.y - a.y, p.x - a.x);
        return (
          <View key={i} style={{ position: 'absolute', left: (a.x + p.x) / 2 - len / 2, top: (a.y + p.y) / 2 - 1.25, width: len, height: 2.5, borderRadius: 2, backgroundColor: C.accent, transform: [{ rotate: `${ang}rad` }] }} />
        );
      })}
      {w > 0 && pts.map((p, i) => i === pts.length - 1 ? (
        <View key={i} style={{ position: 'absolute', left: p.x - 6, top: p.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, borderWidth: 3, borderColor: C.card }} />
      ) : null)}
      <View style={{ position: 'absolute', left: 0, top: 0 }}><T size="sm" muted>{max}</T></View>
      <View style={{ position: 'absolute', left: 0, bottom: 0 }}><T size="sm" muted>{min}</T></View>
    </View>
  );
}

// ───────────────────────── Sheets ─────────────────────────
/** Bottom sheet (28 top radius); centred card on wide screens. Closes on scrim tap and the hardware back button. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.scrim }} onPress={onClose} accessible={false} importantForAccessibility="no" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
        <View accessibilityViewIsModal style={[{ width: '100%', maxWidth: 560, maxHeight: height * 0.85, backgroundColor: C.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: SP.xl, paddingBottom: 36, gap: SP.md }, shadow.s3]}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          {title ? (
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="lg" header style={{ flex: 1 }}>{title}</T>
              <Press onPress={onClose} accessibilityLabel="Close" scaleTo={0.9} hitSlop={6}
                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color={C.text} />
              </Press>
            </View>
          ) : null}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: SP.md }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────── States ─────────────────────────
export function Loading() {
  return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }} accessible accessibilityLabel="Loading"><ActivityIndicator color={C.accent} size="large" /></View>;
}

/** Empty state: icon tile, one-line headline, one sentence, optional action. Never an apology, never blank. */
export function Empty({ icon, title, body, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, padding: SP.xl }}>
      <IconTile name={icon} tone="accent" size={52} />
      <T bold style={{ textAlign: 'center' }}>{title}</T>
      <T muted size="sm" style={{ textAlign: 'center' }}>{body}</T>
      {action && onAction ? <Button kind="primary" size="sm" title={action} onPress={onAction} style={{ marginTop: SP.sm }} /> : null}
    </View>
  );
}

/** Banner: caution / error / info line with an icon (never color alone). */
export function Banner({ text, tone = 'warn', action, onAction }: { text: string; tone?: 'warn' | 'danger' | 'accent'; action?: string; onAction?: () => void }) {
  const t = TONES[tone];
  // A live region that mounts together with its text is often not read on Android: announce warnings and errors.
  useEffect(() => { if (tone !== 'accent') AccessibilityInfo.announceForAccessibility(text); }, [text, tone]);
  return (
    <View style={[s.row, { backgroundColor: t.bg, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12 }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={tone === 'accent' ? 'notifications-outline' : 'warning-outline'} size={18} color={t.fg} />
      <T size="sm" color={tone === 'accent' ? C.text : t.fg} style={{ flex: 1 }}>{text}</T>
      {action && onAction ? <Pressable onPress={onAction} accessibilityRole="button" hitSlop={14}><T size="sm" bold color={C.accent}>{action}</T></Pressable> : null}
    </View>
  );
}

/** Question-step header: back button, "Step n of total", segmented progress. */
export function StepProgress({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        {onBack ? <IconButton icon="chevron-back" label="Back" onPress={onBack} /> : null}
        <T size="sm" muted>Step {step} of {total}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? C.accent : C.accentBorder }} />
        ))}
      </View>
    </View>
  );
}

/** Fade + rise on mount; use sparingly for hero content. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const k = useSharedValue(0);
  useEffect(() => { k.value = withTiming(1, { duration: 250 + delay }); }, [k, delay]);
  const a = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ translateY: (1 - k.value) * 6 }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

export const s = StyleSheet.create({
  screen: { padding: gutter, gap: 20, flexGrow: 1, paddingBottom: 48 },
  btn: { minHeight: touch.primary, borderRadius: R.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: 20, gap: 12 },
  choice: { minHeight: 64, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  input: { minHeight: touch.primary, borderRadius: R.md, borderWidth: 1.5, borderColor: C.control, backgroundColor: C.card, color: C.text, fontFamily: font.body, fontSize: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

/** Settings-style row: icon tile, title, value, chevron. */
export function ListRow({ icon, title, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; title: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const body = (
    <View style={[s.row, { minHeight: 56, paddingVertical: 4 }]}>
      <IconTile name={icon} tone={danger ? 'danger' : 'accent'} size={36} />
      <T bold style={{ flex: 1 }} color={danger ? C.danger : undefined}>{title}</T>
      {value ? <T muted size="sm">{value}</T> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress} scaleTo={0.99}>{body}</Press> : body;
}
