# Running Frontend with PM2 on Port 80

PM2 is a production process manager for Node.js applications. This guide shows how to run the frontend on port 80 using PM2.

## Installation

### Install PM2 Globally

```bash
sudo npm install -g pm2
```

Or using yarn:

```bash
sudo npm install -g pm2
```

## Quick Start

### Step 1: Build the Application

```bash
cd frontend
npm run build
```

### Step 2: Start with PM2

```bash
# Development mode (with auto-reload)
pm2 start npm --name "invoiceai-frontend" -- run dev:80

# Production mode (recommended)
pm2 start npm --name "invoiceai-frontend" -- run start:80
```

### Step 3: Save PM2 Configuration

```bash
pm2 save
```

### Step 4: Setup PM2 to Start on Boot

```bash
pm2 startup
# Follow the instructions it provides (usually involves running a sudo command)
```

## PM2 Configuration File (Recommended)

Create a PM2 ecosystem file for better configuration:

```bash
cd frontend
nano ecosystem.config.js
```

Add this configuration:

```javascript
module.exports = {
  apps: [{
    name: 'invoiceai-frontend',
    script: 'npm',
    args: 'run start:80',
    cwd: '/path/to/invoiceAI/frontend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      NEXT_PUBLIC_API_URL: 'http://localhost:8000'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

**Replace:**
- `/path/to/invoiceAI/frontend` with your actual frontend directory path
- `NEXT_PUBLIC_API_URL` with your backend URL

### Start with Config File

```bash
pm2 start ecosystem.config.js
```

## Running on Port 80 with PM2

### Option 1: Using setcap (Recommended)

First, allow Node.js to bind to port 80:

```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

Then start with PM2:

```bash
pm2 start ecosystem.config.js
```

### Option 2: Run PM2 with sudo (Not Recommended)

```bash
sudo pm2 start ecosystem.config.js
```

**Note:** Running PM2 with sudo is not recommended for security reasons.

### Option 3: Use Port Forwarding

Run on port 3000 and forward port 80:

```bash
# In ecosystem.config.js, change PORT to 3000
# Then use iptables to forward:
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```

## Complete PM2 Setup Script

Create a setup script:

```bash
nano ~/setup-pm2-frontend.sh
```

Add:

```bash
#!/bin/bash

cd /path/to/invoiceAI/frontend

# Build the application
echo "Building Next.js application..."
npm run build

# Set capability for port 80 (if not already set)
echo "Setting capability for port 80..."
NODE_PATH=$(which node)
if [ -n "$NODE_PATH" ]; then
    sudo setcap 'cap_net_bind_service=+ep' $NODE_PATH
    echo "✅ Capability set"
else
    echo "⚠️  Node.js not found in PATH"
fi

# Start with PM2
echo "Starting with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
echo "Setting up PM2 startup..."
pm2 startup

echo "✅ Frontend started with PM2 on port 80"
echo "Access at: http://$(hostname -I | awk '{print $1}')"
```

Make executable:

```bash
chmod +x ~/setup-pm2-frontend.sh
~/setup-pm2-frontend.sh
```

## PM2 Commands

### Basic Commands

```bash
# List all processes
pm2 list

# Show detailed info
pm2 show invoiceai-frontend

# View logs
pm2 logs invoiceai-frontend

# View logs (last 100 lines)
pm2 logs invoiceai-frontend --lines 100

# Restart
pm2 restart invoiceai-frontend

# Stop
pm2 stop invoiceai-frontend

# Delete
pm2 delete invoiceai-frontend

# Reload (zero-downtime restart)
pm2 reload invoiceai-frontend
```

### Monitoring

```bash
# Real-time monitoring
pm2 monit

# Show process info
pm2 info invoiceai-frontend

# Show process list
pm2 list
```

### Logs

```bash
# View all logs
pm2 logs

# View specific app logs
pm2 logs invoiceai-frontend

# Clear logs
pm2 flush

# View logs with timestamps
pm2 logs --timestamp
```

## Environment Variables

### Method 1: In ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'invoiceai-frontend',
    script: 'npm',
    args: 'run start:80',
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      NEXT_PUBLIC_API_URL: 'http://localhost:8000'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 80,
      NEXT_PUBLIC_API_URL: 'https://api.yourdomain.com'
    }
  }]
};
```

### Method 2: Using .env File

Create `.env.production` in frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
PORT=80
```

PM2 will automatically load `.env` files.

### Method 3: Pass Environment Variables

```bash
pm2 start ecosystem.config.js --env production
```

## Production Configuration

### Recommended ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'invoiceai-frontend',
    script: 'npm',
    args: 'run start:80',
    cwd: '/path/to/invoiceAI/frontend',
    instances: 1, // Use 1 for Next.js (or 'max' for cluster mode)
    exec_mode: 'fork', // 'fork' or 'cluster'
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      NEXT_PUBLIC_API_URL: 'http://localhost:8000'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

## Auto-Restart on Boot

### Setup PM2 Startup

```bash
# Generate startup script
pm2 startup

# It will output a command like:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u youruser --hp /home/youruser

# Run the command it provides
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u youruser --hp /home/youruser

# Save current PM2 processes
pm2 save
```

Now PM2 will automatically start your app on system boot.

## Monitoring and Health Checks

### Setup PM2 Plus (Optional)

```bash
pm2 link <secret_key> <public_key>
```

### Health Check Endpoint

Add to your Next.js app (optional):

```typescript
// pages/api/health.ts or app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

Monitor with PM2:

```bash
pm2 install pm2-health
```

## Troubleshooting

### Port 80 Permission Denied

```bash
# Set capability
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Verify
getcap $(which node)
```

### PM2 Process Not Starting

```bash
# Check logs
pm2 logs invoiceai-frontend --err

# Check if port is in use
sudo lsof -i :80

# Check PM2 status
pm2 status
```

### Application Crashes

```bash
# View error logs
pm2 logs invoiceai-frontend --err

# Check memory usage
pm2 monit

# Restart with more memory
pm2 restart invoiceai-frontend --update-env
```

### PM2 Not Starting on Boot

```bash
# Re-run startup
pm2 unstartup
pm2 startup
pm2 save
```

## Updating the Application

### Method 1: Manual Update

```bash
cd frontend
git pull
npm install
npm run build
pm2 restart invoiceai-frontend
```

### Method 2: Create Update Script

```bash
nano ~/update-frontend.sh
```

Add:

```bash
#!/bin/bash
cd /path/to/invoiceAI/frontend
git pull
npm install
npm run build
pm2 restart invoiceai-frontend
echo "✅ Frontend updated and restarted"
```

## Multiple Environments

### Development and Production

```javascript
module.exports = {
  apps: [
    {
      name: 'invoiceai-frontend-dev',
      script: 'npm',
      args: 'run dev:80',
      env: {
        NODE_ENV: 'development',
        PORT: 80
      }
    },
    {
      name: 'invoiceai-frontend-prod',
      script: 'npm',
      args: 'run start:80',
      env: {
        NODE_ENV: 'production',
        PORT: 80
      }
    }
  ]
};
```

Start specific environment:

```bash
pm2 start ecosystem.config.js --only invoiceai-frontend-prod
```

## Complete Example: ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'invoiceai-frontend',
    script: 'npm',
    args: 'run start:80',
    cwd: '/home/azureuser/invoiceAI/frontend',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      NEXT_PUBLIC_API_URL: 'http://localhost:8000'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

## Quick Reference

**Install PM2:**
```bash
sudo npm install -g pm2
```

**Build and Start:**
```bash
cd frontend
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Common Commands:**
```bash
pm2 list              # List processes
pm2 logs              # View logs
pm2 restart <name>    # Restart
pm2 stop <name>       # Stop
pm2 delete <name>    # Delete
pm2 monit             # Monitor
```

## Summary

1. **Install PM2:** `sudo npm install -g pm2`
2. **Create ecosystem.config.js** with your configuration
3. **Set capability for port 80:** `sudo setcap 'cap_net_bind_service=+ep' $(which node)`
4. **Build:** `npm run build`
5. **Start:** `pm2 start ecosystem.config.js`
6. **Save:** `pm2 save`
7. **Setup startup:** `pm2 startup`

Your frontend will now run on port 80 with PM2, automatically restart on crashes, and start on system boot!

