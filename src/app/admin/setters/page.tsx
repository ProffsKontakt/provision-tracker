'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  Phone,
  Clock,
  TrendingUp,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  User
} from 'lucide-react'

interface SetterMetrics {
  id: string
  name: string
  email: string
  status: 'online' | 'offline' | 'busy' | 'away'
  lastActivity: string
  totalCalls: number
  successfulCalls: number
  avgTalkTime: number
  hitRate: number
}

interface SetterPipedriveData {
  setterName: string
  totalDeals: number
  wonDeals: number
  totalValue: number
  wonValue: number
  conversionRate: number
}

export default function SettersPage() {
  const [adversusData, setAdversusData] = useState<{
    agents: SetterMetrics[]
    system_metrics: any
  } | null>(null)
  const [pipedriveData, setPipedriveData] = useState<{
    deals_by_owner: SetterPipedriveData[]
    system_metrics: any
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [adversusResponse, pipedriveResponse] = await Promise.all([
          fetch('/api/adversus/metrics?period=today'),
          fetch('/api/pipedrive/deals?period=month')
        ])

        if (adversusResponse.ok) {
          const adversusResult = await adversusResponse.json()
          setAdversusData(adversusResult)
        }

        if (pipedriveResponse.ok) {
          const pipedriveResult = await pipedriveResponse.json()
          setPipedriveData(pipedriveResult)
        }
      } catch (err) {
        setError('Failed to fetch data')
        console.error('Error fetching setter data:', err)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const agents = adversusData?.agents || []
  const dealsByOwner = pipedriveData?.deals_by_owner || []

  // Combine Adversus and Pipedrive data
  const combinedSetterData = agents.map(agent => {
    const pipedriveStats = dealsByOwner.find(deal =>
      deal.setterName?.toLowerCase() === agent.name?.toLowerCase()
    )

    return {
      ...agent,
      pipedrive: pipedriveStats || {
        totalDeals: 0,
        wonDeals: 0,
        totalValue: 0,
        wonValue: 0,
        conversionRate: 0
      }
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200'
      case 'busy': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'away': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'offline': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPerformanceRating = (hitRate: number) => {
    if (hitRate >= 15) return { label: 'Excellent', color: 'text-green-600', icon: Award }
    if (hitRate >= 10) return { label: 'Good', color: 'text-gray-900 dark:text-white', icon: CheckCircle }
    if (hitRate >= 5) return { label: 'Average', color: 'text-yellow-600', icon: Target }
    return { label: 'Needs Improvement', color: 'text-red-600', icon: AlertCircle }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Setter Performance</h1>
          <p className="text-gray-600 mt-1">
            Individuell prestationsanalys från Adversus och Pipedrive
          </p>
        </div>
        <Button variant="outline">
          <Users className="h-4 w-4 mr-2" />
          Exportera Data
        </Button>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva Setters</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.filter(agent => agent.status === 'online').length}
            </div>
            <p className="text-xs text-muted-foreground">
              av {agents.length} totalt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala Samtal Idag</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.reduce((sum, agent) => sum + agent.totalCalls, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Snitt {Math.round(agents.reduce((sum, agent) => sum + agent.totalCalls, 0) / Math.max(agents.length, 1))} per setter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genomsnittlig Hit Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.length > 0
                ? (agents.reduce((sum, agent) => sum + agent.hitRate, 0) / agents.length).toFixed(1)
                : '0'
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Systemgenomsnitt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('sv-SE', {
                style: 'currency',
                currency: 'SEK',
                maximumFractionDigits: 0
              }).format(dealsByOwner.reduce((sum, deal) => sum + deal.totalValue, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Denna månad
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Setter Performance */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Individuell Prestanda</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {combinedSetterData.map((setter) => {
            const performance = getPerformanceRating(setter.hitRate)
            const PerformanceIcon = performance.icon

            return (
              <Card key={setter.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{setter.name}</CardTitle>
                        <CardDescription>{setter.email}</CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(setter.status)}>
                      {setter.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Performance Rating */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#101827] border border-gray-300 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <PerformanceIcon className={`h-5 w-5 ${performance.color}`} />
                      <span className={`font-medium ${performance.color}`}>
                        {performance.label}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {setter.hitRate.toFixed(1)}% hit rate
                    </span>
                  </div>

                  {/* Adversus Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{setter.totalCalls}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Samtal Idag</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-[#101827] border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{setter.successfulCalls}</div>
                      <div className="text-sm text-green-800">Lyckade</div>
                    </div>
                  </div>

                  {/* Pipedrive Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-purple-50 dark:bg-[#101827] border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{setter.pipedrive.totalDeals}</div>
                      <div className="text-sm text-purple-800">Deals Månad</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-[#101827] border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">
                        {new Intl.NumberFormat('sv-SE', {
                          style: 'currency',
                          currency: 'SEK',
                          maximumFractionDigits: 0
                        }).format(setter.pipedrive.totalValue)}
                      </div>
                      <div className="text-sm text-orange-800">Pipeline Value</div>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="flex justify-between text-sm text-gray-600 pt-2 border-t">
                    <span>Snitt samtalstid: {setter.avgTalkTime}s</span>
                    <span>Konvertering: {setter.pipedrive.conversionRate}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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