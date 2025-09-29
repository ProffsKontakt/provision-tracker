import { NextRequest, NextResponse } from 'next/server'
import { adversusAPI } from '@/lib/adversus-api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agent = searchParams.get('agent')
    const period = searchParams.get('period') || 'current_month'

    if (!agent) {
      return NextResponse.json({ error: 'Agent parameter required' }, { status: 400 })
    }

    const commissionData = await adversusAPI.getCommissionData(agent, period)

    return NextResponse.json({
      success: true,
      data: commissionData
    })
  } catch (error) {
    console.error('Error fetching commission data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    )
  }
}