import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

// Webhook secret for verification (set in environment variables)
const WEBHOOK_SECRET = process.env.ADVERSUS_WEBHOOK_SECRET || 'development-secret'

interface AdversusWebhookPayload {
  event_type: 'lead_status_updated' | 'appointment_booked' | 'call_completed' | 'lead_created'
  timestamp: string
  appointment?: {
    id: string
    agent_id: string
    agent_name: string
    customer_name: string
    customer_phone: string
    customer_email?: string
    customer_address?: string
    appointment_datetime: string
    status: 'booked' | 'confirmed' | 'completed' | 'cancelled'
    campaign_id: string
    campaign_name: string
    lead_source: string
    custom_fields: {
      bolag_1?: string
      bolag_1_leadtype?: string
      bolag_2?: string
      bolag_2_leadtype?: string
      bolag_3?: string
      bolag_3_leadtype?: string
      bolag_4?: string
      bolag_4_leadtype?: string
      property_type?: string
      energy_interest?: string[]
      admin_status?: 'pending' | 'approved' | 'rejected'
      lead_quality_score?: number
      interest_level?: string
      sale_probability?: number
    }
  }
  call?: {
    id: string
    agent_id: string
    agent_name: string
    customer_name: string
    customer_phone: string
    call_datetime: string
    call_duration: number
    call_status: 'success' | 'not_interested' | 'callback' | 'busy' | 'no_answer' | 'do_not_call' | 'wrong_number'
    lead_status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'appointment_booked' | 'sale' | 'closed_lost'
    notes?: string
    campaign_id: string
    custom_fields: {
      admin_check_status?: 'Godkänt' | 'Underkänt' | 'Pending' | ''
      lead_quality_score?: number
      property_type?: string
      interest_level?: string
    }
  }
  lead?: {
    id: string
    customer_name: string
    customer_phone: string
    customer_email?: string
    status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'qualified' | 'appointment_booked' | 'sale' | 'closed_lost'
    agent_id: string
    agent_name: string
    campaign_id: string
    lead_source: string
    created_at: string
    updated_at: string
    custom_fields: Record<string, any>
  }
}

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  const expectedSignatureWithPrefix = `sha256=${expectedSignature}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignatureWithPrefix)
  )
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-adversus-signature') || ''

    console.log('🔗 Adversus webhook received:', {
      hasSignature: !!signature,
      bodyLength: rawBody.length,
      timestamp: new Date().toISOString()
    })

    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the payload
    const payload: AdversusWebhookPayload = JSON.parse(rawBody)

    console.log('📥 Processing Adversus webhook:', {
      eventType: payload.event_type,
      timestamp: payload.timestamp
    })

    // Log webhook for debugging
    await prisma.systemLog.create({
      data: {
        type: 'adversus_webhook',
        source: 'adversus',
        message: `Received ${payload.event_type} webhook from Adversus`,
        data: {
          eventType: payload.event_type,
          timestamp: payload.timestamp,
          payload: payload
        }
      }
    })

    // Process different event types
    switch (payload.event_type) {
      case 'lead_status_updated':
        await handleLeadStatusUpdate(payload)
        break

      case 'appointment_booked':
        await handleAppointmentBooked(payload)
        break

      case 'call_completed':
        await handleCallCompleted(payload)
        break

      case 'lead_created':
        await handleLeadCreated(payload)
        break

      default:
        console.log(`⚠️ Unknown event type: ${payload.event_type}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      eventType: payload.event_type,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error processing Adversus webhook:', error)

    // Log error
    await prisma.systemLog.create({
      data: {
        type: 'adversus_webhook_error',
        source: 'adversus',
        message: `Error processing Adversus webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      }
    })

    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

// Handle lead status updates
async function handleLeadStatusUpdate(payload: AdversusWebhookPayload) {
  if (!payload.lead) return

  const { lead } = payload

  console.log('🔄 Processing lead status update:', {
    leadId: lead.id,
    customerName: lead.customer_name,
    status: lead.status,
    agentName: lead.agent_name
  })

  try {
    // Find the user (setter) in our system
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { adversusAgentId: lead.agent_id },
          { name: { contains: lead.agent_name, mode: 'insensitive' } }
        ]
      }
    })

    // Update or create the lead in our database
    const existingLead = await prisma.adversusLead.findFirst({
      where: {
        OR: [
          { adversusLeadId: lead.id },
          { customerName: lead.customer_name, customerPhone: lead.customer_phone }
        ]
      }
    })

    const leadData = {
      adversusLeadId: lead.id,
      customerName: lead.customer_name,
      customerPhone: lead.customer_phone,
      customerEmail: lead.customer_email,
      adversusStatus: lead.status,
      leadSource: lead.lead_source,
      campaignId: lead.campaign_id,
      userId: user?.id,
      createdAt: new Date(lead.created_at),
      updatedAt: new Date(lead.updated_at),
      customFields: lead.custom_fields
    }

    if (existingLead) {
      await prisma.adversusLead.update({
        where: { id: existingLead.id },
        data: leadData
      })
      console.log('✅ Updated existing lead in database')
    } else {
      await prisma.adversusLead.create({
        data: leadData
      })
      console.log('✅ Created new lead in database')
    }

    // If lead status is "success" and we have a user, potentially create commission
    if (lead.status === 'sale' && user) {
      await handleSuccessfulSale(lead, user)
    }

  } catch (error) {
    console.error('❌ Error handling lead status update:', error)
  }
}

// Handle appointment booking
async function handleAppointmentBooked(payload: AdversusWebhookPayload) {
  if (!payload.appointment) return

  const { appointment } = payload

  console.log('📅 Processing appointment booking:', {
    appointmentId: appointment.id,
    customerName: appointment.customer_name,
    agentName: appointment.agent_name,
    datetime: appointment.appointment_datetime
  })

  try {
    // Find the user (setter) in our system
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { adversusAgentId: appointment.agent_id },
          { name: { contains: appointment.agent_name, mode: 'insensitive' } }
        ]
      }
    })

    // Create or update the lead with appointment information
    const leadData = {
      adversusLeadId: appointment.id,
      customerName: appointment.customer_name,
      customerPhone: appointment.customer_phone,
      customerEmail: appointment.customer_email,
      customerAddress: appointment.customer_address,
      appointmentDate: new Date(appointment.appointment_datetime),
      adversusStatus: appointment.status,
      campaignId: appointment.campaign_id,
      leadSource: appointment.lead_source,
      userId: user?.id,
      bolag1: appointment.custom_fields.bolag_1,
      bolag1LeadType: appointment.custom_fields.bolag_1_leadtype,
      bolag2: appointment.custom_fields.bolag_2,
      bolag2LeadType: appointment.custom_fields.bolag_2_leadtype,
      bolag3: appointment.custom_fields.bolag_3,
      bolag3LeadType: appointment.custom_fields.bolag_3_leadtype,
      bolag4: appointment.custom_fields.bolag_4,
      bolag4LeadType: appointment.custom_fields.bolag_4_leadtype,
      adminStatus: appointment.custom_fields.admin_status || 'pending'
    }

    await prisma.adversusLead.upsert({
      where: {
        adversusLeadId: appointment.id
      },
      update: leadData,
      create: leadData
    })

    console.log('✅ Processed appointment booking successfully')

  } catch (error) {
    console.error('❌ Error handling appointment booking:', error)
  }
}

// Handle call completion
async function handleCallCompleted(payload: AdversusWebhookPayload) {
  if (!payload.call) return

  const { call } = payload

  console.log('📞 Processing call completion:', {
    callId: call.id,
    customerName: call.customer_name,
    agentName: call.agent_name,
    callStatus: call.call_status,
    duration: call.call_duration
  })

  try {
    // Find the user (setter) in our system
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { adversusAgentId: call.agent_id },
          { name: { contains: call.agent_name, mode: 'insensitive' } }
        ]
      }
    })

    // Log the call in our system logs for analytics
    await prisma.systemLog.create({
      data: {
        type: 'adversus_call_completed',
        source: 'adversus',
        message: `Call completed: ${call.call_status} (${call.call_duration}s)`,
        data: {
          callId: call.id,
          agentId: call.agent_id,
          agentName: call.agent_name,
          customerName: call.customer_name,
          customerPhone: call.customer_phone,
          callDuration: call.call_duration,
          callStatus: call.call_status,
          leadStatus: call.lead_status,
          notes: call.notes,
          campaignId: call.campaign_id,
          customFields: call.custom_fields,
          userId: user?.id,
          timestamp: new Date(call.call_datetime)
        }
      }
    })

    console.log('✅ Logged call completion successfully')

  } catch (error) {
    console.error('❌ Error handling call completion:', error)
  }
}

// Handle new lead creation
async function handleLeadCreated(payload: AdversusWebhookPayload) {
  if (!payload.lead) return

  const { lead } = payload

  console.log('🆕 Processing new lead creation:', {
    leadId: lead.id,
    customerName: lead.customer_name,
    agentName: lead.agent_name,
    leadSource: lead.lead_source
  })

  try {
    // Find the user (setter) in our system
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { adversusAgentId: lead.agent_id },
          { name: { contains: lead.agent_name, mode: 'insensitive' } }
        ]
      }
    })

    // Create the lead in our database
    await prisma.adversusLead.create({
      data: {
        adversusLeadId: lead.id,
        customerName: lead.customer_name,
        customerPhone: lead.customer_phone,
        customerEmail: lead.customer_email,
        adversusStatus: lead.status,
        leadSource: lead.lead_source,
        campaignId: lead.campaign_id,
        userId: user?.id,
        createdAt: new Date(lead.created_at),
        customFields: lead.custom_fields
      }
    })

    console.log('✅ Created new lead successfully')

  } catch (error) {
    console.error('❌ Error handling lead creation:', error)
  }
}

// Handle successful sales - create commissions
async function handleSuccessfulSale(lead: any, user: any) {
  console.log('💰 Processing successful sale for commission creation:', {
    leadId: lead.id,
    customerName: lead.customer_name,
    userId: user.id,
    userName: user.name
  })

  try {
    // Check if commission already exists
    const existingCommission = await prisma.commission.findFirst({
      where: {
        adversusLeadId: lead.id
      }
    })

    if (existingCommission) {
      console.log('⚠️ Commission already exists for this lead')
      return
    }

    // Determine commission amount based on lead custom fields or default rates
    const leadType = lead.custom_fields?.bolag_1_leadtype || 'Standard Lead'
    const commissionAmount = calculateCommissionAmount(leadType, lead.custom_fields)

    // Create commission record
    await prisma.commission.create({
      data: {
        userId: user.id,
        adversusLeadId: lead.id,
        leadType: leadType,
        leadTypeAmount: commissionAmount,
        companyName: lead.custom_fields?.bolag_1 || 'Unknown Company',
        status: 'PENDING', // Will be reviewed by admin
        createdAt: new Date(),
        metadata: {
          leadSource: lead.lead_source,
          campaignId: lead.campaign_id,
          customerName: lead.customer_name,
          autoCreatedFromWebhook: true,
          leadQualityScore: lead.custom_fields?.lead_quality_score,
          saleProbability: lead.custom_fields?.sale_probability
        }
      }
    })

    console.log('✅ Created commission for successful sale')

  } catch (error) {
    console.error('❌ Error creating commission for successful sale:', error)
  }
}

// Calculate commission amount based on lead type and custom fields
function calculateCommissionAmount(leadType: string, customFields: any): number {
  // Default commission rates (these should be configurable)
  const commissionRates: Record<string, number> = {
    'Villa - Solceller': 1500,
    'Villa - Värmepump': 1200,
    'Villa - Vindkraft': 1000,
    'Lägenhet - Solceller': 800,
    'Lägenhet - Värmepump': 600,
    'Företag - Solceller': 2000,
    'Företag - Värmepump': 1800,
    'Standard Lead': 1000
  }

  let baseAmount = commissionRates[leadType] || commissionRates['Standard Lead']

  // Apply quality score multiplier if available
  if (customFields?.lead_quality_score) {
    const qualityMultiplier = customFields.lead_quality_score / 10
    baseAmount = Math.round(baseAmount * qualityMultiplier)
  }

  // Apply sale probability bonus if very high
  if (customFields?.sale_probability >= 90) {
    baseAmount = Math.round(baseAmount * 1.2) // 20% bonus for high probability sales
  }

  return baseAmount
}

// GET endpoint for webhook verification/health check
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')

  if (challenge) {
    // Webhook verification challenge
    return NextResponse.json({ challenge })
  }

  // Health check
  return NextResponse.json({
    status: 'ok',
    service: 'Adversus Webhook Handler',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
}