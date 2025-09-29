import { PrismaClient } from '../generated/prisma'

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

interface AdversusUser {
  id: number
  name: string
  email: string
  [key: string]: any
}

interface AdversusField {
  id: number
  name: string
  type: string
  [key: string]: any
}

interface AdversusLead {
  id: number
  campaignId: number
  lastContactedBy: number
  status: string
  created: string
  appointmentDate?: string
  resultData: Array<{
    id: number
    value: string
  }>
  masterData?: Record<string, any>
  [key: string]: any
}

class AdversusEnhancedAPI {
  private authString: string
  private prisma: PrismaClient

  constructor() {
    this.authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')
    this.prisma = new PrismaClient()
  }

  private async makeRequest(endpoint: string, params?: Record<string, string | number>) {
    const url = new URL(`${ADVERSUS_BASE_URL}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString())
      })
    }

    console.log(`🔍 Adversus API Request: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${this.authString}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Adversus API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  // Get all users to find opener IDs
  async getUsers(): Promise<AdversusUser[]> {
    try {
      const data = await this.makeRequest('/users', { pageSize: 1000 })
      return data.users || data.data || data || []
    } catch (error) {
      console.error('Error fetching users:', error)
      return []
    }
  }

  // Get field metadata to find the "Opener" field ID
  async getFields(): Promise<AdversusField[]> {
    try {
      const data = await this.makeRequest('/fields', { pageSize: 1000 })
      return data.fields || data.data || data || []
    } catch (error) {
      console.error('Error fetching fields:', error)
      return []
    }
  }

  // Get opener field ID
  async getOpenerFieldId(): Promise<number | null> {
    const fields = await this.getFields()
    const openerField = fields.find(field =>
      field.name.toLowerCase().includes('opener') ||
      field.name.toLowerCase().includes('öppnare')
    )

    if (openerField) {
      console.log(`✅ Found opener field: ${openerField.name} (ID: ${openerField.id})`)
      return openerField.id
    }

    console.warn('⚠️ Opener field not found in fields list')
    return null
  }

  // Get user ID by name
  async getUserIdByName(name: string): Promise<number | null> {
    const users = await this.getUsers()
    const user = users.find(u =>
      u.name.toLowerCase().includes(name.toLowerCase()) ||
      u.email.toLowerCase().includes(name.toLowerCase())
    )

    if (user) {
      console.log(`✅ Found user: ${user.name} (ID: ${user.id})`)
      return user.id
    }

    console.warn(`⚠️ User ${name} not found`)
    return null
  }

  // Get all leads with pagination
  async getAllLeads(filters?: Record<string, any>): Promise<AdversusLead[]> {
    let allLeads: AdversusLead[] = []
    let page = 1
    const pageSize = 1000

    while (true) {
      try {
        const params: Record<string, any> = {
          page,
          pageSize,
          includeMeta: true
        }

        if (filters) {
          // Add filters as query parameters
          Object.entries(filters).forEach(([key, value]) => {
            if (typeof value === 'object') {
              params[key] = JSON.stringify(value)
            } else {
              params[key] = value
            }
          })
        }

        const data = await this.makeRequest('/leads', params)
        const leads = data.leads || data.data || data

        if (!Array.isArray(leads) || leads.length === 0) {
          console.log(`📍 No more leads found on page ${page}`)
          break
        }

        console.log(`📄 Fetched ${leads.length} leads from page ${page}`)
        allLeads.push(...leads)

        if (leads.length < pageSize) {
          console.log(`📍 Last page reached (${leads.length} < ${pageSize})`)
          break
        }

        page++

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        console.error(`Error fetching leads page ${page}:`, error)
        break
      }
    }

    console.log(`✅ Total leads fetched: ${allLeads.length}`)
    return allLeads
  }

  // Filter leads by opener and status
  async getSuccessLeadsByOpener(openerNames: string[]): Promise<Map<string, AdversusLead[]>> {
    console.log(`🎯 Searching for success leads with openers: ${openerNames.join(', ')}`)

    const openerFieldId = await this.getOpenerFieldId()
    const results = new Map<string, AdversusLead[]>()

    // Initialize results map
    openerNames.forEach(name => results.set(name, []))

    // Get all leads with success status
    const filters = {
      status: 'success'
    }

    const allLeads = await this.getAllLeads(filters)

    console.log(`🔍 Filtering ${allLeads.length} success leads by opener field...`)

    // Filter leads by opener field
    allLeads.forEach(lead => {
      // Check if this lead has the opener field
      if (lead.resultData && Array.isArray(lead.resultData)) {
        const openerResult = lead.resultData.find(result =>
          result.id === openerFieldId ||
          // Fallback: check if any result field contains opener names
          (result.value && openerNames.some(name =>
            result.value.toLowerCase().includes(name.toLowerCase())
          ))
        )

        if (openerResult && openerResult.value) {
          // Find which opener name matches
          const matchingOpener = openerNames.find(name =>
            openerResult.value.toLowerCase().includes(name.toLowerCase())
          )

          if (matchingOpener) {
            const existingLeads = results.get(matchingOpener) || []
            existingLeads.push(lead)
            results.set(matchingOpener, existingLeads)
            console.log(`✅ Found ${matchingOpener} lead: ${lead.id}`)
          }
        }
      }

      // Also check in masterData for opener info
      if (lead.masterData) {
        const masterDataStr = JSON.stringify(lead.masterData).toLowerCase()
        openerNames.forEach(openerName => {
          if (masterDataStr.includes(openerName.toLowerCase())) {
            const existingLeads = results.get(openerName) || []
            if (!existingLeads.find(l => l.id === lead.id)) {
              existingLeads.push(lead)
              results.set(openerName, existingLeads)
              console.log(`✅ Found ${openerName} lead in masterData: ${lead.id}`)
            }
          }
        })
      }
    })

    // Print summary
    results.forEach((leads, opener) => {
      console.log(`📊 ${opener}: ${leads.length} success leads`)
    })

    return results
  }

  // Import leads to database
  async importLeadsToDatabase(openerLeadsMap: Map<string, AdversusLead[]>): Promise<void> {
    console.log('💾 Starting database import...')

    // Mapping of opener names to user data
    const openerUserMap = {
      'Moltas': {
        email: 'moltas.roslund@proffskontakt.se',
        name: 'Moltas Roslund',
        adversusAgentId: 'moltas'
      },
      'Frank': {
        email: 'frank.omsen@proffskontakt.se',
        name: 'Frank Omsén',
        adversusAgentId: 'frank'
      },
      'Gustaf': {
        email: 'gustaf.linder@proffskontakt.se',
        name: 'Gustaf Linder',
        adversusAgentId: 'gustaf'
      },
      'Carl': {
        email: 'carl.brun@proffskontakt.se',
        name: 'Carl Brun',
        adversusAgentId: 'carl'
      }
    }

    let totalImported = 0

    for (const [openerName, leads] of openerLeadsMap) {
      const userData = openerUserMap[openerName as keyof typeof openerUserMap]
      if (!userData) {
        console.warn(`⚠️ No user data found for opener: ${openerName}`)
        continue
      }

      console.log(`👤 Processing ${leads.length} leads for ${userData.name}...`)

      // Ensure user exists
      let user = await this.prisma.user.findFirst({
        where: { email: userData.email }
      })

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            ...userData,
            password: '$2b$10$defaultPasswordHash',
            role: 'SETTER',
            openerName: userData.name.split(' ')[0],
            active: true
          }
        })
        console.log(`✅ Created user: ${user.name}`)
      }

      // Import leads
      let imported = 0
      for (const lead of leads) {
        try {
          // Extract data from lead
          const customerName = this.extractCustomerName(lead)
          const customerPhone = this.extractCustomerPhone(lead)
          const customerEmail = this.extractCustomerEmail(lead)

          await this.prisma.adversusLead.create({
            data: {
              adversusId: `adversus_${lead.id}`,
              setterId: user.adversusAgentId,
              setterName: user.name,
              customerName,
              customerPhone,
              customerEmail,
              appointmentDate: new Date(lead.appointmentDate || lead.created),
              bookedAt: new Date(lead.created),
              adversusStatus: lead.status,
              successStatus: 'success',
              adminStatus: 'pending',
              customFields: {
                resultData: lead.resultData || [],
                masterData: lead.masterData || {}
              },
              adversusData: lead
            }
          })
          imported++
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Duplicate entry, skip
            continue
          }
          console.error(`Error importing lead ${lead.id}:`, error)
        }
      }

      console.log(`✅ Imported ${imported}/${leads.length} leads for ${userData.name}`)
      totalImported += imported
    }

    console.log(`🎉 Total imported: ${totalImported} leads`)
  }

  // Helper methods to extract data from leads
  private extractCustomerName(lead: AdversusLead): string {
    if (lead.masterData?.name) return lead.masterData.name
    if (lead.masterData?.firstName && lead.masterData?.lastName) {
      return `${lead.masterData.firstName} ${lead.masterData.lastName}`
    }
    return `Lead ${lead.id}`
  }

  private extractCustomerPhone(lead: AdversusLead): string {
    if (lead.masterData?.phone) return lead.masterData.phone
    if (lead.masterData?.phoneNumber) return lead.masterData.phoneNumber
    return '+46700000000'
  }

  private extractCustomerEmail(lead: AdversusLead): string | undefined {
    if (lead.masterData?.email) return lead.masterData.email
    if (lead.masterData?.emailAddress) return lead.masterData.emailAddress
    return undefined
  }

  async disconnect() {
    await this.prisma.$disconnect()
  }
}

export const adversusEnhancedAPI = new AdversusEnhancedAPI()
export type { AdversusUser, AdversusField, AdversusLead }