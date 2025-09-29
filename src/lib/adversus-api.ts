import { NextRequest } from 'next/server'

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

interface AdversusLead {
  id: string
  status: string
  created: string
  appointmentDate?: string
  masterData?: Record<string, any>
  resultData?: Record<string, any>
  [key: string]: any
}

interface AdversusCall {
  id: string
  date: string
  duration: number
  status: string
  agent: string
  phone: string
  leadId?: string
  outcome?: string
  [key: string]: any
}

interface DailyMetrics {
  date: string
  agent: string
  totalCalls: number
  connectedCalls: number
  leadsGenerated: number
  successfulLeads: number
  hitRate: number // connectedCalls to successfulLeads ratio
}

interface CommissionData {
  agent: string
  period: string
  totalLeads: number
  baseCommission: number
  offertCommission: number
  platsBesokCommission: number
  totalCommission: number
}

class AdversusAPI {
  private authString: string

  constructor() {
    this.authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${ADVERSUS_BASE_URL}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${this.authString}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Adversus API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Get all leads for a specific agent
  async getLeadsByAgent(agentName: string, status?: string): Promise<AdversusLead[]> {
    let allLeads: AdversusLead[] = []
    let page = 1
    const perPage = 500

    while (true) {
      const params: Record<string, string> = {
        page: page.toString(),
        per_page: perPage.toString()
      }

      if (status) {
        params.status = status
      }

      try {
        const data = await this.makeRequest('/leads', params)
        const leads = data.leads || data.data || data

        if (!Array.isArray(leads) || leads.length === 0) {
          break
        }

        // Filter for the specific agent
        const agentLeads = leads.filter((lead: AdversusLead) => {
          const leadStr = JSON.stringify(lead).toLowerCase()
          return leadStr.includes(agentName.toLowerCase())
        })

        allLeads.push(...agentLeads)

        if (leads.length < perPage) {
          break
        }

        page++
      } catch (error) {
        console.error(`Error fetching leads for ${agentName}:`, error)
        break
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    return allLeads
  }

  // Get call data for agents (this may need to be adapted based on actual Adversus API structure)
  async getCallsByAgent(agentName: string, dateFrom?: string, dateTo?: string): Promise<AdversusCall[]> {
    try {
      const params: Record<string, string> = {
        per_page: '1000'
      }

      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo

      // Note: This endpoint might be different in actual Adversus API
      const data = await this.makeRequest('/calls', params)
      const calls = data.calls || data.data || data

      if (!Array.isArray(calls)) {
        return []
      }

      // Filter for the specific agent
      return calls.filter((call: AdversusCall) => {
        const callStr = JSON.stringify(call).toLowerCase()
        return callStr.includes(agentName.toLowerCase())
      })
    } catch (error) {
      console.error(`Error fetching calls for ${agentName}:`, error)
      return []
    }
  }

  // Calculate daily metrics for an agent
  async getDailyMetrics(agentName: string, days: number = 30): Promise<DailyMetrics[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    const dateFrom = startDate.toISOString().split('T')[0]
    const dateTo = endDate.toISOString().split('T')[0]

    try {
      const [leads, calls] = await Promise.all([
        this.getLeadsByAgent(agentName),
        this.getCallsByAgent(agentName, dateFrom, dateTo)
      ])

      const dailyMetrics: Record<string, DailyMetrics> = {}

      // Process calls by date
      calls.forEach(call => {
        const date = call.date.split('T')[0] // Get YYYY-MM-DD

        if (!dailyMetrics[date]) {
          dailyMetrics[date] = {
            date,
            agent: agentName,
            totalCalls: 0,
            connectedCalls: 0,
            leadsGenerated: 0,
            successfulLeads: 0,
            hitRate: 0
          }
        }

        dailyMetrics[date].totalCalls++

        if (call.status === 'connected' || call.duration > 0) {
          dailyMetrics[date].connectedCalls++
        }
      })

      // Process leads by date
      leads.forEach(lead => {
        const date = (lead.created || lead.appointmentDate || '').split('T')[0]

        if (date && dailyMetrics[date]) {
          dailyMetrics[date].leadsGenerated++

          if (lead.status === 'success' || lead.status === 'successful') {
            dailyMetrics[date].successfulLeads++
          }
        }
      })

      // Calculate hit rates
      Object.values(dailyMetrics).forEach(metric => {
        metric.hitRate = metric.connectedCalls > 0
          ? metric.successfulLeads / metric.connectedCalls
          : 0
      })

      return Object.values(dailyMetrics).sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      console.error(`Error calculating daily metrics for ${agentName}:`, error)
      return []
    }
  }

  // Calculate commission data
  async getCommissionData(agentName: string, period: string = 'current_month'): Promise<CommissionData> {
    try {
      const leads = await this.getLeadsByAgent(agentName, 'success')

      const COMMISSION_RATES = {
        base: 100,      // 100 SEK per lead
        offert: 100,    // 100 SEK per offert request
        platsbesok: 300 // 300 SEK per site visit request
      }

      let baseCommission = 0
      let offertCommission = 0
      let platsBesokCommission = 0

      leads.forEach(lead => {
        baseCommission += COMMISSION_RATES.base

        const leadStr = JSON.stringify(lead).toLowerCase()

        if (leadStr.includes('offert')) {
          offertCommission += COMMISSION_RATES.offert
        }

        if (leadStr.includes('platsbesök') || leadStr.includes('platsbesok')) {
          platsBesokCommission += COMMISSION_RATES.platsbesok
        }
      })

      return {
        agent: agentName,
        period,
        totalLeads: leads.length,
        baseCommission,
        offertCommission,
        platsBesokCommission,
        totalCommission: baseCommission + offertCommission + platsBesokCommission
      }
    } catch (error) {
      console.error(`Error calculating commission for ${agentName}:`, error)
      return {
        agent: agentName,
        period,
        totalLeads: 0,
        baseCommission: 0,
        offertCommission: 0,
        platsBesokCommission: 0,
        totalCommission: 0
      }
    }
  }

  // Get provision trend data for charts
  async getProvisionTrend(days: number = 30): Promise<any[]> {
    const agents = ['Frank Omsén', 'Gustaf Linder', 'Carl Brun', 'Moltas Roslund']
    const endDate = new Date()
    const trendData: any[] = []

    // Generate date range
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate)
      date.setDate(endDate.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const dailyData: any = {
        date: dateStr,
        day: date.toLocaleDateString('sv-SE', { weekday: 'short' }),
        totalCalls: 0,
        leadsGenerated: 0,
        successfulLeads: 0,
        commission: 0
      }

      // Aggregate all agents' metrics for this day
      for (const agent of agents) {
        try {
          // Get cached daily metrics for this agent
          const metrics = await this.getDailyMetrics(agent, days)
          const dayMetric = metrics.find(m => m.date === dateStr)

          if (dayMetric) {
            dailyData.totalCalls += dayMetric.totalCalls
            dailyData.leadsGenerated += dayMetric.leadsGenerated
            dailyData.successfulLeads += dayMetric.successfulLeads
            dailyData.commission += dayMetric.successfulLeads * 100 // Base commission
          }

          // Set individual agent data for chart display
          const agentKey = agent.split(' ')[0]
          dailyData[agentKey] = dayMetric ? dayMetric.successfulLeads * 100 : 0
        } catch (error) {
          console.error(`Error getting metrics for ${agent} on ${dateStr}:`, error)
          const agentKey = agent.split(' ')[0]
          dailyData[agentKey] = 0
        }
      }

      // Set fallback value for chart display
      dailyData.value = dailyData.commission || dailyData.successfulLeads || 0

      trendData.push(dailyData)
    }

    return trendData
  }
}

export const adversusAPI = new AdversusAPI()
export type { DailyMetrics, CommissionData, AdversusLead, AdversusCall }