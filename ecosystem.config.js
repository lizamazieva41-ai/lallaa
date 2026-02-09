module.exports = {
  apps: [
    {
      name: 'payment-sandbox-api',
      script: 'dist/index.js',
      instances: 'max',  // cluster mode for production
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      env: {
        NODE_ENV: 'development',
        API_PORT: 3000
      },
      
      env_production: {
        NODE_ENV: 'production',
        API_PORT: 3000,
        // Add critical env vars here if needed
      }
    },
    {
      name: 'card-generation-worker',
      script: 'dist/workers/cardGenerationWorker.js',
      instances: 2,  // Run 2 worker instances for redundancy
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      
      env: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'card-generation'
      },
      
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'card-generation'
      }
    }
  ]
};