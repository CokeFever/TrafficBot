-- Initial database schema for Telegram Parking Bot

-- User configurations table
CREATE TABLE IF NOT EXISTS user_configs (
  user_id TEXT PRIMARY KEY,
  tdx_api_key TEXT NOT NULL,
  backend_config JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Routine routes table
CREATE TABLE IF NOT EXISTS routine_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  notification_preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user_configs(user_id) ON DELETE CASCADE
);

-- Notification records table
CREATE TABLE IF NOT EXISTS notification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  traffic_status TEXT,
  event_ids TEXT[],
  sent_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (route_id) REFERENCES routine_routes(id) ON DELETE CASCADE
);

-- Cache entries table
CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- Key-value store for general data
CREATE TABLE IF NOT EXISTS key_value_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routine_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_route_id ON notification_records(route_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notification_records(sent_at);
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_key_value_store_key ON key_value_store(key);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_configs_updated_at BEFORE UPDATE ON user_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routine_routes_updated_at BEFORE UPDATE ON routine_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_value_store_updated_at BEFORE UPDATE ON key_value_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
