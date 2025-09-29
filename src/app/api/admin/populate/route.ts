import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { adversusEnhancedAPI } from '@/lib/adversus-enhanced'

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Admin-triggered database population started...')

    // Get target openers from request body or use defaults
    const body = await request.json().catch(() => ({}))
    const targetOpeners = body.openers || ['Moltas', 'Frank', 'Gustaf', 'Carl']
    const forceRefresh = body.forceRefresh || false

    console.log(`🎯 Target openers: ${targetOpeners.join(', ')}`)
    console.log(`🔄 Force refresh: ${forceRefresh}`)

    // Step 1: Get field and user metadata
    const [fields, users] = await Promise.all([
      adversusEnhancedAPI.getFields(),
      adversusEnhancedAPI.getUsers()
    ])

    // Step 2: Get success leads by opener
    const openerLeadsMap = await adversusEnhancedAPI.getSuccessLeadsByOpener(targetOpeners)

    // Calculate totals
    let totalLeads = 0
    const summary: Record<string, number> = {}

    openerLeadsMap.forEach((leads, opener) => {
      summary[opener] = leads.length
      totalLeads += leads.length
    })

    if (totalLeads === 0) {
      return NextResponse.json({
        success: false,
        message: 'No leads found matching the criteria',
        summary,
        debug: {
          totalFields: fields.length,
          totalUsers: users.length,
          openerField: fields.find(f =>
            f.name.toLowerCase().includes('opener') ||
            f.name.toLowerCase().includes('öppnare')
          )
        }
      })
    }

    // Step 3: Import to database
    await adversusEnhancedAPI.importLeadsToDatabase(openerLeadsMap)

    // Step 4: Calculate commission
    const COMMISSION_RATES = {
      base: 100,
      offert: 100,
      platsbesok: 300
    }

    const totalBaseCommission = totalLeads * COMMISSION_RATES.base

    // Step 5: Return success response
    return NextResponse.json({
      success: true,
      message: 'Database populated successfully',
      summary: {
        totalLeads,
        leadsPerOpener: summary,
        totalBaseCommission,
        commissionRates: COMMISSION_RATES
      },
      metadata: {
        fieldsFound: fields.length,
        usersFound: users.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('💥 Error during API-triggered population:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 })
  } finally {
    await adversusEnhancedAPI.disconnect()
  }
}