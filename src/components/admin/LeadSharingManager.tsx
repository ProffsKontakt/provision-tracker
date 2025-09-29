'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Share2, Clock, AlertTriangle, CheckCircle, Mail, Calendar, Building } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/sv'

interface Deal {
  id: number
  title: string
  contactPerson: string
  phoneNumber: string
  streetAddress: string
  company1: string
  company2: string
  company3: string
  company4: string
  dealCreated: string
  user: {
    name: string
    openerName: string
  }
}

interface Company {
  id: string
  name: string
  contactEmail: string
  contactPhone: string
  active: boolean
}

interface LeadShare {
  id: string
  dealId: number
  companyId: string
  sharedAt: string
  creditWindowExpires: string
  sharingMethod: string
  emailSentTo: string
  acknowledged: boolean
  daysRemaining: number
  creditStatus: 'active' | 'expiring' | 'expired'
  hasCredited: boolean
  deal: Deal
  company: Company
  sharedBy: {
    name: string
  }
}

export default function LeadSharingManager() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [leadShares, setLeadShares] = useState<LeadShare[]>([])
  const [selectedDeals, setSelectedDeals] = useState<number[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [sharingMethod, setSharingMethod] = useState<'email' | 'api' | 'manual'>('email')
  const [emailTemplate, setEmailTemplate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')

  // Default email template
  const defaultEmailTemplate = `Hej {{companyName}},

Vi har en ny lead från ProffsKontakt som kan vara intressant för er:

Kunduppgifter:
- Kontaktperson: {{contactPerson}}
- Telefon: {{phoneNumber}}
- Adress: {{streetAddress}}
- Intresserad av: {{interestedIn}}
- Mötesdag: {{meetingDay}}
- Mötestid: {{meetingTime}}

Ni har 14 kalenderdagar från idag att bedöma denna lead. Om den inte uppfyller era standarder, kontakta oss senast {{creditWindowExpires}} för att kreditera tillbaka.

Med vänliga hälsningar,
ProffsKontakt Team`

  useEffect(() => {
    loadData()
    setEmailTemplate(defaultEmailTemplate)
  }, [])

  const loadData = async () => {
    try {
      // Load unshared deals that are "Klar och utskickad"
      const dealsResponse = await fetch('/api/admin/deals?unshared=true&klarOchUtskickad=true')
      const dealsData = await dealsResponse.json()
      setDeals(dealsData.deals || [])

      // Load active companies
      const companiesResponse = await fetch('/api/admin/companies?active=true')
      const companiesData = await companiesResponse.json()
      setCompanies(companiesData.companies || [])

      // Load recent lead shares
      const sharesResponse = await fetch('/api/admin/lead-sharing?limit=100')
      const sharesData = await sharesResponse.json()
      setLeadShares(sharesData.leadShares || [])

    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const handleShareLeads = async () => {
    if (selectedDeals.length === 0 || selectedCompanies.length === 0) {
      alert('Välj minst en deal och ett företag')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/lead-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealIds: selectedDeals,
          companyIds: selectedCompanies,
          sharingMethod,
          emailTemplate: sharingMethod === 'email' ? emailTemplate : undefined,
          notes
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`Leads delades framgångsrikt: ${result.summary.successful} lyckades, ${result.summary.failed} misslyckades`)
        setSelectedDeals([])
        setSelectedCompanies([])
        setNotes('')
        await loadData() // Reload data
      } else {
        alert(`Fel: ${result.error}`)
      }

    } catch (error) {
      console.error('Sharing failed:', error)
      alert('Delning misslyckades')
    } finally {
      setLoading(false)
    }
  }

  const filteredLeadShares = leadShares.filter(share => {
    if (filterStatus === 'all') return true
    return share.creditStatus === filterStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expiring': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'expiring': return <AlertTriangle className="w-4 h-4" />
      case 'expired': return <Clock className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lead-delning & Kreditfönster</h2>
          <p className="text-gray-600">Dela leads med företag och spåra 14-dagars kreditfönster</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Uppdatera data
        </Button>
      </div>

      <Tabs defaultValue="share" className="space-y-6">
        <TabsList>
          <TabsTrigger value="share">Dela Leads</TabsTrigger>
          <TabsTrigger value="history">Delningshistorik</TabsTrigger>
          <TabsTrigger value="alerts">Kreditvarningar</TabsTrigger>
        </TabsList>

        <TabsContent value="share" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deal Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  Välj Leads att dela
                </CardTitle>
                <CardDescription>
                  Endast leads som är "Klar och utskickad" och inte tidigare delade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {deals.map(deal => (
                    <div key={deal.id} className="flex items-start space-x-3 p-3 border rounded">
                      <Checkbox
                        id={`deal-${deal.id}`}
                        checked={selectedDeals.includes(deal.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDeals([...selectedDeals, deal.id])
                          } else {
                            setSelectedDeals(selectedDeals.filter(id => id !== deal.id))
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`deal-${deal.id}`} className="text-sm font-medium cursor-pointer">
                          {deal.title}
                        </Label>
                        <div className="text-xs text-gray-500 mt-1">
                          <div>Öppnare: {deal.user?.openerName}</div>
                          <div>Skapad: {dayjs(deal.dealCreated).locale('sv').format('DD MMM YYYY')}</div>
                          <div>Kontakt: {deal.contactPerson}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {deals.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      Inga odelade leads hittades
                    </div>
                  )}
                </div>
                {deals.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedDeals.length === deals.length) {
                          setSelectedDeals([])
                        } else {
                          setSelectedDeals(deals.map(d => d.id))
                        }
                      }}
                    >
                      {selectedDeals.length === deals.length ? 'Avmarkera alla' : 'Markera alla'}
                    </Button>
                    <span className="ml-3 text-sm text-gray-600">
                      {selectedDeals.length} av {deals.length} valda
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Välj Företag att dela med
                </CardTitle>
                <CardDescription>
                  Aktiva företag som kan ta emot leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {companies.map(company => (
                    <div key={company.id} className="flex items-start space-x-3 p-3 border rounded">
                      <Checkbox
                        id={`company-${company.id}`}
                        checked={selectedCompanies.includes(company.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCompanies([...selectedCompanies, company.id])
                          } else {
                            setSelectedCompanies(selectedCompanies.filter(id => id !== company.id))
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`company-${company.id}`} className="text-sm font-medium cursor-pointer">
                          {company.name}
                        </Label>
                        <div className="text-xs text-gray-500 mt-1">
                          <div>Email: {company.contactEmail || 'Ej angivet'}</div>
                          <div>Telefon: {company.contactPhone || 'Ej angivet'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      Inga aktiva företag hittades
                    </div>
                  )}
                </div>
                {companies.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedCompanies.length === companies.length) {
                          setSelectedCompanies([])
                        } else {
                          setSelectedCompanies(companies.map(c => c.id))
                        }
                      }}
                    >
                      {selectedCompanies.length === companies.length ? 'Avmarkera alla' : 'Markera alla'}
                    </Button>
                    <span className="ml-3 text-sm text-gray-600">
                      {selectedCompanies.length} av {companies.length} valda
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sharing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Delningsinställningar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sharing-method">Delningsmetod</Label>
                  <Select value={sharingMethod} onValueChange={(value: any) => setSharingMethod(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj metod" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email (automatisk)</SelectItem>
                      <SelectItem value="manual">Manuell</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {sharingMethod === 'email' && (
                <div>
                  <Label htmlFor="email-template">Email-mall</Label>
                  <Textarea
                    id="email-template"
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="Email-mall med variabler som {{companyName}}, {{contactPerson}}, etc."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Tillgängliga variabler: {'{'}companyName{'}'}, {'{'}contactPerson{'}'}, {'{'}phoneNumber{'}'}, {'{'}streetAddress{'}'}, {'{'}meetingDay{'}'}, {'{'}meetingTime{'}'}, {'{'}interestedIn{'}'}, {'{'}creditWindowExpires{'}'}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Anteckningar (valfritt)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Intern kommentar om denna delning..."
                />
              </div>

              <Button
                onClick={handleShareLeads}
                disabled={loading || selectedDeals.length === 0 || selectedCompanies.length === 0}
                className="w-full"
              >
                {loading ? 'Delar...' : `Dela ${selectedDeals.length} leads med ${selectedCompanies.length} företag`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Delningshistorik</h3>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrera status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="active">Aktiva</SelectItem>
                <SelectItem value="expiring">Går ut snart</SelectItem>
                <SelectItem value="expired">Utgångna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredLeadShares.map(share => (
              <Card key={share.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{share.deal.title}</h4>
                        <Badge className={getStatusColor(share.creditStatus)}>
                          {getStatusIcon(share.creditStatus)}
                          <span className="ml-1">
                            {share.creditStatus === 'active' && `${share.daysRemaining} dagar kvar`}
                            {share.creditStatus === 'expiring' && `Går ut om ${share.daysRemaining} dagar`}
                            {share.creditStatus === 'expired' && 'Utgången'}
                          </span>
                        </Badge>
                        {share.hasCredited && (
                          <Badge variant="destructive">Krediterad</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <div className="font-medium">Företag</div>
                          <div>{share.company.name}</div>
                        </div>
                        <div>
                          <div className="font-medium">Delad av</div>
                          <div>{share.sharedBy.name}</div>
                        </div>
                        <div>
                          <div className="font-medium">Delad</div>
                          <div>{dayjs(share.sharedAt).locale('sv').format('DD MMM YYYY HH:mm')}</div>
                        </div>
                        <div>
                          <div className="font-medium">Kreditfönster stängs</div>
                          <div>{dayjs(share.creditWindowExpires).locale('sv').format('DD MMM YYYY HH:mm')}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>Metod: {share.sharingMethod}</span>
                        </div>
                        {share.emailSentTo && (
                          <div className="flex items-center gap-1">
                            <span>Email skickat till: {share.emailSentTo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredLeadShares.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Inga delade leads hittades för den valda filtreringen
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <h3 className="text-lg font-semibold">Kreditfönster som snart går ut</h3>

          <div className="space-y-4">
            {leadShares
              .filter(share => share.creditStatus === 'expiring')
              .map(share => (
                <Card key={share.id} className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-yellow-900">{share.deal.title}</h4>
                        <p className="text-sm text-yellow-700">
                          Företag: {share.company.name} • Går ut om {share.daysRemaining} dagar
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Delad: {dayjs(share.sharedAt).locale('sv').format('DD MMM YYYY HH:mm')}
                        </p>
                      </div>
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}

            {leadShares.filter(share => share.creditStatus === 'expiring').length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  Inga kreditfönster går ut inom de närmaste dagarna
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}