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
      name: 'queue-monitor',
      script: './scripts/queue-monitor.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/queue-monitor-error.log',
      out_file: './logs/queue-monitor-out.log',
      log_file: './logs/queue-monitor-combined.log',
      time: true
    }
  ]
}; 