import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const notificationSettingsSchema = z.object({
  enableDaily: z.boolean().default(true),
  enableExpiring: z.boolean().default(true),
  expiringDays: z.number().min(1).max(14).default(3),
  emailRecipients: z.array(z.string().email()),
  webhookUrl: z.string().url().optional(),
  slackWebhook: z.string().url().optional()
})

/**
 * GET /api/admin/credit-notifications
 * Get credit window notifications and settings
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'check') {
      // Check current credit window status
      const alerts = await getCreditWindowAlerts()

      return NextResponse.json({
        alerts,
        summary: {
          total: alerts.length,
          expiring: alerts.filter(a => a.status === 'expiring').length,
          expired: alerts.filter(a => a.status === 'expired').length,
          active: alerts.filter(a => a.status === 'active').length
        }
      })
    }

    if (action === 'settings') {
      // Get notification settings
      const settings = await getNotificationSettings()
      return NextResponse.json({ settings })
    }

    // Default: get recent notifications sent
    const notifications = await prisma.systemLog.findMany({
      where: {
        type: 'credit_notification',
        source: 'auto_notification'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return NextResponse.json({ notifications })

  } catch (error) {
    console.error('Credit notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credit notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/credit-notifications
 * Send manual credit window notifications or update settings
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'send_manual') {
      // Send immediate notification
      const result = await sendCreditWindowNotifications(true)

      return NextResponse.json({
        message: 'Manual notifications sent',
        result
      })
    }

    if (action === 'update_settings') {
      // Update notification settings
      const settings = notificationSettingsSchema.parse(body.settings)
      await updateNotificationSettings(settings)

      return NextResponse.json({
        message: 'Notification settings updated',
        settings
      })
    }

    if (action === 'test') {
      // Send test notification
      const testResult = await sendTestNotification(body.recipient)

      return NextResponse.json({
        message: 'Test notification sent',
        result: testResult
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Credit notification action error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process notification action' },
      { status: 500 }
    )
  }
}

/**
 * Core function to get credit window alerts
 */
async function getCreditWindowAlerts() {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))

  const alertLeadShares = await prisma.leadShare.findMany({
    where: {
      creditWindowExpires: {
        lte: threeDaysFromNow // Show alerts for leads expiring within 3 days
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

  // Group by deal and calculate status
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
 * Send credit window notifications
 */
async function sendCreditWindowNotifications(isManual = false) {
  const settings = await getNotificationSettings()
  const alerts = await getCreditWindowAlerts()

  if (alerts.length === 0) {
    await prisma.systemLog.create({
      data: {
        type: 'credit_notification',
        source: isManual ? 'manual' : 'auto_notification',
        message: 'No credit window alerts to send',
        data: { alertCount: 0 }
      }
    })
    return { sent: 0, alerts: [] }
  }

  const results = {
    emailsSent: 0,
    webhooksSent: 0,
    slackSent: 0,
    errors: []
  }

  // Prepare notification content
  const expiringAlerts = alerts.filter(a => a.status === 'expiring')
  const expiredAlerts = alerts.filter(a => a.status === 'expired')
  const criticalAlerts = alerts.filter(a => a.urgency === 'critical')

  const emailContent = generateEmailContent(alerts, expiringAlerts, expiredAlerts, criticalAlerts)
  const slackContent = generateSlackContent(alerts, expiringAlerts, expiredAlerts, criticalAlerts)

  // Send emails
  if (settings.enableDaily && settings.emailRecipients.length > 0) {
    try {
      for (const recipient of settings.emailRecipients) {
        await sendEmail(recipient, emailContent)
        results.emailsSent++
      }
    } catch (error) {
      results.errors.push(`Email error: ${error.message}`)
    }
  }

  // Send webhook notifications
  if (settings.webhookUrl) {
    try {
      await sendWebhook(settings.webhookUrl, {
        type: 'credit_window_alert',
        alerts: alerts,
        summary: {
          total: alerts.length,
          expiring: expiringAlerts.length,
          expired: expiredAlerts.length,
          critical: criticalAlerts.length
        },
        timestamp: new Date().toISOString()
      })
      results.webhooksSent++
    } catch (error) {
      results.errors.push(`Webhook error: ${error.message}`)
    }
  }

  // Send Slack notifications
  if (settings.slackWebhook) {
    try {
      await sendSlackNotification(settings.slackWebhook, slackContent)
      results.slackSent++
    } catch (error) {
      results.errors.push(`Slack error: ${error.message}`)
    }
  }

  // Log the notification
  await prisma.systemLog.create({
    data: {
      type: 'credit_notification',
      source: isManual ? 'manual' : 'auto_notification',
      message: `Credit window notifications sent: ${alerts.length} alerts`,
      data: {
        alertCount: alerts.length,
        expiringCount: expiringAlerts.length,
        expiredCount: expiredAlerts.length,
        criticalCount: criticalAlerts.length,
        results
      }
    }
  })

  return {
    sent: results.emailsSent + results.webhooksSent + results.slackSent,
    alerts: alerts,
    results
  }
}

/**
 * Generate email content for notifications
 */
function generateEmailContent(alerts: any[], expiring: any[], expired: any[], critical: any[]) {
  const subject = `🚨 Kreditfönster varning - ${alerts.length} leads kräver uppmärksamhet`

  const html = `
    <h2>Kreditfönster Status - ${new Date().toLocaleDateString('sv-SE')}</h2>

    <div style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <h3 style="color: #dc2626; margin: 0;">Sammanfattning</h3>
      <ul style="margin: 10px 0;">
        <li><strong>${critical.length}</strong> kritiska (≤1 dag kvar)</li>
        <li><strong>${expiring.length}</strong> går ut snart (≤3 dagar)</li>
        <li><strong>${expired.length}</strong> redan utgångna</li>
        <li><strong>${alerts.length}</strong> totalt antal varningar</li>
      </ul>
    </div>

    ${critical.length > 0 ? `
    <div style="background: #fef2f2; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc2626;">
      <h3 style="color: #dc2626;">🔴 KRITISKA VARNINGAR (≤1 dag kvar)</h3>
      ${critical.map(alert => `
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
          <strong>Lead #${alert.dealId}</strong> - ${alert.dealTitle}<br>
          <small>Öppnare: ${alert.opener} | Dagar kvar: ${alert.daysRemaining}</small><br>
          <small>Bolag: ${alert.companies.map(c => c.name).join(', ')}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${expiring.length > 0 ? `
    <div style="background: #fefce8; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #eab308;">
      <h3 style="color: #eab308;">🟡 GÅR UT SNART (≤3 dagar)</h3>
      ${expiring.map(alert => `
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
          <strong>Lead #${alert.dealId}</strong> - ${alert.dealTitle}<br>
          <small>Öppnare: ${alert.opener} | Dagar kvar: ${alert.daysRemaining}</small><br>
          <small>Bolag: ${alert.companies.map(c => c.name).join(', ')}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${expired.length > 0 ? `
    <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6b7280;">
      <h3 style="color: #6b7280;">⚫ UTGÅNGNA</h3>
      ${expired.map(alert => `
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
          <strong>Lead #${alert.dealId}</strong> - ${alert.dealTitle}<br>
          <small>Öppnare: ${alert.opener} | Utgången för ${Math.abs(alert.daysRemaining)} dagar sedan</small><br>
          <small>Bolag: ${alert.companies.map(c => c.name).join(', ')}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <p><small>Denna rapport genererades automatiskt av ProffsKontakt Openersystem</small></p>
  `

  return { subject, html }
}

/**
 * Generate Slack content for notifications
 */
function generateSlackContent(alerts: any[], expiring: any[], expired: any[], critical: any[]) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Kreditfönster Varning - ${alerts.length} leads`
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Kritiska:* ${critical.length}`
        },
        {
          type: "mrkdwn",
          text: `*Går ut snart:* ${expiring.length}`
        },
        {
          type: "mrkdwn",
          text: `*Utgångna:* ${expired.length}`
        },
        {
          type: "mrkdwn",
          text: `*Totalt:* ${alerts.length}`
        }
      ]
    }
  ]

  if (critical.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔴 KRITISKA VARNINGAR:*\n${critical.map(alert =>
          `• Lead #${alert.dealId} (${alert.opener}) - ${alert.daysRemaining} dagar kvar`
        ).join('\n')}`
      }
    })
  }

  return { blocks }
}

/**
 * Send email notification
 */
async function sendEmail(recipient: string, content: any) {
  // This would integrate with your email service (SendGrid, Nodemailer, etc.)
  console.log(`Would send email to ${recipient}: ${content.subject}`)

  // In production, implement actual email sending:
  // await emailService.send({
  //   to: recipient,
  //   subject: content.subject,
  //   html: content.html
  // })

  return true
}

/**
 * Send webhook notification
 */
async function sendWebhook(url: string, data: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(webhookUrl: string, content: any) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content)
  })

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.statusText}`)
  }

  return true
}

/**
 * Send test notification
 */
async function sendTestNotification(recipient: string) {
  const testContent = {
    subject: '🧪 Test Kreditfönster Notification',
    html: `
      <h2>Test Notification</h2>
      <p>Detta är ett test av kreditfönster-notifikationssystemet.</p>
      <p>Skickat: ${new Date().toLocaleString('sv-SE')}</p>
      <p>Systemet fungerar korrekt!</p>
    `
  }

  await sendEmail(recipient, testContent)

  return { recipient, sent: true, timestamp: new Date() }
}

/**
 * Get notification settings (from environment or database)
 */
async function getNotificationSettings() {
  // For now, return default settings
  // In production, store these in database or environment variables
  return {
    enableDaily: true,
    enableExpiring: true,
    expiringDays: 3,
    emailRecipients: ['julian@proffskontakt.se'],
    webhookUrl: process.env.CREDIT_NOTIFICATION_WEBHOOK,
    slackWebhook: process.env.SLACK_WEBHOOK_URL
  }
}

/**
 * Update notification settings
 */
async function updateNotificationSettings(settings: any) {
  // In production, store these settings in database
  console.log('Would update notification settings:', settings)

  // Log the update
  await prisma.systemLog.create({
    data: {
      type: 'settings_update',
      source: 'admin',
      message: 'Credit notification settings updated',
      data: settings
    }
  })

  return settings
}