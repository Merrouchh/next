type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: string;
  details: any;
  url?: string;
  userId?: string;
}

class Logger {
  private pendingLogs: Set<Promise<any>> = new Set();

  private async sendToLoggingService(entry: LogEntry): Promise<void> {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`Failed to send log: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending log to service:', error);
      throw error;
    }
  }

  async log(level: LogLevel, type: string, details: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      details
    };

    if (process.env.NODE_ENV === 'production') {
      const logPromise = this.sendToLoggingService(entry);
      this.pendingLogs.add(logPromise);
      
      try {
        await logPromise;
      } finally {
        this.pendingLogs.delete(logPromise);
      }
    } else {
      // Log to console in development
      console.log(JSON.stringify(entry, null, 2));
    }
  }

  cleanup() {
    this.pendingLogs.clear();
  }

  info(type: string, details: any) {
    return this.log('info', type, details);
  }

  warn(type: string, details: any) {
    return this.log('warn', type, details);
  }

  error(type: string, details: any) {
    return this.log('error', type, details);
  }
}

// Create singleton instance
const logger = new Logger();
export { logger };
