module.exports = {
  apps: [
    {
      name: 'nextjs-server',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/nextjs-server-error.log',
      out_file: './logs/nextjs-server-out.log',
      log_file: './logs/nextjs-server-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'simple-queue-monitor',
      script: './scripts/simple-queue-monitor.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 3,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/simple-queue-monitor-error.log',
      out_file: './logs/simple-queue-monitor-out.log',
      log_file: './logs/simple-queue-monitor-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'cloudflare-stream-monitor',
      script: 'npm',
      args: 'start',
      cwd: './CloudFlareStreamProgressDataUpdate',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cloudflare-monitor-error.log',
      out_file: './logs/cloudflare-monitor-out.log',
      log_file: './logs/cloudflare-monitor-combined.log',
      time: true,
      merge_logs: true
    }
  ]
}; 