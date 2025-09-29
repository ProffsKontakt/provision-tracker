# 📞 Adversus Call Analytics & Commission Tracking System

## 🎯 Overview

A comprehensive system for tracking and analyzing call data from Adversus, with automatic commission calculation and admin review functionality. This system provides real-time insights into your team's call performance and lead quality.

## ✨ Key Features

### 📊 Call Analytics Dashboard
- **Last 30 days call records** from Adversus API
- **Detailed call status tracking**: success, not interested, callback, busy, no answer, etc.
- **Lead status progression**: new → contacted → interested → appointment booked → sale
- **Admin quality review**: Godkänt/Underkänt status with approval workflow
- **Agent performance metrics**: success rates, conversion rates, call duration analytics
- **Real-time filtering** by agent, date range, and status
- **CSV export** functionality for reporting

### 🔗 Adversus Integration
- **Real-time webhook integration** for instant updates
- **Call records scraping** with comprehensive data capture
- **Address tracking** for leads marked as "status = success"
- **Automatic commission creation** for successful sales
- **Customer information sync** (name, phone, email, address)
- **Campaign and lead source tracking**

### 👥 Team Performance Tracking
- **Individual agent analytics**
- **Call quality scoring** (1-10 scale)
- **Success rate calculations**
- **Appointment booking tracking**
- **Lead assignment to companies** (Bolag1, Bolag2, etc.)
- **Property type and interest categorization**

### 🛡️ Admin Review System
- **Manual quality review** for each successful call
- **Godkänt/Underkänt approval workflow**
- **Admin comments and notes**
- **Bulk review capabilities**
- **Quality score adjustments**

## 🚀 Quick Start

### 1. Access the Call Analytics
```
http://localhost:3003/admin/call-analytics
```

### 2. Key API Endpoints

**Get Call Records (Admin/Manager only)**
```
GET /api/adversus/call-records?agentId=agent_moltas&dateFrom=2024-09-01&dateTo=2024-09-30
```

**Update Admin Review Status**
```
POST /api/adversus/call-records
{
  "callId": "call_123",
  "adminCheckStatus": "Godkänt", // or "Underkänt"
  "notes": "High quality lead, good conversation"
}
```

**Webhook Endpoint (for Adversus)**
```
POST /api/webhooks/adversus
```

## 📈 Analytics Features

### Call Status Breakdown
- **Success**: Calls that resulted in positive outcomes
- **Not Interested**: Customer declined services
- **Callback**: Customer requested follow-up
- **Busy**: Customer was unavailable
- **No Answer**: Call not answered
- **Do Not Call**: Customer opted out
- **Wrong Number**: Invalid contact information

### Lead Status Progression
- **New**: Fresh lead in system
- **Contacted**: Initial contact made
- **Interested**: Customer showed interest
- **Not Interested**: Customer declined
- **Appointment Booked**: Meeting scheduled
- **Sale**: Successful conversion
- **Closed Lost**: Opportunity lost

### Admin Check Status
- **Godkänt**: Approved by admin (high quality)
- **Underkänt**: Rejected by admin (low quality)
- **Pending**: Awaiting admin review
- **Not Checked**: No admin review yet

## 🔧 Configuration

### Environment Variables
```env
# Adversus API
ADVERSUS_BASE_URL=https://api.adversus.com
ADVERSUS_USERNAME=your_username
ADVERSUS_PASSWORD=your_password
ADVERSUS_WEBHOOK_SECRET=your_webhook_secret

# Database
DATABASE_URL=your_database_url
```

### Adversus Webhook Setup
1. Go to Adversus Dashboard > Integrations > Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/adversus`
3. Select events:
   - `call_completed`
   - `lead_status_updated`
   - `appointment_booked`
   - `lead_created`
4. Set webhook secret (matches `ADVERSUS_WEBHOOK_SECRET`)

## 📊 Dashboard Features

### Overview Cards
- **Total Calls**: All calls in selected period
- **Conversion Rate**: Interested leads / total calls
- **Meetings Booked**: Successful appointments scheduled
- **Admin Approval Rate**: Godkänt / (Godkänt + Underkänt)

### Agent Performance Table
- Call volume and success rates
- Average call duration
- Conversion and appointment rates
- Admin approval rates
- Quality score averages

### Detailed Call Records
- Customer information (name, phone, address)
- Call metrics (duration, status, quality score)
- Lead progression tracking
- Admin review status
- Quick approve/reject actions

### Filtering & Export
- **Date Range**: Custom from/to dates
- **Agent Selection**: Individual or all agents
- **Status Filters**: By call status, lead status, admin status
- **CSV Export**: Complete data export for reporting

## 🔄 Webhook Event Handling

### Supported Events

**1. Lead Status Updated**
```json
{
  "event_type": "lead_status_updated",
  "lead": {
    "id": "lead_123",
    "status": "sale",
    "customer_name": "Anna Andersson",
    "agent_name": "Moltas Roslund"
  }
}
```

**2. Call Completed**
```json
{
  "event_type": "call_completed",
  "call": {
    "id": "call_123",
    "call_status": "success",
    "call_duration": 285,
    "customer_name": "Anna Andersson",
    "agent_name": "Moltas Roslund"
  }
}
```

**3. Appointment Booked**
```json
{
  "event_type": "appointment_booked",
  "appointment": {
    "id": "apt_123",
    "customer_name": "Anna Andersson",
    "appointment_datetime": "2024-10-01T10:00:00Z",
    "agent_name": "Moltas Roslund"
  }
}
```

### Automatic Actions
- **Commission Creation**: Automatically creates commission records for successful sales
- **Lead Sync**: Updates local database with Adversus lead data
- **Quality Scoring**: Applies lead quality scores from Adversus
- **Company Assignment**: Maps leads to appropriate companies (Bolag1, etc.)

## 💰 Commission Integration

When a lead status is updated to "success" via webhook:

1. **Automatic Commission Creation**
   - Commission amount calculated based on lead type
   - Quality score multipliers applied
   - Company assignment from lead data
   - Status set to PENDING for admin review

2. **Lead Type Commission Rates**
   - Villa - Solceller: 1500 SEK
   - Villa - Värmepump: 1200 SEK
   - Lägenhet - Solceller: 800 SEK
   - Företag - Solceller: 2000 SEK
   - Standard Lead: 1000 SEK (fallback)

3. **Quality Bonuses**
   - Quality score 9-10: No adjustment
   - Quality score 7-8: Standard rate
   - Quality score 5-6: 0.8x multiplier
   - Quality score 1-4: 0.6x multiplier
   - High probability sales (90%+): 1.2x bonus

## 🎯 Success Metrics

### For Agents
- **Call Volume**: Number of calls per day/week
- **Success Rate**: Successful calls / total calls
- **Conversion Rate**: Interested leads / total calls
- **Appointment Rate**: Booked meetings / total calls
- **Quality Score**: Average lead quality (1-10)
- **Admin Approval**: Godkänt rate from admin reviews

### For Admins
- **Team Performance**: Overall team metrics
- **Quality Control**: Admin review completion rate
- **Revenue Tracking**: Commission values and trends
- **Lead Sources**: Best performing campaigns
- **Conversion Funnel**: Lead progression analytics

## 🔍 Monitoring & Debugging

### System Logs
All webhook events and API calls are logged in the database for debugging:

```sql
SELECT * FROM "SystemLog"
WHERE type IN ('adversus_webhook', 'adversus_call_completed')
ORDER BY "createdAt" DESC;
```

### Health Checks
- **Webhook Status**: `GET /api/webhooks/adversus`
- **API Health**: `GET /api/adversus/call-records` (requires auth)
- **Database Status**: Check Prisma connection

## 📱 Mobile Friendly

The dashboard is fully responsive and works great on:
- **Desktop**: Full feature access
- **Tablet**: Optimized layout
- **Mobile**: Key metrics and quick actions

---

## 🎉 Ready to Track Your Call Success!

This system provides everything you need to monitor, analyze, and optimize your Adversus call performance. From real-time webhook integration to detailed admin review workflows, you'll have complete visibility into your team's success.

**Key Benefits:**
- ✅ Real-time call tracking from Adversus
- ✅ Automatic commission calculation
- ✅ Quality control with admin reviews
- ✅ Comprehensive performance analytics
- ✅ Easy CSV export for reporting
- ✅ Mobile-friendly dashboard
- ✅ Secure webhook integration