'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calendar,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Phone,
  Mail,
  MapPin,
  Building,
  Zap,
  TrendingUp
} from 'lucide-react'

interface Booking {
  id: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  appointmentDate: string
  bookingDate: string
  status: 'booked' | 'sent_to_pipedrive' | 'sent_to_partners' | 'completed' | 'cancelled'
  pipedriveStatus?: string
  pipelineStage?: string
  companyAssignment: string
  leadType: string
  commission?: {
    id: string
    amount: number
    status: 'PENDING' | 'APPROVED' | 'CREDITED' | 'REJECTED'
    paidAt?: string
  }
  notes?: string
  leadSource: string
  propertyType?: string
  energyInterest: string[]
  qualityScore?: number
  estimatedValue?: number
  followUpDate?: string
}

interface BookingStats {
  totalBookings: number
  thisMonth: number
  sentToPipedrive: number
  sentToPartners: number
  totalCommissions: number
  paidCommissions: number
  pendingCommissions: number
  averageQuality: number
}

export default function BookingsPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats] = useState<BookingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetchBookings()
    }
  }, [session])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/bookings', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch bookings')
      }

      const data = await response.json()
      setBookings(data.bookings || [])
      setStats(data.stats)
      setError(null)
    } catch (err) {
      setError('Failed to load your bookings')
      console.error('Error fetching bookings:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter bookings based on search and filters
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.customerPhone.includes(searchTerm) ||
                         booking.companyAssignment.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter

    const bookingMonth = new Date(booking.bookingDate).getMonth()
    const currentMonth = new Date().getMonth()
    const matchesMonth = monthFilter === 'all' ||
                        (monthFilter === 'current' && bookingMonth === currentMonth) ||
                        (monthFilter === 'last' && bookingMonth === currentMonth - 1)

    return matchesSearch && matchesStatus && matchesMonth
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'booked': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'sent_to_pipedrive': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'sent_to_partners': return 'bg-green-100 text-green-800 border-green-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'booked': return 'Bokad'
      case 'sent_to_pipedrive': return 'Skickad till Pipedrive'
      case 'sent_to_partners': return 'Utskickad och klar'
      case 'completed': return 'Avslutad'
      case 'cancelled': return 'Avbokad'
      default: return status
    }
  }

  const getCommissionStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200'
      case 'CREDITED': return 'bg-green-100 text-green-800 border-green-200'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Mina Bokningar</h1>
          <p className="text-gray-600 mt-1">
            Följ dina bokningar från Adversus till utbetalning - {filteredBookings.length} bokningar
          </p>
        </div>
        <Button onClick={fetchBookings} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totalt Bokningar</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
              <p className="text-xs text-muted-foreground">
                {stats.thisMonth} denna månaden
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utskickade</CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.sentToPartners}</div>
              <p className="text-xs text-muted-foreground">
                Redo för provision
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Provision</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCommissions.toLocaleString()} kr</div>
              <p className="text-xs text-muted-foreground">
                {stats.paidCommissions.toLocaleString()} kr utbetalt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kvalitetssnitt</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageQuality.toFixed(1)}/10</div>
              <p className="text-xs text-muted-foreground">
                Genomsnittlig kvalitet
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Sök
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Sök kund, telefon eller företag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="booked">Bokad</SelectItem>
                <SelectItem value="sent_to_pipedrive">Till Pipedrive</SelectItem>
                <SelectItem value="sent_to_partners">Utskickad och klar</SelectItem>
                <SelectItem value="completed">Avslutad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla månader</SelectItem>
                <SelectItem value="current">Denna månaden</SelectItem>
                <SelectItem value="last">Förra månaden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mina Bokningar ({filteredBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-lg">{booking.customerName}</div>
                      <Badge className={getStatusColor(booking.status)}>
                        {getStatusText(booking.status)}
                      </Badge>
                      {booking.commission && (
                        <Badge className={getCommissionStatusColor(booking.commission.status)}>
                          {booking.commission.amount.toLocaleString()} kr
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {booking.customerPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(booking.appointmentDate).toLocaleDateString('sv-SE')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {booking.companyAssignment}
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        {booking.leadType}
                      </div>
                    </div>

                    {booking.customerAddress && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        {booking.customerAddress}
                      </div>
                    )}

                    {booking.energyInterest.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {booking.energyInterest.map((interest, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {booking.qualityScore && (
                      <div className="text-center">
                        <div className={`text-lg font-bold ${
                          booking.qualityScore >= 8 ? 'text-green-600' :
                          booking.qualityScore >= 6 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {booking.qualityScore}/10
                        </div>
                        <div className="text-xs text-gray-500">Kvalitet</div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detaljer
                    </Button>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>Bokad</span>
                    <span>Pipedrive</span>
                    <span>Utskickad</span>
                    <span>Betald</span>
                  </div>
                  <div className="flex items-center">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{
                          width: booking.status === 'booked' ? '25%' :
                                 booking.status === 'sent_to_pipedrive' ? '50%' :
                                 booking.status === 'sent_to_partners' ? '75%' :
                                 booking.commission?.status === 'CREDITED' ? '100%' : '75%'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredBookings.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Inga bokningar hittades med de valda filtren.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Bokningsdetaljer</h3>
              <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                Stäng
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Kund</label>
                  <p className="font-medium">{selectedBooking.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefon</label>
                  <p>{selectedBooking.customerPhone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Möte datum</label>
                  <p>{new Date(selectedBooking.appointmentDate).toLocaleDateString('sv-SE')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Bokad datum</label>
                  <p>{new Date(selectedBooking.bookingDate).toLocaleDateString('sv-SE')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Företag</label>
                  <p>{selectedBooking.companyAssignment}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Lead typ</label>
                  <p>{selectedBooking.leadType}</p>
                </div>
                {selectedBooking.customerAddress && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Adress</label>
                    <p>{selectedBooking.customerAddress}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-600">Lead källa</label>
                  <p>{selectedBooking.leadSource}</p>
                </div>
                {selectedBooking.qualityScore && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Kvalitetspoäng</label>
                    <p className={`font-bold ${
                      selectedBooking.qualityScore >= 8 ? 'text-green-600' :
                      selectedBooking.qualityScore >= 6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedBooking.qualityScore}/10
                    </p>
                  </div>
                )}
              </div>

              {selectedBooking.energyInterest.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Energiintresse</label>
                  <div className="flex gap-2 mt-1">
                    {selectedBooking.energyInterest.map((interest, index) => (
                      <Badge key={index} variant="outline">{interest}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedBooking.commission && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Provision</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Belopp</label>
                      <p className="font-bold text-green-600">{selectedBooking.commission.amount.toLocaleString()} kr</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <Badge className={getCommissionStatusColor(selectedBooking.commission.status)}>
                        {selectedBooking.commission.status}
                      </Badge>
                    </div>
                    {selectedBooking.commission.paidAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Betald datum</label>
                        <p>{new Date(selectedBooking.commission.paidAt).toLocaleDateString('sv-SE')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedBooking.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Anteckningar</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded text-sm">{selectedBooking.notes}</p>
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
              <Clock className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}