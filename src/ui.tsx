// Rep Proof design system.
// Calm, warm-neutral foundation; ONE accent (deep ink-teal) reserved for progress, primary actions and active states.
// Semantic green / amber / red are muted and only carry meaning (positive, caution, problem).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// ───────────────────────── Tokens ─────────────────────────
export const C = {
  bg: '#F7F5F1', // warm off-white
  card: '#FFFFFF',
  sunken: '#F0EDE7', // inset surfaces, tracks
  border: '#E8E4DC',
  text: '#1B1C1F', // charcoal
  muted: '#6F7075',
  faint: '#A4A29C',
  accent: '#0E5C63', // Rep Proof ink-teal
  accentSoft: '#E3EFEF',
  onAccent: '#FFFFFF',
  ink: '#1B1C1F',
  pos: '#2F7D52', posSoft: '#E5F1EA',
  warn: '#A8731A', warnSoft: '#F7EDD8',
  danger: '#B4443E', dangerSoft: '#F6E3E1',
  scrim: 'rgba(20,20,22,0.45)',
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const SHADOW: ViewStyle = {
  shadowColor: '#2A2118', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

/** Wide layouts (tablet / desktop web) get a side nav and a centred content column. */
export const BREAKPOINT = 900;
export const useWide = () => useWindowDimensions().width >= BREAKPOINT;

// ───────────────────────── Typography ─────────────────────────
type Size = 'micro' | 'sm' | 'md' | 'lg' | 'xl' | 'display';
const TYPE: Record<Size, TextStyle> = {
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8, fontWeight: '600', textTransform: 'uppercase' },
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 16, lineHeight: 23 },
  lg: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontWeight: '700' },
  xl: { fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontWeight: '700' },
  display: { fontSize: 48, lineHeight: 52, letterSpacing: -1.5, fontWeight: '700' },
};
type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; size?: Size; bold?: boolean; color?: string; numberOfLines?: number };
export function T({ children, style, muted, size = 'md', bold, color, numberOfLines }: TProps) {
  return (
    <Text numberOfLines={numberOfLines}
      style={[{ color: color ?? (muted ? C.muted : C.text) }, TYPE[size], bold && { fontWeight: '700' }, size === 'micro' && !color && { color: C.muted }, style]}>
      {children}
    </Text>
  );
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
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={[inner, { flex: 1, width: '100%', maxWidth: 760 }]}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: SP.sm }]}>
      <View style={{ flex: 1, gap: 4 }}>
        {kicker ? <T size="micro">{kicker}</T> : null}
        <T size="xl">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: SP.md }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="lg">{title}</T>
        {action ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><T size="sm" bold color={C.accent}>{action}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />;

// ───────────────────────── Press feedback ─────────────────────────
const OUTER_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical']);
/** Pressable with a subtle spring scale. All tappable cards and buttons use it. */
export function Press({ children, onPress, style, disabled, scaleTo = 0.975, ...rest }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; scaleTo?: number;
  accessibilityLabel?: string; accessibilityRole?: 'button' | 'link' | 'checkbox'; accessibilityState?: { selected?: boolean; checked?: boolean }; hitSlop?: number;
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
      onPressIn={() => { k.set(withTiming(scaleTo, { duration: 90 })); }}
      onPressOut={() => { k.set(withSpring(1, { damping: 14, stiffness: 260 })); }}>
      <Animated.View style={[a, inner]}>{children}</Animated.View>
    </Pressable>
  );
}

// ───────────────────────── Buttons ─────────────────────────
type BtnProps = { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; icon?: keyof typeof Ionicons.glyphMap };
export function Button({ title, onPress, kind = 'secondary', disabled, loading, style, icon }: BtnProps) {
  const fg = kind === 'primary' || kind === 'dark' ? '#fff' : kind === 'danger' ? C.danger : kind === 'ghost' ? C.muted : C.text;
  const bg = kind === 'primary' ? C.accent : kind === 'dark' ? C.ink : kind === 'ghost' ? 'transparent' : C.card;
  const border = kind === 'secondary' || kind === 'danger' ? C.border : 'transparent';
  return (
    <Press accessibilityRole="button" onPress={onPress} disabled={disabled || loading} scaleTo={0.97}
      style={[s.btn, { backgroundColor: bg, borderColor: border }, kind === 'primary' && SHADOW, disabled && { opacity: 0.4 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={s.row}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: '600', fontSize: 16, letterSpacing: -0.1 }}>{title}</Text>
        </View>
      )}
    </Press>
  );
}

export function IconButton({ icon, onPress, label, tone }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; tone?: 'accent' }) {
  return (
    <Press accessibilityLabel={label} onPress={onPress} hitSlop={8} scaleTo={0.9}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tone === 'accent' ? C.accent : C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={tone === 'accent' ? '#fff' : C.text} />
    </Press>
  );
}

// ───────────────────────── Cards ─────────────────────────
export function Card({ children, style, onPress, flat }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; flat?: boolean }) {
  const body = [s.card, !flat && SHADOW, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return <Press onPress={onPress} style={body}>{children}</Press>;
}

/** Round icon badge used on cards. */
export function IconTile({ name, tone = 'accent', size = 40 }: { name: keyof typeof Ionicons.glyphMap; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={t.fg} />
    </View>
  );
}

// ───────────────────────── Chips & badges ─────────────────────────
export type Tone = 'neutral' | 'accent' | 'pos' | 'warn' | 'danger';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.sunken, fg: C.muted },
  accent: { bg: C.accentSoft, fg: C.accent },
  pos: { bg: C.posSoft, fg: C.pos },
  warn: { bg: C.warnSoft, fg: C.warn },
  danger: { bg: C.dangerSoft, fg: C.danger },
};
export const toneColor = (t: Tone) => TONES[t].fg;
export const toneSoft = (t: Tone) => TONES[t].bg;

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = TONES[tone];
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.pill, backgroundColor: t.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Filter pill (toggle). */
export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: on }} scaleTo={0.95}
      style={{ paddingHorizontal: 16, height: 38, borderRadius: R.pill, justifyContent: 'center', backgroundColor: on ? C.ink : C.card, borderWidth: 1, borderColor: on ? C.ink : C.border }}>
      <Text style={{ color: on ? '#fff' : C.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Press>
  );
}

/** Segmented range switch: 7D / 30D / 90D / 1Y. */
export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.sunken, borderRadius: R.md, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={[{ flex: 1, height: 34, borderRadius: R.md - 3, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: C.card, ...SHADOW }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? C.text : C.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────────────────── Selection ─────────────────────────
type Opt<V> = { value: V; label: string; hint?: string; icon?: keyof typeof Ionicons.glyphMap };
/** Selectable cards. Single select by default; pass an array value for multi-select. Icons make them tile-like. */
export function Choice<V extends string | number>({ options, value, onChange }: { options: Opt<V>[]; value: V | V[] | null; onChange: (v: V) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return (
          <Press key={String(o.value)} accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} scaleTo={0.985}
            style={[s.choice, on && { borderColor: C.accent, backgroundColor: C.accentSoft }]}>
            {o.icon ? <IconTile name={o.icon} tone={on ? 'accent' : 'neutral'} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <T bold>{o.label}</T>
              {o.hint ? <T muted size="sm">{o.hint}</T> : null}
            </View>
            <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
              {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
          </Press>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T muted size="sm">{label}</T> : null}
      <TextInput placeholderTextColor={C.faint} {...rest} onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }} onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: C.accent }, style]} />
    </View>
  );
}

/** − value + stepper used for weight and reps while training. */
export function Stepper({ value, onChange, step, unit, min = 0, big }: { value: string; onChange: (v: string) => void; step: number; unit?: string; min?: number; big?: boolean }) {
  const n = Number(value) || 0;
  const bump = (d: number) => onChange(String(Math.max(min, Math.round((n + d) * 100) / 100)));
  const btn = (icon: 'remove' | 'add', d: number) => (
    <Press accessibilityLabel={icon === 'add' ? 'Increase' : 'Decrease'} onPress={() => bump(d)} scaleTo={0.88}
      style={{ width: big ? 56 : 44, height: big ? 56 : 44, borderRadius: big ? 28 : 22, backgroundColor: C.sunken, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={big ? 26 : 20} color={C.text} />
    </Press>
  );
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      {btn('remove', -step)}
      <View style={{ alignItems: 'center', flex: 1 }}>
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" selectTextOnFocus
          style={{ color: C.text, fontSize: big ? 44 : 30, fontWeight: '700', letterSpacing: -1, textAlign: 'center', minWidth: 90, padding: 0 }} />
        {unit ? <T muted size="sm">{unit}</T> : null}
      </View>
      {btn('add', step)}
    </View>
  );
}

// ───────────────────────── Progress & data ─────────────────────────
/** Animated horizontal bar. `zone` draws a soft "productive range" band behind the fill. */
export function ProgressBar({ value, max = 1, tone = 'accent', height = 8, zone }: { value: number; max?: number; tone?: Tone; height?: number; zone?: [number, number] }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(pct, { duration: 700 }); }, [pct, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.sunken, overflow: 'hidden' }}>
      {zone ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%`, backgroundColor: C.accentSoft }} /> : null}
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: TONES[tone].fg }, a]} />
    </View>
  );
}

/** Big number with a small unit and optional delta. */
export function Stat({ value, unit, label, delta, tone }: { value: string | number; unit?: string; label?: string; delta?: string; tone?: Tone }) {
  return (
    <View style={{ gap: 2 }}>
      {label ? <T size="micro">{label}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <T size="xl">{value}</T>
        {unit ? <T muted size="sm">{unit}</T> : null}
      </View>
      {delta ? <T size="sm" bold color={toneColor(tone ?? 'pos')}>{delta}</T> : null}
    </View>
  );
}

/** Minimal line chart built from views (no chart dependency). Last point is highlighted. */
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
    <View style={{ height }} accessibilityLabel={`${label}: ${values.join(', ')}`} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
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
      <View style={{ position: 'absolute', left: 0, top: 0 }}><T size="micro">{max}</T></View>
      <View style={{ position: 'absolute', left: 0, bottom: 0 }}><T size="micro">{min}</T></View>
    </View>
  );
}

// ───────────────────────── Sheets ─────────────────────────
/** Bottom sheet; centred card on wide screens. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 560, maxHeight: '85%', backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SP.xl, paddingBottom: 36, gap: SP.md }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          {title ? <T size="lg">{title}</T> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────── Misc ─────────────────────────
export function Loading() {
  return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}><ActivityIndicator color={C.accent} size="large" /></View>;
}

export function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, padding: SP.xl }}>
      <IconTile name={icon} tone="neutral" size={52} />
      <T bold>{title}</T>
      <T muted size="sm" style={{ textAlign: 'center' }}>{body}</T>
    </View>
  );
}

/** Fade + rise on mount; use sparingly for hero content. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const k = useSharedValue(0);
  useEffect(() => { k.value = withTiming(1, { duration: 420 + delay }); }, [k, delay]);
  const a = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ translateY: (1 - k.value) * 10 }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

export const s = StyleSheet.create({
  screen: { padding: 20, gap: 20, flexGrow: 1, paddingBottom: 48 },
  btn: { minHeight: 54, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 18, gap: 12 },
  choice: { minHeight: 64, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  input: { minHeight: 54, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, color: C.text, fontSize: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

/** Settings-style row: icon, title, value, chevron. */
export function ListRow({ icon, title, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; title: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const body = (
    <View style={[s.row, { minHeight: 52, paddingVertical: 4 }]}>
      <IconTile name={icon} tone={danger ? 'danger' : 'neutral'} size={34} />
      <T bold style={{ flex: 1 }} color={danger ? C.danger : undefined}>{title}</T>
      {value ? <T muted size="sm">{value}</T> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress} scaleTo={0.99}>{body}</Press> : body;
}
