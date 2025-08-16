/**
 * Purple-themed color palette
 */

export const Colors = {
  light: {
    // Primary colors - Purple/Violet theme (improved)
    primary: '#6B68FF',           // Brighter, more modern purple
    primaryLight: '#F0F0FF',      // Very light purple for backgrounds
    primaryDark: '#4F4CFF',       // Slightly darker purple for emphasis
    accent: '#000000',            // Black accent for better contrast
    
    // Base colors (more modern, less harsh)
    text: '#000000',              // Pure black for maximum readability
    textSecondary: '#666666',     // Softer gray for secondary text
    textMuted: '#999999',         // Muted text
    background: '#F8F9FA',        // Off-white background (easier on eyes)
    backgroundSecondary: '#F0F1F3', // Subtle gray background
    backgroundElevated: '#FFFFFF', // Pure white for elevation
    
    // UI colors (improved contrast and modernity)
    card: '#FFFFFF',              // White cards with shadows
    cardHover: '#F8F9FA',         // Light gray hover state
    cardBorder: '#E9ECEF',        // Neutral gray border
    inputBackground: '#F8F9FA',   // Light gray input background
    inputBorder: '#DEE2E6',       // Neutral border
    inputBorderFocus: '#6B68FF',  // Purple focus border
    
    // Status colors
    success: '#22C55E',           // Green
    error: '#FF5A5F',             // Softer red
    warning: '#FFB400',           // Orange
    info: '#00A9FF',              // Blue
    
    // Navigation (updated to match new scheme)
    tabIconDefault: '#999999',    // Muted gray icon
    tabIconSelected: '#6B68FF',   // Purple selected
    
    // Additional (updated for better contrast)
    divider: '#E9ECEF',
    overlay: 'rgba(0, 0, 0, 0.4)',
    
    // Shadows (more neutral)
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    // Primary colors - Purple adapted for dark mode
    primary: '#6B68FF',           // Bright purple for dark mode
    primaryLight: '#2A2A4D',      // Dark purple for backgrounds
    primaryDark: '#8B88FF',       // Brighter purple for emphasis
    accent: '#FFFFFF',            // White accent for contrast
    
    // Base colors
    text: '#FFFFFF',              // White text
    textSecondary: '#C1C1E0',     // Light purple-gray text
    textMuted: '#8B8BA3',         // Muted text
    background: '#0E0E1A',        // Very dark purple-black background
    backgroundSecondary: '#1A1A2E', // Slightly lighter background
    backgroundElevated: '#25253D', // Elevated surface
    
    // UI colors
    card: '#1A1A2E',              // Dark cards
    cardHover: '#25253D',         // Card hover state
    cardBorder: '#2A2A4D',        // Dark purple border
    inputBackground: '#25253D',   // Dark input background
    inputBorder: '#2A2A4D',       // Dark border
    inputBorderFocus: '#6B68FF',  // Purple focus border
    
    // Status colors
    success: '#22C55E',           // Green
    error: '#FF5A5F',             // Red
    warning: '#FFB400',           // Orange
    info: '#00A9FF',              // Blue
    
    // Navigation
    tabIconDefault: '#5D5D7A',    // Muted icon
    tabIconSelected: '#6B68FF',   // Purple selected
    
    // Additional
    divider: '#2A2A4D',
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