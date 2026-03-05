// Data Store abstraction layer

export interface DataStore {
  // Basic operations
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any | null>;
  delete(key: string): Promise<void>;
  
  // List operations
  listKeys(prefix: string): Promise<string[]>;
  
  // Batch operations
  batchSet(items: Record<string, any>): Promise<void>;
  batchGet(keys: string[]): Promise<Record<string, any>>;
}

export abstract class BaseDataStore implements DataStore {
  abstract set(key: string, value: any): Promise<void>;
  abstract get(key: string): Promise<any | null>;
  abstract delete(key: string): Promise<void>;
  abstract listKeys(prefix: string): Promise<string[]>;
  
  async batchSet(items: Record<string, any>): Promise<void> {
    const promises = Object.entries(items).map(([key, value]) => 
      this.set(key, value)
    );
    await Promise.all(promises);
  }
  
  async batchGet(keys: string[]): Promise<Record<string, any>> {
    const promises = keys.map(async (key) => ({
      key,
      value: await this.get(key),
    }));
    const results = await Promise.all(promises);
    
    return results.reduce((acc, { key, value }) => {
      if (value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }
}
