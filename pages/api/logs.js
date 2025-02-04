import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    let fileHandle = null;

    try {
        const { logs } = req.body;
        if (!Array.isArray(logs)) {
            return res.status(400).json({ message: 'Invalid logs format' });
        }

        const logPath = path.join(process.cwd(), 'logs');
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(logPath, `${today}.log`);

        // Ensure directory exists
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath, { recursive: true });
        }

        // Add size check before writing
        const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

        try {
            const stats = await fs.promises.stat(logFile);
            if (stats.size > MAX_LOG_SIZE) {
                const newFile = logFile.replace('.log', `.${Date.now()}.log`);
                await fs.promises.rename(logFile, newFile);
            }
        } catch (error) {
            // File doesn't exist yet, that's ok
        }

        // Write logs
        fileHandle = await fs.promises.open(logFile, 'a');
        await fileHandle.appendFile(logs.join(''));

        res.status(200).json({ message: 'Logs saved successfully' });
    } catch (error) {
        console.error('Error saving logs:', error);
        res.status(500).json({ message: 'Error saving logs' });
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
} 