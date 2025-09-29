import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function fetchMoltasFocused() {
  console.log('🎯 Focused fetch for Moltas leads starting where we found them\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    let allMoltasLeads = []
    let successfulMoltasLeads = []

    // Start at page 24 where we found Moltas data
    const startPage = 24
    const endPage = 50 // Check a good range

    console.log(`📊 Fetching pages ${startPage}-${endPage} where Moltas data exists...\n`)

    for (let page = startPage; page <= endPage; page++) {
      console.log(`📄 Page ${page}...`)

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
        console.log(`  ⚠️  Error: ${response.status}`)
        continue
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads)) {
        continue
      }

      let pageSuccessCount = 0

      // Search for Moltas in each lead
      leads.forEach((lead: any) => {
        const leadString = JSON.stringify(lead).toLowerCase()

        if (leadString.includes('moltas')) {
          allMoltasLeads.push(lead)

          // Check status
          if (lead.status === 'success' || lead.status === 'successful') {
            successfulMoltasLeads.push(lead)
            pageSuccessCount++
          }
        }
      })

      console.log(`  ✅ Found ${pageSuccessCount} Moltas success leads on this page`)
      console.log(`  Total so far: ${successfulMoltasLeads.length}`)

      // Save after each page to avoid losing data
      if (successfulMoltasLeads.length > 0) {
        fs.writeFileSync(
          'moltas-success-leads.json',
          JSON.stringify(successfulMoltasLeads, null, 2)
        )
      }

      // Stop if we found enough for analysis
      if (successfulMoltasLeads.length >= 100) {
        console.log('\n✅ Found 100+ Moltas success leads, stopping here')
        break
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Analyze the structure
    console.log('\n' + '═'.repeat(60))
    console.log('📈 RESULTS')
    console.log('═'.repeat(60))
    console.log(`Total Moltas leads found: ${allMoltasLeads.length}`)
    console.log(`Moltas leads with status="success": ${successfulMoltasLeads.length}`)

    if (successfulMoltasLeads.length > 0) {
      console.log('\n🔍 Analyzing where "Moltas" appears in the data:')

      const firstLead = successfulMoltasLeads[0]
      const moltasLocations = new Set<string>()

      function findMoltas(obj: any, path = '') {
        if (!obj) return

        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key

          if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
            moltasLocations.add(`${fullPath} = "${value}"`)
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            findMoltas(value, fullPath)
          }
        })
      }

      findMoltas(firstLead)

      moltasLocations.forEach(location => {
        console.log(`  - ${location}`)
      })

      // Show sample structure
      console.log('\n📋 Sample successful lead:')
      console.log('ID:', firstLead.id)
      console.log('Status:', firstLead.status)
      console.log('Created:', firstLead.created)

      if (firstLead.masterData) {
        console.log('\nMasterData:')
        Object.entries(firstLead.masterData).forEach(([key, value]) => {
          if (value && typeof value === 'object' && value.constructor === Object) {
            console.log(`  ${key}: [complex object]`)
          } else {
            console.log(`  ${key}: ${value}`)
          }
        })
      }

      if (firstLead.resultData) {
        console.log('\nResultData:')
        if (typeof firstLead.resultData === 'object' && Object.keys(firstLead.resultData).length > 0) {
          Object.entries(firstLead.resultData).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`)
          })
        } else {
          console.log('  [empty or array]')
        }
      }

      // Import to database
      console.log('\n💾 Importing to database...')

      const moltas = await prisma.user.findFirst({
        where: { name: 'Moltas Roslund' }
      })

      if (!moltas) {
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

      const moltasUser = await prisma.user.findFirst({
        where: { name: 'Moltas Roslund' }
      })

      if (moltasUser) {
        let imported = 0

        for (const lead of successfulMoltasLeads.slice(0, 100)) { // Import first 100
          try {
            await prisma.adversusLead.create({
              data: {
                adversusId: `adversus_real_${lead.id}`,
                setterId: moltasUser.adversusAgentId,
                setterName: 'Moltas Roslund',
                customerName: extractField(lead, 'name') || `Customer ${lead.id}`,
                customerPhone: extractField(lead, 'phone') || '+46700000000',
                customerEmail: extractField(lead, 'email'),
                appointmentDate: new Date(lead.created || Date.now()),
                bookedAt: new Date(lead.created || Date.now()),
                adversusStatus: lead.status,
                successStatus: 'success',
                adminStatus: 'pending',
                customFields: {
                  masterData: lead.masterData,
                  resultData: lead.resultData
                },
                adversusData: lead
              }
            })
            imported++
          } catch (error) {
            // Skip duplicates
          }
        }

        console.log(`✅ Imported ${imported} real Moltas success leads`)
      }
    }

    console.log('\n📁 Data saved to moltas-success-leads.json')

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function extractField(lead: any, fieldName: string): string | undefined {
  // Try different locations
  if (lead[fieldName]) return lead[fieldName]
  if (lead.masterData?.[fieldName]) return lead.masterData[fieldName]
  if (lead.resultData?.[fieldName]) return lead.resultData[fieldName]

  // Check numbered masterData fields
  if (lead.masterData) {
    for (const value of Object.values(lead.masterData)) {
      if (typeof value === 'string' && value.includes('@') && fieldName === 'email') {
        return value
      }
      if (typeof value === 'string' && value.includes('+46') && fieldName === 'phone') {
        return value
      }
    }
  }

  return undefined
}

// Run the focused fetch
fetchMoltasFocused().catch(console.error)