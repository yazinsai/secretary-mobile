# Storage to Database Import Script

This script imports audio recordings from Supabase Storage into the recordings database table.

## Prerequisites

1. Install dependencies:
```bash
npm install tsx dotenv
```

2. Create a `.env` file in the project root with:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
USER_ID=the_user_id_to_process
```

**Important**: Use the service role key (not the anon key) to bypass RLS policies.

## Usage

Run the import script:
```bash
npm run import-storage
```

## What it does

1. Lists all audio files (.m4a, .mp3) in the user's storage directory
2. For each file:
   - Extracts the recording ID from the filename
   - Checks if the recording already exists in the database
   - If not, creates a new recording entry with:
     - ID from filename
     - User ID
     - Audio URL (public URL from storage)
     - Status: 'uploaded'
     - Timestamp from file creation date
3. Provides a summary of imported, skipped, and failed files

## Notes

- The script uses the file creation timestamp as the recording timestamp
- Duration is set to 0 by default (you may need to update this based on your needs)
- Files already in the database are skipped to prevent duplicates
- Processes files in batches of 10 to avoid overwhelming the database