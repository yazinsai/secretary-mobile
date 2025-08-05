// Supabase project configuration
// Replace these with your actual Supabase project details

export const SUPABASE_URL = 'https://ozowcbilaclwiuxqnxjw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b3djYmlsYWNsd2l1eHFueGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjc0NTMsImV4cCI6MjA2OTgwMzQ1M30.18rRcR7We7Bkn3owCHSVaO8Nk567YKKPohnyRQxKROE';

// Validate configuration at startup
if (SUPABASE_URL === 'https://your-project.supabase.co' || SUPABASE_ANON_KEY === 'your-anon-key-here') {
  console.warn('⚠️  Supabase configuration not set! Please update config/supabase.config.ts with your project details.');
}