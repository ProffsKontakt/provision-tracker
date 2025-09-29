import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const dashboardParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  klarOchUtskickadOnly: z.string().optional().transform(val => val === 'true')
})

/**
 * GET /api/admin/dashboard
 * Comprehensive admin dashboard with Swedish business requirements
 * - Monthly filtering
 * - "Klar och utskickad" stage filtering
 * - 14-day credit window tracking
 * - Team performance metrics
 * - Company statistics
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const params = {
      month: searchParams.get('month') || getCurrentMonth(),
      klarOchUtskickadOnly: searchParams.get('klarOchUtskickadOnly')
    }

    const { month, klarOchUtskickadOnly } = dashboardParamsSchema.parse(params)

    // Parse month to get date range
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59) // Last day of month

    // Today's date range
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // Build base where clause for deals
    const baseWhereClause = {
      dealCreated: {
        gte: startDate,
        lte: endDate
      },
      ...(klarOchUtskickadOnly && {
        isKlarOchUtskickad: true,
        adversusPipeline: 'Adversus'
      })
    }

    // Get monthly deals with detailed information
    const monthlyDeals = await prisma.deal.findMany({
      where: baseWhereClause,
      include: {
        user: true,
        commissions: true,
        leadShares: {
          include: {
            company: true
          }
        }
      }
    })

    // Calculate monthly stats
    const monthlyStats = {
      selectedMonth: month,
      totalDeals: monthlyDeals.length,
      klarOchUtskickadDeals: monthlyDeals.filter(deal => deal.isKlarOchUtskickad).length,
      approvedDeals: monthlyDeals.filter(deal => deal.adminApproval === 'APPROVED').length,
      rejectedDeals: monthlyDeals.filter(deal => deal.adminApproval === 'REJECTED').length,
      pendingReview: monthlyDeals.filter(deal => deal.adminApproval === 'PENDING').length,
      totalCommission: monthlyDeals.reduce((sum, deal) =>
        sum + (Number(deal.totalCommission) || 0), 0
      ),
      creditsReceived: monthlyDeals.reduce((sum, deal) => {
        const creditedAmount = deal.commissions
          .filter(comm => comm.creditedBack)
          .reduce((commSum, comm) => commSum + Number(comm.leadTypeAmount), 0)
        return sum + creditedAmount
      }, 0),
      netCommission: 0 // Will be calculated after credits
    }
    monthlyStats.netCommission = monthlyStats.totalCommission - monthlyStats.creditsReceived

    // Get team stats for today
    const todayDeals = await prisma.deal.findMany({
      where: {
        dealCreated: {
          gte: todayStart,
          lt: todayEnd
        }
      },
      include: {
        user: true
      }
    })

    const todaysCalls = await prisma.adversusCall.findMany({
      where: {
        callTimestamp: {
          gte: todayStart,
          lt: todayEnd
        }
      }
    })

    const activeUsers = await prisma.user.findMany({
      where: {
        role: UserRole.SETTER,
        active: true
      }
    })

    const teamStats = {
      totalSetters: activeUsers.length,
      activeToday: new Set(todayDeals.map(deal => deal.userId).filter(Boolean)).size,
      totalCallsToday: todaysCalls.length,
      totalLeadsToday: todayDeals.length,
      approvalRateToday: todayDeals.length > 0
        ? (todayDeals.filter(deal => deal.adminApproval === 'APPROVED').length / todayDeals.length) * 100
        : 0,
      avgCommissionPerSetter: activeUsers.length > 0
        ? monthlyStats.totalCommission / activeUsers.length
        : 0
    }

    // Calculate leaderboard (top performers this month)
    const leaderboard = await calculateLeaderboard(startDate, endDate, klarOchUtskickadOnly)

    // Get company statistics
    const companyStats = await calculateCompanyStats(startDate, endDate)

    // Get credit window alerts (14-day tracking)
    const creditAlerts = await getCreditWindowAlerts()

    // Get review queue stats
    const reviewQueue = await getReviewQueueStats(todayStart, todayEnd)

    return NextResponse.json({
      monthlyStats,
      teamStats,
      leaderboard,
      companyStats,
      creditAlerts,
      reviewQueue
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)

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

async function calculateLeaderboard(startDate: Date, endDate: Date, klarOchUtskickadOnly: boolean) {
  const setters = await prisma.user.findMany({
    where: {
      role: UserRole.SETTER,
      active: true
    },
    include: {
      deals: {
        where: {
          dealCreated: {
            gte: startDate,
            lte: endDate
          },
          ...(klarOchUtskickadOnly && {
            isKlarOchUtskickad: true
          })
        },
        include: {
          commissions: true
        }
      }
    }
  })

  const leaderboard = setters.map(setter => {
    const deals = setter.deals
    const approvedDeals = deals.filter(deal => deal.adminApproval === 'APPROVED')
    const klarOchUtskickadDeals = deals.filter(deal => deal.isKlarOchUtskickad)
    const totalCommission = approvedDeals.reduce((sum, deal) =>
      sum + (Number(deal.totalCommission) || 0), 0
    )
    const creditedDeals = deals.filter(deal => {
      const creditedAmount = deal.commissions.filter(comm => comm.creditedBack).length
      return creditedAmount > 0
    })

    return {
      userId: setter.id,
      name: setter.name,
      openerName: setter.openerName,
      leadsThisMonth: deals.length,
      klarOchUtskickadCount: klarOchUtskickadDeals.length,
      commissionThisMonth: totalCommission,
      approvalRate: deals.length > 0
        ? (approvedDeals.length / deals.length) * 100
        : 0,
      creditRate: approvedDeals.length > 0
        ? (creditedDeals.length / approvedDeals.length) * 100
        : 0
    }
  })

  return leaderboard.sort((a, b) => b.commissionThisMonth - a.commissionThisMonth)
}

async function calculateCompanyStats(startDate: Date, endDate: Date) {
  const companies = await prisma.company.findMany({
    where: {
      active: true
    },
    include: {
      leadShares: {
        where: {
          sharedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          deal: {
            include: {
              commissions: true
            }
          }
        }
      }
    }
  })

  const now = new Date()

  return companies.map(company => {
    const leads = company.leadShares
    const leadsInCreditWindow = leads.filter(share =>
      share.creditWindowExpires > now
    )
    const creditedLeads = leads.filter(share => {
      const deal = share.deal
      const creditedCompanies = Array.isArray(deal.creditedCompanies)
        ? deal.creditedCompanies
        : []
      return creditedCompanies.includes(company.name)
    })

    const totalRevenue = leads.reduce((sum, share) => {
      const deal = share.deal
      const commissions = deal.commissions.filter(comm =>
        comm.companyName === company.name && !comm.creditedBack
      )
      return sum + commissions.reduce((commSum, comm) =>
        commSum + Number(comm.leadTypeAmount), 0
      )
    }, 0)

    // Calculate average response time for credits
    const creditedLeadsWithTiming = creditedLeads.filter(share => {
      const deal = share.deal
      const commission = deal.commissions.find(comm =>
        comm.companyName === company.name && comm.creditedAt
      )
      return commission?.creditedAt
    })

    const avgResponseTime = creditedLeadsWithTiming.length > 0
      ? creditedLeadsWithTiming.reduce((sum, share) => {
          const deal = share.deal
          const commission = deal.commissions.find(comm =>
            comm.companyName === company.name && comm.creditedAt
          )
          if (commission?.creditedAt) {
            const hours = (commission.creditedAt.getTime() - share.sharedAt.getTime()) / (1000 * 60 * 60)
            return sum + hours
          }
          return sum
        }, 0) / creditedLeadsWithTiming.length
      : 0

    return {
      companyName: company.name,
      leadsReceived: leads.length,
      leadsInCreditWindow: leadsInCreditWindow.length,
      creditedBack: creditedLeads.length,
      creditRate: leads.length > 0
        ? (creditedLeads.length / leads.length) * 100
        : 0,
      avgResponseTime,
      revenue: totalRevenue
    }
  }).sort((a, b) => b.revenue - a.revenue)
}

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
      deal: true,
      company: true
    },
    orderBy: {
      creditWindowExpires: 'asc'
    }
  })

  // Group by deal to show all companies for each deal
  const dealGroups = new Map()

  alertLeadShares.forEach(share => {
    const dealId = share.dealId
    if (!dealGroups.has(dealId)) {
      dealGroups.set(dealId, {
        dealId: share.deal.id,
        dealTitle: share.deal.title,
        companies: [],
        sharedDate: share.sharedAt,
        creditWindowExpires: share.creditWindowExpires
      })
    }
    dealGroups.get(dealId).companies.push(share.company.name)
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
      status
    }
  })

  return alerts
}

async function getReviewQueueStats(todayStart: Date, todayEnd: Date) {
  const pendingCalls = await prisma.adversusCall.findMany({
    where: {
      markedSuccess: true,
      adminReviewed: false
    },
    orderBy: {
      callTimestamp: 'asc'
    }
  })

  const reviewedCallsToday = await prisma.adversusCall.findMany({
    where: {
      adminReviewed: true,
      updatedAt: {
        gte: todayStart,
        lt: todayEnd
      }
    },
    include: {
      reviewedBy: true
    }
  })

  const callsToday = await prisma.adversusCall.count({
    where: {
      callTimestamp: {
        gte: todayStart,
        lt: todayEnd
      }
    }
  })

  const oldestCall = pendingCalls[0]
  const oldestWaitTime = oldestCall
    ? Math.floor((Date.now() - oldestCall.callTimestamp.getTime()) / (1000 * 60 * 60))
    : 0

  const averageReviewTime = reviewedCallsToday.length > 0
    ? reviewedCallsToday.reduce((sum, call) => {
        if (call.reviewedBy) {
          const reviewDuration = call.reviewedBy.reviewDuration || 0
          return sum + reviewDuration
        }
        return sum
      }, 0) / reviewedCallsToday.length / 60 // Convert to minutes
    : 0

  return {
    pending: pendingCalls.length,
    oldestWaitTime,
    averageReviewTime: Math.round(averageReviewTime),
    callsToday
  }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}