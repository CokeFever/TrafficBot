import { BackendConfig, ConfigSummary, UserConfig } from '../models/types';
import { DataStore } from './data-store';
import * as crypto from 'crypto';

export interface ConfigService {
  isConfigured(userId: string): Promise<boolean>;
  saveTdxApiKey(userId: string, apiKey: string): Promise<void>;
  getTdxApiKey(userId: string): Promise<string | null>;
  validateApiKey(apiKey: string): Promise<boolean>;
  saveBackendConfig(userId: string, config: BackendConfig): Promise<void>;
  getConfigSummary(userId: string): Promise<ConfigSummary | null>;
  resetConfig(userId: string): Promise<void>;
}

export class ConfigServiceImpl implements ConfigService {
  private dataStore: DataStore;
  private encryptionKey: string;

  constructor(dataStore: DataStore, encryptionKey?: string) {
    this.dataStore = dataStore;
    const key = encryptionKey || process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    this.encryptionKey = key;
  }

  async isConfigured(userId: string): Promise<boolean> {
    const config = await this.getConfig(userId);
    return config !== null && !!config.tdxApiKey;
  }

  async saveTdxApiKey(userId: string, apiKey: string): Promise<void> {
    const encryptedKey = this.encrypt(apiKey);
    const config = (await this.getConfig(userId)) || this.createEmptyConfig(userId);

    config.tdxApiKey = encryptedKey;
    config.updatedAt = new Date();

    await this.saveConfig(userId, config);
  }

  async getTdxApiKey(userId: string): Promise<string | null> {
    const config = await this.getConfig(userId);
    if (!config || !config.tdxApiKey) {
      return null;
    }

    try {
      // Try decrypting with current (new) salt
      return this.decrypt(config.tdxApiKey);
    } catch {
      // If new salt fails, try legacy salt for backward compatibility
      try {
        const decrypted = this.decryptLegacy(config.tdxApiKey);
        
        // Auto-migrate: re-encrypt with new salt and save
        console.log(`Auto-migrating encryption for user ${userId}`);
        const reEncrypted = this.encrypt(decrypted);
        config.tdxApiKey = reEncrypted;
        config.updatedAt = new Date();
        await this.saveConfig(userId, config);
        
        return decrypted;
      } catch (legacyError) {
        console.error('Failed to decrypt API key with both new and legacy salt:', legacyError);
        return null;
      }
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // apiKey format: "clientId:clientSecret"
      const [clientId, clientSecret] = apiKey.split(':');
      
      if (!clientId || !clientSecret) {
        return false;
      }

      // Step 1: Get access token from TDX
      const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
      
      const tokenParams = new URLSearchParams();
      tokenParams.append('grant_type', 'client_credentials');
      tokenParams.append('client_id', clientId);
      tokenParams.append('client_secret', clientSecret);

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        console.error('Token request failed:', tokenResponse.status, tokenResponse.statusText);
        return false;
      }

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return false;
      }

      // Step 2: Test API call with the access token
      const testUrl = 'https://tdx.transportdata.tw/api/basic/v2/Basic/City';
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('API key validation error:', error);
      return false;
    }
  }

  async saveBackendConfig(userId: string, backendConfig: BackendConfig): Promise<void> {
    const config = (await this.getConfig(userId)) || this.createEmptyConfig(userId);

    config.backendConfig = backendConfig;
    config.updatedAt = new Date();

    await this.saveConfig(userId, config);
  }

  async getConfigSummary(userId: string): Promise<ConfigSummary | null> {
    const config = await this.getConfig(userId);
    if (!config) {
      return null;
    }

    return {
      hasApiKey: !!config.tdxApiKey,
      backendType: config.backendConfig?.type || 'none',
      configuredAt: config.createdAt,
    };
  }

  async resetConfig(userId: string): Promise<void> {
    const key = `config:${userId}`;
    await this.dataStore.delete(key);

    // Also delete all user routes
    const routeKeys = await this.dataStore.listKeys(`route:${userId}:`);
    for (const routeKey of routeKeys) {
      await this.dataStore.delete(routeKey);
    }
  }

  private async getConfig(userId: string): Promise<UserConfig | null> {
    const key = `config:${userId}`;
    return await this.dataStore.get(key);
  }

  private async saveConfig(userId: string, config: UserConfig): Promise<void> {
    const key = `config:${userId}`;
    await this.dataStore.set(key, config);
  }

  private createEmptyConfig(userId: string): UserConfig {
    return {
      userId,
      tdxApiKey: '',
      backendConfig: { type: 'supabase', connectionString: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    // Use first 16 bytes of encryption key hash as salt for key derivation
    const salt = crypto.createHash('sha256').update(this.encryptionKey).digest().slice(0, 16);
    const key = crypto.scryptSync(this.encryptionKey, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const salt = crypto.createHash('sha256').update(this.encryptionKey).digest().slice(0, 16);
    const key = crypto.scryptSync(this.encryptionKey, salt, 32);

    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Legacy decrypt for backward compatibility with data encrypted before salt fix
  private decryptLegacy(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
