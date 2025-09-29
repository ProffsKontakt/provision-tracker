import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { transcribeAudio, analyzeCallForCoaching, generateCallSummary, calculateProcessingCost, isOpenAIConfigured } from '@/lib/openai/client'
import { z } from 'zod'

const transcribeSchema = z.object({
  callId: z.string(),
  audioUrl: z.string().url().optional(),
  includeAnalysis: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  forceReprocess: z.boolean().default(false)
})

/**
 * POST /api/ai/transcribe
 * Transcribe and analyze call recordings using OpenAI
 * ONLY transcribes when explicitly requested by admin users
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  // Log the transcription request for audit purposes
  console.log(`🎙️ Transcription requested by admin: ${user.name} (${user.email})`)

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: 'OpenAI API not configured. Please set OPENAI_API_KEY environment variable.' },
      { status: 503 }
    )
  }

  try {
    const body = await req.json()
    const { callId, audioUrl, includeAnalysis, includeSummary, forceReprocess } = transcribeSchema.parse(body)

    // Get the call record
    const adversusCall = await prisma.adversusCall.findUnique({
      where: { id: callId },
      include: {
        agent: true,
        transcription: true,
        pipedriveDeaI: {
          include: {
            user: true
          }
        }
      }
    })

    if (!adversusCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    // Check if already processed and not forcing reprocess
    if (adversusCall.transcription && !forceReprocess) {
      return NextResponse.json({
        message: 'Call already transcribed',
        transcription: adversusCall.transcription,
        reprocessed: false
      })
    }

    // Log the transcription request for audit and compliance
    await prisma.systemLog.create({
      data: {
        type: 'transcription_requested',
        source: 'admin_manual',
        message: `Transcription manually requested for call ${callId}`,
        data: {
          callId,
          requestedBy: user.id,
          requestedByName: user.name,
          requestedByEmail: user.email,
          includeAnalysis,
          includeSummary,
          forceReprocess,
          audioUrl: audioUrl || adversusCall.recordingUrl
        }
      }
    })

    // Set processing status
    await updateTranscriptionStatus(callId, 'processing', 'Starting transcription...')

    let audioBuffer: Buffer
    const recordingUrl = audioUrl || adversusCall.recordingUrl

    if (!recordingUrl) {
      throw new Error('No recording URL available for this call')
    }

    try {
      // Download audio file
      const audioResponse = await fetch(recordingUrl)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`)
      }
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    } catch (downloadError) {
      await updateTranscriptionStatus(callId, 'failed', `Audio download failed: ${downloadError.message}`)
      throw downloadError
    }

    // Step 1: Transcribe audio
    let transcriptionResult
    try {
      await updateTranscriptionStatus(callId, 'processing', 'Transcribing audio...')

      const filename = `call_${callId}_${Date.now()}.mp3`
      transcriptionResult = await transcribeAudio(audioBuffer, filename)

      console.log(`✅ Transcribed call ${callId}: ${transcriptionResult.text.length} characters`)
    } catch (transcriptionError) {
      await updateTranscriptionStatus(callId, 'failed', `Transcription failed: ${transcriptionError.message}`)
      throw transcriptionError
    }

    // Step 2: Generate summary (if requested)
    let summary = null
    let summaryTokens = 0
    if (includeSummary && transcriptionResult.text.length > 50) {
      try {
        await updateTranscriptionStatus(callId, 'processing', 'Generating summary...')

        summary = await generateCallSummary(transcriptionResult.text, {
          duration: adversusCall.callDuration,
          customerPhone: adversusCall.customerPhone,
          agentName: adversusCall.agent?.name,
          timestamp: adversusCall.callTimestamp
        })

        summaryTokens = Math.ceil(summary.length / 4) // Rough token estimate
        console.log(`✅ Generated summary for call ${callId}`)
      } catch (summaryError) {
        console.error('Summary generation failed:', summaryError)
        summary = 'Kunde inte generera sammanfattning'
      }
    }

    // Step 3: Analyze for coaching (if requested)
    let analysisResult = null
    let analysisTokens = 0
    if (includeAnalysis && transcriptionResult.text.length > 100) {
      try {
        await updateTranscriptionStatus(callId, 'processing', 'Analyzing for coaching insights...')

        // Get training context
        const trainingContext = await getTrainingContext()

        analysisResult = await analyzeCallForCoaching(
          transcriptionResult.text,
          {
            duration: adversusCall.callDuration,
            customerPhone: adversusCall.customerPhone,
            agentName: adversusCall.agent?.name,
            dealContext: adversusCall.pipedriveDeaI
          },
          trainingContext
        )

        analysisTokens = Math.ceil(transcriptionResult.text.length / 4) + 500 // Input + output estimate
        console.log(`✅ Analyzed call ${callId}: Score ${analysisResult.salesScore}/10`)
      } catch (analysisError) {
        console.error('Call analysis failed:', analysisError)
        analysisResult = {
          summary: 'Analys misslyckades',
          keyPoints: [],
          customerSentiment: 'neutral' as const,
          callQuality: 'fair' as const,
          salesScore: 5,
          improvementAreas: [],
          coachingFeedback: 'Kunde inte generera coaching-feedback'
        }
      }
    }

    // Step 4: Calculate costs
    const costs = calculateProcessingCost(
      transcriptionResult.duration,
      analysisTokens,
      summaryTokens
    )

    // Step 5: Save results to database
    const transcriptionData = {
      callId,
      transcriptionText: transcriptionResult.text,
      summary,
      keyPoints: analysisResult?.keyPoints || null,
      coachingFeedback: analysisResult?.coachingFeedback || null,
      salesScore: analysisResult?.salesScore || null,
      improvementAreas: analysisResult?.improvementAreas || null,
      customerSentiment: analysisResult?.customerSentiment || null,
      callQuality: analysisResult?.callQuality || null,
      status: 'completed',
      openaiModel: 'whisper-1 + gpt-4o',
      processingCost: costs.totalCost
    }

    const savedTranscription = await prisma.callTranscription.upsert({
      where: { callId },
      create: transcriptionData,
      update: transcriptionData
    })

    // Update call with AI processing flag
    await prisma.adversusCall.update({
      where: { id: callId },
      data: { hasAiProcessing: true }
    })

    // Log the processing
    await prisma.systemLog.create({
      data: {
        type: 'ai_processing',
        source: 'transcription',
        message: `Call ${callId} processed successfully`,
        data: {
          callId,
          transcriptionLength: transcriptionResult.text.length,
          salesScore: analysisResult?.salesScore,
          processingCost: costs.totalCost,
          duration: transcriptionResult.duration,
          processedBy: user.id
        }
      }
    })

    return NextResponse.json({
      message: 'Call transcribed and analyzed successfully',
      transcription: savedTranscription,
      costs,
      reprocessed: forceReprocess
    })

  } catch (error) {
    console.error('Transcription processing error:', error)

    // Update status to failed
    if (typeof error === 'object' && 'callId' in error) {
      await updateTranscriptionStatus(error.callId as string, 'failed', error.message)
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Transcription failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/transcribe
 * Get transcription status and results
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER, UserRole.SETTER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const callId = searchParams.get('callId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') // 'pending', 'processing', 'completed', 'failed'

    if (callId) {
      // Get specific transcription
      const transcription = await prisma.callTranscription.findUnique({
        where: { callId },
        include: {
          adversusCall: {
            include: {
              agent: true
            }
          }
        }
      })

      if (!transcription) {
        return NextResponse.json(
          { error: 'Transcription not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ transcription })
    }

    // Get list of transcriptions
    const whereClause: any = {}
    if (status) {
      whereClause.status = status
    }

    // If user is a SETTER, only show their own calls
    if (user.role === UserRole.SETTER) {
      whereClause.adversusCall = {
        agentId: user.adversusAgentId
      }
    }

    const transcriptions = await prisma.callTranscription.findMany({
      where: whereClause,
      include: {
        adversusCall: {
          include: {
            agent: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    const total = await prisma.callTranscription.count({ where: whereClause })

    return NextResponse.json({
      transcriptions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Get transcriptions error:', error)
    return NextResponse.json(
      { error: 'Failed to get transcriptions' },
      { status: 500 }
    )
  }
}

/**
 * Update transcription status
 */
async function updateTranscriptionStatus(callId: string, status: string, message?: string) {
  try {
    await prisma.callTranscription.upsert({
      where: { callId },
      create: {
        callId,
        status,
        errorMessage: status === 'failed' ? message : null
      },
      update: {
        status,
        errorMessage: status === 'failed' ? message : null,
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to update transcription status:', error)
  }
}

/**
 * Get training context for coaching analysis
 */
async function getTrainingContext(): Promise<string> {
  try {
    const trainingMaterials = await prisma.salesTrainingMaterial.findMany({
      where: {
        active: true
      },
      orderBy: {
        priority: 'desc'
      },
      take: 5 // Limit to avoid token limits
    })

    if (trainingMaterials.length === 0) {
      return ''
    }

    return trainingMaterials
      .map(material => `${material.title}:\n${material.content.substring(0, 1000)}`)
      .join('\n\n')

  } catch (error) {
    console.error('Failed to get training context:', error)
    return ''
  }
}