module.exports = {
  apps: [
    {
      name: 'nextjs-server',
      script: 'npm',
      args: 'run start:server-only',
      cwd: './',
      instances: 1,
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
      time: true
    },
    {
      name: 'queue-monitor-realtime',
      script: './scripts/queue-monitor.js',
      args: '--realtime',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/queue-monitor-pm2-error.log',
      out_file: './logs/queue-monitor-pm2-out.log',
      log_file: './logs/queue-monitor-pm2-combined.log',
      time: true,
      merge_logs: true
    }
  ]
}; 