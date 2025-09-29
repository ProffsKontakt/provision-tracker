import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

interface LeadCommission {
  baseFee: number  // 100 SEK per lead
  offertFee: number // 100 SEK per company that requests "offert" (quote)
  platsBesokFee: number // 300 SEK per company that requests "platsbesök" (site visit)
}

const COMMISSION_STRUCTURE: LeadCommission = {
  baseFee: 100,
  offertFee: 100,
  platsBesokFee: 300
}

async function fetchMoltasEfficient() {
  console.log('🎯 Efficiently fetching ALL Moltas success leads from Adversus\n')
  console.log('💰 Commission Structure:')
  console.log(`   Base fee per lead: ${COMMISSION_STRUCTURE.baseFee} SEK`)
  console.log(`   Per company "offert": ${COMMISSION_STRUCTURE.offertFee} SEK`)
  console.log(`   Per company "platsbesök": ${COMMISSION_STRUCTURE.platsBesokFee} SEK\n`)

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    let allMoltasSuccessLeads = []
    let page = 1
    let hasMore = true
    const perPage = 500 // Maximum per page for efficiency

    console.log('📊 Starting comprehensive API scan...\n')

    // Try different API query approaches
    const queryStrategies = [
      // Strategy 1: Direct filter by status and opener
      {
        name: 'Direct filter',
        params: (page: number) => ({
          page: page.toString(),
          per_page: perPage.toString(),
          'filter[status]': 'success',
          'filter[opener]': 'Moltas'
        })
      },
      // Strategy 2: Filter by resultData fields
      {
        name: 'ResultData filter',
        params: (page: number) => ({
          page: page.toString(),
          per_page: perPage.toString(),
          'filter[resultData.opener]': 'Moltas',
          'filter[resultData.status]': 'success'
        })
      },
      // Strategy 3: Filter by masterData fields
      {
        name: 'MasterData filter',
        params: (page: number) => ({
          page: page.toString(),
          per_page: perPage.toString(),
          'filter[masterData.opener]': 'Moltas',
          status: 'success'
        })
      },
      // Strategy 4: Just status filter, then filter locally
      {
        name: 'Status only filter',
        params: (page: number) => ({
          page: page.toString(),
          per_page: perPage.toString(),
          status: 'success'
        })
      }
    ]

    // Try each strategy
    for (const strategy of queryStrategies) {
      console.log(`\n🔍 Trying strategy: ${strategy.name}`)

      const params = new URLSearchParams(strategy.params(1))
      const testUrl = `${ADVERSUS_BASE_URL}/leads?${params}`

      console.log(`   URL: ${testUrl}`)

      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      })

      if (testResponse.ok) {
        const testData = await testResponse.json()
        const leads = testData.leads || testData.data || testData

        if (Array.isArray(leads) && leads.length > 0) {
          // Check if any leads are Moltas leads
          const moltasCount = leads.filter((lead: any) => {
            const leadString = JSON.stringify(lead).toLowerCase()
            return leadString.includes('moltas')
          }).length

          console.log(`   ✅ Strategy works! Found ${leads.length} leads, ${moltasCount} are Moltas leads`)

          if (moltasCount > 0 || strategy.name === 'Status only filter') {
            // Use this strategy
            console.log(`   📈 Using this strategy to fetch all pages\n`)

            // Reset for full fetch
            page = 1
            hasMore = true
            allMoltasSuccessLeads = []

            while (hasMore) {
              const params = new URLSearchParams(strategy.params(page))
              const response = await fetch(
                `${ADVERSUS_BASE_URL}/leads?${params}`,
                {
                  headers: {
                    'Authorization': `Basic ${authString}`,
                    'Accept': 'application/json'
                  }
                }
              )

              if (!response.ok) {
                if (response.status === 429) {
                  console.log('⏳ Rate limited, waiting...')
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  continue
                }
                break
              }

              const data = await response.json()
              const leads = data.leads || data.data || data

              if (!Array.isArray(leads) || leads.length === 0) {
                hasMore = false
                break
              }

              // Filter for Moltas leads
              const moltasLeads = leads.filter((lead: any) => {
                const leadString = JSON.stringify(lead).toLowerCase()
                return leadString.includes('moltas') &&
                       (lead.status === 'success' || lead.status === 'successful')
              })

              allMoltasSuccessLeads.push(...moltasLeads)

              console.log(`📄 Page ${page}: ${leads.length} leads, ${moltasLeads.length} Moltas success leads (Total: ${allMoltasSuccessLeads.length})`)

              if (leads.length < perPage) {
                hasMore = false
              }

              page++
              await new Promise(resolve => setTimeout(resolve, 500))
            }

            break // Found working strategy, don't try others
          }
        }
      } else {
        console.log(`   ❌ Strategy failed: ${testResponse.status}`)
      }
    }

    // If no strategy worked, do a full scan
    if (allMoltasSuccessLeads.length === 0) {
      console.log('\n⚠️ No filtered strategy worked, doing full scan...\n')

      page = 1
      hasMore = true

      while (hasMore && page <= 200) { // Limit to 200 pages
        const response = await fetch(
          `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=${perPage}`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json'
            }
          }
        )

        if (!response.ok) {
          if (response.status === 429) {
            console.log('⏳ Rate limited, waiting...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            continue
          }
          break
        }

        const data = await response.json()
        const leads = data.leads || data.data || data

        if (!Array.isArray(leads) || leads.length === 0) {
          break
        }

        // Search for Moltas success leads
        const moltasLeads = leads.filter((lead: any) => {
          const leadString = JSON.stringify(lead).toLowerCase()
          return leadString.includes('moltas') &&
                 (lead.status === 'success' || lead.status === 'successful' ||
                  lead.resultData?.status === 'success')
        })

        allMoltasSuccessLeads.push(...moltasLeads)

        if (moltasLeads.length > 0) {
          console.log(`📄 Page ${page}: Found ${moltasLeads.length} Moltas success leads (Total: ${allMoltasSuccessLeads.length})`)
        }

        if (leads.length < perPage) {
          hasMore = false
        }

        page++
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Results
    console.log('\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS')
    console.log('═'.repeat(60))
    console.log(`✅ Total Moltas success leads found: ${allMoltasSuccessLeads.length}`)

    // Analyze lead structure to understand commission data
    if (allMoltasSuccessLeads.length > 0) {
      console.log('\n🔍 Analyzing lead structure for commission data...')

      const firstLead = allMoltasSuccessLeads[0]
      console.log('\nSample lead structure:')
      console.log('ID:', firstLead.id)
      console.log('Status:', firstLead.status)
      console.log('Created:', firstLead.created)

      // Look for company assignments
      let companiesFound = 0
      let offertsFound = 0
      let platsbesokFound = 0

      allMoltasSuccessLeads.forEach((lead: any) => {
        // Count companies (bolag)
        for (let i = 1; i <= 4; i++) {
          if (lead.masterData?.[`bolag${i}`] || lead.resultData?.[`bolag${i}`]) {
            companiesFound++
          }
        }

        // Look for offert/platsbesök indicators
        const leadStr = JSON.stringify(lead).toLowerCase()
        if (leadStr.includes('offert')) offertsFound++
        if (leadStr.includes('platsbesök') || leadStr.includes('platsbesok')) platsbesokFound++
      })

      console.log(`\n💰 Commission Potential:`)
      console.log(`   Leads: ${allMoltasSuccessLeads.length} × ${COMMISSION_STRUCTURE.baseFee} SEK = ${allMoltasSuccessLeads.length * COMMISSION_STRUCTURE.baseFee} SEK`)
      console.log(`   Companies assigned: ${companiesFound}`)
      console.log(`   Offerts found: ${offertsFound}`)
      console.log(`   Platsbesök found: ${platsbesokFound}`)

      // Save to file
      fs.writeFileSync(
        'moltas-all-success-leads-final.json',
        JSON.stringify(allMoltasSuccessLeads, null, 2)
      )
      console.log('\n📁 Data saved to moltas-all-success-leads-final.json')

      // Import to database
      console.log('\n💾 Importing to PostgreSQL database...')

      // Ensure Moltas user exists
      let moltasUser = await prisma.user.findFirst({
        where: { name: 'Moltas Roslund' }
      })

      if (!moltasUser) {
        moltasUser = await prisma.user.create({
          data: {
            email: 'moltas.roslund@proffskontakt.se',
            name: 'Moltas Roslund',
            password: '$2b$10$defaultPasswordHash',
            role: 'SETTER',
            openerName: 'Moltas',
            adversusAgentId: 'moltas',
            active: true
          }
        })
      }

      // Clear existing Moltas leads
      await prisma.adversusLead.deleteMany({
        where: { setterName: 'Moltas Roslund' }
      })

      // Import all success leads with proper commission tracking
      let imported = 0
      for (const lead of allMoltasSuccessLeads) {
        try {
          // Calculate commission for this lead
          let commission = COMMISSION_STRUCTURE.baseFee // Base fee

          // Add offert fees
          const leadStr = JSON.stringify(lead).toLowerCase()
          if (leadStr.includes('offert')) {
            commission += COMMISSION_STRUCTURE.offertFee
          }

          // Add platsbesök fees
          if (leadStr.includes('platsbesök') || leadStr.includes('platsbesok')) {
            commission += COMMISSION_STRUCTURE.platsBesokFee
          }

          await prisma.adversusLead.create({
            data: {
              adversusId: `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`,
              setterId: moltasUser.adversusAgentId,
              setterName: 'Moltas Roslund',
              customerName: extractField(lead, 'name') || extractField(lead, 'company') || `Customer ${lead.id}`,
              customerPhone: extractField(lead, 'phone') || extractField(lead, 'tel') || '+46700000000',
              customerEmail: extractField(lead, 'email'),
              bolag1: extractField(lead, 'bolag1') || extractField(lead, 'Bolag 1'),
              bolag2: extractField(lead, 'bolag2') || extractField(lead, 'Bolag 2'),
              bolag3: extractField(lead, 'bolag3') || extractField(lead, 'Bolag 3'),
              bolag4: extractField(lead, 'bolag4') || extractField(lead, 'Bolag 4'),
              appointmentDate: new Date(lead.appointmentDate || lead.created || Date.now()),
              bookedAt: new Date(lead.created || Date.now()),
              adversusStatus: lead.status || 'success',
              successStatus: 'success',
              adminStatus: 'pending',
              customFields: {
                masterData: lead.masterData || {},
                resultData: lead.resultData || {},
                commission: commission,
                commissionBreakdown: {
                  baseFee: COMMISSION_STRUCTURE.baseFee,
                  offertFee: leadStr.includes('offert') ? COMMISSION_STRUCTURE.offertFee : 0,
                  platsBesokFee: (leadStr.includes('platsbesök') || leadStr.includes('platsbesok')) ? COMMISSION_STRUCTURE.platsBesokFee : 0
                }
              },
              adversusData: lead
            }
          })
          imported++
        } catch (error) {
          // Skip on error
        }
      }

      console.log(`✅ Imported ${imported} Moltas success leads to database`)

      // Calculate total commission
      const totalLeads = await prisma.adversusLead.count({
        where: { setterName: 'Moltas Roslund' }
      })

      console.log(`\n💰 Moltas Commission Summary:`)
      console.log(`   Total leads in database: ${totalLeads}`)
      console.log(`   Minimum commission (base only): ${totalLeads * COMMISSION_STRUCTURE.baseFee} SEK`)
      console.log(`   Maximum potential (with all offerts + platsbesök): ${totalLeads * (COMMISSION_STRUCTURE.baseFee + COMMISSION_STRUCTURE.offertFee + COMMISSION_STRUCTURE.platsBesokFee)} SEK`)
    }

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function extractField(lead: any, fieldName: string): string | undefined {
  // Direct field
  if (lead[fieldName]) return lead[fieldName]

  // In masterData
  if (lead.masterData) {
    if (lead.masterData[fieldName]) return lead.masterData[fieldName]

    // Check numbered fields
    for (let i = 1; i <= 20; i++) {
      const value = lead.masterData[`masterData${i}`]
      if (value && typeof value === 'string') {
        if (fieldName === 'email' && value.includes('@')) return value
        if (fieldName === 'phone' && (value.includes('+46') || value.match(/^0\d{8,}$/))) return value
        if (fieldName.includes('bolag') && !value.includes('@') && !value.match(/^\+?\d+$/)) return value
      }
    }
  }

  // In resultData
  if (lead.resultData) {
    if (lead.resultData[fieldName]) return lead.resultData[fieldName]

    // Check all resultData fields
    for (const [key, value] of Object.entries(lead.resultData)) {
      if (typeof value === 'string') {
        if (fieldName === 'email' && value.includes('@')) return value
        if (fieldName === 'phone' && (value.includes('+46') || value.match(/^0\d{8,}$/))) return value
        if (key.toLowerCase().includes(fieldName.toLowerCase())) return value
      }
    }
  }

  return undefined
}

// Run the efficient fetch
fetchMoltasEfficient().catch(console.error)