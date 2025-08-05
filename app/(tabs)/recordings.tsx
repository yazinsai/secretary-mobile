import { StyleSheet, SectionList, View, Pressable, Alert, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import Animated, {
  FadeInDown,
  FadeOut,
  Layout,
  SlideInLeft,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Recording } from '@/types';
import { storageService } from '@/services/storage';
import { audioService } from '@/services/audio';
import { syncService } from '@/services/sync';
import { recordingService, MergedRecording } from '@/services/recordingService';
import { formatDate, formatDuration, groupRecordingsByDate, formatTimeOnly } from '@/utils/helpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/Colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RecordingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [recordings, setRecordings] = useState<MergedRecording[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    loadRecordings();
    
    // Configure audio mode for playback
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
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

  const handlePlay = async (recording: MergedRecording) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Check if audio is available
      if (!recording.fileUri) {
        Alert.alert('Audio Not Available', 'This recording\'s audio file is not available on this device.');
        return;
      }
      
      // If we're currently playing this recording, stop it
      if (playingId === recording.id) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingId(null);
        return;
      }

      // Stop any currently playing sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }

      // Create and play the new recording
      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.fileUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            // Playback finished
            setPlayingId(null);
          }
        }
      );

      soundRef.current = sound;
      setPlayingId(recording.id);
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play recording');
      setPlayingId(null);
    }
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
              // Close the swipeable
              swipeableRefs.current[recording.id]?.close();
              
              // Stop playback if this recording is playing
              if (playingId === recording.id && soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setPlayingId(null);
              }
              
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
  }, [playingId]);

  const handleLongPress = useCallback((recording: MergedRecording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const actions = [];
    
    // Add resend webhook option if webhook failed
    if (recording.webhookStatus === 'failed' && recording.transcript) {
      actions.push({
        text: 'Resend Webhook',
        onPress: async () => {
          try {
            await syncService.resendWebhook(recording.id);
            Alert.alert('Success', 'Webhook sent successfully');
            await loadRecordings();
          } catch (error) {
            Alert.alert(
              'Error', 
              `Failed to send webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });
    }
    
    actions.push(
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => handleDelete(recording),
      },
      {
        text: 'Cancel',
        style: 'cancel' as const,
      }
    );
    
    Alert.alert('Recording Options', undefined, actions);
  }, [handleDelete]);

  const renderRightActions = (recording: MergedRecording) => {
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
  };

  const RecordingItem = ({ item, index }: { item: MergedRecording; index: number }) => {
    const isCurrentlyPlaying = playingId === item.id;
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
              {/* Play Button */}
              <Pressable
                style={[
                  styles.playButton,
                  { 
                    backgroundColor: isCurrentlyPlaying ? theme.primary : theme.backgroundSecondary,
                    opacity: !item.fileUri ? 0.5 : 1
                  }
                ]}
                onPress={() => handlePlay(item)}
                disabled={!item.fileUri}
              >
                <IconSymbol
                  name={!item.fileUri ? 'play.slash.fill' : (isCurrentlyPlaying ? 'pause.fill' : 'play.fill')}
                  size={16}
                  color={!item.fileUri ? theme.textSecondary : (isCurrentlyPlaying ? 'white' : theme.primary)}
                />
              </Pressable>

              {/* Content */}
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
                  {/* Upload Status */}
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
                  
                  {/* Sync Status */}
                  {item.source === 'database' && (
                    <IconSymbol name="icloud.fill" size={14} color={theme.primary} />
                  )}
                  {item.source === 'both' && (
                    <IconSymbol name="checkmark.icloud.fill" size={14} color={theme.success} />
                  )}
                  {item.source === 'local' && item.syncStatus !== 'synced' && (
                    <IconSymbol name="iphone" size={14} color={theme.textSecondary} />
                  )}
                  
                  {/* Webhook Status */}
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
  };

  const sections = useMemo(() => {
    return groupRecordingsByDate(recordings);
  }, [recordings]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Animated.View entering={FadeInDown}>
          <ThemedText type="title" style={styles.title}>Recordings</ThemedText>
        </Animated.View>
      </View>
      
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
          renderItem={({ item, index }) => <RecordingItem item={item} index={index} />}
          renderSectionHeader={({ section: { date } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {date}
              </ThemedText>
            </View>
          )}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.md,
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
    paddingBottom: Spacing.xl,
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
  playButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
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
});