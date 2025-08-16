# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm start                    # Start Expo development server
npx expo start              # Alternative way to start dev server
npm run ios                 # Run on iOS simulator
npm run android             # Run on Android emulator
npm run web                 # Run in web browser
```

### Code Quality
```bash
npm run lint                # Run ESLint
```

### Custom Scripts
```bash
npm run import-storage      # Import recordings from local storage to database (uses bun)
npm run process-recordings  # Process existing recordings through transcription pipeline (uses bun)
```

### Building
```bash
npx eas build --platform ios      # Build for iOS with EAS
npx eas build --platform android  # Build for Android with EAS
npx eas build --platform all      # Build for both platforms
```

## Architecture

### Service Layer Pattern
The app uses a service layer pattern where each service is a singleton class managing specific functionality:

- **supabaseService** (`services/supabase.ts`): Handles all Supabase interactions including auth, storage uploads, and database operations. Uses separate auth and data clients.
- **recordingService** (`services/recordingService.ts`): Merges recordings from local storage and database, providing a unified interface for recording management.
- **queueService** (`services/queue.ts`): Manages offline queue for upload/transcription with exponential backoff retry logic.
- **syncService** (`services/sync.ts`): Periodic sync between local and cloud storage.
- **audioService** (`services/audio.ts`): Handles audio recording and playback using expo-av.
- **storageService** (`services/storage.ts`): Local AsyncStorage persistence for offline support.
- **groqService** (`services/groq.ts`): Transcription via Groq API.
- **userSettingsService** (`services/userSettings.ts`): Manages user configuration stored locally.

### Data Flow
1. **Recording Creation**: Audio recorded via `audioService` → saved locally via `storageService` → queued in `queueService`
2. **Upload Pipeline**: Queue processes → uploads to Supabase storage → triggers edge function for transcription
3. **Sync Strategy**: Dual-source architecture where `recordingService` merges local and cloud recordings, preferring local for conflict resolution

### Authentication Flow
- Auth handled by `AuthContext` using Supabase Auth
- Session persistence via AsyncStorage for offline support
- Protected routes enforced in `app/_layout.tsx` via `useSegments` navigation guard

### Supabase Integration

#### Storage Configuration
- Bucket name: `recordings` (must be created manually)
- Files stored as: `{user_id}/{recording_id}.m4a`
- Requires either public bucket OR configured RLS policies

#### Edge Functions
Located in `supabase/functions/`:
- `transcribe-audio`: Processes audio through Groq API
- `send-webhook`: Sends recording data to configured webhook URL
- `process-transcript`: Additional transcript processing

#### Database Schema
Migrations in `supabase/migrations/`:
- `recordings` table with user_id, timestamp, duration, transcript fields
- `user_profiles` table for extended user data

### State Management
- **AuthContext**: Global auth state using React Context
- **Local State**: Recording list and UI state managed in components
- **Service State**: Each service maintains its own state (queue items, settings, etc.)

### Key Design Decisions

1. **Offline-First**: All recordings saved locally first, then synced when online
2. **Dual-Source Data**: Recordings fetched from both local storage and database, merged by `recordingService`
3. **Queue-Based Processing**: Background queue ensures uploads/transcription happen eventually
4. **Service Singletons**: Services initialized once in `_layout.tsx` and manage their own lifecycle
5. **Expo Router**: File-based routing with auth guards in layout component

### Error Handling Patterns
- Services throw specific errors with user-friendly messages
- Queue implements exponential backoff for retries
- Network failures gracefully fall back to local-only mode
- Toast notifications for user feedback via `react-native-toast-message`

## Development Best Practices

- Run `npm run lint` after code modifications to ensure code quality
- When modifying Supabase integration, test with both anon and service role keys
- Test offline mode by disabling network to verify queue behavior
- Check recordings appear in both local state and Supabase dashboard after sync