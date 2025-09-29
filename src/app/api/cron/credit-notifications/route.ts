import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * POST /api/cron/credit-notifications
 * Automated daily credit window notifications
 * This endpoint should be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secure-cron-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔄 Starting automated credit window notification check...')

    // Get current alerts
    const alerts = await getCreditWindowAlerts()

    if (alerts.length === 0) {
      console.log('✅ No credit window alerts found')
      await logCronExecution('success', 'No alerts to send', { alertCount: 0 })

      return NextResponse.json({
        success: true,
        message: 'No alerts to send',
        alertCount: 0
      })
    }

    // Send notifications
    const result = await sendCreditWindowNotifications()

    console.log(`📧 Sent notifications for ${alerts.length} credit window alerts`)

    await logCronExecution('success', `Sent ${result.sent} notifications`, {
      alertCount: alerts.length,
      notificationsSent: result.sent,
      results: result.results
    })

    return NextResponse.json({
      success: true,
      message: `Sent notifications for ${alerts.length} alerts`,
      alertCount: alerts.length,
      notificationsSent: result.sent,
      details: result.results
    })

  } catch (error) {
    console.error('❌ Cron job failed:', error)

    await logCronExecution('error', error.message, {
      error: error.stack,
      timestamp: new Date()
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/credit-notifications
 * Health check for the cron endpoint
 */
export async function GET(req: NextRequest) {
  try {
    const alerts = await getCreditWindowAlerts()
    const lastExecution = await getLastCronExecution()

    return NextResponse.json({
      status: 'healthy',
      currentAlerts: alerts.length,
      lastExecution: lastExecution ? {
        timestamp: lastExecution.createdAt,
        status: lastExecution.data?.status || 'unknown',
        message: lastExecution.message
      } : null,
      nextScheduled: 'Daily at 09:00 CET'
    })

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Get credit window alerts (duplicate from main notifications API)
 */
async function getCreditWindowAlerts() {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))

  const alertLeadShares = await prisma.leadShare.findMany({
    where: {
      creditWindowExpires: {
        lte: threeDaysFromNow
      }
    },
    include: {
      deal: {
        include: {
          user: true,
          commissions: {
            where: {
              creditedBack: true
            }
          }
        }
      },
      company: true,
      sharedBy: true
    },
    orderBy: {
      creditWindowExpires: 'asc'
    }
  })

  const dealGroups = new Map()

  alertLeadShares.forEach(share => {
    const dealId = share.dealId
    if (!dealGroups.has(dealId)) {
      dealGroups.set(dealId, {
        dealId: share.deal.id,
        dealTitle: share.deal.title,
        dealCreated: share.deal.dealCreated,
        opener: share.deal.user?.openerName || 'Okänd',
        companies: [],
        sharedDate: share.sharedAt,
        creditWindowExpires: share.creditWindowExpires,
        hasCredits: share.deal.commissions.length > 0
      })
    }
    dealGroups.get(dealId).companies.push({
      name: share.company.name,
      email: share.company.contactEmail,
      hasCredited: share.deal.commissions.some(comm =>
        comm.companyName === share.company.name && comm.creditedBack
      )
    })
  })

  const alerts = Array.from(dealGroups.values()).map(alert => {
    const daysRemaining = Math.max(0, Math.ceil(
      (alert.creditWindowExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ))

    let status: 'active' | 'expiring' | 'expired' = 'active'
    if (daysRemaining <= 0) {
      status = 'expired'
    } else if (daysRemaining <= 2) {
      status = 'expiring'
    }

    return {
      ...alert,
      daysRemaining,
      status,
      urgency: daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'high' : 'medium'
    }
  })

  return alerts
}

/**
 * Send credit window notifications (simplified version)
 */
async function sendCreditWindowNotifications() {
  const alerts = await getCreditWindowAlerts()

  if (alerts.length === 0) {
    return { sent: 0, alerts: [] }
  }

  // Get settings from environment
  const emailRecipients = process.env.CREDIT_NOTIFICATION_EMAILS?.split(',') || ['julian@proffskontakt.se']
  const webhookUrl = process.env.CREDIT_NOTIFICATION_WEBHOOK
  const slackWebhook = process.env.SLACK_WEBHOOK_URL

  const results = {
    emailsSent: 0,
    webhooksSent: 0,
    slackSent: 0,
    errors: []
  }

  const expiringAlerts = alerts.filter(a => a.status === 'expiring')
  const expiredAlerts = alerts.filter(a => a.status === 'expired')
  const criticalAlerts = alerts.filter(a => a.urgency === 'critical')

  // Send emails (simplified - log for now)
  try {
    const emailContent = generateEmailSummary(alerts, expiringAlerts, expiredAlerts, criticalAlerts)

    for (const recipient of emailRecipients) {
      console.log(`📧 Would send email to ${recipient}: ${emailContent.subject}`)
      // In production: await sendEmail(recipient, emailContent)
      results.emailsSent++
    }
  } catch (error) {
    results.errors.push(`Email error: ${error.message}`)
  }

  // Send webhook if configured
  if (webhookUrl) {
    try {
      const webhookData = {
        type: 'credit_window_alert',
        alerts: alerts,
        summary: {
          total: alerts.length,
          expiring: expiringAlerts.length,
          expired: expiredAlerts.length,
          critical: criticalAlerts.length
        },
        timestamp: new Date().toISOString()
      }

      console.log(`🔗 Would send webhook to ${webhookUrl}`)
      // In production: await sendWebhook(webhookUrl, webhookData)
      results.webhooksSent++
    } catch (error) {
      results.errors.push(`Webhook error: ${error.message}`)
    }
  }

  // Send Slack if configured
  if (slackWebhook) {
    try {
      const slackContent = generateSlackSummary(alerts, expiringAlerts, expiredAlerts, criticalAlerts)
      console.log(`💬 Would send Slack notification`)
      // In production: await sendSlackNotification(slackWebhook, slackContent)
      results.slackSent++
    } catch (error) {
      results.errors.push(`Slack error: ${error.message}`)
    }
  }

  return {
    sent: results.emailsSent + results.webhooksSent + results.slackSent,
    alerts: alerts,
    results
  }
}

/**
 * Generate email summary for cron notifications
 */
function generateEmailSummary(alerts: any[], expiring: any[], expired: any[], critical: any[]) {
  const subject = `🚨 Daglig Kreditfönster Rapport - ${alerts.length} varningar`

  return {
    subject,
    summary: `${critical.length} kritiska, ${expiring.length} går ut snart, ${expired.length} utgångna`
  }
}

/**
 * Generate Slack summary for cron notifications
 */
function generateSlackSummary(alerts: any[], expiring: any[], expired: any[], critical: any[]) {
  return {
    text: `🚨 Kreditfönster Rapport: ${critical.length} kritiska, ${expiring.length} går ut snart, ${expired.length} utgångna`
  }
}

/**
 * Log cron execution for monitoring
 */
async function logCronExecution(status: 'success' | 'error', message: string, data: any = {}) {
  await prisma.systemLog.create({
    data: {
      type: 'cron_execution',
      source: 'credit_notifications',
      message: `Cron ${status}: ${message}`,
      data: {
        status,
        executedAt: new Date(),
        ...data
      }
    }
  })
}

/**
 * Get last cron execution for health check
 */
async function getLastCronExecution() {
  return await prisma.systemLog.findFirst({
    where: {
      type: 'cron_execution',
      source: 'credit_notifications'
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
}