# PostgreSQL Database Setup Guide

This guide provides step-by-step instructions for setting up PostgreSQL for the Swedish Solar Lead Commission Tracker.

## Option 1: Local PostgreSQL Setup (Development)

### macOS Installation

1. **Accept Xcode License** (if needed)
```bash
sudo xcodebuild -license accept
```

2. **Install PostgreSQL**
```bash
brew install postgresql@15
brew services start postgresql@15
```

3. **Create Database and User**
```bash
# Create the database
createdb commission_tracker

# Connect and create user
psql commission_tracker

-- In psql prompt:
CREATE USER commission_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE commission_tracker TO commission_user;
GRANT ALL ON SCHEMA public TO commission_user;
\q
```

4. **Update Environment Variables**
```env
DATABASE_URL="postgresql://commission_user:secure_password_here@localhost:5432/commission_tracker"
```

### Windows Installation

1. **Download PostgreSQL**
   - Visit https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15+ installer

2. **Install and Configure**
   - Run installer with default settings
   - Remember the postgres user password
   - Start PostgreSQL service

3. **Create Database**
```cmd
# Open Command Prompt as Administrator
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres

-- In psql prompt:
CREATE DATABASE commission_tracker;
CREATE USER commission_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE commission_tracker TO commission_user;
\q
```

### Linux (Ubuntu/Debian) Installation

```bash
# Update packages
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql

-- In psql prompt:
CREATE DATABASE commission_tracker;
CREATE USER commission_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE commission_tracker TO commission_user;
\q
```

## Option 2: Docker PostgreSQL (Isolated)

1. **Install Docker Desktop**
   - macOS: `brew install --cask docker`
   - Windows: Download from https://docker.com
   - Linux: Follow official Docker installation guide

2. **Run PostgreSQL Container**
```bash
docker run --name commission-postgres \
  -e POSTGRES_DB=commission_tracker \
  -e POSTGRES_USER=commission_user \
  -e POSTGRES_PASSWORD=secure_password_here \
  -p 5432:5432 \
  -v commission_data:/var/lib/postgresql/data \
  -d postgres:15

# Verify it's running
docker ps
```

3. **Connect to Database** (optional)
```bash
docker exec -it commission-postgres psql -U commission_user -d commission_tracker
```

## Option 3: Cloud PostgreSQL (Production)

### Supabase (Recommended)

1. **Create Account**
   - Visit https://supabase.com
   - Sign up with GitHub/Google

2. **Create Project**
   - Click "New Project"
   - Choose a name: "commission-tracker"
   - Set a strong database password
   - Select region (Europe for Swedish company)

3. **Get Connection String**
   - Go to Settings → Database
   - Copy the connection string
   - Update .env file

### Neon (Serverless)

1. **Create Account**
   - Visit https://neon.tech
   - Sign up and verify email

2. **Create Database**
   - Click "Create Database"
   - Name: "commission-tracker"
   - Choose region

3. **Get Connection Details**
   - Copy the connection string from dashboard
   - Update .env file

### Railway

1. **Create Account**
   - Visit https://railway.app
   - Sign up with GitHub

2. **Deploy PostgreSQL**
   - Click "New Project"
   - Select "PostgreSQL"
   - Wait for deployment

3. **Get Connection String**
   - Click on PostgreSQL service
   - Go to "Connect" tab
   - Copy connection string

## Database Initialization

After setting up PostgreSQL (any option above):

1. **Install Dependencies**
```bash
cd lead-commission-system
npm install
```

2. **Generate Prisma Client**
```bash
npm run db:generate
```

3. **Run Migrations**
```bash
npm run db:migrate
```

4. **Seed with Sample Data**
```bash
npm run db:seed
```

5. **Verify Setup**
```bash
# Open Prisma Studio to view data
npm run db:studio
```

## Troubleshooting

### Connection Issues

**Error**: "Connection refused"
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql  # macOS
systemctl status postgresql           # Linux
docker ps                            # Docker
```

**Error**: "Password authentication failed"
- Double-check username/password in .env
- Ensure user has proper permissions
- Try connecting with psql directly

**Error**: "Database does not exist"
```bash
# Create the database manually
createdb commission_tracker
# Or via psql:
psql -U postgres -c "CREATE DATABASE commission_tracker;"
```

### Migration Issues

**Error**: "Migration failed"
```bash
# Reset and try again
npm run db:reset
npm run db:migrate
```

**Error**: "Prisma client not found"
```bash
npm run db:generate
```

### Permission Issues

**Error**: "Permission denied for schema public"
```sql
-- Connect as postgres user and run:
GRANT ALL ON SCHEMA public TO commission_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO commission_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO commission_user;
```

## Security Considerations

1. **Strong Passwords**
   - Use unique passwords for production
   - Consider password managers

2. **Network Security**
   - For production, restrict database access to application servers only
   - Use SSL/TLS connections

3. **Backup Strategy**
   - Set up automated backups
   - Test restore procedures

4. **Environment Variables**
   - Never commit .env files
   - Use different credentials for development/production

## Next Steps

After successful database setup:

1. **Start Development Server**
```bash
npm run dev
```

2. **Access Application**
   - Open http://localhost:3000
   - Login with sample credentials from README

3. **Test Commission Calculations**
   - Use the admin dashboard to verify calculations
   - Test with different lead scenarios

4. **Configure API Integrations**
   - Set up Pipedrive webhooks
   - Test Adversus API connection