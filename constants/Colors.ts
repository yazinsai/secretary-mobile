/**
 * Wise-inspired color palette
 */

export const Colors = {
  light: {
    // Primary colors - Wise green
    primary: '#22C55E',           // Strong green with proper contrast (WCAG AA compliant)
    primaryLight: '#E6F9DC',      // Light green for backgrounds
    primaryDark: '#16A34A',       // Darker green for emphasis
    accent: '#163300',            // Dark green accent
    
    // Base colors
    text: '#163300',              // Very dark green/black for text
    textSecondary: '#5D7052',     // Medium gray-green for secondary text
    textMuted: '#8B9A82',         // Muted text
    background: '#FFFFFF',        // Pure white background
    backgroundSecondary: '#F7FAF5', // Slight green tinted background
    backgroundElevated: '#FAFFFE', // Elevated surface
    
    // UI colors
    card: '#FFFFFF',              // White cards
    cardHover: '#F7FAF5',         // Card hover state
    cardBorder: '#E8EDE5',        // Subtle green-gray border
    inputBackground: '#F7FAF5',   // Light green-gray input background
    inputBorder: '#D4DED0',       // Green-gray border
    inputBorderFocus: '#9FE870',  // Green focus border
    
    // Status colors
    success: '#9FE870',           // Wise green
    error: '#FF5A5F',             // Softer red
    warning: '#FFB400',           // Orange
    info: '#00A9FF',              // Blue
    
    // Navigation
    tabIconDefault: '#8B9A82',    // Muted icon
    tabIconSelected: '#163300',   // Dark green selected
    
    // Additional
    divider: '#E8EDE5',
    overlay: 'rgba(22, 51, 0, 0.5)',
    
    // Shadows
    shadow: 'rgba(22, 51, 0, 0.08)',
  },
  dark: {
    // Primary colors - Wise green adapted for dark mode
    primary: '#22C55E',           // Strong green for dark mode
    primaryLight: '#2A3D1F',      // Dark green for backgrounds
    primaryDark: '#4ADE80',       // Brighter green for emphasis
    accent: '#22C55E',            // Green accent
    
    // Base colors
    text: '#FFFFFF',              // White text
    textSecondary: '#C1CFBA',     // Light green-gray text
    textMuted: '#8B9A82',         // Muted text
    background: '#0B1408',        // Very dark green-black background
    backgroundSecondary: '#162211', // Slightly lighter background
    backgroundElevated: '#1F2E19', // Elevated surface
    
    // UI colors
    card: '#162211',              // Dark cards
    cardHover: '#1F2E19',         // Card hover state
    cardBorder: '#2A3D1F',        // Dark green border
    inputBackground: '#1F2E19',   // Dark input background
    inputBorder: '#2A3D1F',       // Dark border
    inputBorderFocus: '#9FE870',  // Green focus border
    
    // Status colors
    success: '#9FE870',           // Wise green
    error: '#FF5A5F',             // Red
    warning: '#FFB400',           // Orange
    info: '#00A9FF',              // Blue
    
    // Navigation
    tabIconDefault: '#5D7052',    // Muted icon
    tabIconSelected: '#9FE870',   // Green selected
    
    // Additional
    divider: '#2A3D1F',
    overlay: 'rgba(0, 0, 0, 0.6)',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
};

// Design tokens
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  full: 9999,
} as const;

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
    huge: 56,
    massive: 72,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.3,
    relaxed: 1.5,
  },
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
} as const;