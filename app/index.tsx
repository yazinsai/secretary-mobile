import { StyleSheet, View, Pressable, FlatList, Alert, ListRenderItemInfo } from 'react-native';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
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
import { ProcessingStateBadge } from '@/components/ProcessingStateBadge';
import { RecordingTimer } from '@/components/RecordingTimer';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { recordingService } from '@/services/recordingService';
import { formatDuration, formatTimeOnly } from '@/utils/helpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Colors';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/contexts/AuthContext';
import { Recording } from '@/types';
import { realtimeService } from '@/services/realtime';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MainScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  
  // Recording state
  const { isRecording, error, startRecording, stopRecording } = useRecording();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Animation values
  const buttonScale = useSharedValue(1);
  const successScale = useSharedValue(0);

  useEffect(() => {
    let unsubscribeRecordings: (() => void) | undefined;
    let unsubscribeConnection: (() => void) | undefined;
    let isInitialized = false;

    const initializeServices = async () => {
      if (!user || isInitialized) return;
      isInitialized = true;

      setIsInitialLoading(true);
      
      // Subscribe to recording changes BEFORE initializing to prevent race conditions
      unsubscribeRecordings = recordingService.onRecordingsChange((updatedRecordings, changeType, changedId) => {
        console.log(`UI received update: ${changeType} for ${changedId || 'all'}`);
        
        // Hide loading state on initial load
        if (changeType === 'initial') {
          setIsInitialLoading(false);
        }
        
        setRecordings(prevRecordings => {
          // Handle different change types
          switch (changeType) {
            case 'update': {
              if (!changedId) return updatedRecordings;
              // Only update the specific item
              const index = prevRecordings.findIndex(r => r.id === changedId);
              if (index === -1) return prevRecordings;
              const newRecordings = [...prevRecordings];
              const updatedRecording = updatedRecordings.find(r => r.id === changedId);
              if (updatedRecording) {
                newRecordings[index] = updatedRecording;
              }
              return newRecordings;
            }
            case 'delete': {
              if (!changedId) return updatedRecordings;
              return prevRecordings.filter(r => r.id !== changedId);
            }
            case 'add': {
              if (!changedId) return updatedRecordings;
              const newRecording = updatedRecordings.find(r => r.id === changedId);
              if (!newRecording) return prevRecordings;
              return [newRecording, ...prevRecordings];
            }
            case 'initial':
            case 'refresh':
            default:
              return updatedRecordings;
          }
        });
      });

      // Small delay to ensure all services are ready, then initialize  
      await new Promise(resolve => setTimeout(resolve, 500));
      await recordingService.initialize(user.id);

      // Subscribe to connection state
      unsubscribeConnection = realtimeService.onConnectionStateChange((connected) => {
        setIsConnected(connected);
      });
    };

    if (user) {
      initializeServices();
    }

    // Cleanup
    return () => {
      if (unsubscribeRecordings) unsubscribeRecordings();
      if (unsubscribeConnection) unsubscribeConnection();
    };
  }, [user]);

  const handleDelete = useCallback(async (recording: Recording) => {
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
              // No need to refresh - realtime will handle it
            } catch (error) {
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  }, []);

  const handleRetry = useCallback(async (recording: Recording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await recordingService.retryRecording(recording.id);
      // No need to refresh - realtime will handle the update
    } catch (error) {
      Alert.alert('Error', 'Failed to retry recording');
    }
  }, []);

  const handleLongPress = useCallback((recording: Recording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const actions = [
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => handleDelete(recording),
      },
    ];

    // Add retry option if in failed state
    if (recording.processingState.includes('failed')) {
      actions.unshift({
        text: 'Retry',
        style: 'default' as const,
        onPress: () => handleRetry(recording),
      });
    }
    
    actions.push({
      text: 'Cancel',
      style: 'cancel' as const,
    });
    
    Alert.alert('Recording Options', undefined, actions);
  }, [handleDelete, handleRetry]);

  // Memoize renderItem to prevent re-creation on every render
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<Recording>) => (
    <RecordingItem item={item} index={index} />
  ), []);

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
        // No need to refresh - realtime will handle new recording
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

  const renderRightActions = useCallback((recording: Recording) => {
    return (
      <Animated.View
        entering={FadeInDown}
        style={styles.deleteAction}
      >
        <Pressable
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
          onPress={() => handleDelete(recording)}
        >
          <IconSymbol name="trash" size={20} color={theme.accent} />
        </Pressable>
      </Animated.View>
    );
  }, [theme.error, handleDelete]);

  const RecordingItem = memo(function RecordingItem({ item, index }: { item: Recording; index: number }) {
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

                {/* Processing State Badge */}
                <ProcessingStateBadge 
                  recording={item} 
                  onRetry={item.processingState.includes('failed') ? () => handleRetry(item) : undefined}
                />
              </View>
            </View>
          </AnimatedPressable>
        </Swipeable>
      </Animated.View>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison for memo - only re-render if the recording data actually changed
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.processingState === nextProps.item.processingState &&
      prevProps.item.transcript === nextProps.item.transcript &&
      prevProps.item.title === nextProps.item.title &&
      prevProps.item.uploadProgress === nextProps.item.uploadProgress &&
      prevProps.index === nextProps.index
    );
  });


  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerContent}>
          <Animated.View entering={FadeInDown}>
            <ThemedText type="title" style={styles.title}>Recordings</ThemedText>
          </Animated.View>
          <View style={styles.headerRight}>
            {/* Connection Indicator */}
            <View style={[styles.connectionIndicator, { backgroundColor: isConnected ? theme.success : theme.textSecondary }]} />
            <UserAvatar />
          </View>
        </View>
      </View>
      
      {/* Recordings List */}
      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading recordings...</ThemedText>
        </View>
      ) : recordings.length === 0 ? (
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
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          getItemLayout={(data, index) => ({
            length: 100, // Approximate height of each item
            offset: 100 * index,
            index,
          })}
        />
      )}

      {/* Recording Timer Overlay */}
      <RecordingTimer isRecording={isRecording} initialDuration={0} />

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    lineHeight: Typography.sizes.xxxl * 1.3,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  recordingItemContainer: {
    marginBottom: Spacing.md,
  },
  recordingCard: {
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
  deleteAction: {
    justifyContent: 'center',
    marginBottom: Spacing.md,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.sizes.lg,
    opacity: 0.6,
  },
});