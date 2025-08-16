# AGENT.md

## Commands
- `npm start` / `npx expo start` - Start development server
- `npm run ios` / `npm run android` / `npm run web` - Run on specific platforms  
- `npm run lint` - ESLint code quality check
- `npm run import-storage` / `npm run process-recordings` - Custom scripts (use bun)
- `npx eas build --platform ios|android|all` - Build for production

## Architecture
React Native + Expo app with service layer pattern. Key services in `services/`:
- `supabaseService` - Database/storage/auth
- `recordingService` - Unified local+cloud recording management
- `queueService` - Offline upload queue with retry logic
- `audioService` - Recording/playback via expo-av
- All services are singletons initialized in `_layout.tsx`

## Code Style
- **Imports**: Use `@/` alias for absolute imports (tsconfig paths)
- **Components**: Functional components with TypeScript, use `ThemedText`/`ThemedView` for consistency
- **Naming**: camelCase variables/functions, PascalCase components/types, service files end with `Service`
- **Types**: Strict TypeScript, interfaces in `types/index.ts`, export all types from single file
- **Error Handling**: Services throw errors with user-friendly messages, use Toast for notifications
- **File Structure**: `app/` (screens), `components/` (UI), `services/` (business logic), `hooks/` (custom hooks)

## Testing
No test framework configured - check with user before writing tests or implementing testing.
