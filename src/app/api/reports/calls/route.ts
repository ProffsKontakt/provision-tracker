import { NextRequest, NextResponse } from 'next/server'
import { adversusAPI } from '@/lib/adversus-api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agent = searchParams.get('agent')
    const days = parseInt(searchParams.get('days') || '30')

    if (!agent) {
      return NextResponse.json({ error: 'Agent parameter required' }, { status: 400 })
    }

    const metrics = await adversusAPI.getDailyMetrics(agent, days)

    return NextResponse.json({
      success: true,
      data: metrics,
      agent,
      period: `${days} days`
    })
  } catch (error) {
    console.error('Error fetching call metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call metrics' },
      { status: 500 }
    )
  }
}