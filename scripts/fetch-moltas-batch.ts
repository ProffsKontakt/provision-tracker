import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function fetchMoltasBatch(startPage: number, endPage: number) {
  console.log(`🎯 Batch fetch for Moltas leads (pages ${startPage}-${endPage})\n`)

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    let successfulMoltasLeads = []

    // Load existing data if it exists
    if (fs.existsSync('moltas-all-success-leads.json')) {
      const existing = JSON.parse(fs.readFileSync('moltas-all-success-leads.json', 'utf-8'))
      successfulMoltasLeads = existing
      console.log(`📊 Loaded ${existing.length} existing leads from file\n`)
    }

    const existingIds = new Set(successfulMoltasLeads.map((l: any) => l.id))

    for (let page = startPage; page <= endPage; page++) {
      console.log(`📄 Scanning page ${page}...`)

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=100`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`⏳ Rate limited, waiting...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          page--
          continue
        }
        if (response.status === 404) {
          console.log(`📍 No more pages`)
          break
        }
        console.log(`⚠️ Error ${response.status}`)
        continue
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log(`📍 No more data`)
        break
      }

      let pageSuccessCount = 0

      leads.forEach((lead: any) => {
        // Skip if already processed
        if (existingIds.has(lead.id)) return

        const leadString = JSON.stringify(lead).toLowerCase()

        if (leadString.includes('moltas')) {
          const status = lead.status || lead.resultData?.status
          if (status === 'success' || status === 'successful' ||
              status === 'godkänd' || status === 'approved') {
            pageSuccessCount++
            successfulMoltasLeads.push(lead)
            existingIds.add(lead.id)
          }
        }
      })

      if (pageSuccessCount > 0) {
        console.log(`  ✅ Found ${pageSuccessCount} new Moltas success leads`)
        console.log(`  Total: ${successfulMoltasLeads.length}`)
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Save results
    fs.writeFileSync(
      'moltas-all-success-leads.json',
      JSON.stringify(successfulMoltasLeads, null, 2)
    )
    console.log(`\n📁 Saved ${successfulMoltasLeads.length} total leads to file`)

    // Import new leads to database
    console.log('\n💾 Importing new leads to database...')

    const moltasUser = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltasUser) {
      console.log('Creating Moltas user first...')
      await prisma.user.create({
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

    const user = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (user) {
      let imported = 0

      // Get existing adversusIds to avoid duplicates
      const existingLeads = await prisma.adversusLead.findMany({
        where: { setterName: 'Moltas Roslund' },
        select: { adversusId: true }
      })
      const existingAdversusIds = new Set(existingLeads.map(l => l.adversusId))

      for (const lead of successfulMoltasLeads) {
        const adversusId = `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`

        if (existingAdversusIds.has(adversusId)) continue

        try {
          await prisma.adversusLead.create({
            data: {
              adversusId,
              setterId: user.adversusAgentId,
              setterName: 'Moltas Roslund',
              customerName: extractField(lead, 'name') || `Customer ${lead.id}`,
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
                resultData: lead.resultData || {}
              },
              adversusData: lead
            }
          })
          imported++
        } catch (error) {
          // Skip on error
        }
      }

      console.log(`✅ Imported ${imported} new leads`)
    }

    const totalInDb = await prisma.adversusLead.count({
      where: { setterName: 'Moltas Roslund' }
    })
    console.log(`\n📈 Total Moltas leads in database: ${totalInDb}`)

    return successfulMoltasLeads.length

  } catch (error) {
    console.error('💥 Error:', error)
    return 0
  } finally {
    await prisma.$disconnect()
  }
}

function extractField(lead: any, fieldName: string): string | undefined {
  if (lead[fieldName]) return lead[fieldName]
  if (lead.masterData?.[fieldName]) return lead.masterData[fieldName]
  if (lead.resultData?.[fieldName]) return lead.resultData[fieldName]

  // Check numbered masterData
  if (lead.masterData) {
    for (let i = 1; i <= 20; i++) {
      const value = lead.masterData[`masterData${i}`]
      if (typeof value === 'string') {
        if (fieldName === 'email' && value.includes('@')) return value
        if (fieldName === 'phone' && value.includes('+46')) return value
        if (fieldName.includes('bolag') && !value.includes('@') && !value.match(/^\+?\d+$/)) {
          return value
        }
      }
    }
  }

  return undefined
}

// Get page range from command line args
const startPage = parseInt(process.argv[2]) || 50
const endPage = parseInt(process.argv[3]) || 100

fetchMoltasBatch(startPage, endPage).catch(console.error)