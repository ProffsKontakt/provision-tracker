import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { UserRole } from '@/generated/prisma'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  openerName: string
  adversusAgentId?: string
}

export interface AuthResult {
  user?: AuthUser
  error?: NextResponse
}

/**
 * Require authentication for API routes
 * @param req - NextRequest object
 * @param allowedRoles - Array of roles that can access this endpoint
 * @returns AuthResult with user or error
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthResult> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (!token) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    const user: AuthUser = {
      id: token.sub!,
      email: token.email!,
      name: token.name!,
      role: token.role as UserRole,
      openerName: token.openerName as string,
      adversusAgentId: token.adversusAgentId as string
    }

    // Check if user role is allowed
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return {
        error: NextResponse.json(
          {
            error: 'Insufficient permissions',
            requiredRoles: allowedRoles,
            userRole: user.role
          },
          { status: 403 }
        )
      }
    }

    return { user }

  } catch (error) {
    console.error('Auth middleware error:', error)
    return {
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === UserRole.ADMIN
}

/**
 * Check if user has manager privileges
 */
export function isManager(user: AuthUser): boolean {
  return user.role === UserRole.MANAGER || user.role === UserRole.ADMIN
}

/**
 * Check if user can access admin functions
 */
export function canAccessAdmin(user: AuthUser): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.MANAGER
}

/**
 * Check if user is a setter
 */
export function isSetter(user: AuthUser): boolean {
  return user.role === UserRole.SETTER
}