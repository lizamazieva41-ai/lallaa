/**
 * API Client Service
 * Handles HTTP requests to the backend API
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface CardGenerationRequest {
  bin?: string;
  vendor?: string;
  count?: number;
  expiryMonths?: number;
  sequential?: boolean;
  startSequence?: number;
  generate999?: boolean;
}

export interface GeneratedCard {
  cardNumber: string;
  bin: string;
  expiryDate: string;
  cvv: string;
  bankName?: string;
  country?: string;
  cardType?: string;
}

export interface AsyncJobResponse {
  jobId: string;
  status: 'created';
}

export interface JobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface JobResult {
  success: boolean;
  cardsGenerated: number;
  cards: GeneratedCard[];
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  /**
   * Set authentication token
   */
  public setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  /**
   * Clear authentication token
   */
  public clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate cards synchronously
   */
  public async generateCards(request: CardGenerationRequest): Promise<ApiResponse<GeneratedCard | GeneratedCard[]>> {
    return this.request<GeneratedCard | GeneratedCard[]>('/cards/generate-from-bin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Create async card generation job
   */
  public async createGenerationJob(request: CardGenerationRequest): Promise<ApiResponse<AsyncJobResponse>> {
    return this.request<AsyncJobResponse>('/cards/generate-async', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.request<JobStatus>(`/cards/jobs/${jobId}/status`, {
      method: 'GET',
    });
  }

  /**
   * Get job result
   */
  public async getJobResult(jobId: string): Promise<ApiResponse<JobResult>> {
    return this.request<JobResult>(`/cards/jobs/${jobId}/result`, {
      method: 'GET',
    });
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<ApiResponse<any>> {
    return this.request('/health', {
      method: 'GET',
    });
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export const getApiClient = (baseUrl?: string): ApiClient => {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(baseUrl);
  }
  return apiClientInstance;
};

export default ApiClient;
