import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions)

    console.log('🔍 Admin setters API - Session check:', {
      hasSession: !!session,
      userRole: session?.user?.role,
      userEmail: session?.user?.email
    })

    if (!session || session.user.role !== 'ADMIN') {
      console.log('❌ Admin setters API - Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Fetching real setter data from database...')

    // Get real setters from database
    const realSetters = await prisma.user.findMany({
      where: {
        role: {
          in: ['SETTER', 'MANAGER']
        },
        active: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        openerName: true,
        adversusAgentId: true,
        createdAt: true,
        adversusLeads: {
          select: {
            id: true,
            customerName: true,
            adversusStatus: true,
            adminStatus: true,
            appointmentDate: true,
            createdAt: true,
            bolag1: true,
            bolag1LeadType: true,
            bolag2: true,
            bolag2LeadType: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        commissions: {
          select: {
            leadTypeAmount: true,
            companyName: true,
            status: true
          }
        }
      }
    })

    // Calculate metrics for each setter
    const setterMetrics = realSetters.map(setter => {
      const leadsThisMonth = setter.adversusLeads.filter(lead => {
        const leadDate = new Date(lead.createdAt)
        const now = new Date()
        return leadDate.getMonth() === now.getMonth() &&
               leadDate.getFullYear() === now.getFullYear()
      })

      const successfulLeads = leadsThisMonth.filter(lead =>
        lead.adminStatus === 'approved' || lead.adversusStatus === 'confirmed'
      )

      const totalCommission = setter.commissions.reduce((sum, commission) =>
        sum + (Number(commission.leadTypeAmount) || 0), 0
      )

      const thisMonthCommission = setter.commissions
        .filter(commission => commission.status === 'APPROVED' || commission.status === 'CREDITED')
        .reduce((sum, commission) => sum + (Number(commission.leadTypeAmount) || 0), 0)

      return {
        id: setter.id,
        name: setter.name,
        email: setter.email,
        openerName: setter.openerName,
        adversusAgentId: setter.adversusAgentId,
        role: setter.role,
        metrics: {
          totalLeads: setter.adversusLeads.length,
          leadsThisMonth: leadsThisMonth.length,
          successfulLeads: successfulLeads.length,
          successRate: leadsThisMonth.length > 0 ?
            (successfulLeads.length / leadsThisMonth.length * 100).toFixed(1) : '0',
          totalCommission,
          thisMonthCommission,
          avgCommissionPerLead: setter.adversusLeads.length > 0 ?
            (totalCommission / setter.adversusLeads.length).toFixed(0) : '0',
          activeToday: true,
          lastActivity: setter.adversusLeads[0]?.createdAt || setter.createdAt
        },
        recentLeads: setter.adversusLeads.slice(0, 3).map(lead => ({
          id: lead.id,
          contactName: lead.customerName,
          companyName: lead.bolag1 || 'Ingen tilldelning',
          status: lead.adminStatus,
          createdAt: lead.createdAt,
          commission: 0 // Commission calculation would need to be added separately
        }))
      }
    })

    // Calculate system totals
    const systemMetrics = {
      totalSetters: realSetters.length,
      activeSetters: realSetters.filter(s => s.role === 'SETTER').length,
      totalLeads: realSetters.reduce((sum, setter) => sum + setter.adversusLeads.length, 0),
      totalCommission: realSetters.reduce((sum, setter) =>
        sum + setter.commissions.reduce((commSum, commission) =>
          commSum + (Number(commission.leadTypeAmount) || 0), 0
        ), 0
      ),
      avgSuccessRate: setterMetrics.length > 0 ?
        (setterMetrics.reduce((sum, s) => sum + parseFloat(s.metrics.successRate), 0) / setterMetrics.length).toFixed(1) : '0'
    }

    console.log('✅ Processed setter metrics:', {
      setterCount: setterMetrics.length,
      systemMetrics
    })

    return NextResponse.json({
      success: true,
      setters: setterMetrics,
      systemMetrics,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Error fetching setter data:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}