#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';

// Configuration - You need to set your service role key
const SUPABASE_URL = 'https://ozowcbilaclwiuxqnxjw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const USER_ID = '87485e4d-7fda-49da-8241-bb0631c4a8b1';

// Options
const LIMIT = process.argv.includes('--limit') ? 
  parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : undefined;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('\nPlease run the script like this:');
  console.log('SUPABASE_SERVICE_ROLE_KEY="your-key-here" npm run process-recordings');
  console.log('\nYou can find your service role key in:');
  console.log('Supabase Dashboard → Settings → API → Service role key (secret)');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface Recording {
  id: string;
  user_id: string;
  timestamp: string;
  duration: number;
  audio_url: string;
  transcript?: string;
  corrected_transcript?: string;
  title?: string;
  status: string;
  webhook_status?: string;
  created_at: string;
  updated_at: string;
}

async function transcribeAudio(audioUrl: string, fileName: string): Promise<{ transcript: string; correctedTranscript: string; title: string }> {
  try {
    console.log(`  📝 Transcribing ${fileName}...`);
    
    // Download the audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    // Create multipart form data manually since FormData doesn't work the same in Node/Bun
    const boundary = '----FormDataBoundary' + Math.random().toString(36);
    
    let formBody = '';
    formBody += `--${boundary}\r\n`;
    formBody += `Content-Disposition: form-data; name="file"\r\n\r\n`;
    formBody += `${base64Audio}\r\n`;
    formBody += `--${boundary}\r\n`;
    formBody += `Content-Disposition: form-data; name="filename"\r\n\r\n`;
    formBody += `${fileName}\r\n`;
    formBody += `--${boundary}--\r\n`;
    
    // Call the transcribe-audio edge function
    const transcribeResponse = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formBody,
    });

    if (!transcribeResponse.ok) {
      const error = await transcribeResponse.text();
      console.warn(`  ⚠️  Transcription failed: ${error}`);
      return {
        transcript: '',
        correctedTranscript: '',
        title: fileName.replace('.m4a', '')
      };
    }

    const transcribeResult = await transcribeResponse.json();
    const transcript = transcribeResult.transcript || '';
    
    if (!transcript) {
      console.warn(`  ⚠️  No transcript returned`);
      return {
        transcript: '',
        correctedTranscript: '',
        title: fileName.replace('.m4a', '')
      };
    }
    
    console.log(`  ✓ Transcribed: "${transcript.substring(0, 50)}..."`);
    
    // Call the process-transcript edge function
    const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        userId: USER_ID
      }),
    });

    if (!processResponse.ok) {
      console.warn(`  ⚠️  Processing failed, using raw transcript`);
      return {
        transcript,
        correctedTranscript: transcript,
        title: fileName.replace('.m4a', '')
      };
    }

    const processResult = await processResponse.json();
    
    return {
      transcript,
      correctedTranscript: processResult.correctedTranscript || transcript,
      title: processResult.title || fileName.replace('.m4a', '')
    };
  } catch (error) {
    console.error(`  ❌ Error processing ${fileName}:`, error);
    return {
      transcript: '',
      correctedTranscript: '',
      title: fileName.replace('.m4a', '')
    };
  }
}

async function main() {
  console.log('🚀 Starting to process existing recordings...');
  if (LIMIT) {
    console.log(`📊 Processing limit: ${LIMIT} files`);
  }
  console.log('');
  
  try {
    // List all files in the user's folder
    console.log(`📂 Fetching recordings for user: ${USER_ID}`);
    const { data: files, error: listError } = await supabase.storage
      .from('recordings')
      .list(USER_ID, {
        limit: 1000,
        offset: 0
      });

    if (listError) {
      console.error('❌ Error listing files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('📭 No recordings found in storage');
      return;
    }

    // Filter for .m4a files
    const m4aFiles = files.filter(file => file.name.endsWith('.m4a'));
    console.log(`📊 Found ${m4aFiles.length} .m4a files\n`);

    if (m4aFiles.length === 0) {
      console.log('📭 No .m4a files found');
      return;
    }

    // Check existing recordings in database
    const { data: existingRecordings, error: dbError } = await supabase
      .from('recordings')
      .select('id')
      .eq('user_id', USER_ID);

    if (dbError) {
      console.error('❌ Error checking existing recordings:', dbError);
      return;
    }

    const existingIds = new Set((existingRecordings || []).map(r => r.id));
    console.log(`📊 Found ${existingIds.size} existing recordings in database\n`);

    // Process each file
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    const filesToProcess = LIMIT ? m4aFiles.slice(0, LIMIT) : m4aFiles;
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const recordingId = file.name.replace('.m4a', '');
      
      // Skip if already in database
      if (existingIds.has(recordingId)) {
        console.log(`⏭️  Skipping ${file.name} (already in database)`);
        skipped++;
        continue;
      }

      console.log(`\n[${i + 1}/${filesToProcess.length}] 🎵 Processing ${file.name}`);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(`${USER_ID}/${file.name}`);

      // Get file metadata
      const timestamp = file.created_at || new Date().toISOString();
      
      // Transcribe and process
      const { transcript, correctedTranscript, title } = await transcribeAudio(publicUrl, file.name);
      
      // Default duration to 0 (can't easily get actual duration without downloading and analyzing)
      const duration = 0;
      
      // Insert into database
      const recordingData = {
        id: recordingId,
        user_id: USER_ID,
        timestamp: timestamp,
        duration: duration,
        audio_url: publicUrl,
        transcript: transcript || null,
        corrected_transcript: correctedTranscript || null,
        title: title || file.name.replace('.m4a', ''),
        status: 'uploaded',
        webhook_status: null,
        created_at: timestamp,
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('recordings')
        .insert(recordingData);

      if (insertError) {
        console.error(`  ❌ Failed to insert: ${insertError.message}`);
        failed++;
      } else {
        console.log(`  ✅ Successfully added to database`);
        console.log(`     Title: ${title}`);
        if (transcript) {
          console.log(`     Transcript preview: "${transcript.substring(0, 80)}..."`);
        }
        processed++;
      }
      
      // Add a small delay to avoid overwhelming the API
      if (i < filesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Processing Complete!');
    console.log('='.repeat(50));
    console.log(`✅ Processed: ${processed} recordings`);
    console.log(`⏭️  Skipped: ${skipped} recordings (already in DB)`);
    console.log(`❌ Failed: ${failed} recordings`);
    console.log(`📁 Total: ${m4aFiles.length} .m4a files`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the script
main().then(() => {
  console.log('\n👋 Done!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});