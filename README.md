# Secretary - Voice Recording App

A simple voice recording app with offline support and webhook integration built with Expo React Native.

## Features

- 📱 Simple recording interface with a big record button
- 🎙️ High-quality audio recording with expo-audio
- 📝 Automatic transcription using Groq API
- 🔄 Offline queue with automatic sync
- 🪝 Webhook integration for remote processing
- 📋 Recording history with playback
- ⚙️ Configurable settings

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Supabase project at https://supabase.com

3. Set up Supabase Storage:
   - Go to your Supabase dashboard
   - Navigate to Storage section
   - Click "New bucket"
   - Name it `recordings`
   - Set it as a **public** bucket
   - **IMPORTANT**: Uncheck "Enable Row Level Security (RLS)" or configure RLS policies (see below)
   - Click "Create bucket"
   
   **Option A - Disable RLS (Easier):**
   - After creating the bucket, click on it
   - Go to "Configuration" tab
   - Toggle OFF "Enable RLS"
   
   **Option B - Configure RLS Policies:**
   - Click on the bucket
   - Go to "Policies" tab
   - Create a new policy:
     - Name: `Allow all uploads`
     - Operation: `INSERT`
     - Policy: `true` (allows all inserts)
   - Create another policy:
     - Name: `Allow public reads`
     - Operation: `SELECT`
     - Policy: `true` (allows all reads)

4. Get your Supabase credentials:
   - In your Supabase dashboard, go to Settings > API
   - Copy your `Project URL` (looks like `https://xxxxx.supabase.co`)
   - Copy your `anon public` key
   
   **If your project has RLS enabled or doesn't allow anonymous access:**
   - Also copy your `service_role` key (under "Service role key - secret")
   - ⚠️ **WARNING**: The service role key bypasses all RLS. Keep it secure and never expose it in client-side code!

5. Get a Groq API key:
   - Sign up at https://console.groq.com
   - Create an API key in the dashboard

6. Configure the app:
   - Open the Secretary app
   - Go to Settings tab
   - Enter your Groq API key
   - Enter your Supabase URL and anon key
   - If your Supabase has RLS enabled, also enter the service role key
   - Enter your webhook URL (optional)
   - Save settings

7. Start the development server:
   ```bash
   npx expo start
   ```

## Webhook Payload

When a recording is processed, the following JSON payload is sent to your webhook:

```json
{
  "id": "recording_123456789_abc",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "duration": 45.3,
  "transcript": "The transcribed text from Groq",
  "correctedTranscript": "The transcribed text from Groq",
  "audioUrl": "https://your-project.supabase.co/storage/v1/object/public/recordings/recording_123456789_abc.m4a"
}
```

## Development

- `app/` - Main application screens
- `components/` - Reusable UI components
- `services/` - API and service integrations
- `hooks/` - Custom React hooks
- `types/` - TypeScript type definitions

## Troubleshooting

### "Bucket not found" error
Make sure you've created the `recordings` bucket in your Supabase Storage dashboard.

### "Row-level security policy" error
This means RLS is enabled on your bucket. Either:
1. Disable RLS on the bucket (easier)
2. Add INSERT and SELECT policies that allow uploads and reads

### Recordings not uploading
1. Check your internet connection
2. Verify your Supabase credentials are correct
3. Ensure the `recordings` bucket exists and RLS is properly configured

### Transcription not working
1. Verify your Groq API key is valid
2. Check that the audio file is not corrupted
3. Ensure you have credits/quota remaining on your Groq account

## Building

Follow the Expo documentation for building standalone apps:
https://docs.expo.dev/build/introduction/