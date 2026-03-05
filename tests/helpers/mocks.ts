// Mock helpers for testing

export class MockTdxApiClient {
  private responses: Map<string, any> = new Map();
  private callCount: number = 0;
  private shouldFail: boolean = false;

  setResponse(endpoint: string, data: any): void {
    this.responses.set(endpoint, data);
  }

  simulateConnectionError(): void {
    this.shouldFail = true;
  }

  reset(): void {
    this.responses.clear();
    this.callCount = 0;
    this.shouldFail = false;
  }

  getCallCount(): number {
    return this.callCount;
  }

  async mockApiCall(endpoint: string): Promise<any> {
    this.callCount++;
    
    if (this.shouldFail) {
      throw new Error('Connection failed');
    }
    
    return this.responses.get(endpoint) || {};
  }
}

export class MockTelegramApi {
  private sentMessages: Map<string, any[]> = new Map();

  async sendMessage(chatId: string, text: string, options?: any): Promise<void> {
    if (!this.sentMessages.has(chatId)) {
      this.sentMessages.set(chatId, []);
    }
    this.sentMessages.get(chatId)!.push({ text, options });
  }

  getSentMessages(chatId: string): any[] {
    return this.sentMessages.get(chatId) || [];
  }

  clear(): void {
    this.sentMessages.clear();
  }
}
