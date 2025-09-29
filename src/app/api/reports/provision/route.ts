import { NextRequest, NextResponse } from 'next/server'
import { adversusAPI } from '@/lib/adversus-api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')

    const trendData = await adversusAPI.getProvisionTrend(days)

    return NextResponse.json({
      success: true,
      data: trendData,
      period: `${days} days`
    })
  } catch (error) {
    console.error('Error fetching provision trend:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provision trend' },
      { status: 500 }
    )
  }
}