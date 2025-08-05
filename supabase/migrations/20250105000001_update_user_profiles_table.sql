-- Update user_profiles table to only store user-specific settings
-- Drop the existing table if it exists
DROP TABLE IF EXISTS user_profiles;

-- Create user_profiles table with only user-specific settings
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    webhook_url TEXT,
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