import fetch from 'node-fetch'
import * as fs from 'fs'

// CORRECT Adversus API configuration
const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

async function queryRealAdversusAPI() {
  console.log('🔍 Querying REAL Adversus API at correct endpoint\n')
  console.log(`API URL: ${ADVERSUS_BASE_URL}`)
  console.log(`Username: ${ADVERSUS_USERNAME}\n`)

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Test connection first
    console.log('📡 Testing connection to Adversus API...')

    const testResponse = await fetch(
      `${ADVERSUS_BASE_URL}/leads`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    console.log(`Response status: ${testResponse.status} ${testResponse.statusText}`)

    if (!testResponse.ok) {
      console.log('❌ Failed to connect. Trying different endpoints...\n')

      // Try different endpoints
      const endpoints = [
        '/leads',
        '/appointments',
        '/campaigns',
        '/calls',
        '/results'
      ]

      for (const endpoint of endpoints) {
        console.log(`Trying ${endpoint}...`)
        try {
          const response = await fetch(
            `${ADVERSUS_BASE_URL}${endpoint}`,
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
              }
            }
          )
          console.log(`  ${endpoint}: ${response.status} ${response.statusText}`)

          if (response.ok) {
            const data = await response.json()
            console.log(`  ✅ Success! Data structure:`)

            if (Array.isArray(data)) {
              console.log(`    Array with ${data.length} items`)
              if (data.length > 0) {
                console.log(`    Sample keys: ${Object.keys(data[0]).join(', ')}`)
              }
            } else if (data.data) {
              console.log(`    Object with 'data' property containing ${data.data.length} items`)
              if (data.data.length > 0) {
                console.log(`    Sample keys: ${Object.keys(data.data[0]).join(', ')}`)
              }
            } else {
              console.log(`    Object with keys: ${Object.keys(data).join(', ')}`)
            }
          }
        } catch (error: any) {
          console.log(`  Error: ${error.message}`)
        }
      }
    } else {
      // Parse the response
      const responseText = await testResponse.text()

      try {
        const data = JSON.parse(responseText)
        console.log('✅ Successfully connected to Adversus API\n')

        // Check data structure
        if (Array.isArray(data)) {
          console.log(`📊 Found array with ${data.length} leads`)
        } else if (data.data && Array.isArray(data.data)) {
          console.log(`📊 Found ${data.data.length} leads in data property`)
          const leads = data.data

          // Look for Moltas
          console.log('\n🔍 Searching for Moltas in the data...')

          let moltasCount = 0
          let successCount = 0

          leads.forEach((lead: any) => {
            // Check all fields for Moltas reference
            const leadString = JSON.stringify(lead).toLowerCase()
            if (leadString.includes('moltas')) {
              moltasCount++

              // Check if status is success
              if (lead.status === 'success' ||
                  lead.resultData?.status === 'success' ||
                  lead.result === 'success') {
                successCount++
              }
            }
          })

          console.log(`\n📈 Results:`)
          console.log(`  Total leads in system: ${leads.length}`)
          console.log(`  Leads mentioning Moltas: ${moltasCount}`)
          console.log(`  Moltas leads with status=success: ${successCount}`)

          // Analyze lead structure
          if (leads.length > 0) {
            console.log('\n🔍 Analyzing lead structure...')
            const sampleLead = leads[0]

            console.log('Top-level keys:', Object.keys(sampleLead))

            if (sampleLead.masterData) {
              console.log('\nMasterData keys:', Object.keys(sampleLead.masterData).slice(0, 20))
            }

            if (sampleLead.resultData) {
              console.log('\nResultData keys:', Object.keys(sampleLead.resultData).slice(0, 20))

              // Look for Bolag fields
              const bolagKeys = Object.keys(sampleLead.resultData).filter(k =>
                k.toLowerCase().includes('bolag')
              )
              if (bolagKeys.length > 0) {
                console.log('\n🏢 Bolag fields found:', bolagKeys)
              }
            }
          }

          // Save sample data
          fs.writeFileSync(
            'adversus-real-data-sample.json',
            JSON.stringify(leads.slice(0, 5), null, 2)
          )
          console.log('\n📁 Sample data saved to adversus-real-data-sample.json')

        } else {
          console.log('Unexpected data structure:', typeof data)
          console.log('Keys:', Object.keys(data))
        }
      } catch (parseError) {
        console.log('❌ Response is not JSON')
        console.log('Response preview:', responseText.substring(0, 500))
      }
    }

    // Now try to query specifically for successful leads
    console.log('\n\n📊 Querying for successful leads specifically...')

    const successQueries = [
      'status=success',
      'result=success',
      'filter[status]=success',
      'q=success'
    ]

    for (const query of successQueries) {
      console.log(`\nTrying: /leads?${query}`)

      try {
        const response = await fetch(
          `${ADVERSUS_BASE_URL}/leads?${query}`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json'
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          const leads = data.data || data

          if (Array.isArray(leads)) {
            console.log(`  ✅ Found ${leads.length} leads`)

            // Count Moltas mentions
            const moltasLeads = leads.filter((lead: any) =>
              JSON.stringify(lead).toLowerCase().includes('moltas')
            )

            console.log(`  Moltas leads in this query: ${moltasLeads.length}`)
          }
        } else {
          console.log(`  ❌ ${response.status} ${response.statusText}`)
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('\n💥 Error connecting to Adversus API:', error)
    console.error('Please verify:')
    console.error('1. API URL is correct: https://api.adversus.io/v1')
    console.error('2. Credentials are valid')
    console.error('3. Network connection is working')
  }
}

// Run the query
queryRealAdversusAPI().catch(console.error)