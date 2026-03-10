-- Add trial usage tracking table
CREATE TABLE IF NOT EXISTS trial_usage (
  user_id TEXT PRIMARY KEY,
  usage_count INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trial_usage_user_id ON trial_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_usage_last_reset ON trial_usage(last_reset_date);

-- Enable RLS
ALTER TABLE trial_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can manage trial usage" ON trial_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);
