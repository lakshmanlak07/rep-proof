// RepProof design tokens (Design System v1.0, board 01 Foundations / board 12 Implementation spec).
// The only place that knows a color, a size or a font. Components read these; screens never use raw hex.
import type { TextStyle, ViewStyle } from 'react-native';

export const color = {
  bg: '#FBF6F1', // cream-0, app background
  surface: '#FFFFFF', // cards
  sand: '#F5EDE6', // inset fill
  ink: '#2A1620', // text 15.8:1
  ink2: '#5E4A53', // body 7.6:1
  muted: '#74606A', // captions 5.4:1
  line: '#E9DDD3', // dividers
  primary: '#7A1F3D', // burgundy-600, 10:1 on white
  primaryPressed: '#651631', // burgundy-700
  primaryTint: '#F7E8EC', // burgundy-50, selected
  primaryBorder: '#EFD3DB', // burgundy-100, borders on tint
  accent: '#C2315F', // raspberry-500
  success: '#2F6B4F', successTint: '#E6F2EB',
  caution: '#8A5200', cautionTint: '#FBEFD7',
  danger: '#B3261E', dangerTint: '#FCE9E7',
  direct: '#1F6B5C', directTint: '#DFF0EC',
  principle: '#43498C', principleTint: '#E8E9F7',
  rule: '#7A1F3D', ruleTint: '#F7E8EC',
  scrim: 'rgba(42,22,32,0.45)',
} as const;

/** Dark mode (future): a second map with the same keys; flip with useColorScheme() once contrast is re-checked. */
export const darkColor = { bg: '#1A0F14', surface: '#261923', ink: '#F6ECE6', muted: '#D9AFBD', primaryText: '#E58AA6', primaryFill: '#C2315F' } as const;

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72] as const;
export const gutter = 20;
export const radius = { sm: 8, md: 16, lg: 20, xl: 24, sheet: 28, pill: 999 } as const;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.display, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  h1: { fontFamily: font.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  h2: { fontFamily: font.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontFamily: font.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  bodyL: { fontFamily: font.body, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: font.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
  numeric: { fontFamily: font.display, fontSize: 40, lineHeight: 40, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const shadow = {
  s1: { shadowColor: '#4A1C2D', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  s2: { shadowColor: '#4A1C2D', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  s3: { shadowColor: '#4A1C2D', shadowOpacity: 0.24, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 10 },
} satisfies Record<string, ViewStyle>;

/** Touch targets: 44 minimum, 52 for primary actions. */
export const touch = { min: 44, primary: 52 } as const;

/** Shell breakpoints: bottom tab bar under 1024, left rail (248 px) from 1024. */
export const breakpoint = { tablet: 640, rail: 1024 } as const;
