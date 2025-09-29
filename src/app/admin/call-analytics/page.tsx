'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Phone,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Target,
  Award,
  AlertCircle,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  BarChart3
} from 'lucide-react'

interface CallRecord {
  id: string
  agentId: string
  agentName: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  callDateTime: string
  callDuration: number
  callStatus: 'success' | 'not_interested' | 'callback' | 'busy' | 'no_answer' | 'do_not_call' | 'wrong_number'
  leadStatus: 'new' | 'contacted' | 'interested' | 'not_interested' | 'appointment_booked' | 'sale' | 'closed_lost'
  appointmentId?: string
  notes?: string
  campaignName: string
  adminCheckStatus: 'Godkänt' | 'Underkänt' | 'Pending' | ''
  adminCheckedBy?: string
  adminCheckedAt?: string
  leadQualityScore: number
  propertyType?: string
  interestLevel?: string
  bolagAssignment?: string
  leadSource?: string
  energyInterest: string[]
  followUpRequired: boolean
  saleProbability: number
  createdAt: string
  updatedAt: string
}

interface CallAnalytics {
  totalCalls: number
  successfulCalls: number
  interestedLeads: number
  appointmentsBooked: number
  successRate: number
  conversionRate: number
  appointmentRate: number
  adminApprovalRate: number
  callStatusBreakdown: Record<string, number>
  leadStatusBreakdown: Record<string, number>
  adminCheckBreakdown: Record<string, number>
  agentPerformance: Record<string, any>
}

export default function CallAnalyticsPage() {
  const [callRecords, setCallRecords] = useState<CallRecord[]>([])
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })
  const [selectedRecord, setSelectedRecord] = useState<CallRecord | null>(null)

  useEffect(() => {
    fetchCallRecords()
  }, [selectedAgent, dateRange])

  const fetchCallRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        dateFrom: `${dateRange.from}T00:00:00Z`,
        dateTo: `${dateRange.to}T23:59:59Z`
      })

      if (selectedAgent !== 'all') {
        params.append('agentId', selectedAgent)
      }

      const response = await fetch(`/api/adversus/call-records?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch call records')
      }

      const data = await response.json()
      setCallRecords(data.data || [])
      setAnalytics(data.analytics)
      setError(null)
    } catch (err) {
      setError('Failed to fetch call records')
      console.error('Error fetching call records:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateAdminStatus = async (callId: string, status: 'Godkänt' | 'Underkänt', notes?: string) => {
    try {
      const response = await fetch('/api/adversus/call-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          callId,
          adminCheckStatus: status,
          notes
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update admin status')
      }

      // Refresh data
      fetchCallRecords()
      setSelectedRecord(null)
    } catch (err) {
      console.error('Error updating admin status:', err)
    }
  }

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200'
      case 'not_interested': return 'bg-red-100 text-red-800 border-red-200'
      case 'callback': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'busy': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'no_answer': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAdminStatusColor = (status: string) => {
    switch (status) {
      case 'Godkänt': return 'bg-green-100 text-green-800 border-green-200'
      case 'Underkänt': return 'bg-red-100 text-red-800 border-red-200'
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "Agent,Customer,Phone,Call Date,Duration,Call Status,Lead Status,Admin Status,Quality Score,Notes\n" +
      callRecords.map(record =>
        `"${record.agentName}","${record.customerName}","${record.customerPhone}","${record.callDateTime}","${formatDuration(record.callDuration)}","${record.callStatus}","${record.leadStatus}","${record.adminCheckStatus}","${record.leadQualityScore}","${record.notes || ''}"`
      ).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `call-analytics-${dateRange.from}-${dateRange.to}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Analytics & Admin Review</h1>
          <p className="text-gray-600 mt-1">
            Detaljerad analys av samtal från Adversus - senaste {callRecords.length} samtalen
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportera CSV
          </Button>
          <Button onClick={fetchCallRecords} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Datum
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Agent</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Välj agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla agenter</SelectItem>
                <SelectItem value="agent_moltas">Moltas Roslund</SelectItem>
                <SelectItem value="agent_gustaf">Gustaf Linder</SelectItem>
                <SelectItem value="agent_carl">Carl Brun</SelectItem>
                <SelectItem value="agent_frank">Frank Omsén</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Från datum</label>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Till datum</label>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totalt Samtal</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalCalls}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.successfulCalls} lyckade ({analytics.successRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Konverteringsgrad</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.interestedLeads} intresserade leads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Möten Bokade</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.appointmentsBooked}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.appointmentRate.toFixed(1)}% av alla samtal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Godkännande</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.adminApprovalRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Av granskade samtal
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Breakdown */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Samtalsstatus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.callStatusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <Badge className={getCallStatusColor(status)}>
                      {status.replace('_', ' ')}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.leadStatusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <Badge variant="outline">
                      {status.replace('_', ' ')}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Granskning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.adminCheckBreakdown).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <Badge className={getAdminStatusColor(status)}>
                      {status === 'Not Checked' ? 'Ej granskad' : status}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Performance */}
      {analytics && Object.keys(analytics.agentPerformance).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agent Prestanda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Agent</th>
                    <th className="text-right p-2">Samtal</th>
                    <th className="text-right p-2">Lyckade</th>
                    <th className="text-right p-2">Intresse</th>
                    <th className="text-right p-2">Möten</th>
                    <th className="text-right p-2">Snitt Tid</th>
                    <th className="text-right p-2">Godkänt</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.agentPerformance).map(([agentName, performance]) => (
                    <tr key={agentName} className="border-b">
                      <td className="p-2 font-medium">{agentName}</td>
                      <td className="text-right p-2">{performance.totalCalls}</td>
                      <td className="text-right p-2">
                        {performance.successfulCalls} ({performance.successRate.toFixed(1)}%)
                      </td>
                      <td className="text-right p-2">
                        {performance.interestedLeads} ({performance.conversionRate.toFixed(1)}%)
                      </td>
                      <td className="text-right p-2">
                        {performance.appointmentsBooked} ({performance.appointmentRate.toFixed(1)}%)
                      </td>
                      <td className="text-right p-2">
                        {formatDuration(Math.round(performance.averageCallDuration))}
                      </td>
                      <td className="text-right p-2">
                        {performance.approvedLeads}/{performance.approvedLeads + performance.rejectedLeads} ({performance.approvalRate.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Samtalshistorik ({callRecords.length} samtal)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Agent</th>
                  <th className="text-left p-2">Kund</th>
                  <th className="text-left p-2">Telefon</th>
                  <th className="text-left p-2">Datum</th>
                  <th className="text-right p-2">Tid</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Lead</th>
                  <th className="text-left p-2">Admin</th>
                  <th className="text-right p-2">Kvalitet</th>
                  <th className="text-left p-2">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {callRecords.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{record.agentName}</td>
                    <td className="p-2">{record.customerName}</td>
                    <td className="p-2">{record.customerPhone}</td>
                    <td className="p-2">
                      {new Date(record.callDateTime).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="text-right p-2">{formatDuration(record.callDuration)}</td>
                    <td className="p-2">
                      <Badge className={getCallStatusColor(record.callStatus)}>
                        {record.callStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">
                        {record.leadStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={getAdminStatusColor(record.adminCheckStatus)}>
                        {record.adminCheckStatus || 'Ej granskad'}
                      </Badge>
                    </td>
                    <td className="text-right p-2">
                      <span className={`font-medium ${record.leadQualityScore >= 8 ? 'text-green-600' : record.leadQualityScore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {record.leadQualityScore}/10
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {!record.adminCheckStatus && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => updateAdminStatus(record.id, 'Godkänt')}
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => updateAdminStatus(record.id, 'Underkänt')}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRecord(record)}
                        >
                          Detaljer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-black rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Samtalsdetaljer</h3>
              <Button variant="outline" onClick={() => setSelectedRecord(null)}>
                Stäng
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Kund</label>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedRecord.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Telefon</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.customerPhone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Agent</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.agentName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Samtalstid</label>
                  <p className="text-gray-900 dark:text-white">{formatDuration(selectedRecord.callDuration)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Adress</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.customerAddress || 'Ej angiven'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Kampanj</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.campaignName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Fastighetstyp</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.propertyType || 'Ej angiven'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Intressenivå</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.interestLevel || 'Ej angiven'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Bolag tilldelning</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.bolagAssignment || 'Ej tilldelad'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Försäljningssannolikhet</label>
                  <p className="text-gray-900 dark:text-white">{selectedRecord.saleProbability}%</p>
                </div>
              </div>

              {selectedRecord.energyInterest.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Energiintresse</label>
                  <div className="flex gap-2 mt-1">
                    {selectedRecord.energyInterest.map((interest, index) => (
                      <Badge key={index} variant="outline">{interest}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Anteckningar</label>
                  <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-900 dark:text-white">{selectedRecord.notes}</p>
                </div>
              )}

              {!selectedRecord.adminCheckStatus && (
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => updateAdminStatus(selectedRecord.id, 'Godkänt')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Godkänn Lead
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => updateAdminStatus(selectedRecord.id, 'Underkänt')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Underkänn Lead
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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