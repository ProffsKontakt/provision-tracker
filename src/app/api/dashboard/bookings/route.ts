import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Bookings API called')

    const session = await getServerSession(authOptions)
    console.log('🔍 Session retrieved:', session ? 'YES' : 'NO')

    if (!session || !session.user) {
      console.log('❌ No session or user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 USER DATA:', session.user.id, session.user.name, session.user.adversusAgentId)

    // Get search params
    const searchParams = request.nextUrl.searchParams
    const includeStats = searchParams.get('includeStats') !== 'false'

    // Check if adversusAgentId is available
    if (!session.user.adversusAgentId) {
      console.error('❌ No adversusAgentId found for user:', session.user.id)
      return NextResponse.json({
        error: 'User missing adversusAgentId',
        bookings: [],
        stats: null
      }, { status: 200 })
    }

    console.log('✅ Using adversusAgentId for query:', session.user.adversusAgentId)

    // Fetch user's leads from database
    console.log('🔍 Querying with setterId:', session.user.adversusAgentId)

    let userLeads;
    try {
      userLeads = await prisma.adversusLead.findMany({
        where: {
          setterId: session.user.adversusAgentId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      console.log(`📋 Found ${userLeads.length} leads for user ${session.user.name}`)
    } catch (queryError) {
      console.error('❌ Prisma query failed:', queryError)
      throw queryError
    }

    // Transform leads to booking format
    const bookings = userLeads.map(lead => {
      // Determine booking status based on lead progression
      let status = 'booked' // Default status

      // If lead has been processed and sent to partners
      if (lead.adminStatus === 'approved' && lead.adversusStatus === 'confirmed') {
        status = 'sent_to_partners' // This is when opener gets paid
      } else if (lead.adversusStatus === 'confirmed') {
        status = 'sent_to_pipedrive'
      } else if (lead.adversusStatus === 'cancelled') {
        status = 'cancelled'
      }

      // Get commission info (temporarily disabled for debugging)
      const commission = undefined

      return {
        id: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone || '',
        customerEmail: lead.customerEmail,
        customerAddress: lead.customerAddress,
        appointmentDate: lead.appointmentDate?.toISOString() || lead.createdAt.toISOString(),
        bookingDate: lead.createdAt.toISOString(),
        status,
        pipedriveStatus: lead.adversusStatus,
        pipelineStage: lead.adminStatus === 'approved' ? 'Utskickad och klar' : 'Pending',
        companyAssignment: lead.bolag1 || 'Ej tilldelad',
        leadType: lead.bolag1LeadType || 'Standard',
        commission,
        notes: lead.notes,
        leadSource: lead.leadSource || 'Adversus',
        propertyType: lead.propertyType,
        energyInterest: extractEnergyInterest(lead),
        qualityScore: extractQualityScore(lead),
        estimatedValue: extractEstimatedValue(lead),
        followUpDate: lead.followUpDate?.toISOString()
      }
    })

    // Calculate stats if requested
    let stats = null
    if (includeStats) {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()

      const thisMonthBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.bookingDate)
        return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear
      })

      const sentToPartners = bookings.filter(b => b.status === 'sent_to_partners').length
      const totalCommissions = bookings.reduce((sum, b) => sum + (b.commission?.amount || 0), 0)
      const paidCommissions = bookings
        .filter(b => b.commission?.status === 'CREDITED')
        .reduce((sum, b) => sum + (b.commission?.amount || 0), 0)
      const pendingCommissions = bookings
        .filter(b => b.commission?.status === 'PENDING' || b.commission?.status === 'APPROVED')
        .reduce((sum, b) => sum + (b.commission?.amount || 0), 0)

      const qualityScores = bookings
        .map(b => b.qualityScore)
        .filter(score => score !== undefined && score > 0)
      const averageQuality = qualityScores.length > 0
        ? qualityScores.reduce((sum, score) => sum + score!, 0) / qualityScores.length
        : 0

      stats = {
        totalBookings: bookings.length,
        thisMonth: thisMonthBookings.length,
        sentToPipedrive: bookings.filter(b => b.status === 'sent_to_pipedrive').length,
        sentToPartners,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        averageQuality
      }

      console.log('📊 Calculated stats:', stats)
    }

    return NextResponse.json({
      success: true,
      bookings,
      stats,
      user: {
        name: session.user.name,
        openerName: session.user.openerName
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error fetching user bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

// Helper function to extract energy interest from lead data
function extractEnergyInterest(lead: any): string[] {
  const interests: string[] = []

  if (lead.bolag1LeadType) {
    if (lead.bolag1LeadType.includes('Solceller')) interests.push('Solceller')
    if (lead.bolag1LeadType.includes('Värmepump')) interests.push('Värmepump')
    if (lead.bolag1LeadType.includes('Vindkraft')) interests.push('Vindkraft')
  }

  if (lead.bolag2LeadType) {
    if (lead.bolag2LeadType.includes('Solceller') && !interests.includes('Solceller')) interests.push('Solceller')
    if (lead.bolag2LeadType.includes('Värmepump') && !interests.includes('Värmepump')) interests.push('Värmepump')
    if (lead.bolag2LeadType.includes('Vindkraft') && !interests.includes('Vindkraft')) interests.push('Vindkraft')
  }

  // Try to extract from custom fields if available
  if (lead.customFields && typeof lead.customFields === 'object') {
    const customFields = lead.customFields as any
    if (customFields.energyInterest && Array.isArray(customFields.energyInterest)) {
      customFields.energyInterest.forEach((interest: string) => {
        if (!interests.includes(interest)) {
          interests.push(interest)
        }
      })
    }
  }

  return interests
}

// Helper function to extract quality score from lead data
function extractQualityScore(lead: any): number | undefined {
  // Try to get quality score from custom fields
  if (lead.customFields && typeof lead.customFields === 'object') {
    const customFields = lead.customFields as any
    if (customFields.qualityScore) {
      return Number(customFields.qualityScore)
    }
    if (customFields.lead_quality_score) {
      return Number(customFields.lead_quality_score)
    }
  }

  // Generate a basic quality score based on available data
  let score = 5 // Base score

  if (lead.appointmentDate) score += 2 // Has appointment = better quality
  if (lead.customerEmail) score += 1 // Has email = better quality
  if (lead.customerAddress) score += 1 // Has address = better quality
  if (lead.bolag1 && lead.bolag2) score += 1 // Multiple company assignments = higher quality

  return Math.min(score, 10)
}

// Helper function to extract estimated value from lead data
function extractEstimatedValue(lead: any): number | undefined {
  // Try to get estimated value from custom fields
  if (lead.customFields && typeof lead.customFields === 'object') {
    const customFields = lead.customFields as any
    if (customFields.estimatedValue) {
      return Number(customFields.estimatedValue)
    }
    if (customFields.estimated_value) {
      return Number(customFields.estimated_value)
    }
  }

  // Estimate based on lead type
  const leadType = lead.bolag1LeadType || ''

  if (leadType.includes('Villa') && leadType.includes('Solceller')) {
    return 150000 // Villa solar installation
  } else if (leadType.includes('Villa') && leadType.includes('Värmepump')) {
    return 120000 // Villa heat pump
  } else if (leadType.includes('Lägenhet') && leadType.includes('Solceller')) {
    return 80000 // Apartment solar
  } else if (leadType.includes('Företag')) {
    return 300000 // Business installation
  }

  return undefined
}

// POST endpoint for updating booking status (if needed)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bookingId, action, notes } = body

    console.log('🔄 Updating booking:', { bookingId, action, userId: session.user.id })

    // Find the lead
    const lead = await prisma.adversusLead.findFirst({
      where: {
        id: bookingId,
        setterId: session.user.adversusAgentId // Ensure user can only update their own bookings
      }
    })

    if (!lead) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Update lead based on action
    let updateData: any = {}

    switch (action) {
      case 'add_note':
        updateData.notes = notes
        break
      case 'request_review':
        updateData.adminStatus = 'pending'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    await prisma.adversusLead.update({
      where: { id: bookingId },
      data: updateData
    })

    // Log the action
    await prisma.systemLog.create({
      data: {
        type: 'booking_updated',
        source: 'dashboard',
        message: `User ${session.user.name} performed action '${action}' on booking ${bookingId}`,
        data: {
          bookingId,
          action,
          userId: session.user.id,
          userName: session.user.name,
          notes,
          timestamp: new Date()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Booking updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating booking:', error)
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}