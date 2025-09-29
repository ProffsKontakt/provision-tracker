import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const companiesQuerySchema = z.object({
  active: z.string().optional().transform(val => val === 'true'),
  search: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
})

const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  organisationsnummer: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  active: z.boolean().default(true)
})

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  organisationsnummer: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  active: z.boolean().optional()
})

/**
 * GET /api/admin/companies
 * List companies with filtering and statistics
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const params = {
      active: searchParams.get('active'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    }

    const { active, search, limit, offset } = companiesQuerySchema.parse(params)

    // Build where clause
    const whereClause: any = {}

    if (active !== undefined) {
      whereClause.active = active
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { organisationsnummer: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get companies with lead share statistics
    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        leadShares: {
          include: {
            deal: {
              include: {
                commissions: {
                  where: {
                    creditedBack: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      take: limit,
      skip: offset
    })

    // Calculate statistics for each company
    const now = new Date()
    const enrichedCompanies = companies.map(company => {
      const leadShares = company.leadShares

      // Total leads received
      const totalLeadsReceived = leadShares.length

      // Active credit windows (not expired)
      const activeShares = leadShares.filter(share =>
        new Date(share.creditWindowExpires) > now
      )

      // Expired credit windows
      const expiredShares = leadShares.filter(share =>
        new Date(share.creditWindowExpires) <= now
      )

      // Credits used (deals where this company was credited)
      const creditedDeals = leadShares.filter(share => {
        const deal = share.deal
        return deal.commissions.some(comm =>
          comm.companyName === company.name && comm.creditedBack
        )
      })

      // Calculate credit rate
      const creditRate = totalLeadsReceived > 0
        ? (creditedDeals.length / totalLeadsReceived) * 100
        : 0

      // Calculate average response time for credits
      const creditedWithTiming = creditedDeals.filter(share => {
        const commission = share.deal.commissions.find(comm =>
          comm.companyName === company.name && comm.creditedAt
        )
        return commission?.creditedAt
      })

      const avgResponseTime = creditedWithTiming.length > 0
        ? creditedWithTiming.reduce((sum, share) => {
            const commission = share.deal.commissions.find(comm =>
              comm.companyName === company.name && comm.creditedAt
            )
            if (commission?.creditedAt) {
              const hours = (commission.creditedAt.getTime() - share.sharedAt.getTime()) / (1000 * 60 * 60)
              return sum + hours
            }
            return sum
          }, 0) / creditedWithTiming.length
        : 0

      // Calculate revenue (commissions not credited back)
      const revenue = leadShares.reduce((sum, share) => {
        const deal = share.deal
        const commissions = deal.commissions.filter(comm =>
          comm.companyName === company.name && !comm.creditedBack
        )
        return sum + commissions.reduce((commSum, comm) =>
          commSum + Number(comm.leadTypeAmount), 0
        )
      }, 0)

      return {
        ...company,
        statistics: {
          totalLeadsReceived,
          activeShares: activeShares.length,
          expiredShares: expiredShares.length,
          creditedBack: creditedDeals.length,
          creditRate: Math.round(creditRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime * 10) / 10, // Hours with 1 decimal
          revenue
        },
        leadShares: undefined // Remove detailed lead shares from response
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.company.count({ where: whereClause })

    // Calculate summary statistics
    const summary = {
      total: totalCount,
      active: enrichedCompanies.filter(c => c.active).length,
      inactive: enrichedCompanies.filter(c => !c.active).length,
      totalLeadsShared: enrichedCompanies.reduce((sum, c) => sum + c.statistics.totalLeadsReceived, 0),
      totalRevenue: enrichedCompanies.reduce((sum, c) => sum + c.statistics.revenue, 0),
      avgCreditRate: enrichedCompanies.length > 0
        ? enrichedCompanies.reduce((sum, c) => sum + c.statistics.creditRate, 0) / enrichedCompanies.length
        : 0
    }

    return NextResponse.json({
      companies: enrichedCompanies,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary
    })

  } catch (error) {
    console.error('Companies query error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/companies
 * Create a new company
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const companyData = createCompanySchema.parse(body)

    // Check if company name already exists
    const existingCompany = await prisma.company.findUnique({
      where: { name: companyData.name }
    })

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Company with this name already exists' },
        { status: 409 }
      )
    }

    // Check if organisation number already exists (if provided)
    if (companyData.organisationsnummer) {
      const existingOrgNumber = await prisma.company.findUnique({
        where: { organisationsnummer: companyData.organisationsnummer }
      })

      if (existingOrgNumber) {
        return NextResponse.json(
          { error: 'Company with this organisation number already exists' },
          { status: 409 }
        )
      }
    }

    // Create the company
    const company = await prisma.company.create({
      data: companyData
    })

    // Log the creation
    await prisma.systemLog.create({
      data: {
        type: 'company_created',
        source: 'admin',
        message: `Company "${company.name}" created`,
        data: {
          companyId: company.id,
          companyName: company.name,
          createdBy: user.id,
          createdByName: user.name
        }
      }
    })

    return NextResponse.json({
      message: 'Company created successfully',
      company
    }, { status: 201 })

  } catch (error) {
    console.error('Company creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid company data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/companies
 * Bulk update companies
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { companyIds, updates } = body

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'companyIds array is required' },
        { status: 400 }
      )
    }

    const updateData = updateCompanySchema.parse(updates)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      )
    }

    // Perform bulk update
    const result = await prisma.company.updateMany({
      where: {
        id: { in: companyIds }
      },
      data: updateData
    })

    // Log the bulk update
    await prisma.systemLog.create({
      data: {
        type: 'bulk_company_update',
        source: 'admin',
        message: `Bulk updated ${result.count} companies`,
        data: {
          companyIds,
          updates: updateData,
          adminId: user.id,
          adminName: user.name
        }
      }
    })

    return NextResponse.json({
      message: `Successfully updated ${result.count} companies`,
      updatedCount: result.count,
      requestedCount: companyIds.length
    })

  } catch (error) {
    console.error('Bulk company update error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid update data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update companies' },
      { status: 500 }
    )
  }
}