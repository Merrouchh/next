type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: string;
  details: any;
  url?: string;
  userId?: string;
}

export const logger = {
  log(level: LogLevel, type: string, details: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      details
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(entry, null, 2));
    }

    // In production you might want to:
    // 1. Send to a logging service
    // 2. Write to a file
    // 3. Store in database
  },

  info(type: string, details: any) {
    this.log('info', type, details);
  },

  warn(type: string, details: any) {
    this.log('warn', type, details);
  },

  error(type: string, details: any) {
    this.log('error', type, details);
  }
};
