import { LoggerService, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as os from 'os';

/**
 * Structured log levels in order of severity.
 */
type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'fatal';

/**
 * Structured JSON log entry that is sent to Logstash via TCP.
 */
interface LogEntry {
  '@timestamp': string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  service: string;
  environment: string;
  hostname: string;
  pid: number;
  stack?: string;
  meta?: Record<string, unknown>;
}

/**
 * Custom NestJS logger that sends structured JSON logs to Logstash via TCP.
 *
 * Falls back to console logging if the Logstash connection is unavailable,
 * ensuring the application never loses log output even when ELK is down.
 *
 * Usage:
 *   In main.ts: app.useLogger(app.get(ElkLoggerService));
 */
@Injectable()
export class ElkLoggerService implements LoggerService, OnModuleDestroy {
  private client: net.Socket | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly buffer: string[] = [];
  private readonly maxBufferSize = 1000;

  private readonly logstashHost: string;
  private readonly logstashPort: number;
  private readonly enabled: boolean;
  private readonly serviceName = 'tbs-erp-backend';
  private readonly environment: string;
  private readonly hostname: string;

  constructor(private readonly configService: ConfigService) {
    this.logstashHost = this.configService.get<string>('LOGSTASH_HOST', 'logstash');
    this.logstashPort = this.configService.get<number>('LOGSTASH_PORT', 5000);
    this.enabled = this.configService.get<boolean>('ELK_ENABLED', false);
    this.environment = this.configService.get<string>('NODE_ENV') || 'development';
    this.hostname = os.hostname();

    if (this.enabled) {
      this.connect();
    }
  }

  onModuleDestroy() {
    this.disconnect();
  }

  log(message: string, context?: string): void {
    this.writeLog('log', message, context);
  }

  error(message: string, stack?: string, context?: string): void {
    this.writeLog('error', message, context, stack);
  }

  warn(message: string, context?: string): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.writeLog('debug', message, context);
  }

  fatal(message: string, context?: string): void {
    this.writeLog('fatal', message, context);
  }

  /**
   * Log a structured entry with request correlation data.
   * Call this from interceptors/middleware that have access to the request context.
   */
  logWithContext(
    level: LogLevel,
    message: string,
    meta?: {
      context?: string;
      requestId?: string;
      userId?: string;
      traceId?: string;
      extra?: Record<string, unknown>;
    },
  ): void {
    const entry: LogEntry = {
      '@timestamp': new Date().toISOString(),
      level,
      message,
      context: meta?.context,
      requestId: meta?.requestId,
      userId: meta?.userId,
      traceId: meta?.traceId,
      service: this.serviceName,
      environment: this.environment,
      hostname: this.hostname,
      pid: process.pid,
      meta: meta?.extra,
    };

    this.sendToLogstash(entry);
    this.logToConsole(entry);
  }

  // ─── Private Methods ───

  private writeLog(level: LogLevel, message: string, context?: string, stack?: string): void {
    const entry: LogEntry = {
      '@timestamp': new Date().toISOString(),
      level,
      message,
      context,
      service: this.serviceName,
      environment: this.environment,
      hostname: this.hostname,
      pid: process.pid,
      stack,
    };

    this.sendToLogstash(entry);
    this.logToConsole(entry);
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = entry.context ? `[${entry.context}]` : '';
    const requestInfo = entry.requestId ? ` [req:${entry.requestId}]` : '';
    const formattedMsg = `${prefix}${requestInfo} ${entry.message}`;

    switch (entry.level) {
      case 'error':
      case 'fatal':
        console.error(formattedMsg, entry.stack || '');
        break;
      case 'warn':
        console.warn(formattedMsg);
        break;
      case 'debug':
        console.debug(formattedMsg);
        break;
      default:
        console.log(formattedMsg);
    }
  }

  private sendToLogstash(entry: LogEntry): void {
    if (!this.enabled) return;

    const json = JSON.stringify(entry) + '\n';

    if (this.connected && this.client) {
      // Drain any buffered messages first
      this.drainBuffer();
      this.client.write(json);
    } else {
      // Buffer messages when not connected
      if (this.buffer.length < this.maxBufferSize) {
        this.buffer.push(json);
      } else {
        console.warn('[ELK] Buffer full, discarding log entry:', entry.message?.substring(0, 100));
      }
    }
  }

  private drainBuffer(): void {
    if (!this.client || !this.connected) return;
    while (this.buffer.length > 0) {
      const msg = this.buffer.shift();
      if (msg) {
        this.client.write(msg);
      }
    }
  }

  private connect(): void {
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
    }

    this.client = new net.Socket();

    this.client.connect(this.logstashPort, this.logstashHost, () => {
      this.connected = true;
      console.log(`[ElkLogger] Connected to Logstash at ${this.logstashHost}:${this.logstashPort}`);
      this.drainBuffer();
    });

    this.client.on('error', (err) => {
      this.connected = false;
      console.warn(`[ElkLogger] Logstash connection error: ${err.message}`);
      this.scheduleReconnect();
    });

    this.client.on('close', () => {
      this.connected = false;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000); // Reconnect after 5 seconds
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
      this.client = null;
    }
    this.connected = false;
  }
}
