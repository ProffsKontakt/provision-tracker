import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function findMoltasSmart() {
  console.log('🎯 Smart approach to find ALL 82 Moltas success leads\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // First, try to get agents/users list
    console.log('📊 Step 1: Checking for agents/users endpoints...\n')

    const endpoints = [
      '/agents',
      '/users',
      '/campaigns',
      '/projects',
      '/teams'
    ]

    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint}...`)
      try {
        const response = await fetch(`${ADVERSUS_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ ${endpoint} exists!`)

          // Look for Moltas
          const jsonStr = JSON.stringify(data).toLowerCase()
          if (jsonStr.includes('moltas')) {
            console.log(`   🎯 Found Moltas reference in ${endpoint}!`)
            console.log(`   Data sample:`, JSON.stringify(data).substring(0, 500))
          }
        } else {
          console.log(`❌ ${endpoint}: ${response.status}`)
        }
      } catch (error) {
        console.log(`❌ ${endpoint}: Error`)
      }
    }

    // Strategy: Get ALL success leads in one go, then filter locally
    console.log('\n📊 Step 2: Fetching ALL success leads and filtering for Moltas locally...\n')

    let allMoltasSuccessLeads = []
    let page = 1
    let totalSuccessLeads = 0
    const perPage = 1000 // Maximum allowed

    // First, get the total count
    const countResponse = await fetch(
      `${ADVERSUS_BASE_URL}/leads?status=success&per_page=1`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (countResponse.ok) {
      const countData = await countResponse.json()
      const total = countData.total || countData.total_count || countData.count || 0
      console.log(`📊 Total success leads in system: ${total}\n`)
    }

    // Now fetch all success leads
    while (true) {
      process.stdout.write(`\r📄 Fetching page ${page} (${perPage} leads per page)...`)

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?status=success&page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          console.log('\n📍 No more pages')
          break
        }
        console.log(`\n⚠️ Error: ${response.status}`)
        break
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log('\n📍 No more leads')
        break
      }

      totalSuccessLeads += leads.length

      // Filter for Moltas
      leads.forEach((lead: any) => {
        // Multiple ways to check for Moltas
        let isMoltasLead = false
        let moltasLocation = ''

        // Check all fields deeply
        function checkForMoltas(obj: any, path = ''): boolean {
          if (!obj) return false

          if (typeof obj === 'string' && obj.toLowerCase().includes('moltas')) {
            moltasLocation = path
            return true
          }

          if (typeof obj === 'object' && !Array.isArray(obj)) {
            for (const [key, value] of Object.entries(obj)) {
              const newPath = path ? `${path}.${key}` : key
              if (checkForMoltas(value, newPath)) {
                return true
              }
            }
          }

          return false
        }

        if (checkForMoltas(lead)) {
          isMoltasLead = true
          allMoltasSuccessLeads.push({
            ...lead,
            _moltasLocation: moltasLocation
          })
        }
      })

      console.log(`\r📄 Page ${page}: ${leads.length} success leads, ${allMoltasSuccessLeads.length} are Moltas`)

      if (leads.length < perPage) {
        console.log('\n📍 Last page reached')
        break
      }

      page++

      // Stop if we've found enough (82 + some buffer)
      if (allMoltasSuccessLeads.length >= 100) {
        console.log('\n✅ Found enough Moltas leads')
        break
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Results
    console.log('\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS')
    console.log('═'.repeat(60))
    console.log(`Total success leads scanned: ${totalSuccessLeads}`)
    console.log(`✅ Moltas success leads found: ${allMoltasSuccessLeads.length}`)

    if (allMoltasSuccessLeads.length > 0) {
      // Analyze where Moltas appears
      const locations = new Map<string, number>()
      allMoltasSuccessLeads.forEach((lead: any) => {
        const loc = lead._moltasLocation || 'unknown'
        locations.set(loc, (locations.get(loc) || 0) + 1)
      })

      console.log('\n🔍 Where "Moltas" appears in the data:')
      locations.forEach((count, location) => {
        console.log(`   ${location}: ${count} times`)
      })

      // Save all leads
      fs.writeFileSync(
        'moltas-all-82-success-leads.json',
        JSON.stringify(allMoltasSuccessLeads, null, 2)
      )
      console.log('\n📁 Saved to moltas-all-82-success-leads.json')

      // Import to database
      console.log('\n💾 Importing ALL Moltas leads to database...')

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

      // Clear and reimport
      await prisma.adversusLead.deleteMany({
        where: { setterName: 'Moltas Roslund' }
      })

      let imported = 0
      for (const lead of allMoltasSuccessLeads) {
        try {
          await prisma.adversusLead.create({
            data: {
              adversusId: `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`,
              setterId: moltasUser.adversusAgentId,
              setterName: 'Moltas Roslund',
              customerName: extractField(lead, 'name') || `Lead ${lead.id}`,
              customerPhone: extractField(lead, 'phone') || '+46700000000',
              customerEmail: extractField(lead, 'email'),
              appointmentDate: new Date(lead.appointmentDate || lead.created || Date.now()),
              bookedAt: new Date(lead.created || Date.now()),
              adversusStatus: lead.status || 'success',
              successStatus: 'success',
              adminStatus: 'pending',
              customFields: {
                masterData: lead.masterData || {},
                resultData: lead.resultData || {},
                moltasLocation: lead._moltasLocation
              },
              adversusData: lead
            }
          })
          imported++
        } catch (error) {
          // Skip duplicates
        }
      }

      console.log(`✅ Imported ${imported} Moltas success leads`)

      // Commission summary
      const COMMISSION = {
        base: 100,
        offert: 100,
        platsbesok: 300
      }

      console.log('\n💰 MOLTAS COMMISSION (Lead Generation Model)')
      console.log('═'.repeat(60))
      console.log(`Total leads: ${allMoltasSuccessLeads.length}`)
      console.log(`Base commission: ${allMoltasSuccessLeads.length} × ${COMMISSION.base} SEK = ${allMoltasSuccessLeads.length * COMMISSION.base} SEK`)
      console.log('\n(+ additional fees for offerts and platsbesök per company)')
    }

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
  return undefined
}

findMoltasSmart().catch(console.error)