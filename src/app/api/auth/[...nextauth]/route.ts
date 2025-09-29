import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import { compare } from 'bcryptjs'
import { UserRole } from '@/generated/prisma'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour - refresh token every hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: 'proffskontakt.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 // 24 hours
      }
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          })

          if (!user) {
            return null
          }

          if (!user.active) {
            throw new Error('Account is deactivated')
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            openerName: user.openerName,
            adversusAgentId: user.adversusAgentId,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      console.log(`🔍 JWT CALLBACK - Trigger: ${trigger}, User present: ${!!user}, Token before:`, JSON.stringify({
        sub: token.sub,
        email: token.email,
        role: token.role,
        openerName: token.openerName,
        adversusAgentId: token.adversusAgentId
      }, null, 2))

      // During initial sign-in, user object is provided
      if (user) {
        console.log('🔍 JWT CALLBACK - Setting user data in token')
        token.role = user.role
        token.openerName = user.openerName
        token.adversusAgentId = user.adversusAgentId
      }

      // Ensure role persists across all JWT operations - check for missing data
      if (!token.role || !token.openerName || !token.adversusAgentId) {
        console.log('🚨 JWT CALLBACK - Missing user data, attempting to restore from database')
        console.log('🔍 JWT CALLBACK - Current token state:', {
          hasRole: !!token.role,
          hasOpenerName: !!token.openerName,
          hasAdversusId: !!token.adversusAgentId,
          sub: token.sub,
          email: token.email
        })

        try {
          const userFromDb = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, openerName: true, adversusAgentId: true }
          })
          if (userFromDb) {
            // Always restore all fields to prevent partial data
            token.role = userFromDb.role
            token.openerName = userFromDb.openerName
            token.adversusAgentId = userFromDb.adversusAgentId
            console.log('🔄 JWT CALLBACK - User data restored from database:', {
              role: userFromDb.role,
              openerName: userFromDb.openerName,
              adversusAgentId: userFromDb.adversusAgentId
            })
          } else {
            console.error('❌ JWT CALLBACK - User not found in database for ID:', token.sub)
          }
        } catch (error) {
          console.error('❌ JWT CALLBACK - Failed to restore user data from database:', error)
        }
      }

      console.log('🔍 JWT CALLBACK - Token after:', JSON.stringify({
        sub: token.sub,
        email: token.email,
        role: token.role,
        openerName: token.openerName,
        adversusAgentId: token.adversusAgentId
      }, null, 2))
      return token
    },
    async session({ session, token }) {
      console.log('🔍 SESSION CALLBACK - Token data:', {
        sub: token?.sub,
        email: token?.email,
        role: token?.role,
        openerName: token?.openerName,
        adversusAgentId: token?.adversusAgentId
      })

      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.openerName = token.openerName as string
        session.user.adversusAgentId = token.adversusAgentId as string

        // Log session after assignment
        console.log('🔍 SESSION CALLBACK - Session user after assignment:', {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          openerName: session.user.openerName,
          adversusAgentId: session.user.adversusAgentId
        })
      }
      return session
    },
    async redirect({ url, baseUrl, token }) {
      // Fix baseUrl to use correct port
      const correctBaseUrl = 'http://localhost:3003'
      console.log('🔍 NextAuth redirect callback:', { url, baseUrl, correctBaseUrl, role: token?.role })

      // If URL already starts with correct baseUrl, use it as is
      if (url.startsWith(correctBaseUrl)) {
        return url
      }

      // Role-based redirect after sign-in
      if (token?.role === 'ADMIN') {
        console.log('🔄 NextAuth redirecting ADMIN to /admin')
        return `${correctBaseUrl}/admin`
      } else if (token?.role) {
        console.log('🔄 NextAuth redirecting non-admin to /dashboard')
        return `${correctBaseUrl}/dashboard`
      }

      // Default fallback to root
      return correctBaseUrl
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      console.log(`User signed in: ${user.email} (${user.role})`)

      // Log the sign-in for security/audit purposes
      await prisma.systemLog.create({
        data: {
          type: 'user_signin',
          source: 'auth',
          message: `User ${user.email} signed in`,
          data: {
            userId: user.id,
            userEmail: user.email,
            userRole: user.role,
            isNewUser,
            timestamp: new Date()
          }
        }
      })
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)

      if (token?.sub) {
        await prisma.systemLog.create({
          data: {
            type: 'user_signout',
            source: 'auth',
            message: `User ${token.email} signed out`,
            data: {
              userId: token.sub,
              userEmail: token.email,
              timestamp: new Date()
            }
          }
        })
      }
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }