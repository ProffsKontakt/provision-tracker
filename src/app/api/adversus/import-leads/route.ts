import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@/generated/prisma'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// Adversus API configuration
const ADVERSUS_BASE_URL = process.env.ADVERSUS_BASE_URL || 'https://api.adversus.com'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD

// Moltas's agent ID mapping
const MOLTAS_AGENT_ID = 'agent_moltas'

interface AdversusAppointment {
  id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  agent_id: string
  agent_name: string
  campaign_id: string
  campaign_name?: string
  created_at: string
  appointment_datetime: string
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled'
  success_status?: string // The success marking from Adversus
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
    street_address?: string
    postal_code?: string
    city?: string
    county?: string
    admin_status?: 'pending' | 'approved' | 'rejected'
    [key: string]: any // For any additional custom fields
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request, [UserRole.ADMIN])

  if (error) {
    return error
  }

  try {
    const body = await request.json()
    const { setterName = 'Moltas Roslund', monthsBack = 2, onlySuccessful = true } = body

    if (!ADVERSUS_USERNAME || !ADVERSUS_PASSWORD) {
      return NextResponse.json({
        error: 'Adversus API credentials not configured'
      }, { status: 500 })
    }

    // Calculate date range (past 2 months by default)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)

    console.log(`Importing leads for ${setterName} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Create Basic Auth header for Adversus
    const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

    // Fetch appointments from Adversus API for Moltas
    const params = new URLSearchParams({
      agent_id: MOLTAS_AGENT_ID,
      date_from: startDate.toISOString(),
      date_to: endDate.toISOString(),
      status: 'booked,confirmed,completed', // All statuses for comprehensive import
      limit: '500', // Increase limit to get more data
      include_custom_fields: 'true'
    })

    // Add success filter if only importing successful leads
    if (onlySuccessful) {
      params.append('success_status', 'success')
    }

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

    console.log(`Fetched ${appointments.length} appointments from Adversus`)

    // Find the user in our database to link the leads
    const setterUser = await prisma.user.findFirst({
      where: { name: setterName }
    })

    if (!setterUser) {
      return NextResponse.json({
        error: `Setter ${setterName} not found in database`
      }, { status: 404 })
    }

    // Import each appointment as an AdversusLead
    const importResults = []
    let importedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const appointment of appointments) {
      try {
        // Check if this lead already exists
        const existingLead = await prisma.adversusLead.findUnique({
          where: { adversusId: appointment.id }
        })

        if (existingLead) {
          skippedCount++
          importResults.push({
            adversusId: appointment.id,
            status: 'skipped',
            reason: 'Already exists in database'
          })
          continue
        }

        // Transform Adversus data to our schema
        const leadData = {
          adversusId: appointment.id,
          setterId: setterUser.adversusAgentId,
          setterName: appointment.agent_name,
          customerName: appointment.customer_name,
          customerPhone: appointment.customer_phone,
          customerEmail: appointment.customer_email,
          appointmentDate: new Date(appointment.appointment_datetime),
          bookedAt: new Date(appointment.created_at),
          adversusStatus: appointment.status,
          successStatus: appointment.success_status,
          campaignId: appointment.campaign_id,
          campaignName: appointment.campaign_name,

          // Company assignments
          bolag1: appointment.custom_fields.bolag_1,
          bolag1LeadType: appointment.custom_fields.bolag_1_leadtype,
          bolag2: appointment.custom_fields.bolag_2,
          bolag2LeadType: appointment.custom_fields.bolag_2_leadtype,
          bolag3: appointment.custom_fields.bolag_3,
          bolag3LeadType: appointment.custom_fields.bolag_3_leadtype,
          bolag4: appointment.custom_fields.bolag_4,
          bolag4LeadType: appointment.custom_fields.bolag_4_leadtype,

          // Property information
          propertyType: appointment.custom_fields.property_type,
          energyInterest: appointment.custom_fields.energy_interest,

          // Address information
          streetAddress: appointment.custom_fields.street_address,
          postalCode: appointment.custom_fields.postal_code,
          city: appointment.custom_fields.city,
          county: appointment.custom_fields.county,

          // Admin status
          adminStatus: appointment.custom_fields.admin_status || 'pending',

          // Store all custom fields and original data
          customFields: appointment.custom_fields,
          adversusData: appointment
        }

        // Create the lead in our database
        const createdLead = await prisma.adversusLead.create({
          data: leadData
        })

        importedCount++
        importResults.push({
          adversusId: appointment.id,
          databaseId: createdLead.id,
          customerName: appointment.customer_name,
          status: 'imported',
          appointmentDate: appointment.appointment_datetime
        })

        console.log(`Imported lead: ${appointment.customer_name} (${appointment.id})`)

      } catch (leadError) {
        errorCount++
        console.error(`Error importing lead ${appointment.id}:`, leadError)
        importResults.push({
          adversusId: appointment.id,
          status: 'error',
          error: leadError instanceof Error ? leadError.message : 'Unknown error'
        })
      }
    }

    // Log the import summary
    await prisma.systemLog.create({
      data: {
        type: 'adversus_import',
        source: 'adversus_api',
        message: `Imported ${importedCount} leads for ${setterName}`,
        data: {
          setterName,
          monthsBack,
          onlySuccessful,
          totalFetched: appointments.length,
          imported: importedCount,
          skipped: skippedCount,
          errors: errorCount,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully imported leads for ${setterName}`,
      summary: {
        totalFetched: appointments.length,
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount,
        setterName,
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString()
        }
      },
      results: importResults
    })

  } catch (error) {
    console.error('Adversus import error:', error)

    // Log the error
    await prisma.systemLog.create({
      data: {
        type: 'adversus_import_error',
        source: 'adversus_api',
        message: 'Failed to import Adversus leads',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to import leads from Adversus',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// GET endpoint to check import status and view imported leads
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(request.url)
    const setterName = searchParams.get('setterName') || 'Moltas Roslund'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Get the setter user
    const setterUser = await prisma.user.findFirst({
      where: { name: setterName }
    })

    if (!setterUser) {
      return NextResponse.json({
        error: `Setter ${setterName} not found`
      }, { status: 404 })
    }

    // Fetch imported leads
    const [leads, totalCount] = await Promise.all([
      prisma.adversusLead.findMany({
        where: { setterId: setterUser.adversusAgentId },
        orderBy: { bookedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          setter: {
            select: { name: true, openerName: true }
          }
        }
      }),
      prisma.adversusLead.count({
        where: { setterId: setterUser.adversusAgentId }
      })
    ])

    // Get import statistics
    const stats = await prisma.adversusLead.groupBy({
      by: ['adminStatus'],
      where: { setterId: setterUser.adversusAgentId },
      _count: true
    })

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat.adminStatus] = stat._count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        leads,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        statistics: {
          total: totalCount,
          pending: statusCounts.pending || 0,
          approved: statusCounts.approved || 0,
          rejected: statusCounts.rejected || 0
        },
        setterName
      }
    })

  } catch (error) {
    console.error('Error fetching imported leads:', error)
    return NextResponse.json({
      error: 'Failed to fetch imported leads'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}