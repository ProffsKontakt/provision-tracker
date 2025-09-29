'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  Phone,
  FileText,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect after we're sure about the session status
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Non-admin users accessing opener routes - this is correct
    // Admin users should never reach this layout since they have separate /admin routes
  }, [session, status])


  const navigation = useMemo(() => [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['MANAGER', 'SETTER']
    },
    {
      name: 'Samtal',
      href: '/calls',
      icon: Phone,
      roles: ['MANAGER', 'SETTER']
    },
    {
      name: 'Rapporter',
      href: '/reports',
      icon: FileText,
      roles: ['MANAGER', 'SETTER']
    },
    {
      name: 'Kalender',
      href: '/calendar',
      icon: Calendar,
      roles: ['MANAGER', 'SETTER']
    },
    {
      name: 'Inställningar',
      href: '/settings',
      icon: Settings,
      roles: ['MANAGER', 'SETTER']
    }
  ], [])

  // Show navigation filtered by user role
  const filteredNavigation = useMemo(() =>
    session?.user?.role
      ? navigation.filter(item => item.roles.includes(session.user.role))
      : navigation,
    [navigation, session?.user?.role]
  )

  // ALWAYS RENDER THE LAYOUT for opener portal users
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation - Always Visible */}
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">ProffsKontakt</h1>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Openerportal</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              {/* Theme Toggle - Always Visible */}
              <ThemeToggle />

              {/* User Info - Show loading state if no session */}
              {status === 'loading' ? (
                <>
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-24 rounded"></div>
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-8 rounded-full"></div>
                </>
              ) : session ? (
                <>
                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={session.user.image || ''} alt={session.user.name || ''} />
                          <AvatarFallback>
                            {session.user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{session.user.name}</p>
                          <p className="text-xs text-gray-500">{session.user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Inställningar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logga ut
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <div className="h-8 w-24"></div>
                  <div className="h-8 w-8"></div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Navigation - ALWAYS VISIBLE */}
        <aside className="w-64 bg-white dark:bg-gray-900 shadow-sm min-h-screen border-r dark:border-gray-700">
          <nav className="mt-8">
            <div className="px-4">
              <ul className="space-y-2">
                {filteredNavigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          isActive
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content - Always Visible */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-900">
          {status === 'loading' ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}