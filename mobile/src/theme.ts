import { Platform } from 'react-native';

/**
 * Short Cut's palette is a paper map on a table: sage paper, ink type, white
 * streets and one coral line for the route. Colors are tuned so that every
 * text pair used in the app clears WCAG AA at its rendered size.
 */
export const colors = {
  ink: '#132622',
  inkSoft: '#2A3F39',
  paper: '#F2F3EA',
  paperDeep: '#E8EBDD',
  surface: '#FCFCF6',
  surfaceAlt: '#EBEEE3',
  coral: '#D9482A',
  coralDeep: '#B4371E',
  coralSoft: '#FBE6DF',
  teal: '#24625F',
  tealSoft: '#DFEDE8',
  mint: '#1F8A5E',
  mintBright: '#2FAF7A',
  mintSoft: '#DDF3E7',
  amber: '#A96A10',
  amberSoft: '#FBF0DA',
  slate: '#5C737C',
  muted: '#596B64',
  mutedLight: '#7C8A84',
  line: '#D8DFCF',
  lineStrong: '#C3CDBB',
  white: '#FFFFFF',
  danger: '#A93F2B',
  navInk: '#12211F',
  navInkSoft: '#1C302C',
  overlay: 'rgba(19, 38, 34, 0.42)',
} as const;

export const fonts = {
  sans: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  display: 'SpaceGrotesk_500Medium',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const shadow = {
  soft: Platform.select({
    android: { elevation: 6, shadowColor: '#17312E' },
    default: {
      shadowColor: '#17312E',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }),
  lifted: Platform.select({
    android: { elevation: 14, shadowColor: '#10201E' },
    default: {
      shadowColor: '#10201E',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 14,
    },
  }),
  tiny: Platform.select({
    android: { elevation: 2 },
    default: {
      shadowColor: '#17312E',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  }),
};

export const type = {
  kicker: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  micro: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -1.1,
    color: '#132622',
  },
  hero: {
    fontFamily: fonts.displayBold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -2.4,
    color: '#132622',
  },
} as const;
