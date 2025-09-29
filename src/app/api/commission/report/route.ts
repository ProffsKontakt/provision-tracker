import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { formatCommissionSEK } from '@/lib/commission/calculator'
import { z } from 'zod'

const reportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  period: z.enum(['today', 'week', 'month', 'year', 'custom']).optional().default('month'),
  includeCredits: z.boolean().optional().default(true),
  format: z.enum(['json', 'csv']).optional().default('json')
})

/**
 * GET /api/commission/report
 * Generate commission reports for admin dashboard and external systems
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req)

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const params = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      userId: searchParams.get('userId'),
      period: searchParams.get('period') || 'month',
      includeCredits: searchParams.get('includeCredits') !== 'false',
      format: searchParams.get('format') || 'json'
    }

    const validatedParams = reportSchema.parse(params)

    // Calculate date range based on period
    let startDate: Date
    let endDate: Date = new Date()

    switch (validatedParams.period) {
      case 'today':
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'week':
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'year':
        startDate = new Date()
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      case 'custom':
        if (!validatedParams.startDate || !validatedParams.endDate) {
          return NextResponse.json(
            { error: 'startDate and endDate required for custom period' },
            { status: 400 }
          )
        }
        startDate = new Date(validatedParams.startDate)
        endDate = new Date(validatedParams.endDate)
        break
      default:
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
    }

    // Build query filters
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    // Filter by user if specified and user has permission
    if (validatedParams.userId) {
      if (user.role === UserRole.SETTER && validatedParams.userId !== user.id) {
        return NextResponse.json(
          { error: 'Access denied: Cannot view other users' data' },
          { status: 403 }
        )
      }
      whereClause.opener = await getUserOpenerName(validatedParams.userId)
    } else if (user.role === UserRole.SETTER) {
      // Setters can only see their own data
      whereClause.opener = user.openerName
    }

    // Get deals with commissions
    const deals = await prisma.deal.findMany({
      where: whereClause,
      include: {
        user: true,
        commissions: {
          where: validatedParams.includeCredits ? {} : {
            creditedBack: false
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate summary statistics
    const totalDeals = deals.length
    const approvedDeals = deals.filter(deal => deal.adminApproval === 'APPROVED')
    const rejectedDeals = deals.filter(deal => deal.adminApproval === 'REJECTED')
    const pendingDeals = deals.filter(deal => deal.adminApproval === 'PENDING')

    const totalCommission = approvedDeals.reduce((sum, deal) =>
      sum + (Number(deal.totalCommission) || 0), 0
    )

    const totalCredits = deals.reduce((sum, deal) => {
      const creditedAmount = deal.commissions
        .filter(comm => comm.creditedBack)
        .reduce((commSum, comm) => commSum + Number(comm.leadTypeAmount), 0)
      return sum + creditedAmount
    }, 0)

    const netCommission = totalCommission - totalCredits

    // Prepare report data
    const reportData = {
      metadata: {
        period: validatedParams.period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        generatedAt: new Date().toISOString(),
        generatedBy: user.name,
        includeCredits: validatedParams.includeCredits
      },
      summary: {
        totalDeals,
        approvedDeals: approvedDeals.length,
        rejectedDeals: rejectedDeals.length,
        pendingDeals: pendingDeals.length,
        approvalRate: totalDeals > 0 ? (approvedDeals.length / totalDeals) * 100 : 0,
        totalCommission,
        totalCredits,
        netCommission,
        formattedTotals: {
          totalCommission: formatCommissionSEK(totalCommission),
          totalCredits: formatCommissionSEK(totalCredits),
          netCommission: formatCommissionSEK(netCommission)
        }
      },
      deals: deals.map(deal => ({
        id: deal.id,
        title: deal.title,
        opener: deal.opener,
        contactPerson: deal.contactPerson,
        createdAt: deal.createdAt,
        adminApproval: deal.adminApproval,
        companies: [
          deal.company1,
          deal.company2,
          deal.company3,
          deal.company4
        ].filter(Boolean),
        leadTypes: [
          deal.company1LeadType,
          deal.company2LeadType,
          deal.company3LeadType,
          deal.company4LeadType
        ].filter(Boolean),
        totalCommission: Number(deal.totalCommission) || 0,
        baseBonus: Number(deal.baseBonus) || 0,
        commissions: deal.commissions.map(comm => ({
          id: comm.id,
          companyName: comm.companyName,
          leadType: comm.leadType,
          amount: Number(comm.leadTypeAmount),
          creditedBack: comm.creditedBack,
          status: comm.status
        })),
        creditedCompanies: Array.isArray(deal.creditedCompanies)
          ? deal.creditedCompanies
          : []
      }))
    }

    // Return CSV format if requested
    if (validatedParams.format === 'csv') {
      const csvHeaders = [
        'Deal ID',
        'Title',
        'Opener',
        'Contact Person',
        'Created Date',
        'Status',
        'Companies',
        'Lead Types',
        'Total Commission',
        'Credits',
        'Net Commission'
      ].join(',')

      const csvRows = reportData.deals.map(deal => {
        const credits = deal.commissions
          .filter(c => c.creditedBack)
          .reduce((sum, c) => sum + c.amount, 0)

        return [
          deal.id,
          `"${deal.title}"`,
          deal.opener,
          `"${deal.contactPerson || ''}"`,
          deal.createdAt.toISOString().split('T')[0],
          deal.adminApproval,
          `"${deal.companies.join(', ')}"`,
          `"${deal.leadTypes.join(', ')}"`,
          deal.totalCommission,
          credits,
          deal.totalCommission - credits
        ].join(',')
      }).join('\n')

      const csvContent = `${csvHeaders}\n${csvRows}`

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="commission-report-${validatedParams.period}.csv"`
        }
      })
    }

    return NextResponse.json(reportData)

  } catch (error) {
    console.error('Commission report error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getUserOpenerName(userId: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openerName: true }
  })
  return user?.openerName
}