#!/usr/bin/env bun

/**
 * Script to fix old recordings that are stuck in failed states
 * This marks recordings with transcripts as completed if they don't have local files
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables or use config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ozowcbilaclwiuxqnxjw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''; // You need to provide this

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please provide SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixOldRecordings() {
  try {
    // Get all recordings that are in failed states but have transcripts
    const { data: recordings, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .in('processing_state', ['upload_failed', 'transcribe_failed', 'webhook_failed'])
      .not('transcript', 'is', null);

    if (fetchError) {
      console.error('Failed to fetch recordings:', fetchError);
      return;
    }

    console.log(`Found ${recordings?.length || 0} recordings to fix`);

    if (!recordings || recordings.length === 0) {
      console.log('No recordings need fixing');
      return;
    }

    // Update each recording
    for (const recording of recordings) {
      console.log(`Fixing recording ${recording.id}...`);
      
      const { error: updateError } = await supabase
        .from('recordings')
        .update({
          processing_state: 'completed',
          processing_error: null,
          retry_count: 0,
          next_retry_at: null
        })
        .eq('id', recording.id);

      if (updateError) {
        console.error(`Failed to update recording ${recording.id}:`, updateError);
      } else {
        console.log(`✓ Fixed recording ${recording.id}`);
      }
    }

    console.log('Done!');
  } catch (error) {
    console.error('Script error:', error);
  }
}

// Run the script
fixOldRecordings();