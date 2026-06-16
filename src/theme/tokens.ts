// Artemis design tokens — ported from artemis/styles.css.
// Gold stays constant across themes (Artemis signature).

export const palette = {
  // Purple (formerly Forest)
  forest900: '#3A1F4A',
  forest700: '#502D61',
  forest500: '#7C4A99',
  forest300: '#A888B9',
  forest100: '#E2D5E8',

  // Gold (theme-invariant)
  gold700: '#A57A1F',
  gold500: '#C9973A',
  gold300: '#E2BD6E',
  gold100: '#F2E2BB',

  // Status
  statusOk: '#5A8F3C',
  statusWarn: '#D4A933',
  statusAlarm: '#C0392B',
  crimson: '#C0392B',
  crimsonSoft: '#E89C95',
} as const;

export type ColorTokens = {
  // Surfaces
  ivoryBg: string;
  moonlight: string;
  parchment: string;

  // Forest (lightens slightly in night mode per spec)
  forest900: string;
  forest700: string;
  forest500: string;
  forest300: string;
  forest100: string;

  // Text
  ink: string;
  inkSoft: string;
  inkMute: string;
  hairline: string;

  // Gold (constant)
  gold700: string;
  gold500: string;
  gold300: string;
  gold100: string;

  // Status / alarm
  statusOk: string;
  statusWarn: string;
  statusAlarm: string;
  crimson: string;
  crimsonSoft: string;
};

export const lightColors: ColorTokens = {
  ivoryBg: '#FAF7F0',
  moonlight: '#F5F0E8',
  parchment: '#FFFDF8',

  forest900: palette.forest900,
  forest700: palette.forest700,
  forest500: palette.forest500,
  forest300: palette.forest300,
  forest100: palette.forest100,

  ink: '#1B1F16',
  inkSoft: '#4A5240',
  inkMute: '#8A8E7E',
  hairline: 'rgba(80, 45, 97, 0.10)',

  gold700: palette.gold700,
  gold500: palette.gold500,
  gold300: palette.gold300,
  gold100: palette.gold100,

  statusOk: palette.statusOk,
  statusWarn: palette.statusWarn,
  statusAlarm: palette.statusAlarm,
  crimson: palette.crimson,
  crimsonSoft: palette.crimsonSoft,
};

export const nightColors: ColorTokens = {
  ivoryBg: '#121118',
  moonlight: '#1A171F',
  parchment: '#201C27',

  // Purple lightened for night mode
  forest900: '#3D3546',
  forest700: '#564A63',
  forest500: '#6D5C7E',
  forest300: '#8B7D9F',
  forest100: '#2A2232',

  ink: '#F2EFE3',
  inkSoft: '#C8CDB6',
  inkMute: '#8A9479',
  hairline: 'rgba(242, 226, 187, 0.12)',

  gold700: palette.gold700,
  gold500: palette.gold500,
  gold300: palette.gold300,
  gold100: palette.gold100,

  statusOk: palette.statusOk,
  statusWarn: palette.statusWarn,
  statusAlarm: palette.statusAlarm,
  crimson: palette.crimson,
  crimsonSoft: palette.crimsonSoft,
};

export const radii = {
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const spacing = {
  pageH: 22,
  cardPad: 18,
  cardPadInner: 14,
  tabBarEdge: 14,
  tabBarBottom: 18,
  tabBarPad: 8,
} as const;

// Type scale (px). Display = Fraunces, Body = DM Sans.
export const type = {
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  // DM Sans (this @expo-google-fonts build) ships 400/500/700 only — no 600.
  // Map "semibold" to 700 so emphasis text actually renders in DM Sans instead
  // of silently falling back to the system font.
  bodySemibold: 'DMSans_700Bold',
  bodyBold: 'DMSans_700Bold',

  size: {
    h1: 32,
    h2: 24,
    section: 22,
    displayBody: 20,
    displayBodyS: 18,
    large: 17,
    body: 15,
    bodyS: 14,
    small: 13,
    meta: 12,
    eyebrow: 11,
  },

  letterSpacing: {
    h1: -0.4,
    eyebrow: 1.4,
  },

  lineHeight: {
    h1: 1.05,
    body: 1.4,
  },
} as const;

// Native shadows are split iOS/Android. iOS gets the layered look closer to spec;
// Android approximates via elevation.
export const shadows = {
  soft: {
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  card: {
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
  },
  pop: {
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 60,
    elevation: 12,
  },
  primaryBtn: {
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  dangerBtn: {
    shadowColor: '#C0392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

// Motion durations (ms) and easing identifiers consumed by Reanimated.
export const motion = {
  page: 320,
  buttonPress: 120,
  toggle: 220,
  alarmPulse: 1400,
  okPulse: 1200,
  bottomSheet: 320,
  callRing: 1600,
} as const;

export const layout = {
  pillButtonPadV: 14,
  pillButtonPadH: 22,
  pillButtonLgPadV: 18,
  pillButtonLgPadH: 24,
  imOkPadV: 26,
} as const;
