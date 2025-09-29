import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isOpenAIConfigured } from '@/lib/openai/client'
import { z } from 'zod'

const batchTranscribeSchema = z.object({
  callIds: z.array(z.string()).min(1).max(50), // Limit batch size
  includeAnalysis: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  forceReprocess: z.boolean().default(false),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
})

/**
 * POST /api/ai/batch-transcribe
 * Queue multiple calls for transcription and analysis
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: 'OpenAI API not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await req.json()
    const { callIds, includeAnalysis, includeSummary, forceReprocess, priority } = batchTranscribeSchema.parse(body)

    // Validate all calls exist
    const calls = await prisma.adversusCall.findMany({
      where: {
        id: { in: callIds }
      },
      include: {
        transcription: true
      }
    })

    if (calls.length !== callIds.length) {
      const foundIds = calls.map(c => c.id)
      const missingIds = callIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: 'Some calls not found', missingIds },
        { status: 404 }
      )
    }

    // Filter out already processed calls (unless forcing reprocess)
    const callsToProcess = forceReprocess
      ? calls
      : calls.filter(call => !call.transcription || call.transcription.status === 'failed')

    if (callsToProcess.length === 0) {
      return NextResponse.json({
        message: 'All calls already processed',
        alreadyProcessed: calls.length,
        queued: 0
      })
    }

    // Create batch job record
    const batchJob = await prisma.systemLog.create({
      data: {
        type: 'batch_transcription',
        source: 'ai_processing',
        message: `Batch transcription queued: ${callsToProcess.length} calls`,
        data: {
          callIds: callsToProcess.map(c => c.id),
          totalCalls: callsToProcess.length,
          includeAnalysis,
          includeSummary,
          forceReprocess,
          priority,
          requestedBy: user.id,
          status: 'queued'
        }
      }
    })

    // Start processing in background
    processBatchTranscription(
      batchJob.id,
      callsToProcess,
      {
        includeAnalysis,
        includeSummary,
        forceReprocess,
        priority,
        requestedBy: user.id
      }
    ).catch(error => {
      console.error('Batch processing failed:', error)
    })

    return NextResponse.json({
      message: `Queued ${callsToProcess.length} calls for transcription`,
      batchJobId: batchJob.id,
      queued: callsToProcess.length,
      alreadyProcessed: calls.length - callsToProcess.length,
      estimatedDuration: estimateProcessingTime(callsToProcess)
    })

  } catch (error) {
    console.error('Batch transcription error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to queue batch transcription' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/batch-transcribe
 * Get batch processing status and history
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const batchJobId = searchParams.get('batchJobId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (batchJobId) {
      // Get specific batch job status
      const batchJob = await prisma.systemLog.findUnique({
        where: { id: batchJobId }
      })

      if (!batchJob) {
        return NextResponse.json(
          { error: 'Batch job not found' },
          { status: 404 }
        )
      }

      // Get progress of individual calls
      const callIds = batchJob.data?.callIds || []
      const callProgress = await prisma.callTranscription.findMany({
        where: {
          callId: { in: callIds }
        },
        select: {
          callId: true,
          status: true,
          salesScore: true,
          processingCost: true,
          updatedAt: true
        }
      })

      const progressSummary = {
        total: callIds.length,
        completed: callProgress.filter(c => c.status === 'completed').length,
        processing: callProgress.filter(c => c.status === 'processing').length,
        failed: callProgress.filter(c => c.status === 'failed').length,
        pending: callIds.length - callProgress.length
      }

      return NextResponse.json({
        batchJob,
        progress: progressSummary,
        callProgress
      })
    }

    // Get recent batch jobs
    const batchJobs = await prisma.systemLog.findMany({
      where: {
        type: 'batch_transcription',
        source: 'ai_processing'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({ batchJobs })

  } catch (error) {
    console.error('Get batch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get batch status' },
      { status: 500 }
    )
  }
}

/**
 * Process batch transcription in background
 */
async function processBatchTranscription(
  batchJobId: string,
  calls: any[],
  options: {
    includeAnalysis: boolean
    includeSummary: boolean
    forceReprocess: boolean
    priority: string
    requestedBy: string
  }
) {
  const startTime = Date.now()
  let processed = 0
  let failed = 0
  let totalCost = 0

  try {
    // Update batch status to processing
    await prisma.systemLog.update({
      where: { id: batchJobId },
      data: {
        data: {
          ...options,
          status: 'processing',
          startedAt: new Date(),
          callIds: calls.map(c => c.id),
          totalCalls: calls.length
        }
      }
    })

    // Process calls with rate limiting
    for (const call of calls) {
      try {
        console.log(`🔄 Processing call ${call.id} (${processed + 1}/${calls.length})`)

        // Call the transcription API internally
        const transcribeResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/ai/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`
          },
          body: JSON.stringify({
            callId: call.id,
            includeAnalysis: options.includeAnalysis,
            includeSummary: options.includeSummary,
            forceReprocess: options.forceReprocess
          })
        })

        if (transcribeResponse.ok) {
          const result = await transcribeResponse.json()
          totalCost += result.costs?.totalCost || 0
          processed++
          console.log(`✅ Processed call ${call.id}`)
        } else {
          const error = await transcribeResponse.text()
          console.error(`❌ Failed to process call ${call.id}:`, error)
          failed++
        }

        // Rate limiting: wait between requests to avoid API limits
        if (processed % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second pause every 5 calls
        }

      } catch (callError) {
        console.error(`❌ Call ${call.id} processing error:`, callError)
        failed++
      }
    }

    const duration = Date.now() - startTime

    // Update batch status to completed
    await prisma.systemLog.update({
      where: { id: batchJobId },
      data: {
        data: {
          ...options,
          status: 'completed',
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration,
          callIds: calls.map(c => c.id),
          totalCalls: calls.length,
          processed,
          failed,
          totalCost
        }
      }
    })

    console.log(`🎉 Batch ${batchJobId} completed: ${processed} processed, ${failed} failed in ${duration}ms`)

  } catch (batchError) {
    console.error(`❌ Batch ${batchJobId} failed:`, batchError)

    // Update batch status to failed
    await prisma.systemLog.update({
      where: { id: batchJobId },
      data: {
        data: {
          ...options,
          status: 'failed',
          error: batchError.message,
          processed,
          failed,
          totalCost
        }
      }
    })
  }
}

/**
 * Estimate processing time for batch
 */
function estimateProcessingTime(calls: any[]): string {
  const avgProcessingTime = 30 // seconds per call (rough estimate)
  const totalSeconds = calls.length * avgProcessingTime

  if (totalSeconds < 60) {
    return `${totalSeconds} sekunder`
  } else if (totalSeconds < 3600) {
    return `${Math.round(totalSeconds / 60)} minuter`
  } else {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.round((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}min`
  }
}