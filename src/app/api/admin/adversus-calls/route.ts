import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const adversusCallsQuerySchema = z.object({
  unprocessed: z.string().optional().transform(val => val === 'true'),
  hasRecording: z.string().optional().transform(val => val === 'true'),
  markedSuccess: z.string().optional().transform(val => val === 'true'),
  adminReviewed: z.string().optional().transform(val => val === 'true'),
  agentId: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
})

/**
 * GET /api/admin/adversus-calls
 * Get Adversus calls for transcription and review
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER, UserRole.SETTER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const params = {
      unprocessed: searchParams.get('unprocessed'),
      hasRecording: searchParams.get('hasRecording'),
      markedSuccess: searchParams.get('markedSuccess'),
      adminReviewed: searchParams.get('adminReviewed'),
      agentId: searchParams.get('agentId'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    }

    const {
      unprocessed,
      hasRecording,
      markedSuccess,
      adminReviewed,
      agentId,
      limit,
      offset
    } = adversusCallsQuerySchema.parse(params)

    // Build where clause
    const whereClause: any = {}

    // Filter by transcription status
    if (unprocessed) {
      whereClause.transcription = null
    }

    // Filter by recording availability
    if (hasRecording) {
      whereClause.recordingUrl = {
        not: null
      }
    }

    // Filter by success marking
    if (markedSuccess !== undefined) {
      whereClause.markedSuccess = markedSuccess
    }

    // Filter by admin review status
    if (adminReviewed !== undefined) {
      whereClause.adminReviewed = adminReviewed
    }

    // Filter by agent (for setters, automatically filter to their calls)
    if (user.role === UserRole.SETTER) {
      whereClause.agentId = user.adversusAgentId
    } else if (agentId) {
      whereClause.agentId = agentId
    }

    // Get calls with relations
    const calls = await prisma.adversusCall.findMany({
      where: whereClause,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            openerName: true,
            email: true
          }
        },
        transcription: {
          select: {
            id: true,
            status: true,
            salesScore: true,
            customerSentiment: true,
            callQuality: true,
            processingCost: true,
            createdAt: true,
            updatedAt: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            status: true,
            notes: true,
            reviewDuration: true,
            createdAt: true,
            reviewer: {
              select: {
                name: true
              }
            }
          }
        },
        pipedriveDeaI: {
          select: {
            id: true,
            title: true,
            status: true,
            adminApproval: true,
            totalCommission: true
          }
        }
      },
      orderBy: {
        callTimestamp: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.adversusCall.count({ where: whereClause })

    // Enrich calls with calculated fields
    const enrichedCalls = calls.map(call => {
      const hasRecordingAvailable = !!call.recordingUrl
      const isTranscribed = !!call.transcription
      const transcriptionStatus = call.transcription?.status || 'not_started'

      // Calculate call quality metrics
      const durationMinutes = Math.round(call.callDuration / 60)
      const isLongCall = call.callDuration > 300 // > 5 minutes
      const hasGoodOutcome = call.markedSuccess && call.adminReviewed

      return {
        ...call,
        durationMinutes,
        isLongCall,
        hasRecordingAvailable,
        isTranscribed,
        transcriptionStatus,
        hasGoodOutcome,
        canBeTranscribed: hasRecordingAvailable && !isTranscribed,
        needsReview: call.markedSuccess && !call.adminReviewed
      }
    })

    // Calculate summary statistics
    const summary = {
      total: totalCount,
      withRecordings: enrichedCalls.filter(c => c.hasRecordingAvailable).length,
      transcribed: enrichedCalls.filter(c => c.isTranscribed).length,
      pendingTranscription: enrichedCalls.filter(c => c.canBeTranscribed).length,
      markedSuccess: enrichedCalls.filter(c => c.markedSuccess).length,
      needingReview: enrichedCalls.filter(c => c.needsReview).length,
      avgDuration: enrichedCalls.length > 0
        ? enrichedCalls.reduce((sum, c) => sum + c.durationMinutes, 0) / enrichedCalls.length
        : 0,
      avgSalesScore: enrichedCalls.filter(c => c.transcription?.salesScore).length > 0
        ? enrichedCalls
            .filter(c => c.transcription?.salesScore)
            .reduce((sum, c) => sum + c.transcription!.salesScore!, 0) /
          enrichedCalls.filter(c => c.transcription?.salesScore).length
        : 0
    }

    return NextResponse.json({
      calls: enrichedCalls,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary
    })

  } catch (error) {
    console.error('Adversus calls query error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch Adversus calls' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/adversus-calls
 * Update call status (admin review, etc.)
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { callId, updates } = body

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    // Validate allowed update fields
    const allowedFields = [
      'adminReviewed',
      'adminStatus',
      'markedSuccess'
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

    // Check if call exists
    const existingCall = await prisma.adversusCall.findUnique({
      where: { id: callId }
    })

    if (!existingCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    // Update the call
    const updatedCall = await prisma.adversusCall.update({
      where: { id: callId },
      data: updateData,
      include: {
        agent: true,
        transcription: true
      }
    })

    // If this is an admin review, create/update the admin review record
    if (updateData.adminReviewed === true && updateData.adminStatus) {
      await prisma.adminReview.upsert({
        where: { callId },
        create: {
          callId,
          reviewerId: user.id,
          status: updateData.adminStatus,
          notes: updates.notes || null,
          reviewDuration: updates.reviewDuration || null
        },
        update: {
          status: updateData.adminStatus,
          notes: updates.notes || null,
          reviewDuration: updates.reviewDuration || null
        }
      })
    }

    // Log the update
    await prisma.systemLog.create({
      data: {
        type: 'call_review',
        source: 'admin',
        message: `Call ${callId} reviewed: ${updateData.adminStatus || 'status updated'}`,
        data: {
          callId,
          updates: updateData,
          reviewedBy: user.id,
          reviewerName: user.name
        }
      }
    })

    return NextResponse.json({
      message: 'Call updated successfully',
      call: updatedCall
    })

  } catch (error) {
    console.error('Update call error:', error)
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    )
  }
}