import { MonitorClientConfig, TelemetryTraceInput } from './types';

export class TelemetryQueue {
  private queue: TelemetryTraceInput[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private config: Required<MonitorClientConfig>;
  private isFlushing = false;

  constructor(config: Required<MonitorClientConfig>) {
    this.config = config;
  }

  public enqueue(trace: TelemetryTraceInput): void {
    if (this.config.disabled) return;

    this.queue.push(trace);

    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush().catch((err) => {
        if (this.config.debug) console.warn('[TelemetryQueue] Flush error on max batch:', err);
      });
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush().catch((err) => {
          if (this.config.debug) console.warn('[TelemetryQueue] Flush error on timer:', err);
        });
      }, this.config.flushIntervalMs);
    }
  }

  public async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.config.maxBatchSize);

    try {
      if (typeof fetch !== 'undefined') {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'x-api-key': this.config.apiKey,
          },
          body: JSON.stringify({ traces: batch }),
          keepalive: true,
        });

        if (!response.ok && this.config.debug) {
          const body = await response.text();
          console.warn(`[TelemetryQueue] Ingest rejected (${response.status}): ${body}`);
        }
      }
    } catch (err) {
      if (this.config.debug) {
        console.warn('[TelemetryQueue] Non-blocking dispatch failed (network error):', err);
      }
      // Re-insert un-sent traces at the front of queue if under buffer capacity
      if (this.queue.length < 500) {
        this.queue.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  public size(): number {
    return this.queue.length;
  }
}
