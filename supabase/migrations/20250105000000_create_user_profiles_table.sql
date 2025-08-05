-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    webhook_url TEXT,
    groq_api_key TEXT,
    supabase_url TEXT,
    supabase_anon_key TEXT,
    supabase_service_key TEXT,
    dictionary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
    ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Update recordings table to add user_id
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);

-- Update RLS policies for recordings
DROP POLICY IF EXISTS "Allow all operations on recordings" ON recordings;

CREATE POLICY "Users can view own recordings" ON recordings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" ON recordings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings" ON recordings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" ON recordings
    FOR DELETE USING (auth.uid() = user_id);

-- Create storage policies for recordings bucket
-- Note: Run these in Supabase dashboard as they require storage admin access
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);
-- CREATE POLICY "Users can upload own recordings" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can view own recordings" ON storage.objects FOR SELECT USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own recordings" ON storage.objects FOR DELETE USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);