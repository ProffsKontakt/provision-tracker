'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Mic,
  Brain,
  FileText,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  BarChart3,
  Download,
  RefreshCw,
  AlertTriangle,
  Zap
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/sv'

interface AdversusCall {
  id: string
  adversusCallId: string
  customerPhone: string
  callDuration: number
  callTimestamp: string
  markedSuccess: boolean
  adminReviewed: boolean
  recordingUrl?: string
  agent?: {
    name: string
    openerName: string
  }
  transcription?: CallTranscription
}

interface CallTranscription {
  id: string
  callId: string
  transcriptionText?: string
  summary?: string
  keyPoints?: string[]
  coachingFeedback?: string
  salesScore?: number
  improvementAreas?: string[]
  customerSentiment?: 'positive' | 'neutral' | 'negative'
  callQuality?: 'excellent' | 'good' | 'fair' | 'poor'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  processingCost?: number
  createdAt: string
  updatedAt: string
}

interface BatchJob {
  id: string
  data: {
    status: string
    totalCalls: number
    processed?: number
    failed?: number
    totalCost?: number
    duration?: number
  }
  createdAt: string
}

export default function AITranscriptionManager() {
  const [calls, setCalls] = useState<AdversusCall[]>([])
  const [transcriptions, setTranscriptions] = useState<CallTranscription[]>([])
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([])
  const [selectedCalls, setSelectedCalls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [includeAnalysis, setIncludeAnalysis] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [processingCallId, setProcessingCallId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load calls available for transcription
      const callsResponse = await fetch('/api/admin/adversus-calls?unprocessed=true&limit=50')
      const callsData = await callsResponse.json()
      setCalls(callsData.calls || [])

      // Load existing transcriptions
      const transcriptionsResponse = await fetch(`/api/ai/transcribe?limit=50${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`)
      const transcriptionsData = await transcriptionsResponse.json()
      setTranscriptions(transcriptionsData.transcriptions || [])

      // Load batch jobs
      const batchResponse = await fetch('/api/ai/batch-transcribe?limit=10')
      const batchData = await batchResponse.json()
      setBatchJobs(batchData.batchJobs || [])

    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSingleTranscription = async (callId: string, includeAI: boolean = includeAnalysis) => {
    try {
      setProcessingCallId(callId)
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          includeAnalysis: includeAI,
          includeSummary
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`✅ Transkription startad för samtal ${callId}\n\n${includeAI ? '🧠 AI-analys inkluderad' : '📝 Endast transkription'}\n\nBearbetning pågår i bakgrunden...`)
        await loadData()
      } else {
        alert(`❌ Fel: ${result.error}`)
      }

    } catch (error) {
      console.error('Transcription failed:', error)
      alert('Transkription misslyckades')
    } finally {
      setProcessingCallId(null)
    }
  }

  const handleBatchTranscription = async () => {
    if (selectedCalls.length === 0) {
      alert('Välj minst ett samtal för batch-bearbetning')
      return
    }

    try {
      setBatchProcessing(true)
      const response = await fetch('/api/ai/batch-transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callIds: selectedCalls,
          includeAnalysis,
          includeSummary,
          priority: 'normal'
        })
      })

      const result = await response.json()

      if (response.ok) {
        setCurrentBatchId(result.batchJobId)
        alert(`Batch-bearbetning startad: ${result.queued} samtal köade`)
        setSelectedCalls([])
        await loadData()
      } else {
        alert(`Fel: ${result.error}`)
      }

    } catch (error) {
      console.error('Batch transcription failed:', error)
      alert('Batch-bearbetning misslyckades')
    } finally {
      setBatchProcessing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-white text-gray-900 border border-gray-300 dark:bg-black dark:text-white dark:border-gray-600'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      case 'neutral': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(cost)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const unprocessedCalls = calls.filter(call => !call.transcription)
  const totalCost = transcriptions.reduce((sum, t) => sum + (t.processingCost || 0), 0)
  const avgSalesScore = transcriptions.filter(t => t.salesScore).length > 0
    ? transcriptions.filter(t => t.salesScore).reduce((sum, t) => sum + t.salesScore!, 0) / transcriptions.filter(t => t.salesScore).length
    : 0

  // Individual call transcription card component
  const CallTranscriptionCard = ({ call, onTranscribe, isProcessing, selectedForBatch, onSelectForBatch }: {
    call: AdversusCall
    onTranscribe: (callId: string, includeAI: boolean) => void
    isProcessing: boolean
    selectedForBatch: boolean
    onSelectForBatch: (selected: boolean) => void
  }) => {
    const [localIncludeAI, setLocalIncludeAI] = useState(true)

    return (
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Checkbox
              checked={selectedForBatch}
              onCheckedChange={onSelectForBatch}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium">
                {call.agent?.name || 'Okänd agent'} → {call.customerPhone}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {dayjs(call.callTimestamp).locale('sv').format('DD MMM YYYY HH:mm')} •
                {formatDuration(call.callDuration)} •
                {call.markedSuccess ? (
                  <span className="text-green-600">Markerad som lyckad</span>
                ) : (
                  <span className="text-gray-500">Ej markerad</span>
                )}
              </div>
              {call.agent?.openerName && (
                <div className="text-xs text-gray-400 mt-1">
                  Opener: {call.agent.openerName}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {call.recordingUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(call.recordingUrl, '_blank')}
              >
                <Play className="w-4 h-4 mr-1" />
                Spela
              </Button>
            )}
          </div>
        </div>

        {/* Transcription controls */}
        <div className="bg-gray-50 p-3 rounded border space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`ai-analysis-${call.id}`}
              checked={localIncludeAI}
              onCheckedChange={setLocalIncludeAI}
            />
            <label htmlFor={`ai-analysis-${call.id}`} className="text-sm font-medium">
              Inkludera AI-analys och coaching
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {localIncludeAI ? (
                <>
                  <span className="text-green-600">✓ Transkription</span>
                  <span className="text-primary ml-2">✓ AI-analys</span>
                  <span className="text-purple-600 ml-2">✓ Coaching</span>
                </>
              ) : (
                <span className="text-green-600">✓ Endast transkription</span>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => onTranscribe(call.id, localIncludeAI)}
              disabled={isProcessing || !call.recordingUrl}
              className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-black"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Bearbetar...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-1" />
                  Transkribera
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Transkription & Coaching</h2>
          <p className="text-gray-600">Endast admin kan transkribera samtal • OpenAI-integration</p>
          {processingCallId && (
            <div className="flex items-center mt-2 text-sm text-black dark:text-white">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              Bearbetar samtal {processingCallId}...
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mic className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-gray-600">Samtal att bearbeta</p>
                <p className="text-2xl font-bold">{unprocessedCalls.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Bearbetade samtal</p>
                <p className="text-2xl font-bold">{transcriptions.filter(t => t.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Snitt säljpoäng</p>
                <p className="text-2xl font-bold">{avgSalesScore.toFixed(1)}/10</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Total kostnad</p>
                <p className="text-2xl font-bold">{formatCost(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="queue">Bearbetningskö</TabsTrigger>
          <TabsTrigger value="results">Resultat & Coaching</TabsTrigger>
          <TabsTrigger value="batch">Batch-bearbetning</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">

          {/* Unprocessed Calls Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Samtal redo för transkription ({unprocessedCalls.length})
              </CardTitle>
              <CardDescription>
                Samtal med inspelningar som kan transkriberas och analyseras. Klicka "Transkribera" för att starta bearbetning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unprocessedCalls.map(call => (
                  <CallTranscriptionCard
                    key={call.id}
                    call={call}
                    onTranscribe={handleSingleTranscription}
                    isProcessing={processingCallId === call.id}
                    selectedForBatch={selectedCalls.includes(call.id)}
                    onSelectForBatch={(selected) => {
                      if (selected) {
                        setSelectedCalls([...selectedCalls, call.id])
                      } else {
                        setSelectedCalls(selectedCalls.filter(id => id !== call.id))
                      }
                    }}
                  />
                ))}

                {unprocessedCalls.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Mic className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    Inga samtal i kön för transkription
                  </div>
                )}
              </div>

              {unprocessedCalls.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedCalls.length === unprocessedCalls.length) {
                            setSelectedCalls([])
                          } else {
                            setSelectedCalls(unprocessedCalls.map(c => c.id))
                          }
                        }}
                      >
                        {selectedCalls.length === unprocessedCalls.length ? 'Avmarkera alla' : 'Markera alla'}
                      </Button>
                      <span className="text-sm text-gray-600">
                        {selectedCalls.length} av {unprocessedCalls.length} valda för batch
                      </span>
                    </div>
                    <Button
                      onClick={handleBatchTranscription}
                      disabled={selectedCalls.length === 0 || batchProcessing}
                    >
                      {batchProcessing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-2" />
                      )}
                      Batch-transkribera ({selectedCalls.length})
                    </Button>
                  </div>

                  <div className="bg-white dark:bg-black border border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="batch-analysis"
                          checked={includeAnalysis}
                          onCheckedChange={setIncludeAnalysis}
                        />
                        <label htmlFor="batch-analysis" className="text-sm font-medium">
                          Inkludera AI-analys för batch-bearbetning
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="batch-summary"
                          checked={includeSummary}
                          onCheckedChange={setIncludeSummary}
                        />
                        <label htmlFor="batch-summary" className="text-sm font-medium">
                          Generera sammanfattningar
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {/* Filter */}
          <div className="flex items-center space-x-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrera status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="completed">Slutförda</SelectItem>
                <SelectItem value="processing">Bearbetas</SelectItem>
                <SelectItem value="failed">Misslyckade</SelectItem>
                <SelectItem value="pending">Väntande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transcription Results */}
          <div className="space-y-4">
            {transcriptions.map(transcription => (
              <Card key={transcription.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(transcription.status)}>
                        {getStatusIcon(transcription.status)}
                        <span className="ml-1">
                          {transcription.status === 'completed' && 'Slutförd'}
                          {transcription.status === 'processing' && 'Bearbetas'}
                          {transcription.status === 'failed' && 'Misslyckad'}
                          {transcription.status === 'pending' && 'Väntande'}
                        </span>
                      </Badge>
                      {transcription.salesScore && (
                        <Badge variant="outline">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          {transcription.salesScore}/10
                        </Badge>
                      )}
                      {transcription.customerSentiment && (
                        <Badge variant="outline" className={getSentimentColor(transcription.customerSentiment)}>
                          {transcription.customerSentiment === 'positive' && '😊 Positiv'}
                          {transcription.customerSentiment === 'neutral' && '😐 Neutral'}
                          {transcription.customerSentiment === 'negative' && '😞 Negativ'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transcription.processingCost && formatCost(transcription.processingCost)}
                    </div>
                  </div>
                </CardHeader>

                {transcription.status === 'completed' && (
                  <CardContent className="space-y-4">
                    {transcription.summary && (
                      <div>
                        <h4 className="font-medium mb-2">Sammanfattning</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                          {transcription.summary}
                        </p>
                      </div>
                    )}

                    {transcription.keyPoints && transcription.keyPoints.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Viktiga punkter</h4>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                          {transcription.keyPoints.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {transcription.coachingFeedback && (
                      <div>
                        <h4 className="font-medium mb-2">Coaching-feedback</h4>
                        <div className="text-sm text-gray-700 bg-white dark:bg-black dark:text-gray-300 border border-gray-300 dark:border-gray-600 p-3 rounded whitespace-pre-wrap">
                          {transcription.coachingFeedback}
                        </div>
                      </div>
                    )}

                    {transcription.improvementAreas && transcription.improvementAreas.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Förbättringsområden</h4>
                        <div className="flex flex-wrap gap-2">
                          {transcription.improvementAreas.map((area, idx) => (
                            <Badge key={idx} variant="outline" className="text-orange-700 border-orange-200">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}

                {transcription.status === 'failed' && transcription.errorMessage && (
                  <CardContent>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {transcription.errorMessage}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                )}
              </Card>
            ))}

            {transcriptions.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  Inga transkriptioner hittades för den valda filtreringen
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch-bearbetningshistorik</CardTitle>
              <CardDescription>
                Översikt över batch-jobb för transkription och analys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {batchJobs.map(job => (
                  <div key={job.id} className="p-4 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(job.data.status)}>
                          {getStatusIcon(job.data.status)}
                          <span className="ml-1">{job.data.status}</span>
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {job.data.totalCalls} samtal
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {dayjs(job.createdAt).locale('sv').format('DD MMM YYYY HH:mm')}
                      </div>
                    </div>

                    {job.data.status === 'processing' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Framsteg</span>
                          <span>{job.data.processed || 0}/{job.data.totalCalls}</span>
                        </div>
                        <Progress
                          value={((job.data.processed || 0) / job.data.totalCalls) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    {job.data.status === 'completed' && (
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <span>✅ {job.data.processed} bearbetade</span>
                        {job.data.failed && job.data.failed > 0 && (
                          <span>❌ {job.data.failed} misslyckade</span>
                        )}
                        {job.data.totalCost && (
                          <span>💰 {formatCost(job.data.totalCost)}</span>
                        )}
                        {job.data.duration && (
                          <span>⏱️ {Math.round(job.data.duration / 1000)}s</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {batchJobs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    Inga batch-jobb hittades
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}