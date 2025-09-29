# 14-Day Credit Window Notifications

This system automatically monitors and sends notifications when the 14-day credit window for shared leads is approaching expiration or has expired.

## Features

- **Daily automated notifications** via email, Slack, and webhooks
- **Real-time monitoring** of credit window status
- **Manual notifications** for immediate alerts
- **Flexible configuration** via environment variables
- **Comprehensive logging** for audit and debugging

## Setup

### 1. Environment Variables

Add these variables to your `.env` file:

```env
# Required for cron job authentication
CRON_SECRET=your-secure-random-secret-here

# Email notifications (comma-separated)
CREDIT_NOTIFICATION_EMAILS=julian@proffskontakt.se,admin@company.com

# Optional webhook for external systems
CREDIT_NOTIFICATION_WEBHOOK=https://your-system.com/webhook/credit-alerts

# Optional Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Your app URL for cron calls
APP_URL=https://your-app.vercel.app
```

### 2. GitHub Actions Setup

The automated notifications run via GitHub Actions daily at 09:00 CET.

**Required GitHub Secrets:**
1. Go to your repository Settings → Secrets and variables → Actions
2. Add these secrets:
   - `CRON_SECRET`: Same value as in your .env file
   - `APP_URL`: Your deployed application URL
   - `SLACK_WEBHOOK_URL`: (Optional) Your Slack webhook URL

### 3. Vercel Cron Jobs (Alternative)

If using Vercel, you can use their cron functionality:

1. Create `vercel.json` in your project root:
```json
{
  "crons": [
    {
      "path": "/api/cron/credit-notifications",
      "schedule": "0 8 * * *"
    }
  ]
}
```

2. Add the `CRON_SECRET` to your Vercel environment variables.

## API Endpoints

### Manual Notifications

**Send immediate notifications:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "send_manual"}' \
  https://your-app.com/api/admin/credit-notifications
```

**Check current alerts:**
```bash
curl https://your-app.com/api/admin/credit-notifications?action=check
```

### Cron Endpoint

**Automated daily run:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.com/api/cron/credit-notifications
```

**Health check:**
```bash
curl https://your-app.com/api/cron/credit-notifications
```

## Notification Types

### Email Notifications
- **Subject**: 🚨 Kreditfönster varning - X leads kräver uppmärksamhet
- **Content**: HTML formatted with color-coded urgency levels
- **Recipients**: Configured via `CREDIT_NOTIFICATION_EMAILS`

### Slack Notifications
- **Format**: Rich blocks with summary statistics
- **Channels**: Configured via Slack webhook URL
- **Urgency**: Color-coded messages (red for critical, yellow for expiring)

### Webhook Notifications
- **Format**: JSON payload with full alert data
- **Use case**: Integration with external monitoring systems
- **Payload structure**:
```json
{
  "type": "credit_window_alert",
  "alerts": [...],
  "summary": {
    "total": 5,
    "expiring": 3,
    "expired": 1,
    "critical": 1
  },
  "timestamp": "2024-01-15T09:00:00Z"
}
```

## Alert Levels

### 🔴 Critical (≤1 day remaining)
- Immediate attention required
- Highlighted in red across all notification channels
- Highest priority in notifications

### 🟡 Expiring (≤3 days remaining)
- Warning level
- Highlighted in yellow
- Included in daily notifications

### ⚫ Expired (past expiration date)
- Archive/tracking purposes
- Shown for historical context
- Indicates missed opportunities

## Admin Dashboard Integration

The credit window alerts are integrated into the admin dashboard:

1. **Dashboard Overview**: Shows current alerts count
2. **Lead Sharing Tab**: Full management interface
3. **Credit Alerts Tab**: Dedicated alerts view
4. **Real-time Updates**: Automatic refresh of alert status

## Manual Management

### Via Admin Dashboard

1. Navigate to Admin Dashboard → Lead-delning tab
2. Use the "Kreditvarningar" section to:
   - View all current alerts
   - Check days remaining
   - See which companies are involved
   - Track credit status

### Via API

```javascript
// Get current alerts
const alerts = await fetch('/api/admin/credit-notifications?action=check')
const data = await alerts.json()

// Send manual notification
await fetch('/api/admin/credit-notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'send_manual' })
})
```

## Monitoring and Logging

### System Logs
All notification activities are logged in the `system_logs` table:
- Type: `credit_notification` or `cron_execution`
- Source: `auto_notification`, `manual`, or `credit_notifications`
- Data: Full details of what was sent and to whom

### Health Checks
The cron endpoint provides health status:
```json
{
  "status": "healthy",
  "currentAlerts": 3,
  "lastExecution": {
    "timestamp": "2024-01-15T09:00:00Z",
    "status": "success",
    "message": "Sent 3 notifications"
  },
  "nextScheduled": "Daily at 09:00 CET"
}
```

### Failure Handling
- Failed notifications are logged with error details
- GitHub Actions will retry failed workflows
- Slack notifications sent on workflow failures
- Health check endpoint monitors system status

## Customization

### Email Templates
Edit the `generateEmailContent()` function in `/api/admin/credit-notifications/route.ts`:
- Modify HTML structure
- Add company branding
- Change color schemes
- Add custom fields

### Notification Timing
Modify the cron schedule in `.github/workflows/credit-notifications.yml`:
```yaml
schedule:
  - cron: '0 8 * * *'  # Daily at 08:00 UTC (09:00 CET)
  - cron: '0 13 * * *' # Additional afternoon check at 13:00 UTC
```

### Alert Thresholds
Adjust the warning periods in the `getCreditWindowAlerts()` function:
```javascript
// Change from 3 days to 5 days warning
const threeDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000))

// Adjust urgency levels
const urgency = daysRemaining <= 2 ? 'critical' :
                daysRemaining <= 5 ? 'high' : 'medium'
```

## Testing

### Manual Testing
1. **Create test lead shares** with short credit windows
2. **Run manual notification** via admin dashboard
3. **Check logs** for successful execution
4. **Verify email delivery** (check spam folders)

### Automated Testing
```bash
# Test the cron endpoint
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.com/api/cron/credit-notifications

# Check health
curl https://your-app.com/api/cron/credit-notifications
```

## Troubleshooting

### Common Issues

**1. No notifications received**
- Check environment variables are set correctly
- Verify email addresses in `CREDIT_NOTIFICATION_EMAILS`
- Check spam/junk folders
- Review system logs for errors

**2. Cron job not running**
- Verify GitHub secrets are configured
- Check workflow permissions in repository settings
- Review GitHub Actions logs
- Ensure `CRON_SECRET` matches between environments

**3. Slack notifications failing**
- Verify Slack webhook URL is correct
- Check webhook permissions in Slack
- Test webhook manually with curl

**4. Wrong timezone**
- GitHub Actions runs in UTC
- Adjust cron schedule for your timezone
- Consider daylight saving time changes

### Debug Commands

```bash
# Check current alerts
curl https://your-app.com/api/admin/credit-notifications?action=check

# View system logs
curl https://your-app.com/api/admin/dashboard | jq '.systemLogs'

# Test email settings
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "test", "recipient": "your-email@domain.com"}' \
  https://your-app.com/api/admin/credit-notifications
```

## Security Considerations

1. **Cron Secret**: Use a strong, random secret for `CRON_SECRET`
2. **Environment Variables**: Never commit secrets to version control
3. **Webhook URLs**: Use HTTPS and validate incoming requests
4. **Email Content**: Avoid including sensitive customer data
5. **Access Control**: Ensure notification endpoints require proper authentication

## Production Deployment

1. **Set all environment variables** in your hosting platform
2. **Configure GitHub secrets** for automated workflows
3. **Test notifications** with a small group first
4. **Monitor logs** for the first few days
5. **Set up alerts** for notification failures
6. **Document recipients** and update procedures

For more information, see the main README.md and SETUP.md files.