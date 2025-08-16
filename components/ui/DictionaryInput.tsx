import { StyleSheet, View, Pressable, TextInput, ScrollView } from 'react-native';
import { useState } from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';

interface DictionaryInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function DictionaryInput({ value, onChange, placeholder = "Add a term..." }: DictionaryInputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemove = (term: string) => {
    onChange(value.filter(t => t !== term));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.borderLight,
            }
          ]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {inputValue.trim() && (
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={handleAdd}
          >
            <IconSymbol name="plus" size={20} color={theme.accent} />
          </Pressable>
        )}
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagsContainer}
      >
        {value.map((term, index) => (
          <Animated.View
            key={term}
            entering={SlideInRight.delay(index * 50).springify()}
            exiting={SlideOutLeft}
            layout={Layout.springify()}
          >
            <View style={[styles.tag, { backgroundColor: theme.primaryLight }]}>
              <ThemedText style={[styles.tagText, { color: theme.primary }]}>
                {term}
              </ThemedText>
              <Pressable
                onPress={() => handleRemove(term)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol 
                  name="xmark" 
                  size={16} 
                  color={theme.primary}
                  style={styles.removeIcon}
                />
              </Pressable>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: Typography.sizes.base,
    borderWidth: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  tagText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  removeIcon: {
    marginLeft: Spacing.xs,
  },
});