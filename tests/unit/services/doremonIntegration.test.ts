/**
 * Unit Tests for Doremon Integration Service
 */

import axios from 'axios';
import { DoremonIntegrationService } from '../../../src/services/doremonIntegration';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DoremonIntegrationService', () => {
  let service: DoremonIntegrationService;
  const mockConfig = {
    apiUrl: 'http://localhost:8000',
    apiKey: 'test-api-key',
    timeout: 30000,
    retryAttempts: 3,
  };

  beforeEach(() => {
    service = new DoremonIntegrationService(mockConfig);
    jest.clearAllMocks();
  });

  describe('uploadExcelToDoremon', () => {
    it('should upload Excel file successfully', async () => {
      const mockResponse = {
        data: {
          processId: 'test-process-id',
          status: 'pending',
          message: 'File uploaded successfully',
        },
      };

      mockedAxios.create = jest.fn(() => ({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      })) as any;

      const buffer = Buffer.from('test excel content');
      const result = await service.uploadExcelToDoremon(buffer, 'test.xlsx');

      expect(result.processId).toBe('test-process-id');
      expect(result.status).toBe('pending');
    });

    it('should retry on failure with exponential backoff', async () => {
      const mockAxiosInstance = {
        post: jest.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValue({
            data: { processId: 'test-process-id', status: 'pending' },
          }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;

      const buffer = Buffer.from('test excel content');
      const result = await service.uploadExcelToDoremon(buffer, 'test.xlsx');

      expect(result.processId).toBe('test-process-id');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('getProcessingStatus', () => {
    it('should get processing status successfully', async () => {
      const mockResponse = {
        data: {
          processId: 'test-process-id',
          status: 'running',
          progress: 50,
          currentStep: 'verifying_cards',
        },
      };

      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;

      const result = await service.getProcessingStatus('test-process-id');

      expect(result.status).toBe('running');
      expect(result.progress).toBe(50);
    });
  });

  describe('downloadProcessedExcel', () => {
    it('should download processed Excel file successfully', async () => {
      const mockResponse = {
        data: Buffer.from('processed excel content'),
      };

      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;

      const result = await service.downloadProcessedExcel('test-process-id');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('processed excel content');
    });
  });
});
