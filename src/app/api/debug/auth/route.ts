import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    return NextResponse.json({
      authenticated: !!session,
      session: session ? {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          openerName: session.user.openerName,
          adversusAgentId: session.user.adversusAgentId
        }
      } : null,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Debug auth error:', error)
    return NextResponse.json({
      error: 'Auth check failed',
      details: error.message
    }, { status: 500 })
  }
}