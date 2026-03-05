import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BaseDataStore } from './data-store';

export class SupabaseDataStore extends BaseDataStore {
  private client: SupabaseClient;
  private tableName: string = 'key_value_store';

  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async set(key: string, value: any): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .upsert({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to set key ${key}: ${error.message}`);
    }
  }

  async get(key: string): Promise<any | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get key ${key}: ${error.message}`);
    }

    return data ? JSON.parse(data.value) : null;
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to delete key ${key}: ${error.message}`);
    }
  }

  async listKeys(prefix: string): Promise<string[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('key')
      .like('key', `${prefix}%`);

    if (error) {
      throw new Error(`Failed to list keys with prefix ${prefix}: ${error.message}`);
    }

    return data ? data.map((row) => row.key) : [];
  }

  // Helper method to initialize the key-value store table
  static async initializeSchema(_supabaseUrl: string, _supabaseKey: string): Promise<void> {
    // This should be run as a migration, but included here for reference
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS key_value_store (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_key_value_store_key ON key_value_store(key);
    `;
    
    // Note: This requires service role key to execute
    console.log('Schema initialization SQL:', createTableSQL);
  }
}
