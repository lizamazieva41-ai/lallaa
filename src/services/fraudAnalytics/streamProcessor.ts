export interface FraudEvent {
  id: string;
  occurredAt: string;
  bin?: string;
  amount?: number;
  merchantCountry?: string;
  ipCountry?: string;
}

export interface FraudAlert {
  id: string;
  eventId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  createdAt: string;
}

/**
 * StreamProcessor (Phase 6 placeholder)
 *
 * In production, this would connect to Kafka/RabbitMQ/etc.
 * Here we provide an in-memory processor interface so the rest of the system can integrate.
 */
export class StreamProcessor {
  private alerts: FraudAlert[] = [];

  public ingest(event: FraudEvent): FraudAlert[] {
    const alerts: FraudAlert[] = [];

    if (typeof event.amount === 'number' && event.amount >= 10000) {
      alerts.push(this.createAlert(event.id, 'high', `High amount event: ${event.amount}`));
    }

    if (event.merchantCountry && event.ipCountry && event.merchantCountry !== event.ipCountry) {
      alerts.push(
        this.createAlert(event.id, 'medium', `Geo mismatch ${event.merchantCountry} vs ${event.ipCountry}`)
      );
    }

    this.alerts.push(...alerts);
    return alerts;
  }

  public getRecentAlerts(limit: number = 100): FraudAlert[] {
    return this.alerts.slice(-limit);
  }

  private createAlert(eventId: string, severity: FraudAlert['severity'], message: string): FraudAlert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventId,
      severity,
      message,
      createdAt: new Date().toISOString(),
    };
  }
}

export const streamProcessor = new StreamProcessor();

