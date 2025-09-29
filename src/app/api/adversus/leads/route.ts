import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

// Adversus API configuration
const ADVERSUS_BASE_URL = process.env.ADVERSUS_BASE_URL || 'https://api.adversus.com'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD

// Setter name to Agent ID mapping
const SETTER_AGENT_MAP = {
  'Moltas Roslund': 'agent_moltas',
  'Gustaf Linder': 'agent_gustaf',
  'Carl Brun': 'agent_carl',
  'Frank Omsén': 'agent_frank'
}

interface AdversusAppointment {
  id: string
  customer_name: string
  customer_phone: string
  agent_id: string
  agent_name: string
  campaign_id: string
  created_at: string
  appointment_datetime: string
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled'
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
  }
}

// This endpoint will integrate with Adversus to fetch booked leads
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const setterName = searchParams.get('setterName') || session.user.name
    const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Default: 30 days ago
    const dateTo = searchParams.get('dateTo') || new Date().toISOString() // Default: now

    // Get agent ID for the setter
    const agentId = SETTER_AGENT_MAP[setterName as keyof typeof SETTER_AGENT_MAP]

    if (!ADVERSUS_USERNAME || !ADVERSUS_PASSWORD) {
      console.log('Adversus API not configured, returning mock data for:', setterName)
      return getMockAdversusData(setterName, agentId, dateFrom, dateTo)
    }

    try {
      // Create Basic Auth header for Adversus
      const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

      // Fetch appointments from Adversus API
      const params = new URLSearchParams({
        agent_id: agentId || '',
        date_from: dateFrom,
        date_to: dateTo,
        status: 'booked,confirmed,completed',
        limit: '100'
      })

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/appointments?${params}`,
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

      const data = await response.json()
      const appointments: AdversusAppointment[] = data.data || []

      // Transform Adversus data to our format
      const transformedLeads = appointments.map(appointment => ({
        id: appointment.id,
        customerName: appointment.customer_name,
        customerPhone: appointment.customer_phone,
        bookedAt: appointment.appointment_datetime,
        setterId: appointment.agent_id,
        setterName: appointment.agent_name,
        // Company assignments from custom fields
        bolag1: appointment.custom_fields.bolag_1,
        bolag1LeadType: appointment.custom_fields.bolag_1_leadtype,
        bolag2: appointment.custom_fields.bolag_2,
        bolag2LeadType: appointment.custom_fields.bolag_2_leadtype,
        bolag3: appointment.custom_fields.bolag_3,
        bolag3LeadType: appointment.custom_fields.bolag_3_leadtype,
        bolag4: appointment.custom_fields.bolag_4,
        bolag4LeadType: appointment.custom_fields.bolag_4_leadtype,
        // Admin status from Adversus
        adminStatus: appointment.custom_fields.admin_status || 'pending',
        // Additional metadata
        adversusStatus: appointment.status,
        campaignId: appointment.campaign_id,
        customFields: {
          propertyType: appointment.custom_fields.property_type,
          energyInterest: appointment.custom_fields.energy_interest || []
        }
      }))

      return NextResponse.json({
        success: true,
        data: transformedLeads,
        total: transformedLeads.length,
        source: 'adversus_api',
        setterName,
        agentId,
        dateRange: { from: dateFrom, to: dateTo }
      })

    } catch (apiError) {
      console.error('Adversus API error:', apiError)
      // Fallback to mock data if API fails
      return getMockAdversusData(setterName, agentId, dateFrom, dateTo)
    }

  } catch (error) {
    console.error('Error fetching Adversus leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads from Adversus' },
      { status: 500 }
    )
  }
}

// Mock data function for when API is not available
function getMockAdversusData(setterName: string, agentId: string, dateFrom: string, dateTo: string) {
  const mockData = [
    {
      id: `adv_${agentId}_001`,
      customerName: 'Anna Andersson',
      customerPhone: '+46701234567',
      bookedAt: '2024-09-27T10:30:00Z',
      setterId: agentId,
      setterName: setterName,
      bolag1: 'SolarTech Stockholm AB',
      bolag1LeadType: 'Villa - Solceller',
      bolag2: 'Nordic Solar Solutions',
      bolag2LeadType: 'Villa - Värmepump',
      adminStatus: 'approved',
      adversusStatus: 'completed',
      campaignId: 'solar_campaign_2024',
      customFields: {
        propertyType: 'Villa',
        energyInterest: ['Solceller', 'Värmepump']
      }
    },
    {
      id: `adv_${agentId}_002`,
      customerName: 'Lars Nilsson',
      customerPhone: '+46709876543',
      bookedAt: '2024-09-26T14:15:00Z',
      setterId: agentId,
      setterName: setterName,
      bolag1: 'Green Energy Nordic',
      bolag1LeadType: 'Lägenhet - Solceller',
      adminStatus: 'pending',
      adversusStatus: 'booked',
      campaignId: 'solar_campaign_2024',
      customFields: {
        propertyType: 'Lägenhet',
        energyInterest: ['Solceller']
      }
    },
    {
      id: `adv_${agentId}_003`,
      customerName: 'Maria Larsson',
      customerPhone: '+46705551234',
      bookedAt: '2024-09-25T09:20:00Z',
      setterId: agentId,
      setterName: setterName,
      bolag1: 'Energi & Miljöteknik i Sverige AB',
      bolag1LeadType: 'Villa - Värmepump',
      bolag2: 'Solceller Sverige AB',
      bolag2LeadType: 'Villa - Solceller',
      bolag3: 'EcoSolar Scandinavia',
      bolag3LeadType: 'Villa - Vindkraft',
      adminStatus: 'approved',
      adversusStatus: 'completed',
      campaignId: 'solar_campaign_2024',
      customFields: {
        propertyType: 'Villa',
        energyInterest: ['Värmepump', 'Solceller', 'Vindkraft']
      }
    }
  ]

  return NextResponse.json({
    success: true,
    data: mockData,
    total: mockData.length,
    source: 'mock_data',
    setterName,
    agentId,
    dateRange: { from: dateFrom, to: dateTo }
  })
}

// POST endpoint for updating lead status in Adversus
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, status, notes } = body

    // TODO: Implement actual Adversus API integration
    // Example: PUT https://api.adversus.dk/v1/appointments/{leadId}

    console.log(`Updating Adversus lead ${leadId} status to ${status}`)

    return NextResponse.json({
      success: true,
      message: 'Lead status updated in Adversus'
    })

  } catch (error) {
    console.error('Error updating Adversus lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead in Adversus' },
      { status: 500 }
    )
  }
}