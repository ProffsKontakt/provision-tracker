import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@/generated/prisma'

// Pipedrive API Configuration
const PIPEDRIVE_API_BASE = 'https://api.pipedrive.com/v1'
const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN
const PIPEDRIVE_COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'proffskontakt'

interface PipedriveDeal {
  id: number
  title: string
  value: number
  currency: string
  status: 'open' | 'won' | 'lost' | 'deleted'
  stage_id: number
  stage_name: string
  person_id: number
  person_name: string
  org_id: number
  org_name: string
  owner_name: string
  add_time: string
  update_time: string
  close_time?: string
  expected_close_date?: string
  probability?: number
  custom_fields?: {
    lead_source?: string
    adversus_call_id?: string
    setter_name?: string
    commission_calculated?: boolean
  }
}

interface PipedriveStage {
  id: number
  name: string
  order_nr: number
  deal_probability: number
  pipeline_id: number
  pipeline_name: string
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request, [UserRole.ADMIN])

  if (error) {
    return error
  }

  try {

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const ownerId = searchParams.get('owner_id')
    const status = searchParams.get('status') || 'all_not_deleted'

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    if (!PIPEDRIVE_API_TOKEN) {
      console.log('Pipedrive API not configured, returning mock data')

      // Return mock data when API is not configured
      const mockData = {
        success: false,
        error: 'Using mock data - Pipedrive API not available',
        system_metrics: {
          total_deals: 67,
          total_value: 1250000,
          won_deals: 23,
          won_value: 450000,
          open_deals: 44,
          open_value: 800000,
          avg_deal_size: 18656,
          conversion_rate: 34.3,
          period: period,
          last_updated: new Date().toISOString()
        },
        deals_by_owner: [
          {
            owner_name: 'Anna Andersson',
            total_deals: 12,
            total_value: 245000,
            won_deals: 5,
            won_value: 95000,
            open_deals: 7,
            open_value: 150000,
            avg_deal_size: 20417,
            conversion_rate: 41.7
          },
          {
            owner_name: 'Erik Johansson',
            total_deals: 8,
            total_value: 156000,
            won_deals: 2,
            won_value: 45000,
            open_deals: 6,
            open_value: 111000,
            avg_deal_size: 19500,
            conversion_rate: 25.0
          },
          {
            owner_name: 'Maria Larsson',
            total_deals: 15,
            total_value: 312000,
            won_deals: 8,
            won_value: 178000,
            open_deals: 7,
            open_value: 134000,
            avg_deal_size: 20800,
            conversion_rate: 53.3
          }
        ],
        deals_by_stage: [
          {
            stage_id: 1,
            stage_name: 'Kvalificerad Lead',
            order: 1,
            probability: 10,
            deal_count: 15,
            total_value: 285000
          },
          {
            stage_id: 2,
            stage_name: 'Offert Skickad',
            order: 2,
            probability: 25,
            deal_count: 12,
            total_value: 234000
          },
          {
            stage_id: 3,
            stage_name: 'Förhandling',
            order: 3,
            probability: 50,
            deal_count: 8,
            total_value: 167000
          },
          {
            stage_id: 4,
            stage_name: 'Kontrakt Påskrivet',
            order: 4,
            probability: 90,
            deal_count: 9,
            total_value: 181000
          }
        ]
      }

      return NextResponse.json(mockData)
    }

    try {
      // Fetch deals from Pipedrive
      const dealsParams = new URLSearchParams({
        api_token: PIPEDRIVE_API_TOKEN,
        status: status,
        start: '0',
        limit: '500',
        sort: 'update_time DESC'
      })

      if (ownerId) {
        dealsParams.append('user_id', ownerId)
      }

      const dealsResponse = await fetch(
        `${PIPEDRIVE_API_BASE}/deals?${dealsParams}`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )

      if (!dealsResponse.ok) {
        throw new Error(`Pipedrive deals API error: ${dealsResponse.status}`)
      }

      const dealsData = await dealsResponse.json()
      const deals: PipedriveDeal[] = dealsData.data || []

      // Fetch pipeline stages for context
      const stagesResponse = await fetch(
        `${PIPEDRIVE_API_BASE}/stages?api_token=${PIPEDRIVE_API_TOKEN}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      const stagesData = await stagesResponse.json()
      const stages: PipedriveStage[] = stagesData.data || []

      // Filter deals by date range
      const filteredDeals = deals.filter(deal => {
        const dealDate = new Date(deal.add_time)
        return dealDate >= startDate
      })

      // Process deals data
      const dealsByOwner = filteredDeals.reduce((acc, deal) => {
        const ownerName = deal.owner_name || 'Unknown'
        if (!acc[ownerName]) {
          acc[ownerName] = {
            owner_name: ownerName,
            total_deals: 0,
            total_value: 0,
            won_deals: 0,
            won_value: 0,
            open_deals: 0,
            open_value: 0,
            avg_deal_size: 0,
            conversion_rate: 0,
            deals: []
          }
        }

        acc[ownerName].total_deals++
        acc[ownerName].total_value += deal.value || 0
        acc[ownerName].deals.push(deal)

        if (deal.status === 'won') {
          acc[ownerName].won_deals++
          acc[ownerName].won_value += deal.value || 0
        } else if (deal.status === 'open') {
          acc[ownerName].open_deals++
          acc[ownerName].open_value += deal.value || 0
        }

        return acc
      }, {} as any)

      // Calculate additional metrics
      Object.values(dealsByOwner).forEach((owner: any) => {
        owner.avg_deal_size = owner.total_deals > 0
          ? Math.round(owner.total_value / owner.total_deals)
          : 0
        owner.conversion_rate = owner.total_deals > 0
          ? Number(((owner.won_deals / owner.total_deals) * 100).toFixed(1))
          : 0
      })

      // Calculate system-wide metrics
      const totalValue = filteredDeals.reduce((sum, deal) => sum + (deal.value || 0), 0)
      const wonDeals = filteredDeals.filter(deal => deal.status === 'won')
      const openDeals = filteredDeals.filter(deal => deal.status === 'open')

      const systemMetrics = {
        total_deals: filteredDeals.length,
        total_value: totalValue,
        won_deals: wonDeals.length,
        won_value: wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
        open_deals: openDeals.length,
        open_value: openDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
        avg_deal_size: filteredDeals.length > 0 ? Math.round(totalValue / filteredDeals.length) : 0,
        conversion_rate: filteredDeals.length > 0
          ? Number(((wonDeals.length / filteredDeals.length) * 100).toFixed(1))
          : 0,
        period: period,
        last_updated: new Date().toISOString()
      }

      // Group deals by stage for pipeline analysis
      const dealsByStage = stages.map(stage => {
        const stageDeals = filteredDeals.filter(deal => deal.stage_id === stage.id)
        return {
          stage_id: stage.id,
          stage_name: stage.name,
          order: stage.order_nr,
          probability: stage.deal_probability,
          deal_count: stageDeals.length,
          total_value: stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
          deals: stageDeals
        }
      })

      return NextResponse.json({
        success: true,
        system_metrics: systemMetrics,
        deals_by_owner: Object.values(dealsByOwner),
        deals_by_stage: dealsByStage,
        total_deals_fetched: deals.length,
        filtered_deals_count: filteredDeals.length,
        period: period
      })

    } catch (apiError) {
      console.error('Pipedrive API error:', apiError)

      // Return mock data if API fails
      const mockData = {
        success: false,
        error: 'Using mock data - Pipedrive API not available',
        system_metrics: {
          total_deals: 67,
          total_value: 1250000,
          won_deals: 23,
          won_value: 450000,
          open_deals: 44,
          open_value: 800000,
          avg_deal_size: 18656,
          conversion_rate: 34.3,
          period: period,
          last_updated: new Date().toISOString()
        },
        deals_by_owner: [
          {
            owner_name: 'Anna Andersson',
            total_deals: 12,
            total_value: 245000,
            won_deals: 5,
            won_value: 95000,
            open_deals: 7,
            open_value: 150000,
            avg_deal_size: 20417,
            conversion_rate: 41.7
          }
        ],
        deals_by_stage: [
          {
            stage_id: 1,
            stage_name: 'Kvalificerad Lead',
            order: 1,
            probability: 10,
            deal_count: 15,
            total_value: 285000
          }
        ]
      }

      return NextResponse.json(mockData)
    }

  } catch (error) {
    console.error('Pipedrive API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST endpoint for creating deals or handling webhooks
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {

    const body = await request.json()

    if (body.webhook) {
      // Handle Pipedrive webhooks
      console.log('Pipedrive webhook received:', body)

      // Process webhook events (deal created, updated, won, etc.)
      const { event, current } = body

      if (event === 'added.deal') {
        // New deal created
        console.log('New deal created:', current)
      } else if (event === 'updated.deal') {
        // Deal updated
        console.log('Deal updated:', current)
      } else if (event === 'won.deal') {
        // Deal won
        console.log('Deal won:', current)
      }

      return NextResponse.json({ success: true, message: 'Webhook processed' })
    }

    // Handle manual deal creation
    const { title, value, person_name, org_name, stage_id, owner_id } = body

    if (!PIPEDRIVE_API_TOKEN) {
      return NextResponse.json({ error: 'Pipedrive API not configured' }, { status: 500 })
    }

    const dealData = {
      title,
      value,
      currency: 'SEK',
      stage_id,
      user_id: owner_id,
      // Add custom fields for tracking
      custom_fields: {
        setter_name: user.name,
        lead_source: 'adversus_call'
      }
    }

    const response = await fetch(
      `${PIPEDRIVE_API_BASE}/deals?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dealData)
      }
    )

    if (!response.ok) {
      throw new Error(`Pipedrive create deal error: ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      deal: result.data,
      message: 'Deal created successfully'
    })

  } catch (error) {
    console.error('Pipedrive deal creation error:', error)
    return NextResponse.json({ error: 'Deal creation failed' }, { status: 500 })
  }
}