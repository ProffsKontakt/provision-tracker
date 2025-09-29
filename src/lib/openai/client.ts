import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface TranscriptionResult {
  text: string
  language: string
  duration: number
}

export interface CallAnalysis {
  summary: string
  keyPoints: string[]
  customerSentiment: 'positive' | 'neutral' | 'negative'
  callQuality: 'excellent' | 'good' | 'fair' | 'poor'
  salesScore: number // 1-10
  improvementAreas: string[]
  coachingFeedback: string
}

export interface ProcessingCost {
  transcriptionCost: number
  analysisCost: number
  totalCost: number
  tokensUsed: number
}

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer | File,
  filename: string
): Promise<TranscriptionResult> {
  try {
    const file = new File([audioBuffer], filename, {
      type: 'audio/mpeg' // Adjust based on actual audio format
    })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'sv', // Swedish
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    })

    return {
      text: transcription.text,
      language: transcription.language || 'sv',
      duration: transcription.duration || 0
    }

  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}

/**
 * Analyze call transcription for sales coaching insights
 */
export async function analyzeCallForCoaching(
  transcriptionText: string,
  callMetadata: {
    duration: number
    customerPhone: string
    agentName?: string
    dealContext?: any
  },
  trainingContext?: string
): Promise<CallAnalysis> {
  try {
    const systemPrompt = createCoachingSystemPrompt(trainingContext)
    const userPrompt = createCoachingUserPrompt(transcriptionText, callMetadata)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const analysis = JSON.parse(completion.choices[0].message.content)

    return {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints || [],
      customerSentiment: analysis.customerSentiment || 'neutral',
      callQuality: analysis.callQuality || 'fair',
      salesScore: Math.min(10, Math.max(1, analysis.salesScore || 5)),
      improvementAreas: analysis.improvementAreas || [],
      coachingFeedback: analysis.coachingFeedback || ''
    }

  } catch (error) {
    console.error('Call analysis error:', error)
    throw new Error(`Failed to analyze call: ${error.message}`)
  }
}

/**
 * Generate call summary for admin review
 */
export async function generateCallSummary(
  transcriptionText: string,
  callMetadata: {
    duration: number
    customerPhone: string
    agentName?: string
    timestamp: Date
  }
): Promise<string> {
  try {
    const prompt = `
Analysera följande samtalsutskrift från ett säljsamtal för solceller i Sverige och skapa en koncis sammanfattning på svenska.

SAMTALSINFO:
- Agent: ${callMetadata.agentName || 'Okänd'}
- Kund: ${callMetadata.customerPhone}
- Datum: ${callMetadata.timestamp.toLocaleDateString('sv-SE')}
- Längd: ${Math.round(callMetadata.duration / 60)} minuter

UTSKRIFT:
${transcriptionText}

Skapa en sammanfattning som inkluderar:
1. Kundens intresse och behov
2. Vad som diskuterades
3. Nästa steg (om några)
4. Övergripande resultat av samtalet

Håll sammanfattningen kort (max 200 ord) och fokusera på det väsentliga för provisionsspårning.
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    return completion.choices[0].message.content || 'Kunde inte generera sammanfattning'

  } catch (error) {
    console.error('Summary generation error:', error)
    throw new Error(`Failed to generate summary: ${error.message}`)
  }
}

/**
 * Create system prompt for coaching analysis
 */
function createCoachingSystemPrompt(trainingContext?: string): string {
  const basePrompt = `
Du är en expert på säljcoaching för solcellsförsäljning i Sverige. Din uppgift är att analysera samtalsutskrifter och ge konstruktiv feedback för att förbättra säljarens prestanda.

ANALYSERA:
1. Kundens sentiment (positive, neutral, negative)
2. Samtalskvalitet (excellent, good, fair, poor)
3. Säljpoäng 1-10 baserat på teknik och resultat
4. Förbättringsområden
5. Specifik coaching-feedback

FOKUSOMRÅDEN:
- Rapport-byggande och första intryck
- Behovsanalys och frågeteknik
- Produktpresentation och värdeskapande
- Invändningshantering
- Avslutning och nästa steg
- Professionalism och kommunikation

SVENSKA SÄLJKULTUR:
- Svenskar uppskattar tydlighet och ärlighet
- Undvik aggressiv försäljning
- Fokusera på miljöfördelar och ekonomisk besparing
- Respektera kundens tid och beslutprocess

${trainingContext ? `FÖRETAGETS TRÄNINGSRIKTLINJER:\n${trainingContext}` : ''}

Svara i JSON-format med följande struktur:
{
  "summary": "Kort sammanfattning av samtalet",
  "keyPoints": ["viktiga punkter från samtalet"],
  "customerSentiment": "positive/neutral/negative",
  "callQuality": "excellent/good/fair/poor",
  "salesScore": number,
  "improvementAreas": ["konkreta förbättringsområden"],
  "coachingFeedback": "Detaljerad coaching-feedback på svenska"
}
`

  return basePrompt
}

/**
 * Create user prompt for coaching analysis
 */
function createCoachingUserPrompt(
  transcriptionText: string,
  callMetadata: {
    duration: number
    customerPhone: string
    agentName?: string
    dealContext?: any
  }
): string {
  return `
SAMTALSANALYS - SOLCELLSFÖRSÄLJNING

SAMTALSINFORMATION:
- Agent: ${callMetadata.agentName || 'Okänd'}
- Samtalslängd: ${Math.round(callMetadata.duration / 60)} minuter
- Kund: ${callMetadata.customerPhone}
${callMetadata.dealContext ? `- Affärskontext: ${JSON.stringify(callMetadata.dealContext, null, 2)}` : ''}

SAMTALSUTSKRIFT:
${transcriptionText}

Analysera detta samtal och ge coaching-feedback för att hjälpa säljaren att förbättra sina färdigheter inom solcellsförsäljning.
`
}

/**
 * Calculate processing costs (approximate)
 */
export function calculateProcessingCost(
  transcriptionDuration: number,
  analysisTokens: number,
  summaryTokens: number = 0
): ProcessingCost {
  // OpenAI pricing (approximate, update with current rates)
  const WHISPER_RATE = 0.006 // $0.006 per minute
  const GPT4_INPUT_RATE = 0.00003 // $0.03 per 1K tokens
  const GPT4_OUTPUT_RATE = 0.00006 // $0.06 per 1K tokens
  const GPT4_MINI_RATE = 0.00000015 // Much cheaper for summaries

  const transcriptionMinutes = transcriptionDuration / 60
  const transcriptionCost = transcriptionMinutes * WHISPER_RATE

  const analysisCost = (analysisTokens / 1000) * GPT4_INPUT_RATE +
                      (500 / 1000) * GPT4_OUTPUT_RATE // Estimated output tokens

  const summaryCost = summaryTokens > 0 ?
                     (summaryTokens / 1000) * GPT4_MINI_RATE : 0

  return {
    transcriptionCost,
    analysisCost: analysisCost + summaryCost,
    totalCost: transcriptionCost + analysisCost + summaryCost,
    tokensUsed: analysisTokens + summaryTokens
  }
}

/**
 * Check if OpenAI API is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * Get OpenAI model info
 */
export async function getModelInfo() {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const models = await openai.models.list()
    const availableModels = models.data
      .filter(model =>
        model.id.includes('whisper') ||
        model.id.includes('gpt-4') ||
        model.id.includes('gpt-3.5')
      )
      .map(model => ({
        id: model.id,
        created: model.created,
        ownedBy: model.owned_by
      }))

    return {
      configured: true,
      availableModels,
      recommendedModels: {
        transcription: 'whisper-1',
        analysis: 'gpt-4o',
        summary: 'gpt-4o-mini'
      }
    }

  } catch (error) {
    console.error('Failed to get model info:', error)
    return {
      configured: false,
      error: error.message
    }
  }
}

export { openai }