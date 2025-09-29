import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole, Deal } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { calculateDealCommission, validateDealForCommission } from '@/lib/commission/calculator'
import { z } from 'zod'

const calculateCommissionSchema = z.object({
  dealId: z.number().int().positive(),
  recalculate: z.boolean().optional().default(false)
})

/**
 * POST /api/commission/calculate
 * Calculate commission for a specific deal
 * Used by admin dashboard and external ProffsKontakt integrations
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { dealId, recalculate } = calculateCommissionSchema.parse(body)

    // Find the deal with all related data
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        user: true,
        commissions: true,
        adversusCall: true
      }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Validate deal meets commission requirements
    const validation = validateDealForCommission(deal)
    if (!validation.isValid) {
      return NextResponse.json({
        dealId,
        isEligible: false,
        validationErrors: validation.reasons,
        commission: null
      })
    }

    // Calculate commission
    const calculationResult = calculateDealCommission(deal)

    // Update deal with calculated commission (if recalculate is true or no existing commission)
    if (recalculate || !deal.totalCommission) {
      const updatedDeal = await prisma.deal.update({
        where: { id: dealId },
        data: {
          totalCommission: calculationResult.totalCommission,
          baseBonus: calculationResult.breakdown.baseBonus
        }
      })

      // Log the calculation
      await prisma.systemLog.create({
        data: {
          type: 'commission_calculation',
          source: 'api',
          message: `Commission calculated for deal ${dealId}`,
          data: {
            dealId,
            userId: user.id,
            previousCommission: deal.totalCommission,
            newCommission: calculationResult.totalCommission,
            breakdown: calculationResult.breakdown
          }
        }
      })
    }

    return NextResponse.json({
      dealId,
      isEligible: true,
      validationErrors: [],
      commission: {
        total: calculationResult.totalCommission,
        breakdown: calculationResult.breakdown,
        calculatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Commission calculation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/commission/calculate?dealId=123
 * Get commission calculation for a deal without updating database
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req)

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const dealIdParam = searchParams.get('dealId')

    if (!dealIdParam) {
      return NextResponse.json(
        { error: 'dealId parameter is required' },
        { status: 400 }
      )
    }

    const dealId = parseInt(dealIdParam, 10)
    if (isNaN(dealId)) {
      return NextResponse.json(
        { error: 'dealId must be a valid number' },
        { status: 400 }
      )
    }

    // Find the deal
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        user: true,
        commissions: true
      }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Check if user can access this deal (setters can only see their own)
    if (user.role === UserRole.SETTER && deal.opener !== user.openerName) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Validate and calculate
    const validation = validateDealForCommission(deal)
    if (!validation.isValid) {
      return NextResponse.json({
        dealId,
        isEligible: false,
        validationErrors: validation.reasons,
        commission: null
      })
    }

    const calculationResult = calculateDealCommission(deal)

    return NextResponse.json({
      dealId,
      isEligible: true,
      validationErrors: [],
      commission: {
        total: calculationResult.totalCommission,
        breakdown: calculationResult.breakdown,
        calculatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Commission calculation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}