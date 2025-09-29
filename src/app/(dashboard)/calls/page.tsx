'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Phone,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Building,
  User,
  FileText
} from 'lucide-react'

interface Lead {
  id: string
  customerName: string
  phone: string
  bookedAt: string
  bookedBy: string
  bolag1: string
  bolag1LeadType: string
  bolag2?: string
  bolag2LeadType?: string
  bolag3?: string
  bolag3LeadType?: string
  bolag4?: string
  bolag4LeadType?: string
  status: 'pending' | 'checked_by_admin' | 'sent_to_company' | 'converted'
  adminCheckDate?: string
  sentToCompanyDate?: string
}

export default function CallsPage() {
  const { data: session } = useSession()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  // Fetch real data from Adversus API
  useEffect(() => {
    const fetchLeads = async () => {
      if (!session?.user?.name) return

      setLoading(true)

      try {
        // Fetch data from our Adversus API endpoint
        const params = new URLSearchParams({
          setterName: session.user.name,
          dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          dateTo: new Date().toISOString()
        })

        const response = await fetch(`/api/adversus/leads?${params}`)
        const data = await response.json()

        if (data.success) {
          // Transform API data to our Lead interface
          const transformedLeads: Lead[] = data.data.map((item: any) => ({
            id: item.id,
            customerName: item.customerName,
            phone: item.customerPhone,
            bookedAt: item.bookedAt,
            bookedBy: item.setterName,
            bolag1: item.bolag1,
            bolag1LeadType: item.bolag1LeadType,
            bolag2: item.bolag2,
            bolag2LeadType: item.bolag2LeadType,
            bolag3: item.bolag3,
            bolag3LeadType: item.bolag3LeadType,
            bolag4: item.bolag4,
            bolag4LeadType: item.bolag4LeadType,
            status: getStatusFromAdversus(item.adminStatus, item.adversusStatus),
            adminCheckDate: item.adminStatus === 'approved' ? item.bookedAt : undefined,
            sentToCompanyDate: item.adminStatus === 'approved' ? item.bookedAt : undefined
          }))

          setLeads(transformedLeads)
        } else {
          console.error('Failed to fetch leads:', data.error)
          setLeads([])
        }
      } catch (error) {
        console.error('Error fetching leads:', error)
        setLeads([])
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchLeads()
    }
  }, [session])

  // Helper function to map Adversus status to our status enum
  const getStatusFromAdversus = (adminStatus: string, adversusStatus: string): Lead['status'] => {
    if (adminStatus === 'approved') {
      return 'sent_to_company'
    } else if (adminStatus === 'rejected') {
      return 'pending' // We'll treat rejected as pending for now
    } else if (adminStatus === 'pending') {
      return 'pending'
    }
    return 'pending'
  }

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300"><Clock className="w-3 h-3 mr-1" />Väntar</Badge>
      case 'checked_by_admin':
        return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" />Godkänd</Badge>
      case 'sent_to_company':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"><Building className="w-3 h-3 mr-1" />Skickad</Badge>
      case 'converted':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300"><CheckCircle className="w-3 h-3 mr-1" />Konverterad</Badge>
      default:
        return <Badge variant="outline">Okänd</Badge>
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone.includes(searchTerm) ||
                         lead.bolag1.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!session) return null

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Samtal & Leads</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Spåra dina bokade leads från Adversus till Pipedrive
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Exportera
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Totalt Bokade</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{leads.length}</p>
              </div>
              <Phone className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Väntar Granskning</p>
                <p className="text-2xl font-bold text-yellow-600">{leads.filter(l => l.status === 'pending').length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Godkända av Admin</p>
                <p className="text-2xl font-bold text-green-600">{leads.filter(l => l.status === 'checked_by_admin' || l.status === 'sent_to_company').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Skickade till Bolag</p>
                <p className="text-2xl font-bold text-blue-600">{leads.filter(l => l.status === 'sent_to_company').length}</p>
              </div>
              <Building className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Sök</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Sök efter kund, telefon eller bolag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="pending">Väntar granskning</SelectItem>
                <SelectItem value="checked_by_admin">Godkänd av admin</SelectItem>
                <SelectItem value="sent_to_company">Skickad till bolag</SelectItem>
                <SelectItem value="converted">Konverterad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dina Bokade Leads</CardTitle>
          <CardDescription>
            Leads bokade från Adversus och deras status i Pipedrive
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-3 text-gray-900 dark:text-white font-medium">Kund</th>
                    <th className="text-left p-3 text-gray-900 dark:text-white font-medium">Bokad</th>
                    <th className="text-left p-3 text-gray-900 dark:text-white font-medium">Bolag & Typ</th>
                    <th className="text-left p-3 text-gray-900 dark:text-white font-medium">Status</th>
                    <th className="text-left p-3 text-gray-900 dark:text-white font-medium">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{lead.customerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{lead.phone}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {new Date(lead.bookedAt).toLocaleDateString('sv-SE')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(lead.bookedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{lead.bolag1}</Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{lead.bolag1LeadType}</span>
                          </div>
                          {lead.bolag2 && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.bolag2}</Badge>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{lead.bolag2LeadType}</span>
                            </div>
                          )}
                          {lead.bolag3 && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.bolag3}</Badge>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{lead.bolag3LeadType}</span>
                            </div>
                          )}
                          {lead.bolag4 && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.bolag4}</Badge>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{lead.bolag4LeadType}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {lead.adminCheckDate && (
                            <div>Admin: {new Date(lead.adminCheckDate).toLocaleDateString('sv-SE')}</div>
                          )}
                          {lead.sentToCompanyDate && (
                            <div>Skickad: {new Date(lead.sentToCompanyDate).toLocaleDateString('sv-SE')}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLeads.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Inga leads hittades med de valda filtren.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}