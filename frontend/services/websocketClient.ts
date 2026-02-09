/**
 * WebSocket Client Service
 * Handles WebSocket connection for real-time job progress updates
 */

import { io, Socket } from 'socket.io-client';

export interface JobProgressUpdate {
  jobId: string;
  progress: number;
  data?: {
    cardsGenerated?: number;
    totalCards?: number;
    estimatedTimeRemaining?: number;
  };
  timestamp: string;
}

export interface JobCompletedEvent {
  jobId: string;
  result: {
    success: boolean;
    cardsGenerated: number;
    cards: Array<{
      cardNumber: string;
      expiryDate: string;
      cvv: string;
      bin: string;
    }>;
  };
  timestamp: string;
}

export interface JobErrorEvent {
  jobId: string;
  error: string;
  timestamp: string;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  /**
   * Connect to WebSocket server
   */
  public connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(url, {
          auth: {
            token,
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to job progress updates
   */
  public subscribeToJob(jobId: string, callbacks: {
    onProgress?: (update: JobProgressUpdate) => void;
    onCompleted?: (event: JobCompletedEvent) => void;
    onError?: (event: JobErrorEvent) => void;
  }): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    // Join job room
    this.socket.emit('subscribe:job', jobId);

    // Listen for progress updates
    this.socket.on(`job:${jobId}:progress`, (update: JobProgressUpdate) => {
      if (callbacks.onProgress) {
        callbacks.onProgress(update);
      }
    });

    // Listen for completion
    this.socket.on(`job:${jobId}:completed`, (event: JobCompletedEvent) => {
      if (callbacks.onCompleted) {
        callbacks.onCompleted(event);
      }
      this.unsubscribeFromJob(jobId);
    });

    // Listen for errors
    this.socket.on(`job:${jobId}:error`, (event: JobErrorEvent) => {
      if (callbacks.onError) {
        callbacks.onError(event);
      }
      this.unsubscribeFromJob(jobId);
    });
  }

  /**
   * Unsubscribe from job updates
   */
  public unsubscribeFromJob(jobId: string): void {
    if (!this.socket) {
      return;
    }

    this.socket.emit('unsubscribe:job', jobId);
    
    // Remove listeners
    this.socket.off(`job:${jobId}:progress`);
    this.socket.off(`job:${jobId}:completed`);
    this.socket.off(`job:${jobId}:error`);
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get connection status
   */
  public getStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) {
      return 'disconnected';
    }
    if (this.socket.connected) {
      return 'connected';
    }
    return 'connecting';
  }
}

// Singleton instance
let websocketClientInstance: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!websocketClientInstance) {
    websocketClientInstance = new WebSocketClient();
  }
  return websocketClientInstance;
};

export default WebSocketClient;
