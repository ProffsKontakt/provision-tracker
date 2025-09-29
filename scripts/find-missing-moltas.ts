import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function findMissingMoltas() {
  console.log('🎯 Finding the missing 10 Moltas leads to reach 82 total\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Load existing 72 leads
    let existingLeads = []
    if (fs.existsSync('moltas-all-success-leads.json')) {
      existingLeads = JSON.parse(fs.readFileSync('moltas-all-success-leads.json', 'utf-8'))
      console.log(`📊 Currently have ${existingLeads.length} Moltas success leads`)
      console.log(`🎯 Need to find ${82 - existingLeads.length} more leads\n`)
    }

    const existingIds = new Set(existingLeads.map((l: any) => l.id))

    // The Moltas leads appear with smaller page sizes (100 per page)
    // We found them on pages: 24, 32, 39, 46, 55, 61, 63, 67, 70, 73, 81
    // Let's check more pages around these areas
    const targetPages = [
      // Around page 81 where we found 1
      80, 81, 82, 83, 84, 85,
      // Around page 90-100
      90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
      // Earlier pages we might have missed
      1, 2, 3, 4, 5, 10, 15, 20
    ]

    let newMoltasLeads = []

    console.log('📊 Checking specific pages with 100 leads per page...\n')

    for (const page of targetPages) {
      process.stdout.write(`\r📄 Checking page ${page}...`)

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=100`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) continue

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads)) continue

      let pageNewCount = 0

      leads.forEach((lead: any) => {
        // Skip if already have this lead
        if (existingIds.has(lead.id)) return

        // Check if this is a Moltas success lead
        const leadStr = JSON.stringify(lead).toLowerCase()
        if (leadStr.includes('moltas') &&
            (lead.status === 'success' || lead.status === 'successful')) {
          newMoltasLeads.push(lead)
          existingIds.add(lead.id)
          pageNewCount++
        }
      })

      if (pageNewCount > 0) {
        console.log(`\n✅ Page ${page}: Found ${pageNewCount} NEW Moltas success leads!`)
      }

      // Stop if we found enough
      if (existingLeads.length + newMoltasLeads.length >= 82) {
        console.log('\n🎯 Found all 82 leads!')
        break
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // If still not enough, check ALL leads without status filter
    if (existingLeads.length + newMoltasLeads.length < 82) {
      console.log('\n\n📊 Checking ALL leads (not just success status)...\n')

      for (let page = 1; page <= 100; page++) {
        process.stdout.write(`\r📄 Checking ALL leads on page ${page}...`)

        const response = await fetch(
          `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=100`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json'
            }
          }
        )

        if (!response.ok) continue

        const data = await response.json()
        const leads = data.leads || data.data || data

        if (!Array.isArray(leads) || leads.length === 0) break

        let pageNewCount = 0

        leads.forEach((lead: any) => {
          if (existingIds.has(lead.id)) return

          const leadStr = JSON.stringify(lead).toLowerCase()
          if (leadStr.includes('moltas') &&
              (lead.status === 'success' || lead.status === 'successful' ||
               lead.status === 'godkänd' || lead.status === 'approved')) {
            newMoltasLeads.push(lead)
            existingIds.add(lead.id)
            pageNewCount++
          }
        })

        if (pageNewCount > 0) {
          console.log(`\n✅ Page ${page}: Found ${pageNewCount} NEW Moltas success leads!`)
        }

        if (existingLeads.length + newMoltasLeads.length >= 82) {
          console.log('\n🎯 Found all 82 leads!')
          break
        }

        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Combine all leads
    const allMoltasLeads = [...existingLeads, ...newMoltasLeads]

    // Results
    console.log('\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS')
    console.log('═'.repeat(60))
    console.log(`Previously had: ${existingLeads.length} leads`)
    console.log(`Found new: ${newMoltasLeads.length} leads`)
    console.log(`✅ TOTAL: ${allMoltasLeads.length} Moltas success leads`)

    if (allMoltasLeads.length !== 82) {
      console.log(`\n⚠️ Expected 82 leads but found ${allMoltasLeads.length}`)
      console.log('The remaining leads might be:')
      console.log('- In different status (not "success")')
      console.log('- Under different name spelling')
      console.log('- In archived/deleted status')
    }

    // Save updated file
    fs.writeFileSync(
      'moltas-all-success-leads.json',
      JSON.stringify(allMoltasLeads, null, 2)
    )
    console.log('\n📁 Updated moltas-all-success-leads.json')

    // Update database
    console.log('\n💾 Updating database...')

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

    // Clear and reimport ALL
    await prisma.adversusLead.deleteMany({
      where: { setterName: 'Moltas Roslund' }
    })

    let imported = 0
    for (const lead of allMoltasLeads) {
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
              resultData: lead.resultData || {}
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
    console.log(`Total success leads: ${allMoltasLeads.length}`)
    console.log(`Base commission: ${allMoltasLeads.length} × 100 SEK = ${allMoltasLeads.length * 100} SEK`)
    console.log(`(+ additional 100 SEK per company requesting offert)`)
    console.log(`(+ additional 300 SEK per company requesting platsbesök)`)

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

findMissingMoltas().catch(console.error)