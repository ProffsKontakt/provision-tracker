import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const dealsQuerySchema = z.object({
  unshared: z.string().optional().transform(val => val === 'true'),
  klarOchUtskickad: z.string().optional().transform(val => val === 'true'),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  userId: z.string().optional(),
  companyName: z.string().optional(),
  status: z.enum(['OPEN', 'WON', 'LOST']).optional(),
  adminApproval: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
})

/**
 * GET /api/admin/deals
 * Comprehensive deal querying for admin operations
 * Supports filtering by sharing status, stage, month, etc.
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const params = {
      unshared: searchParams.get('unshared'),
      klarOchUtskickad: searchParams.get('klarOchUtskickad'),
      month: searchParams.get('month'),
      userId: searchParams.get('userId'),
      companyName: searchParams.get('companyName'),
      status: searchParams.get('status'),
      adminApproval: searchParams.get('adminApproval'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    }

    const {
      unshared,
      klarOchUtskickad,
      month,
      userId,
      companyName,
      status,
      adminApproval,
      limit,
      offset
    } = dealsQuerySchema.parse(params)

    // Build where clause
    const whereClause: any = {}

    // Filter by sharing status
    if (unshared) {
      whereClause.leadShares = {
        none: {} // No lead shares exist for this deal
      }
    }

    // Filter by "Klar och utskickad" stage
    if (klarOchUtskickad) {
      whereClause.isKlarOchUtskickad = true
      whereClause.adversusPipeline = 'Adversus'
    }

    // Filter by month
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0, 23, 59, 59)
      whereClause.dealCreated = {
        gte: startDate,
        lte: endDate
      }
    }

    // Filter by user
    if (userId) {
      whereClause.userId = userId
    }

    // Filter by company involvement
    if (companyName) {
      whereClause.OR = [
        { company1: companyName },
        { company2: companyName },
        { company3: companyName },
        { company4: companyName }
      ]
    }

    // Filter by status
    if (status) {
      whereClause.status = status
    }

    // Filter by admin approval
    if (adminApproval) {
      whereClause.adminApproval = adminApproval
    }

    // Get deals with all necessary relations
    const deals = await prisma.deal.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            openerName: true,
            email: true
          }
        },
        commissions: {
          select: {
            id: true,
            companyName: true,
            leadType: true,
            leadTypeAmount: true,
            creditedBack: true,
            creditedAt: true,
            status: true
          }
        },
        leadShares: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                contactEmail: true
              }
            }
          }
        },
        adversusCall: {
          select: {
            id: true,
            adversusCallId: true,
            markedSuccess: true,
            adminReviewed: true
          }
        }
      },
      orderBy: {
        dealCreated: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.deal.count({ where: whereClause })

    // Enrich deals with calculated fields
    const enrichedDeals = deals.map(deal => {
      // Calculate total commission
      const totalCommission = deal.commissions.reduce((sum, comm) =>
        sum + (comm.creditedBack ? 0 : Number(comm.leadTypeAmount)), 0
      )

      // Get assigned companies
      const assignedCompanies = [
        deal.company1,
        deal.company2,
        deal.company3,
        deal.company4
      ].filter(Boolean)

      // Check if shared
      const isShared = deal.leadShares.length > 0

      // Get credit window status
      const now = new Date()
      const activeShares = deal.leadShares.filter(share =>
        new Date(share.creditWindowExpires) > now
      )
      const expiredShares = deal.leadShares.filter(share =>
        new Date(share.creditWindowExpires) <= now
      )

      // Check if any companies have credited
      const creditedCompanies = deal.commissions
        .filter(comm => comm.creditedBack)
        .map(comm => comm.companyName)

      return {
        ...deal,
        totalCommission,
        assignedCompanies,
        isShared,
        shareCount: deal.leadShares.length,
        activeShareCount: activeShares.length,
        expiredShareCount: expiredShares.length,
        creditedCompanies,
        hasCreditedCompanies: creditedCompanies.length > 0
      }
    })

    // Calculate summary statistics
    const summary = {
      total: totalCount,
      unshared: enrichedDeals.filter(d => !d.isShared).length,
      klarOchUtskickad: enrichedDeals.filter(d => d.isKlarOchUtskickad).length,
      approved: enrichedDeals.filter(d => d.adminApproval === 'APPROVED').length,
      pending: enrichedDeals.filter(d => d.adminApproval === 'PENDING').length,
      rejected: enrichedDeals.filter(d => d.adminApproval === 'REJECTED').length,
      totalCommission: enrichedDeals.reduce((sum, d) => sum + d.totalCommission, 0),
      activeCreditWindows: enrichedDeals.reduce((sum, d) => sum + d.activeShareCount, 0)
    }

    return NextResponse.json({
      deals: enrichedDeals,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary
    })

  } catch (error) {
    console.error('Deals query error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/deals
 * Bulk update deals (admin approval, stage changes, etc.)
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { dealIds, updates } = body

    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return NextResponse.json(
        { error: 'dealIds array is required' },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      )
    }

    // Validate allowed update fields
    const allowedFields = [
      'adminApproval',
      'adminChecked',
      'isKlarOchUtskickad',
      'adversusPipeline',
      'notes'
    ]

    const updateData: any = {}
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      )
    }

    // Perform bulk update
    const result = await prisma.deal.updateMany({
      where: {
        id: { in: dealIds }
      },
      data: updateData
    })

    // Log the bulk update
    await prisma.systemLog.create({
      data: {
        type: 'bulk_update',
        source: 'admin',
        message: `Bulk updated ${result.count} deals`,
        data: {
          dealIds,
          updates: updateData,
          adminId: user.id,
          adminName: user.name
        }
      }
    })

    return NextResponse.json({
      message: `Successfully updated ${result.count} deals`,
      updatedCount: result.count,
      requestedCount: dealIds.length
    })

  } catch (error) {
    console.error('Bulk deal update error:', error)
    return NextResponse.json(
      { error: 'Failed to update deals' },
      { status: 500 }
    )
  }
}