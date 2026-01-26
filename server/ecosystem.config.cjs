module.exports = {
  apps: [
    {
      name: 'aura-backend',
      cwd: '/home/ubuntu/aura-estates-insight/server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};