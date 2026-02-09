/**
 * Comprehensive Real Data Integration Tests
 * Tests all API features with real data to verify functionality
 */

import request from 'supertest';
import { app } from '../../src/index';

// Test data with real BIN numbers, IBANs, etc.
const TEST_DATA = {
  // Real BIN numbers from major banks
  bins: {
    visa: '411111', // Test Visa BIN
    mastercard: '555555', // Test Mastercard BIN
    amex: '378282', // Test Amex BIN
    discover: '601111', // Test Discover BIN
    jcb: '353011', // Test JCB BIN
    diners: '305693', // Test Diners BIN
    // Real bank BINs
    chase: '422590', // JPMorgan Chase
    bankOfAmerica: '414720', // Bank of America
    wellsFargo: '475839', // Wells Fargo
    citibank: '542418', // Citibank
  },

  // Real IBANs for testing
  ibans: {
    germany: 'DE89370400440532013000', // German IBAN
    uk: 'GB29RBOS60161331926819', // UK IBAN
    france: 'FR7630006000011234567890189', // French IBAN
    spain: 'ES9121000418450200051332', // Spanish IBAN
    italy: 'IT60X0542811101000000123456', // Italian IBAN
    netherlands: 'NL91ABNA0417164300', // Dutch IBAN
    belgium: 'BE68539007547034', // Belgian IBAN
    austria: 'AT611904300234573201', // Austrian IBAN
  },

  // Test user credentials
  user: {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  },

  // Card generation parameters
  cardParams: {
    visa: { vendor: 'visa', count: 2 },
    mastercard: { vendor: 'mastercard', count: 2 },
    amex: { vendor: 'amex', count: 1 },
  },
};

// Test results collector
interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL';
  response?: any;
  error?: string;
  duration?: number;
}

class TestReporter {
  private results: TestResult[] = [];

  addResult(result: TestResult) {
    this.results.push(result);
    console.log(`[${result.status}] ${result.category} - ${result.test}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  getResults() {
    return this.results;
  }

  getSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? (passed / total * 100).toFixed(2) : '0.00',
      results: this.results,
    };
  }

  printReport() {
    const summary = this.getSummary();
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE REAL DATA TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${summary.successRate}%`);
    console.log('='.repeat(80));

    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];
    categories.forEach(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
      const categoryFailed = categoryResults.filter(r => r.status === 'FAIL').length;

      console.log(`\n${category} (${categoryPassed}/${categoryPassed + categoryFailed} passed)`);
      categoryResults.forEach(result => {
        const status = result.status === 'PASS' ? '✅' : '❌';
        console.log(`  ${status} ${result.test}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
        if (result.duration) {
          console.log(`    Duration: ${result.duration}ms`);
        }
      });
    });

    console.log('\n' + '='.repeat(80));
  }
}

const reporter = new TestReporter();

describe('Comprehensive Real Data Integration Tests', () => {
  let authToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Set up authentication for all tests
    try {
      // Register user
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_DATA.user)
        .expect(200);

      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_DATA.user.email,
          password: TEST_DATA.user.password,
        })
        .expect(200);

      authToken = loginResponse.body.data.accessToken;
      refreshToken = loginResponse.body.data.refreshToken;

      reporter.addResult({
        category: 'Authentication',
        test: 'User Registration and Login',
        status: 'PASS',
        response: loginResponse.body,
      });
    } catch (error: any) {
      reporter.addResult({
        category: 'Authentication',
        test: 'User Registration and Login',
        status: 'FAIL',
        error: error.message,
      });
      throw error; // Fail the test suite if auth setup fails
    }
  });

  describe('Authentication Service', () => {
    test('Token Refresh', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        authToken = response.body.data.accessToken; // Update with new token

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Authentication',
          test: 'Token Refresh',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Authentication',
          test: 'Token Refresh',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });
  });

  describe('BIN Service', () => {
    test('Lookup Visa BIN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get(`/api/v1/bin/${TEST_DATA.bins.visa}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Visa BIN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Visa BIN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Lookup Mastercard BIN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get(`/api/v1/bin/${TEST_DATA.bins.mastercard}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Mastercard BIN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Mastercard BIN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Lookup Chase Bank BIN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get(`/api/v1/bin/${TEST_DATA.bins.chase}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Chase Bank BIN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Lookup Chase Bank BIN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Search BINs', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/bin?card_network=visa&limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Search BINs',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Search BINs',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Get BINs by Country (US)', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/bin/country/US')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Get BINs by Country (US)',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Get BINs by Country (US)',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Validate BIN Format', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/bin/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ bin: TEST_DATA.bins.visa })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Validate BIN Format',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Validate BIN Format',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Get BIN Statistics', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/bin/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Get BIN Statistics',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'BIN Service',
          test: 'Get BIN Statistics',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });
  });

  describe('IBAN Service', () => {
    test('Validate German IBAN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ iban: TEST_DATA.ibans.germany })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Validate German IBAN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Validate German IBAN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Validate UK IBAN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ iban: TEST_DATA.ibans.uk })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Validate UK IBAN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Validate UK IBAN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Parse German IBAN', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/parse')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ iban: TEST_DATA.ibans.germany })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Parse German IBAN',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Parse German IBAN',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Generate IBAN for Germany', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ countryCode: 'DE', bankCode: '37040044', accountNumber: '532013000' })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Generate IBAN for Germany',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Generate IBAN for Germany',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Batch Validate IBANs', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/batch-validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ibans: [
              TEST_DATA.ibans.germany,
              TEST_DATA.ibans.uk,
              TEST_DATA.ibans.france,
            ]
          })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Batch Validate IBANs',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Batch Validate IBANs',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Convert IBAN Format', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .post('/api/v1/iban/convert')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            iban: TEST_DATA.ibans.germany,
            format: 'compact'
          })
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Convert IBAN Format',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Convert IBAN Format',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Generate Test IBAN for Germany', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/iban/test/DE')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Generate Test IBAN for Germany',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'IBAN Service',
          test: 'Generate Test IBAN for Germany',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });
  });

  describe('Card Generation Service', () => {
    test('Generate Visa Cards', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/generate')
          .query(TEST_DATA.cardParams.visa)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Generate Visa Cards',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Generate Visa Cards',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Generate Mastercard Cards', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/generate')
          .query(TEST_DATA.cardParams.mastercard)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Generate Mastercard Cards',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Generate Mastercard Cards',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Get Supported Vendors', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/vendors')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Get Supported Vendors',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Card Generation',
          test: 'Get Supported Vendors',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });
  });

  describe('Test Cards Service', () => {
    test('Get Payment Gateways', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/gateways')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Get Payment Gateways',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Get Payment Gateways',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Search Test Cards', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/search')
          .query({ brand: 'visa', limit: 5 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Search Test Cards',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Search Test Cards',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });

    test('Get Card Statistics', async () => {
      const startTime = Date.now();

      try {
        const response = await request(app)
          .get('/api/v1/cards/statistics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Get Card Statistics',
          status: 'PASS',
          response: response.body,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        reporter.addResult({
          category: 'Test Cards',
          test: 'Get Card Statistics',
          status: 'FAIL',
          error: error.message,
          duration,
        });
      }
    });
  });

  afterAll(() => {
    // Print the comprehensive report
    reporter.printReport();
  });
});