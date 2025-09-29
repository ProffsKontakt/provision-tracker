import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const shareLeadSchema = z.object({
  dealId: z.number(),
  companyIds: z.array(z.string()),
  sharingMethod: z.enum(['email', 'api', 'manual']),
  emailTemplate: z.string().optional(),
  notes: z.string().optional()
})

const bulkShareSchema = z.object({
  dealIds: z.array(z.number()),
  companyIds: z.array(z.string()),
  sharingMethod: z.enum(['email', 'api', 'manual', 'bulk']),
  emailTemplate: z.string().optional(),
  notes: z.string().optional()
})

/**
 * POST /api/admin/lead-sharing
 * Share leads with companies and start 14-day credit window
 * Supports both single and bulk sharing operations
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()

    // Determine if this is bulk or single sharing
    const isBulk = Array.isArray(body.dealIds)

    if (isBulk) {
      const { dealIds, companyIds, sharingMethod, emailTemplate, notes } = bulkShareSchema.parse(body)

      // Process bulk sharing
      const results = []

      for (const dealId of dealIds) {
        try {
          const result = await shareLeadWithCompanies(dealId, companyIds, user.id, sharingMethod, emailTemplate, notes)
          results.push({ dealId, success: true, result })
        } catch (error) {
          results.push({ dealId, success: false, error: error.message })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return NextResponse.json({
        message: `Bulk sharing completed: ${successCount} successful, ${failCount} failed`,
        results,
        summary: {
          total: dealIds.length,
          successful: successCount,
          failed: failCount
        }
      })

    } else {
      const { dealId, companyIds, sharingMethod, emailTemplate, notes } = shareLeadSchema.parse(body)

      // Process single sharing
      const result = await shareLeadWithCompanies(dealId, companyIds, user.id, sharingMethod, emailTemplate, notes)

      return NextResponse.json({
        message: 'Lead shared successfully',
        result
      })
    }

  } catch (error) {
    console.error('Lead sharing error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to share lead', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/lead-sharing
 * Get lead sharing history and credit window status
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const dealId = searchParams.get('dealId')
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status') // 'active', 'expiring', 'expired'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const whereClause = {
      ...(dealId && { dealId: parseInt(dealId) }),
      ...(companyId && { companyId }),
    }

    // Filter by credit window status
    const now = new Date()
    if (status === 'active') {
      whereClause.creditWindowExpires = { gt: now }
    } else if (status === 'expiring') {
      const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))
      whereClause.creditWindowExpires = {
        gt: now,
        lte: threeDaysFromNow
      }
    } else if (status === 'expired') {
      whereClause.creditWindowExpires = { lte: now }
    }

    const leadShares = await prisma.leadShare.findMany({
      where: whereClause,
      include: {
        deal: {
          include: {
            user: true,
            commissions: {
              where: {
                creditedBack: true
              }
            }
          }
        },
        company: true,
        sharedBy: true
      },
      orderBy: {
        sharedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Calculate credit window status for each share
    const enrichedShares = leadShares.map(share => {
      const daysRemaining = Math.max(0, Math.ceil(
        (share.creditWindowExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ))

      let creditStatus: 'active' | 'expiring' | 'expired' = 'active'
      if (daysRemaining <= 0) {
        creditStatus = 'expired'
      } else if (daysRemaining <= 2) {
        creditStatus = 'expiring'
      }

      // Check if this company has credited this deal
      const hasCredited = share.deal.commissions.some(comm =>
        comm.companyName === share.company.name && comm.creditedBack
      )

      return {
        ...share,
        daysRemaining,
        creditStatus,
        hasCredited
      }
    })

    // Get summary statistics
    const totalShares = await prisma.leadShare.count({ where: whereClause })

    const activeShares = await prisma.leadShare.count({
      where: {
        ...whereClause,
        creditWindowExpires: { gt: now }
      }
    })

    const expiredShares = await prisma.leadShare.count({
      where: {
        ...whereClause,
        creditWindowExpires: { lte: now }
      }
    })

    return NextResponse.json({
      leadShares: enrichedShares,
      pagination: {
        total: totalShares,
        limit,
        offset,
        hasMore: offset + limit < totalShares
      },
      summary: {
        total: totalShares,
        active: activeShares,
        expired: expiredShares,
        expiring: totalShares - activeShares - expiredShares
      }
    })

  } catch (error) {
    console.error('Lead sharing history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead sharing history' },
      { status: 500 }
    )
  }
}

/**
 * Core function to share a lead with multiple companies
 */
async function shareLeadWithCompanies(
  dealId: number,
  companyIds: string[],
  sharedById: string,
  sharingMethod: string,
  emailTemplate?: string,
  notes?: string
): Promise<any> {
  // Verify deal exists and get company assignments
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      user: true,
      leadShares: {
        include: {
          company: true
        }
      }
    }
  })

  if (!deal) {
    throw new Error(`Deal ${dealId} not found`)
  }

  // Verify companies exist
  const companies = await prisma.company.findMany({
    where: {
      id: { in: companyIds },
      active: true
    }
  })

  if (companies.length !== companyIds.length) {
    const foundIds = companies.map(c => c.id)
    const missingIds = companyIds.filter(id => !foundIds.includes(id))
    throw new Error(`Companies not found: ${missingIds.join(', ')}`)
  }

  // Calculate 14-day credit window expiry
  const sharedAt = new Date()
  const creditWindowExpires = new Date(sharedAt.getTime() + (14 * 24 * 60 * 60 * 1000))

  const createdShares = []
  const errors = []

  // Create lead share records for each company
  for (const company of companies) {
    try {
      // Check if already shared with this company
      const existingShare = await prisma.leadShare.findUnique({
        where: {
          dealId_companyId: {
            dealId: dealId,
            companyId: company.id
          }
        }
      })

      if (existingShare) {
        errors.push(`Already shared with ${company.name}`)
        continue
      }

      // Create the lead share record
      const leadShare = await prisma.leadShare.create({
        data: {
          dealId,
          companyId: company.id,
          sharedById,
          sharedAt,
          creditWindowExpires,
          sharingMethod,
          emailSentTo: company.contactEmail
        },
        include: {
          company: true,
          deal: true
        }
      })

      createdShares.push(leadShare)

      // Send email if method is email and we have template
      if (sharingMethod === 'email' && emailTemplate && company.contactEmail) {
        try {
          await sendLeadSharingEmail(company, deal, emailTemplate, leadShare)
        } catch (emailError) {
          console.error(`Failed to send email to ${company.name}:`, emailError)
          errors.push(`Email failed for ${company.name}: ${emailError.message}`)
        }
      }

      // Log the sharing action
      await prisma.systemLog.create({
        data: {
          type: 'lead_sharing',
          source: 'admin',
          message: `Lead ${dealId} shared with ${company.name} via ${sharingMethod}`,
          data: {
            dealId,
            companyId: company.id,
            companyName: company.name,
            sharingMethod,
            sharedById,
            creditWindowExpires,
            notes
          }
        }
      })

    } catch (error) {
      console.error(`Error sharing with ${company.name}:`, error)
      errors.push(`${company.name}: ${error.message}`)
    }
  }

  // Update deal with sharing timestamp if this is the first sharing
  if (createdShares.length > 0 && !deal.sharedWithCompanies) {
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        sharedWithCompanies: sharedAt,
        creditWindowExpires: creditWindowExpires
      }
    })
  }

  return {
    dealId,
    sharedCount: createdShares.length,
    totalRequested: companyIds.length,
    shares: createdShares,
    errors: errors.length > 0 ? errors : null,
    creditWindowExpires
  }
}

/**
 * Send lead sharing email to company
 */
async function sendLeadSharingEmail(company: any, deal: any, template: string, leadShare: any) {
  // This would integrate with your email service (SendGrid, Nodemailer, etc.)
  // For now, just log that we would send an email
  console.log(`Would send email to ${company.contactEmail} for deal ${deal.id}`)

  // Email template variables that could be replaced:
  const emailVariables = {
    companyName: company.name,
    dealTitle: deal.title,
    contactPerson: deal.contactPerson,
    phoneNumber: deal.phoneNumber,
    streetAddress: deal.streetAddress,
    meetingDay: deal.meetingDay,
    meetingTime: deal.meetingTime,
    interestedIn: deal.interestedIn,
    creditWindowExpires: leadShare.creditWindowExpires,
    daysToRespond: 14
  }

  // In production, replace template variables and send actual email
  // await emailService.send({
  //   to: company.contactEmail,
  //   subject: `Ny lead från ProffsKontakt - ${deal.title}`,
  //   html: replaceTemplateVariables(template, emailVariables)
  // })

  return true
}