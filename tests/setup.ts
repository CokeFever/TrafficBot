// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Initialize test database if needed
  console.log('Test environment initialized');
});

afterAll(async () => {
  // Cleanup test resources
  console.log('Test environment cleaned up');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
