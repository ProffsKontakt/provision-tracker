import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db/prisma'

// Adversus API configuration
const ADVERSUS_BASE_URL = process.env.ADVERSUS_BASE_URL || 'https://api.adversus.com'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD

interface AdversusCallRecord {
  id: string
  agent_id: string
  agent_name: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_address?: string
  call_datetime: string
  call_duration: number
  call_status: 'success' | 'not_interested' | 'callback' | 'busy' | 'no_answer' | 'do_not_call' | 'wrong_number'
  lead_status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'appointment_booked' | 'sale' | 'closed_lost'
  appointment_id?: string
  notes?: string
  campaign_id: string
  campaign_name: string
  created_at: string
  updated_at: string
  custom_fields: {
    admin_check_status?: 'Godkänt' | 'Underkänt' | 'Pending' | ''
    admin_checked_by?: string
    admin_checked_at?: string
    lead_quality_score?: number
    callback_datetime?: string
    property_type?: string
    interest_level?: string
    bolag_assignment?: string
    lead_source?: string
    energy_interest?: string[]
    follow_up_required?: boolean
    sale_probability?: number
  }
}

interface AdversusApiResponse {
  success: boolean
  data: AdversusCallRecord[]
  pagination: {
    current_page: number
    total_pages: number
    total_records: number
    per_page: number
  }
}

// Get call records for the last 30 days with detailed analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('agentId')
    const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const dateTo = searchParams.get('dateTo') || new Date().toISOString()
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log('🔍 Fetching Adversus call records:', {
      agentId,
      dateFrom,
      dateTo,
      page,
      limit
    })

    if (!ADVERSUS_USERNAME || !ADVERSUS_PASSWORD) {
      console.log('⚠️ Adversus API not configured, returning mock call records data')
      return getMockCallRecordsData(agentId, dateFrom, dateTo, page, limit)
    }

    try {
      // Create Basic Auth header for Adversus
      const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

      // Fetch call records from Adversus API
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        page: page.toString(),
        limit: limit.toString(),
        include_call_details: 'true',
        include_custom_fields: 'true'
      })

      if (agentId) {
        params.append('agent_id', agentId)
      }

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/call-records?${params}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Adversus API error: ${response.status} ${response.statusText}`)
      }

      const data: AdversusApiResponse = await response.json()
      const callRecords = data.data || []

      // Process and analyze the call records
      const processedRecords = await processCallRecords(callRecords)
      const analytics = generateCallAnalytics(processedRecords)

      return NextResponse.json({
        success: true,
        data: processedRecords,
        analytics,
        pagination: data.pagination,
        source: 'adversus_api',
        dateRange: { from: dateFrom, to: dateTo },
        timestamp: new Date().toISOString()
      })

    } catch (apiError) {
      console.error('❌ Adversus API error:', apiError)
      // Fallback to mock data if API fails
      return getMockCallRecordsData(agentId, dateFrom, dateTo, page, limit)
    }

  } catch (error) {
    console.error('❌ Error fetching Adversus call records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call records from Adversus' },
      { status: 500 }
    )
  }
}

// Process call records and enrich with local data
async function processCallRecords(callRecords: AdversusCallRecord[]) {
  return Promise.all(callRecords.map(async (record) => {
    // Try to find matching user in our database
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { adversusAgentId: record.agent_id },
          { name: { contains: record.agent_name, mode: 'insensitive' } }
        ]
      }
    })

    // Try to find existing lead in our database
    const existingLead = await prisma.adversusLead.findFirst({
      where: {
        OR: [
          { customerName: record.customer_name },
          { adversusCallId: record.id }
        ]
      }
    })

    return {
      id: record.id,
      agentId: record.agent_id,
      agentName: record.agent_name,
      localUserId: user?.id,
      localUserName: user?.name,
      customerName: record.customer_name,
      customerPhone: record.customer_phone,
      customerEmail: record.customer_email,
      customerAddress: record.customer_address,
      callDateTime: record.call_datetime,
      callDuration: record.call_duration,
      callStatus: record.call_status,
      leadStatus: record.lead_status,
      appointmentId: record.appointment_id,
      notes: record.notes,
      campaignId: record.campaign_id,
      campaignName: record.campaign_name,
      adminCheckStatus: record.custom_fields.admin_check_status || '',
      adminCheckedBy: record.custom_fields.admin_checked_by,
      adminCheckedAt: record.custom_fields.admin_checked_at,
      leadQualityScore: record.custom_fields.lead_quality_score || 0,
      propertyType: record.custom_fields.property_type,
      interestLevel: record.custom_fields.interest_level,
      bolagAssignment: record.custom_fields.bolag_assignment,
      leadSource: record.custom_fields.lead_source,
      energyInterest: record.custom_fields.energy_interest || [],
      followUpRequired: record.custom_fields.follow_up_required || false,
      saleProbability: record.custom_fields.sale_probability || 0,
      isInLocalDatabase: !!existingLead,
      localLeadId: existingLead?.id,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    }
  }))
}

// Generate analytics from call records
function generateCallAnalytics(records: any[]) {
  const totalCalls = records.length

  // Call status breakdown
  const callStatusBreakdown = records.reduce((acc, record) => {
    acc[record.callStatus] = (acc[record.callStatus] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Lead status breakdown
  const leadStatusBreakdown = records.reduce((acc, record) => {
    acc[record.leadStatus] = (acc[record.leadStatus] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Admin check status breakdown
  const adminCheckBreakdown = records.reduce((acc, record) => {
    const status = record.adminCheckStatus || 'Not Checked'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Success rate calculations
  const successfulCalls = records.filter(r => r.callStatus === 'success').length
  const interestedLeads = records.filter(r => r.leadStatus === 'interested' || r.leadStatus === 'appointment_booked' || r.leadStatus === 'sale').length
  const appointmentsBooked = records.filter(r => r.appointmentId).length
  const approvedByAdmin = records.filter(r => r.adminCheckStatus === 'Godkänt').length
  const rejectedByAdmin = records.filter(r => r.adminCheckStatus === 'Underkänt').length

  // Agent performance
  const agentPerformance = records.reduce((acc, record) => {
    const agentName = record.agentName
    if (!acc[agentName]) {
      acc[agentName] = {
        totalCalls: 0,
        successfulCalls: 0,
        interestedLeads: 0,
        appointmentsBooked: 0,
        approvedLeads: 0,
        rejectedLeads: 0,
        averageCallDuration: 0,
        totalCallDuration: 0
      }
    }

    acc[agentName].totalCalls++
    acc[agentName].totalCallDuration += record.callDuration

    if (record.callStatus === 'success') acc[agentName].successfulCalls++
    if (record.leadStatus === 'interested' || record.leadStatus === 'appointment_booked' || record.leadStatus === 'sale') {
      acc[agentName].interestedLeads++
    }
    if (record.appointmentId) acc[agentName].appointmentsBooked++
    if (record.adminCheckStatus === 'Godkänt') acc[agentName].approvedLeads++
    if (record.adminCheckStatus === 'Underkänt') acc[agentName].rejectedLeads++

    return acc
  }, {} as Record<string, any>)

  // Calculate averages
  Object.keys(agentPerformance).forEach(agentName => {
    const agent = agentPerformance[agentName]
    agent.averageCallDuration = agent.totalCalls > 0 ? agent.totalCallDuration / agent.totalCalls : 0
    agent.successRate = agent.totalCalls > 0 ? (agent.successfulCalls / agent.totalCalls * 100) : 0
    agent.conversionRate = agent.totalCalls > 0 ? (agent.interestedLeads / agent.totalCalls * 100) : 0
    agent.appointmentRate = agent.totalCalls > 0 ? (agent.appointmentsBooked / agent.totalCalls * 100) : 0
    agent.approvalRate = (agent.approvedLeads + agent.rejectedLeads) > 0 ?
      (agent.approvedLeads / (agent.approvedLeads + agent.rejectedLeads) * 100) : 0
  })

  return {
    totalCalls,
    successfulCalls,
    interestedLeads,
    appointmentsBooked,
    successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100) : 0,
    conversionRate: totalCalls > 0 ? (interestedLeads / totalCalls * 100) : 0,
    appointmentRate: totalCalls > 0 ? (appointmentsBooked / totalCalls * 100) : 0,
    adminApprovalRate: (approvedByAdmin + rejectedByAdmin) > 0 ?
      (approvedByAdmin / (approvedByAdmin + rejectedByAdmin) * 100) : 0,
    callStatusBreakdown,
    leadStatusBreakdown,
    adminCheckBreakdown,
    agentPerformance
  }
}

// Mock data function for development/testing
function getMockCallRecordsData(agentId: string | null, dateFrom: string, dateTo: string, page: number, limit: number) {
  const mockRecords = [
    {
      id: 'call_001',
      agentId: 'agent_moltas',
      agentName: 'Moltas Roslund',
      customerName: 'Anna Andersson',
      customerPhone: '+46701234567',
      customerEmail: 'anna.andersson@email.com',
      customerAddress: 'Storgatan 123, 111 11 Stockholm',
      callDateTime: '2024-09-28T09:15:00Z',
      callDuration: 285,
      callStatus: 'success',
      leadStatus: 'appointment_booked',
      appointmentId: 'apt_001',
      notes: 'Kund mycket intresserad av solceller för villa. Bokade möte nästa vecka.',
      campaignId: 'solar_campaign_2024',
      campaignName: 'Solceller Stockholm 2024',
      adminCheckStatus: 'Godkänt',
      adminCheckedBy: 'Admin User',
      adminCheckedAt: '2024-09-28T10:30:00Z',
      leadQualityScore: 9,
      propertyType: 'Villa',
      interestLevel: 'High',
      bolagAssignment: 'SolarTech Stockholm AB',
      leadSource: 'Google Ads',
      energyInterest: ['Solceller', 'Värmepump'],
      followUpRequired: false,
      saleProbability: 85,
      createdAt: '2024-09-28T09:15:00Z',
      updatedAt: '2024-09-28T10:30:00Z'
    },
    {
      id: 'call_002',
      agentId: 'agent_moltas',
      agentName: 'Moltas Roslund',
      customerName: 'Lars Nilsson',
      customerPhone: '+46709876543',
      customerEmail: 'lars.nilsson@email.com',
      customerAddress: 'Kungsgatan 45, 222 22 Göteborg',
      callDateTime: '2024-09-28T10:30:00Z',
      callDuration: 180,
      callStatus: 'not_interested',
      leadStatus: 'not_interested',
      notes: 'Kund inte intresserad längre, har redan installerat solceller.',
      campaignId: 'solar_campaign_2024',
      campaignName: 'Solceller Stockholm 2024',
      adminCheckStatus: 'Underkänt',
      adminCheckedBy: 'Admin User',
      adminCheckedAt: '2024-09-28T11:00:00Z',
      leadQualityScore: 2,
      propertyType: 'Villa',
      interestLevel: 'None',
      leadSource: 'Facebook Ads',
      energyInterest: [],
      followUpRequired: false,
      saleProbability: 0,
      createdAt: '2024-09-28T10:30:00Z',
      updatedAt: '2024-09-28T11:00:00Z'
    },
    {
      id: 'call_003',
      agentId: 'agent_gustaf',
      agentName: 'Gustaf Linder',
      customerName: 'Maria Larsson',
      customerPhone: '+46705551234',
      customerEmail: 'maria.larsson@email.com',
      customerAddress: 'Vasagatan 67, 333 33 Malmö',
      callDateTime: '2024-09-27T14:20:00Z',
      callDuration: 420,
      callStatus: 'success',
      leadStatus: 'interested',
      notes: 'Kund vill ha mer information. Skickar info via mail och ringer upp nästa vecka.',
      campaignId: 'solar_campaign_2024',
      campaignName: 'Solceller Stockholm 2024',
      adminCheckStatus: '',
      leadQualityScore: 7,
      propertyType: 'Lägenhet',
      interestLevel: 'Medium',
      leadSource: 'Organic Search',
      energyInterest: ['Solceller'],
      followUpRequired: true,
      saleProbability: 60,
      createdAt: '2024-09-27T14:20:00Z',
      updatedAt: '2024-09-27T14:27:00Z'
    },
    {
      id: 'call_004',
      agentId: 'agent_carl',
      agentName: 'Carl Brun',
      customerName: 'Erik Johansson',
      customerPhone: '+46708887777',
      customerEmail: 'erik.johansson@email.com',
      customerAddress: 'Drottninggatan 89, 444 44 Uppsala',
      callDateTime: '2024-09-27T11:45:00Z',
      callDuration: 95,
      callStatus: 'callback',
      leadStatus: 'contacted',
      notes: 'Kund upptagen, vill att vi ringer tillbaka imorgon kl 15:00.',
      campaignId: 'heatpump_campaign_2024',
      campaignName: 'Värmepumpar Sverige 2024',
      adminCheckStatus: '',
      leadQualityScore: 5,
      propertyType: 'Villa',
      interestLevel: 'Medium',
      leadSource: 'Cold Call',
      energyInterest: ['Värmepump'],
      followUpRequired: true,
      saleProbability: 40,
      createdAt: '2024-09-27T11:45:00Z',
      updatedAt: '2024-09-27T11:46:00Z'
    },
    {
      id: 'call_005',
      agentId: 'agent_frank',
      agentName: 'Frank Omsén',
      customerName: 'Petra Svensson',
      customerPhone: '+46703334444',
      customerEmail: 'petra.svensson@email.com',
      customerAddress: 'Linnégatan 12, 555 55 Linköping',
      callDateTime: '2024-09-26T16:10:00Z',
      callDuration: 350,
      callStatus: 'success',
      leadStatus: 'sale',
      appointmentId: 'apt_002',
      notes: 'Kund tecknate avtal direkt på telefon! Fantastiskt resultat.',
      campaignId: 'solar_campaign_2024',
      campaignName: 'Solceller Stockholm 2024',
      adminCheckStatus: 'Godkänt',
      adminCheckedBy: 'Admin User',
      adminCheckedAt: '2024-09-26T17:00:00Z',
      leadQualityScore: 10,
      propertyType: 'Villa',
      interestLevel: 'Very High',
      bolagAssignment: 'Green Energy Nordic',
      leadSource: 'Referral',
      energyInterest: ['Solceller', 'Värmepump', 'Batterilager'],
      followUpRequired: false,
      saleProbability: 100,
      createdAt: '2024-09-26T16:10:00Z',
      updatedAt: '2024-09-26T17:00:00Z'
    }
  ]

  // Filter by agent if specified
  const filteredRecords = agentId ?
    mockRecords.filter(record => record.agentId === agentId) :
    mockRecords

  const analytics = generateCallAnalytics(filteredRecords)

  return NextResponse.json({
    success: true,
    data: filteredRecords,
    analytics,
    pagination: {
      current_page: page,
      total_pages: 1,
      total_records: filteredRecords.length,
      per_page: limit
    },
    source: 'mock_data',
    dateRange: { from: dateFrom, to: dateTo },
    timestamp: new Date().toISOString()
  })
}

// POST endpoint for updating call record admin status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { callId, adminCheckStatus, notes } = body

    if (!callId || !adminCheckStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update in Adversus via API (if configured)
    if (ADVERSUS_USERNAME && ADVERSUS_PASSWORD) {
      try {
        const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

        const response = await fetch(
          `${ADVERSUS_BASE_URL}/call-records/${callId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              custom_fields: {
                admin_check_status: adminCheckStatus,
                admin_checked_by: session.user.name,
                admin_checked_at: new Date().toISOString(),
                admin_notes: notes
              }
            })
          }
        )

        if (!response.ok) {
          throw new Error(`Adversus API error: ${response.status}`)
        }

        console.log(`✅ Updated call record ${callId} in Adversus:`, { adminCheckStatus, notes })

      } catch (apiError) {
        console.error('❌ Failed to update Adversus call record:', apiError)
        // Continue with local update even if Adversus update fails
      }
    }

    // Log the admin action locally
    await prisma.systemLog.create({
      data: {
        type: 'admin_call_review',
        source: 'admin_panel',
        message: `Admin ${session.user.name} marked call ${callId} as ${adminCheckStatus}`,
        data: {
          callId,
          adminCheckStatus,
          adminUserId: session.user.id,
          adminUserName: session.user.name,
          notes,
          timestamp: new Date()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Call record admin status updated successfully',
      data: {
        callId,
        adminCheckStatus,
        adminCheckedBy: session.user.name,
        adminCheckedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error updating call record admin status:', error)
    return NextResponse.json(
      { error: 'Failed to update call record admin status' },
      { status: 500 }
    )
  }
}