class MonitoringService {
    constructor() {
        this.isServer = typeof window === 'undefined';
        this.logs = [];
        this.memoryThreshold = process.env.NODE_ENV === 'production' ? 85 : 95;
        this.batchSize = process.env.NODE_ENV === 'production' ? 20 : 10;
        this.logRetention = process.env.NODE_ENV === 'production' ? 30 : 7; // days
        this.pendingLogs = new Set();
    }

    formatLog(type, message, details = {}) {
        const log = {
            timestamp: new Date().toISOString(),
            type,
            message,
            details,
        };

        // Only add memory and CPU info on server
        if (this.isServer) {
            log.memory = this.getMemoryUsage();
            log.cpu = process.cpuUsage();
        }

        return JSON.stringify(log) + '\n';
    }

    getMemoryUsage() {
        if (!this.isServer) return null;

        const used = process.memoryUsage();
        return {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100 + 'MB',
            heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100 + 'MB',
            rss: Math.round(used.rss / 1024 / 1024 * 100) / 100 + 'MB',
            memoryUsagePercent: Math.round((used.heapUsed / used.heapTotal) * 100)
        };
    }

    async log(type, message, details = {}) {
        const logEntry = this.formatLog(type, message, details);
        
        if (this.isServer) {
            // Server-side logging
            try {
                const fs = require('fs');
                const path = require('path');
                const today = new Date().toISOString().split('T')[0];
                const logPath = path.join(process.cwd(), 'logs');
                const logFile = path.join(logPath, `${today}.log`);

                // Ensure directory exists
                if (!fs.existsSync(logPath)) {
                    fs.mkdirSync(logPath, { recursive: true });
                }

                await fs.promises.appendFile(logFile, logEntry);
            } catch (error) {
                console.error('Server logging failed:', error);
            }
        } else {
            // Client-side logging
            this.logs.push(logEntry);
            
            // Send logs to server in batches
            if (this.logs.length >= this.batchSize) {
                await this.sendLogsToServer();
            }
        }
    }

    async sendLogsToServer() {
        if (this.logs.length === 0) return;

        try {
            const logsToSend = [...this.logs];
            this.logs = [];

            const logPromise = fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ logs: logsToSend }),
            });

            this.pendingLogs.add(logPromise);

            await logPromise;
            this.pendingLogs.delete(logPromise);
        } catch (error) {
            console.error('Failed to send logs to server:', error);
            this.logs.unshift(...logsToSend);
        }
    }

    async logPageView(page, userId = null) {
        await this.log('PAGE_VIEW', `Page visited: ${page}`, {
            page,
            userId,
            userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : null,
        });
    }

    async logError(error, context = {}) {
        await this.log('ERROR', error.message, {
            stack: error.stack,
            context
        });
    }

    async logPerformance(action, duration) {
        await this.log('PERFORMANCE', `Action: ${action}`, {
            action,
            duration,
            timestamp: Date.now()
        });
    }

    async logAlert(alertType, details) {
        await this.log('ALERT', alertType, details);
    }

    async logAPICall(endpoint, method, duration, status) {
        await this.log('API_CALL', `${method} ${endpoint}`, {
            endpoint,
            method,
            duration,
            status
        });
    }

    async rotateOldLogs() {
        if (!this.isServer) return;
        
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'logs');
            
            // Keep logs for 30 days
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
            const now = Date.now();
            
            const files = await fs.promises.readdir(logPath);
            for (const file of files) {
                const filePath = path.join(logPath, file);
                const stats = await fs.promises.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.promises.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('Log rotation failed:', error);
        }
    }

    cleanup() {
        // Cancel all pending log requests
        this.pendingLogs.forEach(promise => {
            if (promise.abort) promise.abort();
        });
        this.pendingLogs.clear();
        this.logs = [];
    }
}

// Create a singleton instance
const monitoring = new MonitoringService();
export default monitoring; 