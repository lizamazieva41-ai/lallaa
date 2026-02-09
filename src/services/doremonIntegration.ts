import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { ExcelExportService } from './excelExport';
import { GeneratedCardFromBIN } from './cardGeneration';
import { metricsService } from './metrics';

export interface DoremonIntegrationConfig {
  apiUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
}

export interface UploadExcelResponse {
  processId: string;
  status: string;
  message?: string;
}

export interface ProcessingStatusResponse {
  processId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  totalCards?: number;
  verifiedCards?: number;
  failedCards?: number;
  currentStep?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessResultResponse {
  processId: string;
  status: string;
  resultFileUrl: string;
  totalCards: number;
  verifiedCards: number;
  failedCards: number;
  completedAt: string;
}

export class DoremonIntegrationService {
  private axiosInstance: AxiosInstance;
  private config: DoremonIntegrationConfig;

  constructor(config?: Partial<DoremonIntegrationConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || process.env.DOREMON_API_URL || 'http://localhost:8000',
      apiKey: config?.apiKey || process.env.DOREMON_API_KEY || '',
      timeout: config?.timeout || parseInt(process.env.DOREMON_TIMEOUT || '30000', 10),
      retryAttempts: config?.retryAttempts || parseInt(process.env.DOREMON_RETRY_ATTEMPTS || '3', 10),
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    // Add correlation ID to all requests
    this.axiosInstance.interceptors.request.use((config) => {
      const { getCorrelationId } = require('../utils/logger');
      const correlationId = getCorrelationId();
      if (correlationId) {
        config.headers['X-Correlation-ID'] = correlationId;
      }
      return config;
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Doremon API request', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error('Doremon API request error', { error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Doremon API response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < attempts - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s...
          logger.warn(`Doremon API request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxAttempts: attempts,
            error: lastError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Upload Excel file to doremon-ai for processing
   */
  public async uploadExcelToDoremon(
    excelBuffer: Buffer,
    filename: string = 'cards.xlsx'
  ): Promise<UploadExcelResponse> {
    try {
      // Create FormData using Blob (browser-compatible) or Buffer (Node.js)
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', excelBuffer, {
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const requestStart = Date.now();
      const response = await this.retryWithBackoff(async () => {
        return await this.axiosInstance.post<UploadExcelResponse>(
          '/api/v1/integration/upload-excel',
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'X-API-Key': this.config.apiKey,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );
      });

      logger.info('Excel file uploaded to doremon-ai', {
        processId: response.data.processId,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to upload Excel to doremon-ai', { error });
      throw new Error(
        `Failed to upload Excel to doremon-ai: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get processing status from doremon-ai
   */
  public async getProcessingStatus(processId: string): Promise<ProcessingStatusResponse> {
    const requestStart = Date.now();
    try {
      const response = await this.retryWithBackoff(async () => {
        return await this.axiosInstance.get<ProcessingStatusResponse>(
          `/api/v1/integration/process/${processId}/status`
        );
      });
      
      const requestDuration = (Date.now() - requestStart) / 1000;
      metricsService.recordDoremonApiRequest('GET', '/process/{id}/status', requestDuration, true);

      return response.data;
    } catch (error) {
      const requestDuration = (Date.now() - requestStart) / 1000;
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      metricsService.recordDoremonApiRequest('GET', '/process/{id}/status', requestDuration, false, errorType);
      
      logger.error('Failed to get processing status from doremon-ai', {
        processId,
        error,
      });
      throw new Error(
        `Failed to get processing status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download processed Excel file from doremon-ai
   */
  public async downloadProcessedExcel(processId: string): Promise<Buffer> {
    const requestStart = Date.now();
    try {
      const response = await this.retryWithBackoff(async () => {
        return await this.axiosInstance.get(`/api/v1/integration/process/${processId}/result`, {
          responseType: 'arraybuffer',
        });
      });
      
      const requestDuration = (Date.now() - requestStart) / 1000;
      metricsService.recordDoremonApiRequest('GET', '/process/{id}/result', requestDuration, true);

      return Buffer.from(response.data);
    } catch (error) {
      const requestDuration = (Date.now() - requestStart) / 1000;
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      metricsService.recordDoremonApiRequest('GET', '/process/{id}/result', requestDuration, false, errorType);
      
      logger.error('Failed to download processed Excel from doremon-ai', {
        processId,
        error,
      });
      throw new Error(
        `Failed to download processed Excel: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get process result metadata (without downloading file)
   */
  public async getProcessResult(processId: string): Promise<ProcessResultResponse> {
    try {
      const response = await this.retryWithBackoff(async () => {
        return await this.axiosInstance.get<ProcessResultResponse>(
          `/api/v1/integration/process/${processId}/result`,
          {
            params: { metadata: true },
          }
        );
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get process result from doremon-ai', {
        processId,
        error,
      });
      throw new Error(
        `Failed to get process result: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const doremonIntegrationService = new DoremonIntegrationService();
