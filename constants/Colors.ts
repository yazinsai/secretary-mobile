/**
 * Wise-inspired color palette with beautiful purple hues
 */

export const Colors = {
  light: {
    // Primary colors
    primary: '#9334E9',           // Vibrant purple
    primaryLight: '#E9D7FE',      // Light purple for backgrounds
    primaryDark: '#6B21A8',       // Dark purple for emphasis
    
    // Base colors
    text: '#1F2937',              // Dark gray for text
    textSecondary: '#6B7280',     // Medium gray for secondary text
    background: '#FFFFFF',        // Pure white background
    backgroundSecondary: '#F9FAFB', // Light gray background
    
    // UI colors
    card: '#FFFFFF',              // White cards
    cardBorder: '#E5E7EB',        // Light border
    inputBackground: '#F3F4F6',   // Light gray input background
    inputBorder: '#D1D5DB',       // Medium gray border
    inputBorderFocus: '#9334E9',  // Purple focus border
    
    // Status colors
    success: '#10B981',           // Green
    error: '#EF4444',             // Red
    warning: '#F59E0B',           // Orange
    info: '#3B82F6',              // Blue
    
    // Navigation
    tabIconDefault: '#9CA3AF',    // Gray icon
    tabIconSelected: '#9334E9',   // Purple selected
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    // Primary colors
    primary: '#A855F7',           // Slightly lighter purple for dark mode
    primaryLight: '#581C87',      // Dark purple for backgrounds
    primaryDark: '#C084FC',       // Light purple for emphasis
    
    // Base colors
    text: '#F9FAFB',              // Light text
    textSecondary: '#D1D5DB',     // Medium gray text
    background: '#0F172A',        // Dark background
    backgroundSecondary: '#1E293B', // Slightly lighter background
    
    // UI colors
    card: '#1E293B',              // Dark cards
    cardBorder: '#334155',        // Dark border
    inputBackground: '#1E293B',   // Dark input background
    inputBorder: '#334155',       // Dark border
    inputBorderFocus: '#A855F7',  // Purple focus border
    
    // Status colors
    success: '#10B981',           // Green
    error: '#EF4444',             // Red
    warning: '#F59E0B',           // Orange
    info: '#3B82F6',              // Blue
    
    // Navigation
    tabIconDefault: '#64748B',    // Gray icon
    tabIconSelected: '#A855F7',   // Purple selected
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};

// Design tokens
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
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