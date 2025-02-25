import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Start the service
const service = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  env: process.env
});

service.on('error', (error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Stopping service...');
  service.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Stopping service...');
  service.kill('SIGTERM');
});

// Log when service exits
service.on('exit', (code, signal) => {
  if (code) {
    console.error(`Service exited with code: ${code}`);
  } else if (signal) {
    console.error(`Service was terminated by signal: ${signal}`);
  } else {
    console.log('Service stopped');
  }
}); 