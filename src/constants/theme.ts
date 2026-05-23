/**
 * MyGarage Lite - Modern Dark Theme
 * Tema warna otomotif modern: dark charcoal + biru tua + orange accent
 */

export const darkTheme = {
  colors: {
    // Backgrounds
    background: '#0A0A0F',
    surface: '#13131A',
    card: '#1A1A24',
    cardLight: '#22222E',
    overlay: 'rgba(0, 0, 0, 0.7)',

    // Brand
    primary: '#0F3460',
    primaryLight: '#1E4D8B',
    primaryDark: '#0A2547',
    accent: '#FF6B35',
    accentDark: '#E55525',
    accentLight: '#FF8A5C',

    // Accents
    blue: '#1E90FF',
    blueDark: '#1873CC',

    // Text
    text: '#FFFFFF',
    textSecondary: '#A0A0B0',
    textMuted: '#6B6B7B',

    // Status
    success: '#00C896',
    warning: '#FFB800',
    danger: '#FF4757',
    info: '#1E90FF',

    // UI
    border: '#2A2A38',
    borderLight: '#3A3A48',
    divider: '#1F1F2A',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
  },
} as const;

export const lightTheme = {
  colors: {
    // Backgrounds
    background: '#F5F7FA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardLight: '#F8F9FA',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Brand
    primary: '#0F3460',
    primaryLight: '#1E4D8B',
    primaryDark: '#0A2547',
    accent: '#FF6B35',
    accentDark: '#E55525',
    accentLight: '#FF8A5C',

    // Accents
    blue: '#1E90FF',
    blueDark: '#1873CC',

    // Text
    text: '#1A1A2E',
    textSecondary: '#4A4A5E',
    textMuted: '#7A7A8E',

    // Status
    success: '#00C896',
    warning: '#FFB800',
    danger: '#FF4757',
    info: '#1E90FF',

    // UI
    border: '#D8D8E0',
    borderLight: '#E0E0E8',
    divider: '#E8E8F0',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
  },
} as const;

export const theme = darkTheme;

export type Theme = typeof darkTheme | typeof lightTheme;
