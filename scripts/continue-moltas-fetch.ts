import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

// CORRECT COMMISSION STRUCTURE FOR LEAD GENERATION
const COMMISSION_STRUCTURE = {
  baseFee: 100,      // 100 SEK per lead generated
  offertFee: 100,    // 100 SEK when company requests quote
  platsBesokFee: 300 // 300 SEK when company requests site visit
}

async function continueMoltasFetch() {
  console.log('🎯 Continuing Moltas lead fetch from page 97\n')
  console.log('💰 Lead Generation Commission Structure:')
  console.log(`   Base: ${COMMISSION_STRUCTURE.baseFee} SEK per lead`)
  console.log(`   Offert: ${COMMISSION_STRUCTURE.offertFee} SEK per company requesting quote`)
  console.log(`   Platsbesök: ${COMMISSION_STRUCTURE.platsBesokFee} SEK per company requesting site visit\n`)

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Load existing leads
    let allMoltasSuccessLeads = []
    if (fs.existsSync('moltas-all-success-leads.json')) {
      allMoltasSuccessLeads = JSON.parse(fs.readFileSync('moltas-all-success-leads.json', 'utf-8'))
      console.log(`📊 Loaded ${allMoltasSuccessLeads.length} existing leads\n`)
    }

    const existingIds = new Set(allMoltasSuccessLeads.map((l: any) => l.id))

    // Continue from page 97 to 200
    for (let page = 97; page <= 200; page++) {
      process.stdout.write(`\r📄 Scanning page ${page}/200...`)

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=500`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`\n📍 No more data after page ${page - 1}`)
          break
        }
        if (response.status === 429) {
          console.log('\n⏳ Rate limited, waiting...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          page--
          continue
        }
        continue
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log(`\n📍 No more leads after page ${page - 1}`)
        break
      }

      // Find Moltas success leads
      let pageNewLeads = 0
      leads.forEach((lead: any) => {
        if (existingIds.has(lead.id)) return

        const leadString = JSON.stringify(lead).toLowerCase()
        if (leadString.includes('moltas') &&
            (lead.status === 'success' || lead.status === 'successful')) {
          allMoltasSuccessLeads.push(lead)
          existingIds.add(lead.id)
          pageNewLeads++
        }
      })

      if (pageNewLeads > 0) {
        console.log(`\n✅ Page ${page}: Found ${pageNewLeads} new Moltas success leads (Total: ${allMoltasSuccessLeads.length})`)
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Save updated leads
    fs.writeFileSync(
      'moltas-all-success-leads.json',
      JSON.stringify(allMoltasSuccessLeads, null, 2)
    )

    console.log('\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS')
    console.log('═'.repeat(60))
    console.log(`✅ Total Moltas success leads: ${allMoltasSuccessLeads.length}`)

    // Import to database with proper commission calculation
    console.log('\n💾 Importing to PostgreSQL with commission tracking...')

    const moltasUser = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    }) || await prisma.user.create({
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

    // Clear existing leads
    await prisma.adversusLead.deleteMany({
      where: { setterName: 'Moltas Roslund' }
    })

    // Import with commission calculation
    let imported = 0
    let totalBaseFees = 0
    let totalOffertFees = 0
    let totalPlatsBesokFees = 0

    for (const lead of allMoltasSuccessLeads) {
      try {
        const leadStr = JSON.stringify(lead).toLowerCase()

        // Calculate commission based on lead data
        let commission = COMMISSION_STRUCTURE.baseFee
        totalBaseFees += COMMISSION_STRUCTURE.baseFee

        let offertCount = 0
        let platsBesokCount = 0

        // Check for companies requesting offert
        if (leadStr.includes('offert')) {
          offertCount = 1 // Count how many companies requested
          commission += COMMISSION_STRUCTURE.offertFee * offertCount
          totalOffertFees += COMMISSION_STRUCTURE.offertFee * offertCount
        }

        // Check for companies requesting platsbesök
        if (leadStr.includes('platsbesök') || leadStr.includes('platsbesok')) {
          platsBesokCount = 1 // Count how many companies requested
          commission += COMMISSION_STRUCTURE.platsBesokFee * platsBesokCount
          totalPlatsBesokFees += COMMISSION_STRUCTURE.platsBesokFee * platsBesokCount
        }

        await prisma.adversusLead.create({
          data: {
            adversusId: `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`,
            setterId: moltasUser.adversusAgentId,
            setterName: 'Moltas Roslund',
            customerName: extractField(lead, 'name') || `Lead ${lead.id}`,
            customerPhone: extractField(lead, 'phone') || '+46700000000',
            customerEmail: extractField(lead, 'email'),
            bolag1: extractField(lead, 'bolag1'),
            bolag2: extractField(lead, 'bolag2'),
            bolag3: extractField(lead, 'bolag3'),
            bolag4: extractField(lead, 'bolag4'),
            appointmentDate: new Date(lead.appointmentDate || lead.created || Date.now()),
            bookedAt: new Date(lead.created || Date.now()),
            adversusStatus: lead.status || 'success',
            successStatus: 'success',
            adminStatus: 'pending',
            customFields: {
              masterData: lead.masterData || {},
              resultData: lead.resultData || {},
              commission: {
                total: commission,
                breakdown: {
                  baseFee: COMMISSION_STRUCTURE.baseFee,
                  offertFees: COMMISSION_STRUCTURE.offertFee * offertCount,
                  platsBesokFees: COMMISSION_STRUCTURE.platsBesokFee * platsBesokCount,
                  offertCount,
                  platsBesokCount
                }
              }
            },
            adversusData: lead
          }
        })
        imported++
      } catch (error) {
        // Skip duplicates
      }
    }

    console.log(`✅ Imported ${imported} leads to database`)

    // Commission summary
    console.log('\n💰 MOLTAS COMMISSION SUMMARY')
    console.log('═'.repeat(60))
    console.log(`Total leads generated: ${allMoltasSuccessLeads.length}`)
    console.log(`Base fees: ${allMoltasSuccessLeads.length} × ${COMMISSION_STRUCTURE.baseFee} SEK = ${totalBaseFees} SEK`)
    console.log(`Offert fees: ${totalOffertFees} SEK`)
    console.log(`Platsbesök fees: ${totalPlatsBesokFees} SEK`)
    console.log('─'.repeat(60))
    console.log(`TOTAL COMMISSION: ${totalBaseFees + totalOffertFees + totalPlatsBesokFees} SEK`)

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function extractField(lead: any, fieldName: string): string | undefined {
  if (lead[fieldName]) return lead[fieldName]
  if (lead.masterData?.[fieldName]) return lead.masterData[fieldName]
  if (lead.resultData?.[fieldName]) return lead.resultData[fieldName]

  // Check numbered fields
  if (lead.masterData) {
    for (let i = 1; i <= 20; i++) {
      const value = lead.masterData[`masterData${i}`]
      if (value && typeof value === 'string') {
        if (fieldName === 'email' && value.includes('@')) return value
        if (fieldName === 'phone' && value.includes('+46')) return value
        if (fieldName.includes('bolag')) return value
      }
    }
  }

  return undefined
}

continueMoltasFetch().catch(console.error)