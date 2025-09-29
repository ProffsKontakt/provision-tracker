'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSetterData } from '@/hooks/useSetterData'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  TrendingUp,
  Users,
  DollarSign,
  Phone,
  FileText,
  Clock,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { stats, recentLeads, loading: statsLoading } = useSetterData()

  useEffect(() => {
    // Redirect admin users to admin panel immediately
    if (session?.user?.role === 'ADMIN') {
      router.replace('/admin')
      return
    }
  }, [session, router])

  // Don't render anything for admin users - redirect immediately
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-black dark:border-white"></div>
      </div>
    )
  }

  if (session.user.role === 'ADMIN') {
    return null // Don't render anything while redirecting
  }

  const isAdmin = session.user.role === 'ADMIN'
  const isManager = session.user.role === 'MANAGER'
  const isSetter = session.user.role === 'SETTER'

  return (
    <div className="p-5 space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white">
            Välkommen, {session.user.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Här är en översikt av ditt openersystem
          </p>
        </div>
        <Badge className="bg-white text-black border-gray-300 dark:bg-black dark:text-white dark:border-gray-600">
          {session.user.openerName}
        </Badge>
      </div>

      {/* Lead Tracking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bokade Leads (September)</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats.thisMonth}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? 'Laddar...' : `${stats.growth >= 0 ? '+' : ''}${stats.growth}% från förra månaden`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ska skickas ut</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats.pendingReview}
            </div>
            <p className="text-xs text-muted-foreground">
              Av admin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utskickade</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats.adminApproved}
            </div>
            <p className="text-xs text-muted-foreground">
              Redo för bolag
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skickade till Bolag</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats.sentToCompanies}
            </div>
            <p className="text-xs text-muted-foreground">
              I Pipedrive pipeline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Senaste Aktivitet
            </CardTitle>
            <CardDescription>
              Dina senaste åtgärder i systemet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads && recentLeads.length > 0 ? (
                recentLeads.slice(0, 3).map((lead, index) => (
                  <div key={lead.id || index} className="flex items-center gap-3 p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-green-500' :
                      index === 1 ? 'bg-blue-500' : 'bg-purple-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {lead.status === 'approved' ? 'Lead godkänd av admin' :
                         lead.status === 'sent_to_pipedrive' ? 'Lead skickad till Pipedrive' :
                         'Lead bokad från Adversus'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lead.contactName} - {lead.companyName || 'Företag ej angivet'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Ingen aktivitet ännu</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dina leads kommer att visas här</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Snabbåtgärder</CardTitle>
            <CardDescription>
              Vanliga uppgifter och verktyg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {/* Primary action for setters - View their bookings */}
              {isSetter && (
                <Link href="/bookings" className="col-span-2">
                  <Button className="w-full h-24 flex flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <CalendarDays className="h-8 w-8" />
                    <span className="text-base font-medium">Mina Bokningar</span>
                    <span className="text-xs opacity-90">Se dina bokningar och provisioner</span>
                  </Button>
                </Link>
              )}

              {(isAdmin || isManager) && (
                <Link href="/admin">
                  <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                    <TrendingUp className="h-6 w-6" />
                    <span className="text-sm">Admin Panel</span>
                  </Button>
                </Link>
              )}

              <Link href="/reports">
                <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">Rapporter</span>
                </Button>
              </Link>

              <Link href="/calendar">
                <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                  <CalendarDays className="h-6 w-6" />
                  <span className="text-sm">Kalender</span>
                </Button>
              </Link>

              <Link href="/settings">
                <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Inställningar</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin/Manager Specific Features */}
      {(isAdmin || isManager) && (
        <Card>
          <CardHeader>
            <CardTitle>Systemöversikt</CardTitle>
            <CardDescription>
              Statusöversikt för hela organisationen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">156</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Totala Leads</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">89%</div>
                <div className="text-sm text-green-800 dark:text-green-300">Systemupptid</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">23</div>
                <div className="text-sm text-orange-800 dark:text-orange-300">Väntande Granskningar</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setter Specific Features */}
      {isSetter && (
        <Card>
          <CardHeader>
            <CardTitle>Dina Mål</CardTitle>
            <CardDescription>
              Månadsmål och framsteg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Antal samtal</span>
                  <span>234/300</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <div className="bg-gray-900 dark:bg-white h-2 rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm">
                  <span>Provision (SEK)</span>
                  <span>12,500/15,000</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '83%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}