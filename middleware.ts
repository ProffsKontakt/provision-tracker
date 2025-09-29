import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(request: NextRequest) {
    const token = request.nextauth.token
    const pathname = request.nextUrl.pathname

    console.log(`🔍 MIDDLEWARE EXECUTING: ${pathname}, Role: ${token?.role}, Token exists: ${!!token}, Full token:`, JSON.stringify(token, null, 2))

    // If user is authenticated
    if (token) {
      console.log(`🔍 AUTHENTICATED USER - Role: ${token.role}, Path: ${pathname}`)

      // Additional check for role existence
      if (!token.role) {
        console.log(`🚨 WARNING: Token exists but role is undefined/null - redirecting to sign-in`)
        return NextResponse.redirect(new URL('/auth/signin?error=InvalidSession', request.url))
      }

      // ABSOLUTE BLOCK: Admin users CANNOT access dashboard routes under ANY circumstances
      if (token.role === 'ADMIN') {
        console.log(`🚨 ADMIN USER DETECTED - Current path: ${pathname}`)

        // IMMEDIATELY BLOCK any dashboard access
        if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
          console.log(`🚫🚫🚫 EMERGENCY BLOCK: ADMIN trying to access dashboard: ${pathname} -> REDIRECT TO /admin`)
          return NextResponse.redirect(new URL('/admin', request.url))
        }

        // Allow only these specific routes for admin
        const allowedPaths = ['/admin', '/api', '/auth', '/_next', '/favicon.ico']
        const isAllowed = allowedPaths.some(path => pathname.startsWith(path)) || pathname.includes('.')

        if (!isAllowed && pathname !== '/') {
          console.log(`🚫 BLOCKING ADMIN from unauthorized path: ${pathname} -> /admin`)
          return NextResponse.redirect(new URL('/admin', request.url))
        }

        // Root redirect for admin
        if (pathname === '/') {
          console.log(`🔄 ADMIN user redirected from root to /admin`)
          return NextResponse.redirect(new URL('/admin', request.url))
        }

        // Allow admin routes
        if (pathname.startsWith('/admin')) {
          console.log(`✅ ADMIN accessing authorized admin route: ${pathname}`)
          return NextResponse.next()
        }

        return NextResponse.next()
      }

      // Non-admin logic
      if (pathname === '/') {
        console.log('🔄 Non-admin user redirected from root to /dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // Prevent non-admin users from accessing admin routes
      if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
        console.log(`🚫 Non-admin user blocked from admin panel: Role="${token.role}" -> /dashboard`)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // Allow admin users to access admin routes
      if (pathname.startsWith('/admin') && token.role === 'ADMIN') {
        console.log(`✅ ADMIN user accessing admin route: ${pathname}`)
        return NextResponse.next()
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        console.log(`🔐 AUTHORIZATION CHECK: ${pathname}, Token exists: ${!!token}, Role: ${token?.role}`)

        // Allow access to auth pages without token
        if (pathname.startsWith('/auth/')) {
          return true
        }

        // Allow API routes (they handle their own auth)
        if (pathname.startsWith('/api/')) {
          return true
        }

        // Allow static files and assets
        if (pathname.startsWith('/_next/') || pathname.includes('.') || pathname === '/favicon.ico') {
          return true
        }

        // For admin routes, require admin role
        if (pathname.startsWith('/admin')) {
          const hasAdminAccess = token?.role === 'ADMIN'
          console.log(`🔐 ADMIN ROUTE ACCESS: ${pathname}, Has admin access: ${hasAdminAccess}`)
          return hasAdminAccess
        }

        // For dashboard routes, block admin users
        if (pathname.startsWith('/dashboard') && token?.role === 'ADMIN') {
          console.log(`🚫 AUTHORIZATION DENIED: Admin cannot access dashboard routes`)
          return false
        }

        // Require token for all other protected routes
        return !!token
      },
    }
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}