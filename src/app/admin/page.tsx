'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
  DollarSign,
  Calendar,
  PhoneCall,
  UserCheck,
  Building,
  Timer,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Database,
  Download,
  Info
} from 'lucide-react'

interface SetterMetrics {
  id: string
  name: string
  openerName: string
  adversusAgentId: string
  metrics: {
    totalCalls: number
    successfulCalls: number
    avgTalkTime: number
    hitRate: number
    dealsCreated: number
    pipelineValue: number
    commissionEarned: number
    activeToday: boolean
    lastCallTime: string
  }
  trends: {
    callsChange: number
    hitRateChange: number
    talkTimeChange: number
  }
}

interface SystemMetrics {
  totalSetters: number
  activeSetters: number
  totalCallsToday: number
  avgHitRate: number
  totalDealsInPipeline: number
  totalPipelineValue: number
  systemUptime: number
  apiStatus: {
    adversus: 'online' | 'offline' | 'error'
    pipedrive: 'online' | 'offline' | 'error'
  }
}

export default function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    totalSetters: 12,
    activeSetters: 8,
    totalCallsToday: 245,
    avgHitRate: 12.4,
    totalDealsInPipeline: 67,
    totalPipelineValue: 1250000,
    systemUptime: 99.8,
    apiStatus: {
      adversus: 'online',
      pipedrive: 'online'
    }
  })

  const [setterMetrics, setSetterMetrics] = useState<SetterMetrics[]>([])

  const [isLoading, setIsLoading] = useState(false)

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      console.log('🔄 Fetching real-time metrics from Adversus and Pipedrive...')

      const [adversusResponse, pipedriveResponse, settersResponse] = await Promise.all([
        fetch('/api/adversus/metrics', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        }),
        fetch('/api/pipedrive/deals', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        }),
        fetch('/api/admin/setters', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      ])

      const adversusData = adversusResponse.ok ? await adversusResponse.json() : null
      const pipedriveData = pipedriveResponse.ok ? await pipedriveResponse.json() : null
      const settersData = settersResponse.ok ? await settersResponse.json() : null

      console.log('📊 Adversus data:', adversusData)
      console.log('📊 Pipedrive data:', pipedriveData)
      console.log('👥 Real setters data:', settersData)
      console.log('🔍 Setters response status:', settersResponse.status, settersResponse.ok)
      console.log('🔍 Setters data success:', settersData?.success)
      console.log('🔍 Setters data.setters:', settersData?.setters)

      // Process real data - prioritize database data over Adversus mock data
      if (settersData?.success && settersData.setters) {
        console.log('✅ Using real database setter data')

        const realSetters = settersData.setters.map((setter: any) => {
          // Try to merge with Adversus data if available
          const adversusAgent = adversusData?.agents?.find((agent: any) =>
            agent.name?.toLowerCase().includes(setter.name?.toLowerCase().split(' ')[0])
          )

          return {
            id: setter.id,
            name: setter.name,
            openerName: setter.openerName,
            adversusAgentId: setter.adversusAgentId,
            metrics: {
              totalCalls: adversusAgent?.totalCalls || 0,
              successfulCalls: setter.metrics.successfulLeads,
              avgTalkTime: adversusAgent?.avgTalkTime || 0,
              hitRate: parseFloat(setter.metrics.successRate) || 0,
              dealsCreated: setter.metrics.leadsThisMonth,
              pipelineValue: setter.metrics.thisMonthCommission,
              commissionEarned: setter.metrics.totalCommission,
              activeToday: setter.metrics.activeToday,
              lastCallTime: new Date(setter.metrics.lastActivity).toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit'
              })
            },
            trends: {
              callsChange: 0, // Could be calculated from historical data
              hitRateChange: 0,
              talkTimeChange: 0
            }
          }
        })

        console.log('✅ Processed real setter data from database:', realSetters)
        setSetterMetrics(realSetters)

        // Update system metrics with real data
        if (settersData.systemMetrics) {
          setSystemMetrics(prev => ({
            ...prev,
            totalSetters: settersData.systemMetrics.totalSetters,
            activeSetters: settersData.systemMetrics.activeSetters,
            totalCallsToday: realSetters.reduce((sum: number, setter: any) => sum + setter.metrics.totalCalls, 0),
            avgHitRate: parseFloat(settersData.systemMetrics.avgSuccessRate) || 0,
            totalDealsInPipeline: settersData.systemMetrics.totalLeads,
            totalPipelineValue: settersData.systemMetrics.totalCommission
          }))
        }

      } else if (adversusData?.agents) {
        console.log('⚠️ Falling back to Adversus mock data')
        // Keep the existing Adversus processing as fallback
        const realSetters = adversusData.agents
          .filter((agent: any) => {
            const realTeamMembers = ['moltas', 'frank', 'gustaf', 'carl']
            return realTeamMembers.some(name =>
              agent.name?.toLowerCase().includes(name.toLowerCase())
            )
          })
          .map((agent: any, index: number) => ({
            id: agent.id || `real_${index}`,
            name: agent.name || 'Unknown Setter',
            openerName: agent.openerName || agent.name?.split(' ').map((n: string) => n[0]).join('') || 'N/A',
            adversusAgentId: agent.adversusAgentId || `agent_${index}`,
            metrics: {
              totalCalls: agent.totalCalls || 0,
              successfulCalls: agent.successfulCalls || 0,
              avgTalkTime: agent.avgTalkTime || 0,
              hitRate: agent.hitRate || 0,
              dealsCreated: 0,
              pipelineValue: 0,
              commissionEarned: (agent.successfulCalls || 0) * 100,
              activeToday: agent.status === 'online' || false,
              lastCallTime: agent.lastCallTime || new Date().toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit'
              })
            },
            trends: {
              callsChange: 0,
              hitRateChange: 0,
              talkTimeChange: 0
            }
          }))

        setSetterMetrics(realSetters)
      } else {
        console.log('⚠️ No real data available from any source')
      }

    } catch (error) {
      console.error('❌ Error fetching real metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [selectedPeriod])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800">Online</Badge>
      case 'offline':
        return <Badge className="bg-red-100 text-red-800">Offline</Badge>
      case 'error':
        return <Badge className="bg-yellow-100 text-yellow-800">Error</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUpRight className="h-3 w-3 text-green-600" />
    } else if (change < 0) {
      return <ArrowDownRight className="h-3 w-3 text-red-600" />
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* System Status & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Idag</SelectItem>
              <SelectItem value="yesterday">Igår</SelectItem>
              <SelectItem value="week">Denna vecka</SelectItem>
              <SelectItem value="month">Denna månad</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">API Status:</div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Adversus:</span>
            {getStatusBadge(systemMetrics.apiStatus.adversus)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Pipedrive:</span>
            {getStatusBadge(systemMetrics.apiStatus.pipedrive)}
          </div>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva Setters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemMetrics.activeSetters}/{systemMetrics.totalSetters}
            </div>
            <p className="text-xs text-muted-foreground">
              {((systemMetrics.activeSetters / systemMetrics.totalSetters) * 100).toFixed(0)}% online
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Samtal Idag</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.totalCallsToday}</div>
            <p className="text-xs text-muted-foreground">
              Genomsnitt: {(systemMetrics.totalCallsToday / systemMetrics.activeSetters).toFixed(1)} per setter
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genomsnittlig Hit Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.avgHitRate}%</div>
            <p className="text-xs text-muted-foreground">
              {systemMetrics.avgHitRate > 12 ? 'Över målet (12%)' : 'Under målet (12%)'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Värde</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(systemMetrics.totalPipelineValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemMetrics.totalDealsInPipeline} aktiva deals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setter Performance Table */}
      <Card className="bg-white dark:bg-[#101827]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Setter Performance - Realtidsdata
          </CardTitle>
          <CardDescription>
            Live data från Adversus och Pipedrive APIs - uppdaterad var 30:e sekund
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Setter</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Samtal</th>
                  <th className="text-left p-3">Genomsnittlig Samtalstid</th>
                  <th className="text-left p-3">Hit Rate</th>
                  <th className="text-left p-3">Deals</th>
                  <th className="text-left p-3">Pipeline Värde</th>
                  <th className="text-left p-3">Provision</th>
                </tr>
              </thead>
              <tbody>
                {setterMetrics.map((setter) => (
                  <tr key={setter.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{setter.name}</div>
                        <div className="text-xs text-gray-500">
                          {setter.openerName} • {setter.adversusAgentId}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          setter.metrics.activeToday ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-xs">
                          {setter.metrics.activeToday ? 'Aktiv' : 'Offline'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {setter.metrics.lastCallTime}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{setter.metrics.totalCalls}</span>
                        {getTrendIcon(setter.trends.callsChange)}
                        <span className={`text-xs ${
                          setter.trends.callsChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {setter.trends.callsChange > 0 ? '+' : ''}{setter.trends.callsChange}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {setter.metrics.successfulCalls} framgångsrika
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{formatTime(setter.metrics.avgTalkTime)}</span>
                        {getTrendIcon(setter.trends.talkTimeChange)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {setter.trends.talkTimeChange > 0 ? '+' : ''}{setter.trends.talkTimeChange}% vs igår
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className={`font-medium ${
                          setter.metrics.hitRate > 12 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {setter.metrics.hitRate}%
                        </span>
                        {getTrendIcon(setter.trends.hitRateChange)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(100 / setter.metrics.hitRate).toFixed(0)} samtal per lead
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{setter.metrics.dealsCreated}</div>
                      <div className="text-xs text-gray-500">aktiva deals</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{formatCurrency(setter.metrics.pipelineValue)}</div>
                      <div className="text-xs text-gray-500">
                        {(setter.metrics.pipelineValue / setter.metrics.dealsCreated || 0).toFixed(0)} kr/deal
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-green-600">
                        {formatCurrency(setter.metrics.commissionEarned)}
                      </div>
                      <div className="text-xs text-gray-500">denna period</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Aktivitet
            </CardTitle>
            <CardDescription>
              Realtidsflöde från Adversus och Pipedrive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#101827] border border-gray-300 dark:border-gray-600 rounded-lg">
                <Clock className="h-4 w-4 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Väntar på realtidsdata</p>
                  <p className="text-xs text-gray-600">Aktivitetsflöde kommer att visas här från Adversus</p>
                </div>
                <span className="text-xs text-gray-400">-</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card className="bg-white dark:bg-[#101827]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Automatisk analys av prestationsmönster
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Insights kommer snart:</strong> Automatisk analys av prestationsmönster från Adversus data
                  kommer att visas här när tillräckligt med data har samlats in.
                </AlertDescription>
              </Alert>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium mb-2">Kommande funktioner:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• Realtidsanalys av samtalsprestanda</li>
                  <li>• Automatiska coaching-rekommendationer</li>
                  <li>• Trendanalys för varje setter</li>
                  <li>• Lead-kvalitetsbedömning</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Management */}
      <Card className="bg-white dark:bg-[#101827]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Adversus Databashantering
          </CardTitle>
          <CardDescription>
            Importera och synkronisera leads från Adversus API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DatabaseManager />
        </CardContent>
      </Card>
    </div>
  )
}

function DatabaseManager() {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<any>(null)

  const handlePopulateDatabase = async () => {
    setIsLoading(true)
    setStatus('Connecting to Adversus API...')
    setResult(null)

    try {
      const response = await fetch('/api/admin/populate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          openers: ['Moltas', 'Frank', 'Gustaf', 'Carl'],
          forceRefresh: true
        })
      })

      const data = await response.json()

      if (data.success) {
        setStatus('✅ Database population completed successfully!')
        setResult(data.summary)
      } else {
        setStatus(`❌ Error: ${data.message || data.error}`)
        setResult(data)
      }

    } catch (error: any) {
      setStatus(`💥 Network error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handlePopulateDatabase}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Importerar...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Importera Adversus Leads
            </>
          )}
        </Button>

        <div className="text-sm text-gray-600">
          Importerar success leads för Moltas, Frank, Gustaf, Carl
        </div>
      </div>

      {status && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="bg-gray-50 dark:bg-[#101827] p-4 rounded-lg">
          <h4 className="font-medium mb-3">Import Resultat:</h4>

          {result.totalLeads !== undefined && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.totalLeads}</div>
                <div className="text-sm text-gray-600">Totalt Leads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.totalBaseCommission}</div>
                <div className="text-sm text-gray-600">Base Provision (SEK)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{Object.keys(result.leadsPerOpener || {}).length}</div>
                <div className="text-sm text-gray-600">Aktiva Säljare</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">100</div>
                <div className="text-sm text-gray-600">SEK per Lead</div>
              </div>
            </div>
          )}

          {result.leadsPerOpener && (
            <div>
              <h5 className="font-medium mb-2">Leads per Säljare:</h5>
              <div className="space-y-2">
                {Object.entries(result.leadsPerOpener).map(([opener, count]) => (
                  <div key={opener} className="flex justify-between items-center">
                    <span>{opener}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{count as number} leads</span>
                      <span className="text-sm text-gray-500">
                        ({((count as number) * 100).toLocaleString()} SEK)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.metadata && (
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <div>Timestamp: {new Date(result.metadata.timestamp).toLocaleString('sv-SE')}</div>
              <div>Fields found: {result.metadata.fieldsFound}</div>
              <div>Users found: {result.metadata.usersFound}</div>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-[#101827] p-4 rounded-lg">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Information
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Systemet använder Adversus API för att hämta leads med status "success"</li>
          <li>• Filtrerar på result field "Opener" för Moltas, Frank, Gustaf, Carl</li>
          <li>• Basprovision: 100 SEK per lead</li>
          <li>• Extra provision: +100 SEK per offert, +300 SEK per platsbesök</li>
          <li>• Import kan ta flera minuter beroende på antal leads</li>
        </ul>
      </div>
    </div>
  )
}