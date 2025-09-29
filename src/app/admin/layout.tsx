'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { PageLoading } from '@/components/ui/loading-spinner'
import {
  BarChart3,
  Users,
  Phone,
  Target,
  Settings,
  Calendar,
  FileText,
  TrendingUp,
  Activity,
  Database,
  ChevronLeft,
  ChevronRight,
  Menu,
  Home,
  UserCheck,
  PhoneCall,
  Building,
  DollarSign,
  Clock,
  MessageSquare,
  Shield,
  LogOut
} from 'lucide-react'
import { signOut } from 'next-auth/react'

const ADMIN_NAVIGATION = [
  {
    name: 'Översikt',
    href: '/admin',
    icon: Home,
    description: 'Systemöversikt och nyckeltal'
  },
  {
    name: 'Setter Performance',
    href: '/admin/setters',
    icon: UserCheck,
    description: 'Individuell prestationsanalys'
  },
  {
    name: 'Call Analytics',
    href: '/admin/call-analytics',
    icon: PhoneCall,
    description: 'Detaljerad analys av samtal från Adversus'
  },
  {
    name: 'Pipeline Management',
    href: '/admin/pipeline',
    icon: TrendingUp,
    description: 'Pipedrive deals och progression'
  },
  {
    name: 'Företag & Leads',
    href: '/admin/companies',
    icon: Building,
    description: 'Företagshantering och leadfördelning'
  },
  {
    name: 'Provisionsrapporter',
    href: '/admin/commissions',
    icon: DollarSign,
    description: 'Provisionsspårning och utbetalningar'
  },
  {
    name: 'Systemloggar',
    href: '/admin/logs',
    icon: Activity,
    description: 'Systemaktivitet och felsökning'
  },
  {
    name: 'Inställningar',
    href: '/admin/settings',
    icon: Settings,
    description: 'Systemkonfiguration'
  }
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const pathname = usePathname()
  const router = useRouter()


  // Handle redirects in useEffect instead of blocking render
  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Handle session restoration race condition - don't redirect if role is temporarily undefined
    // but we have admin email and the session is still loading user data
    if (session.user.role === undefined && session.user.email === 'admin@proffskontakt.se') {
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [session, status])

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#101827]">
      {/* Sidebar */}
      <div className={`bg-white dark:bg-[#101827] shadow-lg transition-all duration-300 ${
        sidebarExpanded ? 'w-64' : 'w-16'
      } flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarExpanded && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Panel</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">ProffsKontakt</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-2"
            >
              {sidebarExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 text-sm font-medium">
              {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            {sidebarExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {session?.user?.name || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {session?.user?.email || 'Loading...'}
                </p>
                <Badge size="sm" className="mt-1 bg-gray-900 text-white dark:bg-white dark:text-black border border-gray-300 dark:border-gray-600">
                  System Administrator
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {ADMIN_NAVIGATION.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black border border-gray-300 dark:border-gray-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={!sidebarExpanded ? item.name : undefined}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white dark:text-black' : 'text-gray-500 dark:text-gray-400'}`} />
                {sidebarExpanded && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.description}
                    </div>
                  </div>
                )}
                {isActive && !sidebarExpanded && (
                  <div className="w-2 h-2 bg-white dark:bg-black rounded-full"></div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={`w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 ${
              !sidebarExpanded ? 'px-2' : ''
            }`}
            title={!sidebarExpanded ? 'Logga ut' : undefined}
          >
            <LogOut className="h-5 w-5" />
            {sidebarExpanded && 'Logga ut'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-[#101827] shadow-sm border-b dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {ADMIN_NAVIGATION.find(item => item.href === pathname)?.name || 'Admin Dashboard'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {ADMIN_NAVIGATION.find(item => item.href === pathname)?.description || 'Systemöversikt och hantering'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Badge variant="outline" className="bg-white text-gray-900 border-gray-300 dark:bg-[#101827] dark:text-white dark:border-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                System Online
              </Badge>
              <Badge variant="secondary" className="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white">SA</Badge>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('sv-SE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-[#101827]">
          {children}
        </main>
      </div>
    </div>
  )
}