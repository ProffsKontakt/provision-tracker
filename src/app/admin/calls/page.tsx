'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhoneCall, Clock, Users, TrendingUp, Target, AlertCircle, User } from 'lucide-react'

interface AdversusMetrics {
  system_metrics: {
    total_agents: number
    active_agents: number
    total_calls_today: number
    avg_talk_time: number
    system_hit_rate: number
    calls_per_hour: number
    last_updated: string
  }
  agents: Array<{
    id: string
    name: string
    email: string
    status: string
    totalCalls: number
    successfulCalls: number
    avgTalkTime: number
    hitRate: number
  }>
}

export default function CallsAnalysisPage() {
  const [data, setData] = useState<AdversusMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/adversus/metrics?period=today')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        } else {
          setError('Failed to fetch call data')
        }
      } catch (err) {
        setError('Network error')
        console.error('Error fetching call data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const metrics = data?.system_metrics
  const agents = data?.agents || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200'
      case 'busy': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'away': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'offline': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Samtalsanalys</h1>
          <p className="text-gray-600 mt-1">
            Adversus samtalsdata och kvalitetsanalys
          </p>
        </div>
        {metrics?.last_updated && (
          <Badge variant="outline">
            Uppdaterad: {new Date(metrics.last_updated).toLocaleTimeString('sv-SE')}
          </Badge>
        )}
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala Samtal Idag</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_calls_today || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.calls_per_hour?.toFixed(1) || 0} samtal/timme
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genomsnittlig Samtalstid</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.avg_talk_time ? formatTime(metrics.avg_talk_time) : '0:00'}
            </div>
            <p className="text-xs text-muted-foreground">Optimalt: 3:00-4:00</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active_agents || 0}</div>
            <p className="text-xs text-muted-foreground">
              av {metrics?.total_agents || 0} totalt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Hit Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.system_hit_rate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.system_hit_rate && metrics.system_hit_rate > 10 ? 'Över mål' : 'Under mål'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Agent Performance */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Agent Prestanda</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription className="text-sm">{agent.email}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(agent.status)}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{agent.totalCalls}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">Samtal</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">{agent.successfulCalls}</div>
                    <div className="text-xs text-green-800">Lyckade</div>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hit Rate:</span>
                  <span className={`font-medium ${agent.hitRate > 10 ? 'text-green-600' : 'text-red-600'}`}>
                    {agent.hitRate.toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Snitt tid:</span>
                  <span className="font-medium">{formatTime(agent.avgTalkTime)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}