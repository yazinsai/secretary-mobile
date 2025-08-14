import { StyleSheet, View, Pressable, SectionList, Alert, RefreshControl, Dimensions, Text } from 'react-native';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeOut,
  Layout,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { UserAvatar } from '@/components/UserAvatar';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { recordingService, MergedRecording } from '@/services/recordingService';
import { audioService } from '@/services/audio';
import { formatDuration, groupRecordingsByDate, formatTimeOnly } from '@/utils/helpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';
import { useRecording } from '@/hooks/useRecording';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MainScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [recordings, setRecordings] = useState<MergedRecording[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  
  // Recording state
  const { isRecording, duration, error, startRecording, stopRecording } = useRecording();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Animation values
  const buttonScale = useSharedValue(1);
  const successScale = useSharedValue(0);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await recordingService.getMergedRecordings();
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecordings();
    setRefreshing(false);
  };

  const handleDelete = useCallback((recording: MergedRecording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              swipeableRefs.current[recording.id]?.close();
              await recordingService.deleteRecording(recording.id);
              if (recording.source === 'local' || recording.source === 'both') {
                await audioService.deleteRecording(recording.fileUri);
              }
              await loadRecordings();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  }, []);

  const handleLongPress = useCallback((recording: MergedRecording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const actions = [
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => handleDelete(recording),
      },
      {
        text: 'Cancel',
        style: 'cancel' as const,
      }
    ];
    
    Alert.alert('Recording Options', undefined, actions);
  }, [handleDelete]);

  const handleRecordPressIn = () => {
    buttonScale.value = withSpring(0.88, { 
      damping: 10, 
      stiffness: 400 
    });
  };

  const handleRecordPressOut = () => {
    buttonScale.value = withSpring(1, { 
      damping: 8,
      stiffness: 200,
      velocity: 2
    });
  };

  const handleRecordPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isRecording) {
      setIsSaving(true);
      await stopRecording();
      
      // Trigger success animation
      setShowSuccess(true);
      successScale.value = withSequence(
        withSpring(1.05, { 
          damping: 10,
          stiffness: 180,
        }),
        withSpring(1, { 
          damping: 12,
          stiffness: 200,
        })
      );
      
      setTimeout(() => {
        setIsSaving(false);
        setShowSuccess(false);
        successScale.value = withSpring(0, { damping: 15, stiffness: 200 });
        loadRecordings(); // Refresh the list
      }, 1800);
    } else {
      await startRecording();
    }
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: interpolate(successScale.value, [0, 0.5, 1], [0, 1, 1]),
  }));

  const renderRightActions = useCallback((recording: MergedRecording) => {
    return (
      <Animated.View
        entering={FadeInDown}
        style={styles.deleteAction}
      >
        <Pressable
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
          onPress={() => handleDelete(recording)}
        >
          <IconSymbol name="trash" size={20} color="white" />
        </Pressable>
      </Animated.View>
    );
  }, [theme.error, handleDelete]);

  const RecordingItem = memo(({ item, index }: { item: MergedRecording; index: number }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      'worklet';
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
      'worklet';
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 30).springify()}
        exiting={SlideOutLeft}
        layout={Layout.springify()}
      >
        <Swipeable
          ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
          renderRightActions={() => renderRightActions(item)}
          rightThreshold={40}
        >
          <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={() => handleLongPress(item)}
            style={[animatedStyle, styles.recordingItemContainer]}
          >
            <View style={[styles.recordingCard, { backgroundColor: theme.card }]}>
              <View style={styles.recordingContent}>
                <View style={styles.recordingHeader}>
                  <ThemedText style={styles.recordingTime}>
                    {formatTimeOnly(item.timestamp)}
                  </ThemedText>
                  <ThemedText style={[styles.recordingDuration, { color: theme.textSecondary }]}>
                    {formatDuration(item.duration)}
                  </ThemedText>
                </View>
                
                {item.title && (
                  <ThemedText style={styles.recordingTitle} numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                )}
                
                {item.transcript && (
                  <ThemedText 
                    style={[styles.recordingTranscript, { color: theme.textSecondary }]} 
                    numberOfLines={2}
                  >
                    {item.transcript}
                  </ThemedText>
                )}

                {/* Status Indicators */}
                <View style={styles.statusRow}>
                  {item.status !== 'uploaded' && (
                    <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSecondary }]}>
                      <IconSymbol
                        name={item.status === 'uploading' ? 'arrow.up.circle' : 'exclamationmark.circle'}
                        size={12}
                        color={item.status === 'uploading' ? theme.primary : theme.error}
                      />
                      <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
                        {item.status}
                      </ThemedText>
                    </View>
                  )}
                  
                  {item.source === 'local' && item.syncStatus !== 'synced' && (
                    <IconSymbol name="wifi.slash" size={14} color={theme.textSecondary} />
                  )}
                  
                  {item.webhookStatus === 'failed' && (
                    <View style={[styles.webhookDot, { backgroundColor: theme.error }]} />
                  )}
                </View>
              </View>
            </View>
          </AnimatedPressable>
        </Swipeable>
      </Animated.View>
    );
  });

  const sections = useMemo(() => {
    return groupRecordingsByDate(recordings);
  }, [recordings]);

  const renderItem = useCallback(({ item, index }: { item: MergedRecording; index: number }) => (
    <RecordingItem item={item} index={index} />
  ), []);

  const renderSectionHeader = useCallback(({ section: { date } }: any) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {date}
      </ThemedText>
    </View>
  ), [theme.background, theme.textSecondary]);

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerContent}>
          <Animated.View entering={FadeInDown}>
            <ThemedText type="title" style={styles.title}>Recordings</ThemedText>
          </Animated.View>
          <UserAvatar />
        </View>
      </View>
      
      {/* Recordings List */}
      {recordings.length === 0 ? (
        <Animated.View
          entering={FadeInDown.delay(200)}
          style={styles.emptyState}
        >
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
            <IconSymbol
              name="mic.slash"
              size={48}
              color={theme.primary}
            />
          </View>
          <ThemedText style={styles.emptyText}>
            No recordings yet
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Tap the record button to get started
          </ThemedText>
        </Animated.View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
        />
      )}

      {/* Recording Timer Overlay */}
      {isRecording && (
        <Animated.View 
          entering={FadeInDown}
          style={[styles.recordingOverlay, { backgroundColor: theme.overlay }]}
        >
          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <View style={styles.pulseIndicator}>
              <View style={[styles.pulseDot, { backgroundColor: theme.error }]} />
            </View>
            <Text style={[styles.timerText, { color: theme.text }]}>
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={[styles.recordingLabel, { color: theme.textSecondary }]}>
              Recording...
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Success Message */}
      {showSuccess && (
        <Animated.View style={[styles.successOverlay, successAnimatedStyle]}>
          <View style={[styles.successCard, { backgroundColor: theme.card, borderColor: theme.primary + '20' }]}>
            <IconSymbol name="checkmark.circle" size={48} color={theme.primary} />
            <ThemedText type="subheading" style={[styles.successText, { color: theme.text }]}>
              Saved
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Record Button - Fixed at bottom */}
      <View style={[styles.recordButtonContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            style={[
              styles.recordButton,
              { 
                backgroundColor: isRecording ? theme.error : theme.primary,
              }
            ]}
            onPressIn={handleRecordPressIn}
            onPressOut={handleRecordPressOut}
            onPress={handleRecordPress}
            disabled={isSaving}
          >
            <IconSymbol 
              size={32} 
              name={isRecording ? "stop.fill" : "mic.fill"} 
              color={theme.accent}
            />
          </Pressable>
        </Animated.View>
      </View>

      {/* Error Message */}
      {error && (
        <Animated.View
          entering={FadeInDown}
          exiting={FadeOut}
          style={[styles.errorCard, { backgroundColor: theme.error + '15' }]}
        >
          <IconSymbol name="exclamationmark.circle" size={20} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {error}
          </ThemedText>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.xxxl * 1.3,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 120, // Space for the record button
  },
  recordingItemContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  recordingContent: {
    flex: 1,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  recordingTime: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  recordingDuration: {
    fontSize: Typography.sizes.xs,
  },
  recordingTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    marginBottom: Spacing.xs,
  },
  recordingTranscript: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.4,
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    textTransform: 'capitalize',
  },
  webhookDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deleteAction: {
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  deleteButton: {
    width: 70,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: Typography.sizes.base,
    textAlign: 'center',
  },
  recordButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCard: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  timerText: {
    fontSize: Typography.sizes.huge,
    lineHeight: Typography.sizes.huge * 1.2,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.lg,
  },
  recordingLabel: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  successOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  successCard: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  successText: {
    letterSpacing: -0.5,
  },
  errorCard: {
    position: 'absolute',
    bottom: 120,
    marginHorizontal: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
  },
});