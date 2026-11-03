import { Platform } from 'react-native';

export const colors = {
  ink: '#172B28',
  inkSoft: '#2B403B',
  paper: '#F0F2E9',
  paperDeep: '#E7EBDF',
  surface: '#FAFBF5',
  surfaceAlt: '#EDF0E6',
  coral: '#E45537',
  coralDeep: '#C74327',
  coralSoft: '#FBE8E2',
  teal: '#2B6968',
  tealSoft: '#E1EEEA',
  mint: '#2FAF7A',
  mintSoft: '#DDF3E7',
  amber: '#E39A24',
  amberSoft: '#FBF0DA',
  slate: '#657D87',
  muted: '#6D7D77',
  mutedLight: '#93A09A',
  line: '#DCE2D4',
  lineStrong: '#C9D2C3',
  white: '#FFFFFF',
  danger: '#B3452F',
  navInk: '#12211F',
  navInkSoft: '#1C302C',
  overlay: 'rgba(23, 43, 40, 0.42)',
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
    letterSpacing: 1.6,
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
};
