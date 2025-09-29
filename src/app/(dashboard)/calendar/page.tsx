'use client'

import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

export default function CalendarPage() {
  const { data: session } = useSession()

  if (!session) {
    return null
  }

  const mockEvents = []

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'platsbesok': return 'bg-green-100 text-green-800 border-green-200'
      case 'followup': return 'bg-white text-gray-900 border-gray-300 dark:bg-gray-900 dark:text-white dark:border-gray-600'
      case 'call': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getEventTypeText = (type: string) => {
    switch (type) {
      case 'platsbesok': return 'Platsbesök'
      case 'followup': return 'Uppföljning'
      case 'call': return 'Samtal'
      default: return 'Event'
    }
  }

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kalender</h1>
          <p className="text-gray-600 mt-1">
            Hantera dina möten och uppföljningar
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nytt möte
        </Button>
      </div>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl">December 2024</CardTitle>
              <Button variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Dag</Button>
              <Button variant="outline" size="sm">Vecka</Button>
              <Button size="sm">Månad</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => (
              <div key={day} className="p-2 font-medium text-gray-500">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 6 // Offset for starting day
              const isCurrentMonth = day > 0 && day <= 31
              const isToday = day === 15
              const hasEvent = [15, 16, 18, 22].includes(day)

              return (
                <div
                  key={i}
                  className={`
                    p-2 h-10 flex items-center justify-center cursor-pointer rounded-md
                    ${isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}
                    ${isToday ? 'bg-gray-900 text-white font-bold dark:bg-white dark:text-gray-900' : 'hover:bg-gray-100'}
                    ${hasEvent && !isToday ? 'bg-white border border-gray-300 dark:bg-gray-900 dark:border-gray-600' : ''}
                  `}
                >
                  {isCurrentMonth ? day : ''}
                  {hasEvent && !isToday && (
                    <div className="w-1 h-1 bg-gray-900 dark:bg-white rounded-full ml-1"></div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Dagens schema
            </CardTitle>
            <CardDescription>
              Dina planerade aktiviteter idag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockEvents.filter(event => event.date === 'Idag').map(event => (
                <div key={event.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getEventTypeColor(event.type)}>
                          {getEventTypeText(event.type)}
                        </Badge>
                        <span className="text-sm text-gray-500">{event.time}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{event.title}</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.contact}
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {event.phone}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.address}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Detaljer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Kommande
            </CardTitle>
            <CardDescription>
              Nästa veckas planerade aktiviteter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockEvents.filter(event => event.date === 'Imorgon').map(event => (
                <div key={event.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getEventTypeColor(event.type)}>
                          {getEventTypeText(event.type)}
                        </Badge>
                        <span className="text-sm text-gray-500">{event.time}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{event.title}</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.contact}
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {event.phone}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Detaljer
                    </Button>
                  </div>
                </div>
              ))}

              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">Inga fler möten denna vecka</p>
                <Button variant="outline" size="sm">
                  Visa nästa vecka
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Snabbåtgärder</CardTitle>
          <CardDescription>
            Hantera dina kalenderaktiviteter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-16 flex flex-col gap-1">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Nytt möte</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1">
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Visa vecka</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1">
              <Clock className="h-5 w-5" />
              <span className="text-xs">Påminnelser</span>
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full h-16 flex flex-col gap-1">
                <ChevronLeft className="h-5 w-5" />
                <span className="text-xs">Tillbaka</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}