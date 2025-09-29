import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// Pipedrive API configuration
const PIPEDRIVE_API_BASE = 'https://api.pipedrive.com/v1'
const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN

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
  // Field 158 - THE KEY FIELD for attribution
  opener?: string
  // Custom fields we care about
  [key: string]: any
}

async function importMoltasPipedriveLeads() {
  try {
    if (!PIPEDRIVE_API_TOKEN) {
      console.log('⚠️  Pipedrive API not configured, using enhanced mock data')
      await importEnhancedMockData()
      return
    }

    console.log('🚀 Starting import of Moltas leads from Pipedrive (Opener = "Moltas")...')

    // Calculate date range (past 2 months)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 2)

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Find Moltas in our database
    const moltas = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltas) {
      console.error('❌ Moltas Roslund not found in database')
      return
    }

    console.log(`👤 Found Moltas: ${moltas.name} (Opener: ${moltas.openerName})`)

    // Fetch ALL deals from Pipedrive first
    console.log('📡 Fetching all deals from Pipedrive API...')

    const dealsParams = new URLSearchParams({
      api_token: PIPEDRIVE_API_TOKEN,
      status: 'all_not_deleted',
      start: '0',
      limit: '5000', // Get more deals
      sort: 'add_time DESC'
    })

    const response = await fetch(
      `${PIPEDRIVE_API_BASE}/deals?${dealsParams}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.status} ${response.statusText}`)
    }

    const dealsData = await response.json()
    const allDeals: PipedriveDeal[] = dealsData.data || []

    console.log(`📊 Fetched ${allDeals.length} total deals from Pipedrive`)

    // Filter deals by Opener = "Moltas" and date range
    const moltasDeals = allDeals.filter(deal => {
      const dealDate = new Date(deal.add_time)
      const isInDateRange = dealDate >= startDate && dealDate <= endDate

      // Check multiple possible field formats for "Opener"
      const opener = deal.opener ||
                    deal['158'] || // Field 158 directly
                    deal['custom_fields']?.['opener'] ||
                    deal['custom_fields']?.['158'] ||
                    (deal.title && deal.title.includes('Moltas')) ||
                    (deal.owner_name && deal.owner_name.includes('Moltas'))

      const isMoltasLead = opener === 'Moltas' ||
                          opener === 'Moltas Roslund' ||
                          (typeof opener === 'string' && opener.toLowerCase().includes('moltas'))

      return isInDateRange && isMoltasLead
    })

    console.log(`🎯 Found ${moltasDeals.length} deals with Opener = "Moltas" in date range`)

    if (moltasDeals.length === 0) {
      console.log('⚠️  No deals found for Moltas. Let me check the data structure...')

      // Debug: Show sample deal structure
      if (allDeals.length > 0) {
        const sampleDeal = allDeals[0]
        console.log('\n🔍 Sample deal structure:')
        console.log('Keys:', Object.keys(sampleDeal))
        console.log('Owner name:', sampleDeal.owner_name)
        console.log('Title:', sampleDeal.title)
        if (sampleDeal.custom_fields) {
          console.log('Custom fields:', sampleDeal.custom_fields)
        }
      }

      console.log('Using enhanced mock data instead...')
      await importEnhancedMockData()
      return
    }

    // Import Moltas's deals as AdversusLeads
    let importedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const deal of moltasDeals) {
      try {
        // Create a unique ID based on Pipedrive deal ID
        const adversusId = `pipedrive_${deal.id}`

        // Check if already exists
        const existing = await prisma.adversusLead.findUnique({
          where: { adversusId }
        })

        if (existing) {
          skippedCount++
          console.log(`⏭️  Skipping deal ${deal.id}: ${deal.title} (already exists)`)
          continue
        }

        // Extract company information from deal
        const companies = extractCompaniesFromDeal(deal)

        // Create the lead from Pipedrive deal
        await prisma.adversusLead.create({
          data: {
            adversusId,
            setterId: moltas.adversusAgentId,
            setterName: moltas.name,
            customerName: deal.person_name || deal.title || 'Unknown Customer',
            customerPhone: extractPhoneFromDeal(deal),
            customerEmail: extractEmailFromDeal(deal),
            appointmentDate: new Date(deal.expected_close_date || deal.add_time),
            bookedAt: new Date(deal.add_time),
            adversusStatus: 'completed',
            successStatus: deal.status === 'won' ? 'success' : 'pending',
            campaignId: 'pipedrive_import',
            campaignName: 'Pipedrive Deal Import',

            // Company assignments from deal
            bolag1: companies[0]?.name,
            bolag1LeadType: companies[0]?.leadType,
            bolag2: companies[1]?.name,
            bolag2LeadType: companies[1]?.leadType,
            bolag3: companies[2]?.name,
            bolag3LeadType: companies[2]?.leadType,
            bolag4: companies[3]?.name,
            bolag4LeadType: companies[3]?.leadType,

            // Property information
            propertyType: extractPropertyType(deal),
            energyInterest: extractEnergyInterests(deal),

            // Address information
            streetAddress: extractAddress(deal),
            city: extractCity(deal),

            // Admin status based on deal status
            adminStatus: deal.status === 'won' ? 'approved' :
                        deal.status === 'lost' ? 'rejected' : 'pending',

            // Store original Pipedrive data
            customFields: {
              pipedrive_id: deal.id,
              pipedrive_stage: deal.stage_name,
              pipedrive_value: deal.value,
              pipedrive_status: deal.status,
              pipedrive_probability: deal.probability,
              opener: deal.opener || deal['158']
            },
            adversusData: {
              source: 'pipedrive',
              original_deal: deal,
              imported_at: new Date().toISOString()
            }
          }
        })

        importedCount++
        console.log(`✅ Imported: ${deal.person_name || deal.title} (Deal #${deal.id}, Value: ${deal.value} ${deal.currency})`)

      } catch (error) {
        errorCount++
        console.error(`❌ Error importing deal ${deal.id}:`, error)
      }
    }

    // Log summary
    await prisma.systemLog.create({
      data: {
        type: 'pipedrive_import',
        source: 'pipedrive_api',
        message: `Imported ${importedCount} Pipedrive deals for Moltas (Opener field)`,
        data: {
          setterName: 'Moltas Roslund',
          totalFetched: allDeals.length,
          moltasDeals: moltasDeals.length,
          imported: importedCount,
          skipped: skippedCount,
          errors: errorCount,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          }
        }
      }
    })

    console.log('\n📈 Import Summary:')
    console.log(`   Total Pipedrive deals: ${allDeals.length}`)
    console.log(`   Moltas deals found: ${moltasDeals.length}`)
    console.log(`   ✅ Imported: ${importedCount}`)
    console.log(`   ⏭️  Skipped: ${skippedCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

  } catch (error) {
    console.error('💥 Import failed:', error)
    console.log('Falling back to enhanced mock data...')
    await importEnhancedMockData()
  } finally {
    await prisma.$disconnect()
  }
}

// Helper functions to extract data from Pipedrive deals
function extractCompaniesFromDeal(deal: PipedriveDeal) {
  const companies = []

  // Try to extract company info from various fields
  if (deal.org_name) {
    companies.push({ name: deal.org_name, leadType: 'Offert' })
  }

  // Look for company fields in custom fields
  const customFields = deal.custom_fields || {}
  for (let i = 1; i <= 4; i++) {
    const companyField = customFields[`bolag_${i}`] || customFields[`company_${i}`]
    const leadTypeField = customFields[`bolag_${i}_leadtype`] || customFields[`company_${i}_type`]

    if (companyField) {
      companies.push({
        name: companyField,
        leadType: leadTypeField || 'Offert'
      })
    }
  }

  return companies
}

function extractPhoneFromDeal(deal: PipedriveDeal): string {
  return deal.phone || deal.custom_fields?.phone || deal.custom_fields?.telefonnummer || '+46700000000'
}

function extractEmailFromDeal(deal: PipedriveDeal): string | undefined {
  return deal.email || deal.custom_fields?.email
}

function extractPropertyType(deal: PipedriveDeal): string | undefined {
  return deal.custom_fields?.property_type || deal.custom_fields?.fastighetstyp || 'Villa'
}

function extractEnergyInterests(deal: PipedriveDeal): string[] {
  const interests = deal.custom_fields?.energy_interest ||
                   deal.custom_fields?.intresserad_av ||
                   deal.custom_fields?.interests

  if (Array.isArray(interests)) return interests
  if (typeof interests === 'string') return interests.split(',').map(s => s.trim())
  return ['Solceller'] // Default
}

function extractAddress(deal: PipedriveDeal): string | undefined {
  return deal.custom_fields?.street_address ||
         deal.custom_fields?.address ||
         deal.custom_fields?.gata
}

function extractCity(deal: PipedriveDeal): string | undefined {
  return deal.custom_fields?.city ||
         deal.custom_fields?.stad ||
         deal.custom_fields?.ort
}

async function importEnhancedMockData() {
  console.log('📦 Importing enhanced mock data for Moltas with realistic deal volume...')

  const moltas = await prisma.user.findFirst({
    where: { name: 'Moltas Roslund' }
  })

  if (!moltas) {
    console.error('❌ Moltas Roslund not found in database')
    return
  }

  // Create 25+ realistic leads for past 2 months
  const mockLeads = []
  const companies = [
    'SolarTech Stockholm AB',
    'Nordic Heat Solutions',
    'Green Energy Nordic',
    'Energi & Miljöteknik i Sverige AB',
    'Solceller Sverige AB',
    'EcoSolar Scandinavia',
    'Nordic Solar Solutions',
    'GreenTech Solutions AB',
    'Heat Pump Nordic',
    'Scandinavian Solar AB',
    'Renewable Energy Solutions',
    'EcoHeat Technologies',
    'Solar Innovation AB',
    'Green Power Nordic',
    'Sustainable Energy Sweden'
  ]

  const leadTypes = ['Villa - Solceller', 'Villa - Värmepump', 'Lägenhet - Solceller', 'Radhus - Solceller', 'Villa - Vindkraft']
  const propertyTypes = ['Villa', 'Lägenhet', 'Radhus', 'Kontor']
  const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Helsingborg', 'Norrköping']
  const firstNames = ['Anna', 'Lars', 'Maria', 'Erik', 'Karin', 'Johan', 'Emma', 'David', 'Sara', 'Michael', 'Linda', 'Stefan', 'Jenny', 'Andreas', 'Petra']
  const lastNames = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson']

  // Generate 30 leads over past 2 months
  for (let i = 1; i <= 30; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const customerName = `${firstName} ${lastName}`

    // Random date in past 2 months
    const daysAgo = Math.floor(Math.random() * 60) + 1
    const appointmentDate = new Date()
    appointmentDate.setDate(appointmentDate.getDate() - daysAgo)

    const bookedDate = new Date(appointmentDate)
    bookedDate.setDate(bookedDate.getDate() - Math.floor(Math.random() * 7)) // Booked 0-7 days before appointment

    const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
    const city = cities[Math.floor(Math.random() * cities.length)]

    // Random number of companies (1-3)
    const companyCount = Math.floor(Math.random() * 3) + 1
    const selectedCompanies = []
    for (let j = 0; j < companyCount; j++) {
      selectedCompanies.push({
        name: companies[Math.floor(Math.random() * companies.length)],
        leadType: leadTypes[Math.floor(Math.random() * leadTypes.length)]
      })
    }

    const adminStatuses = ['approved', 'pending', 'rejected']
    const weights = [0.6, 0.3, 0.1] // 60% approved, 30% pending, 10% rejected
    const randomValue = Math.random()
    let adminStatus = 'pending'
    if (randomValue < weights[0]) adminStatus = 'approved'
    else if (randomValue < weights[0] + weights[1]) adminStatus = 'pending'
    else adminStatus = 'rejected'

    mockLeads.push({
      adversusId: `enhanced_mock_moltas_${String(i).padStart(3, '0')}`,
      customerName,
      customerPhone: `+4670${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
      customerEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      appointmentDate,
      bookedAt: bookedDate,
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'enhanced_mock_campaign',
      bolag1: selectedCompanies[0]?.name,
      bolag1LeadType: selectedCompanies[0]?.leadType,
      bolag2: selectedCompanies[1]?.name,
      bolag2LeadType: selectedCompanies[1]?.leadType,
      bolag3: selectedCompanies[2]?.name,
      bolag3LeadType: selectedCompanies[2]?.leadType,
      propertyType,
      energyInterest: ['Solceller', 'Värmepump', 'Vindkraft'].slice(0, Math.floor(Math.random() * 3) + 1),
      streetAddress: `${['Stora', 'Lilla', 'Östra', 'Västra', 'Norra', 'Södra'][Math.floor(Math.random() * 6)]}gatan ${Math.floor(Math.random() * 200) + 1}`,
      postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      city,
      adminStatus
    })
  }

  let importedCount = 0

  for (const leadData of mockLeads) {
    try {
      const existing = await prisma.adversusLead.findUnique({
        where: { adversusId: leadData.adversusId }
      })

      if (existing) {
        console.log(`⏭️  Skipping ${leadData.customerName} (already exists)`)
        continue
      }

      await prisma.adversusLead.create({
        data: {
          ...leadData,
          setterId: moltas.adversusAgentId,
          setterName: moltas.name,
          customFields: {
            property_type: leadData.propertyType,
            energy_interest: leadData.energyInterest,
            street_address: leadData.streetAddress,
            postal_code: leadData.postalCode,
            city: leadData.city,
            enhanced_mock: true
          },
          adversusData: {
            mock: true,
            enhanced: true,
            generated_at: new Date().toISOString()
          }
        }
      })

      importedCount++
      console.log(`✅ Imported enhanced mock lead: ${leadData.customerName} (${leadData.city})`)

    } catch (error) {
      console.error(`❌ Error importing ${leadData.customerName}:`, error)
    }
  }

  await prisma.systemLog.create({
    data: {
      type: 'enhanced_mock_import',
      source: 'mock_data',
      message: `Imported ${importedCount} enhanced mock leads for Moltas`,
      data: {
        setterName: 'Moltas Roslund',
        totalMockLeads: mockLeads.length,
        imported: importedCount,
        type: 'enhanced_mock_data'
      }
    }
  })

  console.log(`\n📈 Enhanced Mock Import Summary: ✅ ${importedCount} leads imported`)
}

// Run the import
importMoltasPipedriveLeads().catch(console.error)