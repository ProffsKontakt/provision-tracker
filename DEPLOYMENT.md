# 🚀 Deployment Guide

## Overview

This guide covers deploying the Lead Commission System to Netlify with Supabase as the database provider.

## 📋 Prerequisites

1. **Netlify Account** - [Sign up at netlify.com](https://netlify.com)
2. **Supabase Account** - [Sign up at supabase.com](https://supabase.com)
3. **Adversus API Access** - Username, password, and webhook configuration
4. **Git Repository** - Your code should be in a GitHub/GitLab repo

## 🗄️ Database Setup (Supabase)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a database password (save this!)
3. Wait for project provisioning (~2 minutes)

### 2. Get Database Connection Strings

From your Supabase dashboard > Settings > Database:

```env
# Connection pooling (recommended for serverless)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

# Direct connection
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

### 3. Deploy Database Schema

```bash
# Set your environment variables
export DATABASE_URL="your-supabase-url"
export DIRECT_URL="your-supabase-direct-url"

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Seed initial data
npx prisma db seed
```

## 🌐 Netlify Deployment

### 1. Connect Repository

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "New site from Git"
3. Connect your GitHub/GitLab account
4. Select your repository

### 2. Build Settings

Netlify should auto-detect these settings:

- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Node version**: `18.x`

### 3. Environment Variables

In Netlify Dashboard > Site settings > Environment variables, add:

```env
# Database
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# NextAuth.js
NEXTAUTH_URL=https://your-site-name.netlify.app
NEXTAUTH_SECRET=your-super-secret-key-minimum-32-characters

# Adversus API
ADVERSUS_BASE_URL=https://api.adversus.com
ADVERSUS_USERNAME=your-adversus-username
ADVERSUS_PASSWORD=your-adversus-password
ADVERSUS_WEBHOOK_SECRET=your-webhook-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Pipedrive
PIPEDRIVE_API_TOKEN=your-pipedrive-token
PIPEDRIVE_COMPANY_DOMAIN=your-company

# Security
NODE_ENV=production
```

### 4. Deploy

1. Click "Deploy site"
2. Wait for build to complete (~3-5 minutes)
3. Your site will be available at `https://random-name.netlify.app`

### 5. Custom Domain (Optional)

1. In Netlify Dashboard > Domain settings
2. Add custom domain
3. Follow DNS configuration instructions

## 🔗 Webhook Configuration

### 1. Adversus Webhook Setup

In your Adversus dashboard:

1. Go to Integrations > Webhooks
2. Add new webhook:
   - **URL**: `https://your-site-name.netlify.app/api/webhooks/adversus`
   - **Secret**: Your `ADVERSUS_WEBHOOK_SECRET`
   - **Events**: Select relevant events (lead_status_updated, appointment_booked, etc.)

### 2. Test Webhook

```bash
# Test webhook endpoint
curl -X GET https://your-site-name.netlify.app/api/webhooks/adversus

# Should return:
{
  "status": "ok",
  "service": "Adversus Webhook Handler",
  "timestamp": "2024-09-29T...",
  "environment": "production"
}
```

## 🔐 Security Configuration

### 1. Supabase Row Level Security

Enable RLS in Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdversusLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemLog" ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see their own data
CREATE POLICY "users_own_data" ON "AdversusLead"
  FOR ALL USING (
    "userId" = (
      SELECT id FROM "User"
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Admin policy: Admins can see everything
CREATE POLICY "admin_access" ON "AdversusLead"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE email = auth.jwt() ->> 'email'
      AND role = 'ADMIN'
    )
  );
```

### 2. Additional Security Headers

These are already configured in `netlify.toml`:

- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Content-Security-Policy

## 🧪 Testing Your Deployment

### 1. Application Tests

1. **Load the app**: Visit your Netlify URL
2. **Authentication**: Test login/logout
3. **Admin panel**: Check `/admin` (admin users only)
4. **Call analytics**: Visit `/admin/call-analytics`
5. **API endpoints**: Test `/api/adversus/call-records`

### 2. Database Tests

```bash
# Connect to your deployed database
npx prisma studio --browser none

# Check tables exist
npx prisma db pull
```

### 3. Webhook Tests

Test with curl or Postman:

```bash
# Health check
curl https://your-site.netlify.app/api/webhooks/adversus

# Mock webhook (with proper signature)
curl -X POST https://your-site.netlify.app/api/webhooks/adversus \
  -H "Content-Type: application/json" \
  -H "X-Adversus-Signature: sha256=your-signature" \
  -d '{
    "event_type": "lead_status_updated",
    "timestamp": "2024-09-29T12:00:00Z",
    "lead": {
      "id": "test-123",
      "customer_name": "Test Customer",
      "status": "interested"
    }
  }'
```

## 🔍 Monitoring & Debugging

### 1. Netlify Logs

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login and view logs
netlify login
netlify logs
```

### 2. Supabase Logs

In Supabase Dashboard:
- Go to Logs section
- Monitor database queries and errors
- Check API logs for webhook calls

### 3. Application Monitoring

Monitor these in your admin panel:
- System logs (`/admin/logs`)
- Webhook events
- Database errors
- Authentication issues

## 🚨 Troubleshooting

### Common Issues:

**1. Build Failures**
```bash
# Check build logs in Netlify
# Usually related to:
- Missing environment variables
- TypeScript errors
- Missing dependencies
```

**2. Database Connection Issues**
```bash
# Verify connection strings
# Check Supabase project status
# Ensure proper URL encoding of passwords
```

**3. Authentication Problems**
```bash
# Check NEXTAUTH_URL matches your domain
# Verify NEXTAUTH_SECRET is set
# Ensure cookies work with your domain
```

**4. Webhook Issues**
```bash
# Verify webhook URL in Adversus
# Check webhook secret matches
# Monitor Netlify function logs
```

### Getting Help

1. **Netlify Support**: [netlify.com/support](https://netlify.com/support)
2. **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
3. **Project Issues**: Create an issue in your repository

## 📚 Additional Resources

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Supabase Postgres Documentation](https://supabase.com/docs/guides/database)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Prisma with Supabase](https://supabase.com/docs/guides/integrations/prisma)

---

🎉 **Congratulations!** Your Lead Commission System is now deployed and ready to track Adversus call data with real-time webhook integration!