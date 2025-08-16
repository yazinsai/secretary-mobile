import { StyleSheet, View, Pressable, SectionList, Alert } from 'react-native';
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
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
  withTiming,
  interpolate,
} from 'react-native-reanimated';

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

// Date formatting utility
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  
  // For other dates, show relative or absolute date
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

export default function MainScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Group recordings by date
  const groupedRecordings = useMemo(() => {
    const groups: { [key: string]: Recording[] } = {};
    
    recordings.forEach(recording => {
      const date = new Date(recording.timestamp);
      const dateKey = date.toDateString(); // e.g., "Mon Dec 25 2023"
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(recording);
    });

    // Convert to section list format and sort by date (newest first)
    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(dateKey => ({
        title: formatDateHeader(new Date(dateKey)),
        data: groups[dateKey].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }));
  }, [recordings]);

  
  // Recording state
  const { isRecording, error, startRecording, stopRecording } = useRecording();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  
  // Animation values
  const buttonScale = useSharedValue(1);
  const successScale = useSharedValue(0);
  
  // Header scroll animations
  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);

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

  // Render section header
  const renderSectionHeader = useCallback(({ section: { title } }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <ThemedText style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
    </View>
  ), [theme]);

  // Memoize renderItem to work with sections
  const renderItem = useCallback(({ item, index }: { item: Recording; index: number }) => (
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

  // Header scroll animation
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  // Scroll handler for header animation
  const handleScroll = useCallback((event: any) => {
    'worklet';
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.value;
    
    // Only trigger animation if scroll distance is significant
    if (Math.abs(scrollDiff) > 5) {
      if (scrollDiff > 0 && currentScrollY > 50) {
        // Scrolling down - hide header
        headerOpacity.value = withTiming(0, { duration: 200 });
        headerTranslateY.value = withTiming(-60, { duration: 200 });
      } else if (scrollDiff < 0) {
        // Scrolling up - show header
        headerOpacity.value = withTiming(1, { duration: 200 });
        headerTranslateY.value = withTiming(0, { duration: 200 });
      }
    }
    
    lastScrollY.value = currentScrollY;
  }, []);


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
        <AnimatedPressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            setExpandedTranscripts(prev => {
              const newSet = new Set(prev);
              if (newSet.has(item.id)) {
                newSet.delete(item.id);
              } else {
                newSet.add(item.id);
              }
              return newSet;
            });
          }}
          onLongPress={() => handleLongPress(item)}
          style={[animatedStyle, styles.recordingItemContainer]}
        >
          <View style={[styles.recordingCard, { backgroundColor: theme.card }]}>
            <View style={styles.recordingContent}>
              <View style={styles.recordingHeader}>
                <View style={styles.recordingHeaderLeft}>
                  {item.title ? (
                    <>
                      <ThemedText style={styles.recordingTitle} numberOfLines={1}>
                        {item.title}
                      </ThemedText>
                      <ThemedText style={[styles.recordingTime, { color: theme.textSecondary }]}>
                        {formatTimeOnly(item.timestamp)}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={styles.recordingTime}>
                      {formatTimeOnly(item.timestamp)}
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={[styles.recordingDuration, { color: theme.textSecondary }]}>
                  {formatDuration(item.duration)}
                </ThemedText>
              </View>
              
              {item.transcript && (
                <ThemedText 
                  style={[styles.recordingTranscript, { color: theme.textSecondary }]} 
                  numberOfLines={expandedTranscripts.has(item.id) ? undefined : 3}
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
      <Animated.View 
        style={[
          styles.header, 
          { 
            paddingTop: insets.top + Spacing.md,
            backgroundColor: theme.background + 'F0', // Semi-transparent background
          },
          headerAnimatedStyle
        ]}
      >
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
      </Animated.View>
      
      {/* Recordings List */}
      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading recordings...</ThemedText>
        </View>
      ) : groupedRecordings.length === 0 ? (
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
          sections={groupedRecordings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 100 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          stickySectionHeadersEnabled={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
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
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  recordingHeaderLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  recordingTime: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  recordingDuration: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  recordingTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    marginBottom: 2,
  },
  recordingTranscript: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.4,
    marginBottom: Spacing.xs,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionHeaderText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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