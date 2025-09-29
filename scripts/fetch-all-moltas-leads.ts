import fetch from 'node-fetch'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// Correct Adversus API configuration
const ADVERSUS_BASE_URL = 'https://api.adversus.dk/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

async function fetchAllMoltasLeads() {
  console.log('🚀 Fetching ALL of Moltas\'s successful leads from Adversus...\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Step 1: Get all leads/appointments without filtering first
    console.log('📊 Step 1: Fetching all leads to understand structure...')

    const allLeadsResponse = await fetch(
      `${ADVERSUS_BASE_URL}/leads?per_page=1000`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (allLeadsResponse.ok) {
      const allLeadsData = await allLeadsResponse.text()

      try {
        const parsedData = JSON.parse(allLeadsData)
        console.log('✅ Successfully fetched leads data')

        // Check if data is in expected format
        const leads = parsedData.data || parsedData.leads || parsedData

        if (Array.isArray(leads)) {
          console.log(`📋 Total leads found: ${leads.length}`)

          if (leads.length > 0) {
            console.log('\n🔍 Analyzing lead structure...')
            const sampleLead = leads[0]
            console.log('Sample lead keys:', Object.keys(sampleLead))

            // Look for Moltas in the data
            console.log('\n🎯 Searching for Moltas leads...')

            const moltasVariations = [
              'Moltas',
              'Moltas Roslund',
              'Moltas R',
              'moltas',
              'MOLTAS'
            ]

            let moltasLeads: any[] = []

            // Search through all fields for Moltas
            leads.forEach((lead: any) => {
              const leadStr = JSON.stringify(lead).toLowerCase()

              if (moltasVariations.some(name => leadStr.includes(name.toLowerCase()))) {
                moltasLeads.push(lead)
              }
            })

            console.log(`\n✅ Found ${moltasLeads.length} leads potentially related to Moltas`)

            if (moltasLeads.length > 0) {
              console.log('\n📋 Analyzing Moltas lead structure:')
              const moltasSample = moltasLeads[0]

              // Deep analysis of the structure
              analyzeLeadStructure(moltasSample)

              // Look for Bolag fields
              console.log('\n🏢 Looking for Bolag (company) fields...')
              findBolagFields(moltasSample)

              // Look for status fields
              console.log('\n⭐ Looking for status fields...')
              findStatusFields(moltasSample)
            }

            // Now search for successful leads
            console.log('\n🎯 Filtering for successful leads...')
            const successfulLeads = leads.filter((lead: any) => {
              const statusFields = findAllStatusFields(lead)
              return statusFields.some(field => {
                const value = String(field.value).toLowerCase()
                return value === 'success' || value === 'successful' || value === 'godkänd' || value === 'approved'
              })
            })

            console.log(`✅ Found ${successfulLeads.length} successful leads total`)

            // Filter successful leads for Moltas
            const moltasSuccessfulLeads = successfulLeads.filter((lead: any) => {
              const leadStr = JSON.stringify(lead).toLowerCase()
              return moltasVariations.some(name => leadStr.includes(name.toLowerCase()))
            })

            console.log(`🎯 Found ${moltasSuccessfulLeads.length} successful leads for Moltas`)

            if (moltasSuccessfulLeads.length > 0) {
              console.log('\n📄 Sample successful Moltas lead:')
              console.log(JSON.stringify(moltasSuccessfulLeads[0], null, 2))

              // Save to file for analysis
              const fs = require('fs')
              fs.writeFileSync(
                'moltas-leads-sample.json',
                JSON.stringify(moltasSuccessfulLeads.slice(0, 5), null, 2)
              )
              console.log('\n📁 Saved sample leads to moltas-leads-sample.json')
            }
          }
        } else {
          console.log('⚠️  Unexpected data structure:', typeof parsedData)
          console.log('Keys:', Object.keys(parsedData))
        }
      } catch (parseError) {
        console.log('⚠️  Response is not JSON. Trying XML/HTML parsing...')
        console.log('Response preview:', allLeadsData.substring(0, 500))
      }
    } else {
      console.log(`❌ Failed to fetch leads: ${allLeadsResponse.status} ${allLeadsResponse.statusText}`)
    }

    // Step 2: Try appointments endpoint
    console.log('\n📊 Step 2: Trying appointments endpoint...')

    const appointmentsResponse = await fetch(
      `${ADVERSUS_BASE_URL}/appointments?per_page=1000`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (appointmentsResponse.ok) {
      const appointmentsText = await appointmentsResponse.text()

      try {
        const appointments = JSON.parse(appointmentsText)
        console.log('✅ Successfully fetched appointments')

        if (appointments && appointments.data) {
          console.log(`📋 Total appointments: ${appointments.data.length}`)
        }
      } catch (e) {
        console.log('⚠️  Appointments response is not JSON')
      }
    }

    // Step 3: Try different query approaches
    console.log('\n📊 Step 3: Trying specific query parameters...')

    const queryApproaches = [
      { endpoint: '/leads', params: 'agent=Moltas&status=success' },
      { endpoint: '/leads', params: 'opener=Moltas&status=success' },
      { endpoint: '/leads', params: 'filter[agent]=Moltas&filter[status]=success' },
      { endpoint: '/leads', params: 'q=Moltas&status=success' },
      { endpoint: '/appointments', params: 'agent=Moltas' },
      { endpoint: '/appointments', params: 'status=success' }
    ]

    for (const approach of queryApproaches) {
      console.log(`\n🔍 Trying: ${approach.endpoint}?${approach.params}`)

      try {
        const response = await fetch(
          `${ADVERSUS_BASE_URL}${approach.endpoint}?${approach.params}&per_page=100`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json'
            }
          }
        )

        if (response.ok) {
          const text = await response.text()
          try {
            const data = JSON.parse(text)
            const records = data.data || data
            if (Array.isArray(records) && records.length > 0) {
              console.log(`   ✅ Found ${records.length} records!`)
              console.log('   Sample record:', JSON.stringify(records[0], null, 2).substring(0, 500))
            } else {
              console.log(`   ⚠️  No records found`)
            }
          } catch (e) {
            console.log(`   ⚠️  Response not JSON`)
          }
        } else {
          console.log(`   ❌ Failed: ${response.status}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

function analyzeLeadStructure(lead: any) {
  console.log('Lead type:', typeof lead)
  console.log('Top-level keys:', Object.keys(lead).slice(0, 20))

  // Check for nested structures
  Object.keys(lead).forEach(key => {
    if (typeof lead[key] === 'object' && lead[key] !== null) {
      console.log(`  ${key} (object):`, Object.keys(lead[key]).slice(0, 10))
    }
  })
}

function findBolagFields(lead: any, path = ''): void {
  Object.keys(lead).forEach(key => {
    const fullPath = path ? `${path}.${key}` : key
    const value = lead[key]

    // Check if key contains bolag/company
    if (key.toLowerCase().includes('bolag') ||
        key.toLowerCase().includes('company') ||
        key.toLowerCase().includes('företag')) {
      console.log(`  Found: ${fullPath} = ${JSON.stringify(value)}`)
    }

    // Recurse into objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      findBolagFields(value, fullPath)
    }
  })
}

function findStatusFields(lead: any, path = ''): void {
  Object.keys(lead).forEach(key => {
    const fullPath = path ? `${path}.${key}` : key
    const value = lead[key]

    // Check if key contains status
    if (key.toLowerCase().includes('status') ||
        key.toLowerCase().includes('success')) {
      console.log(`  Found: ${fullPath} = ${JSON.stringify(value)}`)
    }

    // Recurse into objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      findStatusFields(value, fullPath)
    }
  })
}

function findAllStatusFields(lead: any): Array<{path: string, value: any}> {
  const results: Array<{path: string, value: any}> = []

  function search(obj: any, path = '') {
    Object.keys(obj).forEach(key => {
      const fullPath = path ? `${path}.${key}` : key
      const value = obj[key]

      if (key.toLowerCase().includes('status') || key.toLowerCase().includes('success')) {
        results.push({ path: fullPath, value })
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        search(value, fullPath)
      }
    })
  }

  search(lead)
  return results
}

// Run the fetch
fetchAllMoltasLeads().catch(console.error)