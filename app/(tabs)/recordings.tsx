import { StyleSheet, FlatList, View, Pressable, Alert, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
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
import { Card } from '@/components/ui/Card';
import { Recording } from '@/types';
import { storageService } from '@/services/storage';
import { audioService } from '@/services/audio';
import { syncService } from '@/services/sync';
import { formatDate, formatDuration } from '@/utils/helpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/Colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RecordingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [recordings, setRecordings] = useState<Recording[]>([]);
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
      const data = await storageService.getRecordings();
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

  const handlePlay = async (recording: Recording) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
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

  const handleDelete = useCallback((recording: Recording) => {
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
              
              await storageService.deleteRecording(recording.id);
              await audioService.deleteRecording(recording.fileUri);
              await loadRecordings();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  }, [playingId]);

  const handleLongPress = useCallback((recording: Recording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const actions = [];
    
    // Add resend webhook option if webhook failed
    if (recording.webhookStatus === 'failed' && recording.transcript) {
      actions.push({
        text: 'Resend Webhook',
        onPress: async () => {
          try {
            await syncService.resendWebhook(recording.id);
            Toast.show({
              type: 'success',
              text1: 'Webhook Sent',
              position: 'top',
              visibilityTime: 2000,
            });
            await loadRecordings();
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Failed to send webhook',
              text2: error instanceof Error ? error.message : 'Unknown error',
              position: 'top',
              visibilityTime: 3000,
            });
          }
        },
      });
    }
    
    actions.push(
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDelete(recording),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      }
    );
    
    Alert.alert('Recording Options', undefined, actions);
  }, [handleDelete]);

  const getStatusColor = (status: Recording['status']) => {
    switch (status) {
      case 'uploaded':
        return theme.success;
      case 'uploading':
        return theme.primary;
      case 'failed':
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: Recording['status']) => {
    switch (status) {
      case 'uploaded':
        return 'checkmark.circle.fill';
      case 'uploading':
        return 'arrow.up.circle.fill';
      case 'failed':
        return 'exclamationmark.circle.fill';
      default:
        return 'circle.fill';
    }
  };

  const renderRightActions = (recording: Recording) => {
    return (
      <Animated.View
        entering={FadeInDown}
        style={styles.deleteAction}
      >
        <Pressable
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
          onPress={() => handleDelete(recording)}
        >
          <IconSymbol name="trash" size={24} color="white" />
        </Pressable>
      </Animated.View>
    );
  };

  const RecordingItem = ({ item, index }: { item: Recording; index: number }) => {
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
        entering={FadeInDown.delay(index * 50).springify()}
        exiting={SlideOutLeft}
        layout={Layout.springify()}
      >
        <Swipeable
          ref={(ref) => (swipeableRefs.current[item.id] = ref)}
          renderRightActions={() => renderRightActions(item)}
          rightThreshold={40}
        >
          <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={() => handleLongPress(item)}
            style={[animatedStyle, styles.recordingItemContainer]}
          >
            <Card style={styles.recordingCard}>
              <View style={styles.recordingContent}>
                <View style={styles.recordingInfo}>
                  <ThemedText style={styles.recordingTitle} numberOfLines={1}>
                    {item.title || 'Untitled Recording'}
                  </ThemedText>
                  <ThemedText style={[styles.recordingDate, { color: theme.textSecondary }]}>
                    {formatDate(item.timestamp)}
                  </ThemedText>
                  {item.transcript && (
                    <ThemedText 
                      style={[styles.recordingPreview, { color: theme.textTertiary }]} 
                      numberOfLines={2}
                    >
                      {item.transcript}
                    </ThemedText>
                  )}
                  <View style={styles.recordingMeta}>
                    <ThemedText style={[styles.recordingDuration, { color: theme.textSecondary }]}>
                      {formatDuration(item.duration)}
                    </ThemedText>
                    <View style={styles.statusBadge}>
                      <IconSymbol
                        name={getStatusIcon(item.status)}
                        size={16}
                        color={getStatusColor(item.status)}
                      />
                    </View>
                    {item.webhookStatus && (
                      <View 
                        style={[
                          styles.webhookDot, 
                          { backgroundColor: item.webhookStatus === 'sent' ? theme.success : theme.warning }
                        ]} 
                      />
                    )}
                  </View>
                </View>
                
                <Pressable
                  style={[
                    styles.playButton,
                    { backgroundColor: isCurrentlyPlaying ? theme.primary : theme.backgroundSecondary }
                  ]}
                  onPress={() => handlePlay(item)}
                >
                  <IconSymbol
                    name={isCurrentlyPlaying ? 'pause.fill' : 'play.fill'}
                    size={20}
                    color={isCurrentlyPlaying ? 'white' : theme.primary}
                  />
                </Pressable>
              </View>
            </Card>
          </AnimatedPressable>
        </Swipeable>
      </Animated.View>
    );
  };

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
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <RecordingItem item={item} index={index} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.xxxl * 1.3,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  recordingItemContainer: {
    marginBottom: Spacing.md,
  },
  recordingCard: {
    padding: Spacing.lg,
  },
  recordingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.xs,
  },
  recordingDate: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
  },
  recordingPreview: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.4,
    marginBottom: Spacing.sm,
  },
  recordingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  recordingDuration: {
    fontSize: Typography.sizes.sm,
  },
  webhookDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.lg,
    ...Shadows.sm,
  },
  deleteAction: {
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  deleteButton: {
    width: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
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