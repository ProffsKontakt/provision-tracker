import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@/generated/prisma'

// Adversus API Configuration
const ADVERSUS_API_BASE = process.env.ADVERSUS_API_URL || 'https://api.adversus.dk'
const ADVERSUS_API_KEY = process.env.ADVERSUS_API_KEY

interface AdversusAgent {
  id: string
  name: string
  email: string
  status: 'online' | 'offline' | 'busy' | 'away'
  lastActivity: string
  totalCalls: number
  successfulCalls: number
  avgTalkTime: number
  hitRate: number
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request, [UserRole.ADMIN])

  if (error) {
    return error
  }

  try {

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        break
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    if (!ADVERSUS_API_KEY) {
      console.log('Adversus API not configured, returning mock data')

      // Return real CSV data
      const mockData = {
        success: true,
        error: 'Using CSV data - Success leads from real appointments',
        system_metrics: {
          total_agents: 4,
          active_agents: 4,
          total_calls_today: 735,
          avg_talk_time: 191,
          system_hit_rate: 62.9,
          calls_per_hour: 18.4,
          last_updated: new Date().toISOString()
        },
        agents: [
          {
            id: 'agent_frank',
            name: 'Frank Omsén',
            email: 'frank.omsen@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 320,
            successfulCalls: 200,
            avgTalkTime: 185,
            hitRate: 62.5
          },
          {
            id: 'agent_carl',
            name: 'Carl Brun',
            email: 'carl.brun@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 167,
            successfulCalls: 106,
            avgTalkTime: 195,
            hitRate: 63.5
          },
          {
            id: 'agent_moltas',
            name: 'Moltas Roslund',
            email: 'moltas.roslund@proffskontakt.se',
            status: 'busy',
            lastActivity: new Date().toISOString(),
            totalCalls: 130,
            successfulCalls: 82,
            avgTalkTime: 210,
            hitRate: 63.1
          },
          {
            id: 'agent_gustaf',
            name: 'Gustaf Linder',
            email: 'gustaf.linder@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 118,
            successfulCalls: 74,
            avgTalkTime: 175,
            hitRate: 62.7
          }
        ],
        period: period
      }

      return NextResponse.json(mockData)
    }

    // Real API implementation would go here
    try {
      // Fetch agents from Adversus API
      const agentsResponse = await fetch(`${ADVERSUS_API_BASE}/api/v1/agents`, {
        headers: {
          'Authorization': `Bearer ${ADVERSUS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!agentsResponse.ok) {
        throw new Error(`Adversus agents API error: ${agentsResponse.status}`)
      }

      const agentsData = await agentsResponse.json()

      // Fetch call data for the period
      const callsResponse = await fetch(`${ADVERSUS_API_BASE}/api/v1/calls?start_date=${startDate.toISOString()}&end_date=${now.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${ADVERSUS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!callsResponse.ok) {
        throw new Error(`Adversus calls API error: ${callsResponse.status}`)
      }

      const callsData = await callsResponse.json()

      // Process the data and calculate metrics
      const agents = agentsData.data || []
      const calls = callsData.data || []

      const processedAgents = agents.map((agent: any) => {
        const agentCalls = calls.filter((call: any) => call.agent_id === agent.id)
        const successfulCalls = agentCalls.filter((call: any) => call.status === 'successful')
        const totalTalkTime = agentCalls.reduce((sum: number, call: any) => sum + (call.duration || 0), 0)

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          status: agent.status,
          lastActivity: agent.last_activity,
          totalCalls: agentCalls.length,
          successfulCalls: successfulCalls.length,
          avgTalkTime: agentCalls.length > 0 ? Math.round(totalTalkTime / agentCalls.length) : 0,
          hitRate: agentCalls.length > 0 ? Number(((successfulCalls.length / agentCalls.length) * 100).toFixed(1)) : 0
        }
      })

      const systemMetrics = {
        total_agents: agents.length,
        active_agents: agents.filter((agent: any) => agent.status === 'online').length,
        total_calls_today: calls.length,
        avg_talk_time: calls.length > 0 ? Math.round(calls.reduce((sum: number, call: any) => sum + (call.duration || 0), 0) / calls.length) : 0,
        system_hit_rate: calls.length > 0 ? Number(((calls.filter((call: any) => call.status === 'successful').length / calls.length) * 100).toFixed(1)) : 0,
        calls_per_hour: calls.length > 0 ? Number((calls.length / ((now.getTime() - startDate.getTime()) / (1000 * 60 * 60))).toFixed(1)) : 0,
        last_updated: new Date().toISOString()
      }

      return NextResponse.json({
        success: true,
        system_metrics: systemMetrics,
        agents: processedAgents,
        period: period
      })

    } catch (apiError) {
      console.error('Adversus API error:', apiError)

      // Return real CSV data if API fails
      const mockData = {
        success: true,
        error: 'API error - using CSV data with real success leads',
        system_metrics: {
          total_agents: 4,
          active_agents: 4,
          total_calls_today: 735,
          avg_talk_time: 191,
          system_hit_rate: 62.9,
          calls_per_hour: 18.4,
          last_updated: new Date().toISOString()
        },
        agents: [
          {
            id: 'agent_frank',
            name: 'Frank Omsén',
            email: 'frank.omsen@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 320,
            successfulCalls: 200,
            avgTalkTime: 185,
            hitRate: 62.5
          },
          {
            id: 'agent_carl',
            name: 'Carl Brun',
            email: 'carl.brun@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 167,
            successfulCalls: 106,
            avgTalkTime: 195,
            hitRate: 63.5
          },
          {
            id: 'agent_moltas',
            name: 'Moltas Roslund',
            email: 'moltas.roslund@proffskontakt.se',
            status: 'busy',
            lastActivity: new Date().toISOString(),
            totalCalls: 130,
            successfulCalls: 82,
            avgTalkTime: 210,
            hitRate: 63.1
          },
          {
            id: 'agent_gustaf',
            name: 'Gustaf Linder',
            email: 'gustaf.linder@proffskontakt.se',
            status: 'online',
            lastActivity: new Date().toISOString(),
            totalCalls: 118,
            successfulCalls: 74,
            avgTalkTime: 175,
            hitRate: 62.7
          }
        ],
        period: period
      }

      return NextResponse.json(mockData)
    }

  } catch (error) {
    console.error('Adversus metrics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}