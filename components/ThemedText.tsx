import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { Typography } from '@/constants/Colors';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyBold' | 'caption' | 'label' | 'link';
  weight?: keyof typeof Typography.weights;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'body',
  weight,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'hero' ? styles.hero : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'subheading' ? styles.subheading : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'bodyBold' ? styles.bodyBold : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'label' ? styles.label : undefined,
        type === 'link' ? styles.link : undefined,
        weight ? { fontFamily: `Inter-${weight === 'regular' ? 'Regular' : weight === 'medium' ? 'Medium' : weight === 'semibold' ? 'SemiBold' : weight === 'bold' ? 'Bold' : weight === 'heavy' ? 'ExtraBold' : 'Black'}` } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    fontSize: Typography.sizes.massive,
    lineHeight: Typography.sizes.massive * Typography.lineHeight.tight,
    fontFamily: 'Inter-Black',
    letterSpacing: -2,
  },
  title: {
    fontSize: Typography.sizes.huge,
    lineHeight: Typography.sizes.huge * Typography.lineHeight.tight,
    fontFamily: 'Inter-ExtraBold',
    letterSpacing: -1.5,
  },
  heading: {
    fontSize: Typography.sizes.xxxl,
    lineHeight: Typography.sizes.xxxl * Typography.lineHeight.tight,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: Typography.sizes.xxl,
    lineHeight: Typography.sizes.xxl * Typography.lineHeight.normal,
    fontFamily: 'Inter-SemiBold',
  },
  body: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeight.relaxed,
    fontFamily: 'Inter-Regular',
  },
  bodyBold: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeight.relaxed,
    fontFamily: 'Inter-Bold',
  },
  caption: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * Typography.lineHeight.normal,
    fontFamily: 'Inter-Regular',
  },
  label: {
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.xs * Typography.lineHeight.normal,
    fontFamily: 'Inter-Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeight.relaxed,
    fontFamily: 'Inter-Medium',
    textDecorationLine: 'underline',
  },
});
