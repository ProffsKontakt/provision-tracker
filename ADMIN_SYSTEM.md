# Admin System Documentation

## Overview

The ProffsKontakt Admin System provides comprehensive management and analytics for the Swedish solar commission tracking system. It integrates with both Adversus (calling system) and Pipedrive (CRM) APIs to provide real-time insights into setter performance, deal progression, and commission calculations.

## Features

### 🎛️ Admin Dashboard
- **Real-time metrics** from Adversus and Pipedrive APIs
- **Expandable sidebar navigation** with collapsible icon-only mode
- **Live activity feed** showing system events
- **API status monitoring** for both Adversus and Pipedrive
- **Auto-refresh** every 30 seconds for real-time data

### 📊 Key Metrics Tracked

#### From Adversus API:
- Total calls per setter
- Average talk time
- Hit rate (successful calls / total calls)
- Calls per hour productivity
- Agent status (online/offline)
- Last activity timestamps

#### From Pipedrive API:
- Deals created and won
- Pipeline values and progression
- Deal conversion rates
- Average deal sizes
- Stage-by-stage analysis

#### Commission Calculations:
- Base bonus (100 SEK per deal)
- Offert commissions (100 SEK each)
- Platsbesök commissions (300 SEK each)
- Monthly and weekly totals
- Target vs actual tracking

### 🧭 Navigation Structure

The admin interface includes:

1. **Översikt** (`/admin`) - Main dashboard with system-wide metrics
2. **Setter Performance** (`/admin/setters`) - Individual setter analysis
3. **Samtalsanalys** (`/admin/calls`) - Adversus call quality analysis
4. **Pipeline Management** (`/admin/pipeline`) - Pipedrive deal progression
5. **Företag & Leads** (`/admin/companies`) - Lead distribution management
6. **Provisionsrapporter** (`/admin/commissions`) - Commission tracking
7. **Systemloggar** (`/admin/logs`) - System activity monitoring
8. **Inställningar** (`/admin/settings`) - System configuration

### 📈 Setter Performance Analysis

#### Overview Cards
- Performance rating (Excellent/Good/Average/Needs Improvement)
- Real-time progress bars for daily goals
- Key metrics at a glance
- Trend indicators with directional arrows

#### Detailed Analytics
- Comprehensive table view with all metrics
- Working hours and activity tracking
- Deal values and commission earnings
- Goal progress monitoring

#### Coaching Insights
- Automatic identification of underperforming setters
- Best practice recommendations
- Performance trend analysis
- Scheduling tools for coaching sessions

## API Integration

### Adversus API
**Base URL:** `https://api.adversus.dk/api/v1`

**Key Endpoints Used:**
- `/agents` - Agent status and basic info
- `/calls` - Call records with duration, status, results
- `/campaigns` - Campaign data for filtering

**Data Flow:**
1. Fetch agent list and current status
2. Retrieve call records for specified time period
3. Calculate metrics (hit rate, average talk time, productivity)
4. Process trends and changes over time

### Pipedrive API
**Base URL:** `https://api.pipedrive.com/v1`

**Key Endpoints Used:**
- `/deals` - Deal information and values
- `/stages` - Pipeline stage configuration
- `/persons` - Contact information
- `/users` - Pipedrive user mapping

**Data Flow:**
1. Fetch deals by owner and time period
2. Calculate conversion rates and deal values
3. Analyze pipeline progression
4. Link with Adversus data via user mapping

### User Mapping
The system links Adversus agents with Pipedrive users through:
- Database mapping table
- Environment variable configuration
- Manual admin assignment

## Environment Configuration

Required environment variables:

```bash
# Adversus Configuration
ADVERSUS_API_URL="https://api.adversus.dk"
ADVERSUS_API_KEY="your-api-key"
ADVERSUS_WEBHOOK_SECRET="webhook-secret"

# Pipedrive Configuration
PIPEDRIVE_API_TOKEN="your-api-token"
PIPEDRIVE_WEBHOOK_SECRET="webhook-secret"

# User Mapping
USER_ID_MAPPING="ADV001:123,ADV002:124,ADV003:125"
```

## Real-time Features

### Auto-refresh Dashboard
- **Interval:** 30 seconds
- **Data Sources:** Both APIs
- **Fallback:** Mock data if APIs unavailable
- **Error Handling:** Graceful degradation

### Live Activity Feed
- New deal creation events
- Call quality achievements
- Performance improvements
- System alerts and warnings

### Performance Alerts
- Low activity warnings
- Hit rate improvements
- Goal achievements
- Coaching recommendations

## Commission Business Logic

### Swedish Solar Rules
1. **Base Bonus:** 100 SEK per deal (once per deal)
2. **Offert Commission:** 100 SEK per company
3. **Platsbesök Commission:** 300 SEK per company
4. **Credit Window:** 14 days for company attribution

### Calculation Process
1. Identify deal and associated companies
2. Check credit window eligibility
3. Apply commission rates by lead type
4. Calculate total with base bonus
5. Track approval status (pending/approved/rejected)

## Security Features

### Authentication
- NextAuth.js with role-based access
- Admin-only routes protection
- Session management
- Automatic logout

### API Security
- Bearer token authentication
- Rate limiting
- Request validation
- Error sanitization

### Data Privacy
- No sensitive data logging
- Encrypted API tokens
- Secure webhook endpoints
- GDPR compliance considerations

## Performance Optimization

### Caching Strategy
- API response caching
- Database query optimization
- Real-time data batching
- Efficient pagination

### Error Handling
- API timeout management
- Fallback to cached data
- User-friendly error messages
- Automatic retry logic

## Deployment Considerations

### Production Setup
1. Configure environment variables
2. Set up database migrations
3. Initialize user mappings
4. Configure webhook endpoints
5. Set up monitoring and alerts

### Monitoring
- API health checks
- Performance metrics
- Error rate tracking
- User activity logs

## Future Enhancements

### Planned Features
- Advanced analytics dashboard
- Machine learning insights
- Automated coaching recommendations
- Integration with additional tools
- Mobile-responsive improvements

### API Expansions
- Additional Adversus endpoints
- Enhanced Pipedrive integration
- Third-party analytics tools
- Webhook real-time processing

## Support and Maintenance

### Regular Tasks
- API token renewal
- Performance monitoring
- Data quality checks
- User mapping updates

### Troubleshooting
- Check API connectivity
- Verify user mappings
- Review error logs
- Validate data consistency

---

## Quick Start

1. **Setup Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

2. **Access Admin Panel:**
   - Login as admin user
   - Navigate to `/admin`
   - Use sidebar navigation

3. **Configure APIs:**
   - Add Adversus API key
   - Add Pipedrive API token
   - Map users between systems

4. **Monitor Performance:**
   - Check real-time dashboard
   - Review setter analytics
   - Monitor API status

The admin system provides powerful insights while maintaining ease of use for daily management tasks.