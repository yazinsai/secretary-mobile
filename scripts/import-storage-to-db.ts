import { createClient } from '@supabase/supabase-js';

// Supabase configuration - hardcoded values
const SUPABASE_URL = 'https://ozowcbilaclwiuxqnxjw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b3djYmlsYWNsd2l1eHFueGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzQ1MywiZXhwIjoyMDY5ODAzNDUzfQ.qlXoW9_4q2aGrfKS9NRkM-5q7o3YODvqoxrOZstTGvA';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b3djYmlsYWNsd2l1eHFueGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjc0NTMsImV4cCI6MjA2OTgwMzQ1M30.18rRcR7We7Bkn3owCHSVaO8Nk567YKKPohnyRQxKROE';
const USER_ID = '4841497d-0990-4be8-b6db-193dfe6bac79'; // The user ID to process files for

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

interface RecordingRecord {
  id: string;
  user_id: string;
  timestamp: string;
  duration: number;
  audio_url: string;
  transcript?: string;
  corrected_transcript?: string;
  title?: string;
  status: string;
  webhook_url?: string;
  webhook_status?: string;
  webhook_last_sent_at?: string;
  error?: string;
  synced_at?: string;
}

async function listUserFiles(userId: string): Promise<StorageFile[]> {
  try {
    console.log(`\nListing files for user: ${userId}`);
    
    // List files in the user's directory
    const { data, error } = await supabase.storage
      .from('recordings')
      .list(userId, {
        limit: 1000, // Adjust if user has more files
        offset: 0,
      });

    if (error) {
      throw error;
    }

    const files = (data || []).filter(file => 
      file.name.endsWith('.m4a') || file.name.endsWith('.mp3')
    );
    
    console.log(`Found ${files.length} audio files`);
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

async function checkExistingRecording(recordingId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id')
      .eq('id', recordingId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking existing recording:', error);
    return false;
  }
}

async function getPublicUrl(userId: string, fileName: string): Promise<string> {
  const { data } = supabase.storage
    .from('recordings')
    .getPublicUrl(`${userId}/${fileName}`);

  return data.publicUrl;
}

async function downloadAudioFile(userId: string, fileName: string): Promise<ArrayBuffer> {
  try {
    const { data, error } = await supabase.storage
      .from('recordings')
      .download(`${userId}/${fileName}`);

    if (error) {
      throw error;
    }

    return await data.arrayBuffer();
  } catch (error) {
    console.error('Error downloading audio file:', error);
    throw error;
  }
}

async function transcribeAudio(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    // Convert ArrayBuffer to base64
    const uint8Array = new Uint8Array(audioBuffer);
    const base64Audio = Buffer.from(uint8Array).toString('base64');

    // Create form data
    const formData = new FormData();
    formData.append('file', base64Audio);
    formData.append('filename', fileName);

    // Call Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Transcription failed');
    }

    const result = await response.json();
    return result.transcript || '';
  } catch (error) {
    console.error('Failed to transcribe audio:', error);
    throw error;
  }
}

async function processTranscript(transcript: string, userId: string): Promise<{
  title: string;
  correctedTranscript: string;
}> {
  try {
    // Call Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Processing failed');
    }

    const result = await response.json();

    return {
      title: result.title || 'Untitled Recording',
      correctedTranscript: result.correctedTranscript || transcript,
    };
  } catch (error) {
    console.error('Failed to process transcript:', error);
    // Return original transcript if processing fails
    return {
      title: 'Untitled Recording',
      correctedTranscript: transcript,
    };
  }
}

async function parseRecordingMetadata(file: StorageFile): Promise<{
  recordingId: string;
  duration: number;
  timestamp: Date;
}> {
  // Extract recording ID from filename (assuming format: recording_id.m4a)
  const recordingId = file.name.replace(/\.(m4a|mp3)$/, '');
  
  // Use file creation time as timestamp
  const timestamp = new Date(file.created_at);
  
  // Default duration (will need to be updated if you have actual duration data)
  // You might want to download and analyze the audio file to get actual duration
  const duration = 0; // seconds
  
  return {
    recordingId,
    duration,
    timestamp,
  };
}

async function importRecording(
  userId: string,
  file: StorageFile,
  publicUrl: string
): Promise<void> {
  try {
    const { recordingId, duration, timestamp } = await parseRecordingMetadata(file);
    
    // Check if recording already exists
    const exists = await checkExistingRecording(recordingId);
    if (exists) {
      console.log(`  Skipping ${recordingId} - already in database`);
      return;
    }
    
    console.log(`  Processing ${recordingId}...`);
    
    // Download and transcribe the audio file
    let transcript = '';
    let correctedTranscript = '';
    let title = `Recording ${recordingId}`;
    let status = 'uploaded';
    
    try {
      console.log(`    Downloading audio file...`);
      const audioBuffer = await downloadAudioFile(userId, file.name);
      
      console.log(`    Transcribing audio...`);
      transcript = await transcribeAudio(audioBuffer, file.name);
      
      if (transcript) {
        console.log(`    Processing transcript...`);
        const processed = await processTranscript(transcript, userId);
        correctedTranscript = processed.correctedTranscript;
        title = processed.title;
        status = 'completed';
      }
    } catch (transcriptionError) {
      console.error(`    Transcription failed for ${recordingId}:`, transcriptionError);
      // Continue with import but mark as failed transcription
      status = 'transcription_failed';
    }
    
    const recording: RecordingRecord = {
      id: recordingId,
      user_id: userId,
      timestamp: timestamp.toISOString(),
      duration: duration,
      audio_url: publicUrl,
      transcript: transcript || undefined,
      corrected_transcript: correctedTranscript || undefined,
      title: title,
      status: status,
      synced_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('recordings')
      .insert(recording);
    
    if (error) {
      throw error;
    }
    
    console.log(`  ✓ Imported ${recordingId} (${status})`);
  } catch (error) {
    console.error(`  ✗ Failed to import ${file.name}:`, error);
    throw error;
  }
}

async function main() {
  console.log('Starting storage to database import...');
  console.log(`Processing files for user: ${USER_ID}`);
  
  try {
    // Get all audio files for the user
    const files = await listUserFiles(USER_ID);
    
    if (files.length === 0) {
      console.log('No audio files found in storage');
      return;
    }
    
    console.log(`\nProcessing ${files.length} files...`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Process files sequentially to avoid overwhelming the transcription API
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const publicUrl = await getPublicUrl(USER_ID, file.name);
        await importRecording(USER_ID, file, publicUrl);
        successCount++;
      } catch (error) {
        if (error instanceof Error && error.message?.includes('already in database')) {
          skipCount++;
        } else {
          errorCount++;
        }
      }
      
      // Progress update
      console.log(`Progress: ${i + 1}/${files.length} files processed`);
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total files: ${files.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Skipped (already exists): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run the import
main().catch(console.error);
