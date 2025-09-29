import fetch from 'node-fetch'
import * as fs from 'fs'

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function smartMoltasFetch() {
  console.log('🎯 Smart fetch for Moltas leads with proper field detection\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // First, let's understand the data structure with a sample
    console.log('📊 Step 1: Analyzing lead structure...\n')

    const sampleResponse = await fetch(
      `${ADVERSUS_BASE_URL}/leads?page=1&per_page=5`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    const sampleData = await sampleResponse.json()
    const sampleLeads = sampleData.leads || sampleData.data || sampleData

    if (Array.isArray(sampleLeads) && sampleLeads.length > 0) {
      const firstLead = sampleLeads[0]
      console.log('Lead structure found:')
      console.log('  Top keys:', Object.keys(firstLead))

      // Deep search for Opener field location
      let openerFieldPath = null
      let openerFieldExample = null

      function findOpenerField(obj: any, path = '') {
        if (!obj || typeof obj !== 'object') return

        Object.entries(obj).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key

          // Check if this might be the opener field
          if (key.toLowerCase().includes('opener') ||
              key.toLowerCase().includes('säljare') ||
              key.toLowerCase().includes('agent')) {
            console.log(`  Found potential opener field: ${fullPath} = ${value}`)
            openerFieldPath = fullPath
            openerFieldExample = value
          }

          // Check if value contains Moltas
          if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
            console.log(`  Found "Moltas" at: ${fullPath} = ${value}`)
            openerFieldPath = fullPath
            openerFieldExample = value
          }

          // Recurse
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            findOpenerField(value, fullPath)
          }
        })
      }

      findOpenerField(firstLead)

      // Check masterData fields specifically
      if (firstLead.masterData) {
        console.log('\n  MasterData analysis:')
        Object.entries(firstLead.masterData).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`)
        })
      }

      // Check resultData fields specifically
      if (firstLead.resultData) {
        console.log('\n  ResultData analysis:')
        if (typeof firstLead.resultData === 'object' && !Array.isArray(firstLead.resultData)) {
          Object.entries(firstLead.resultData).forEach(([key, value]) => {
            if (value) {
              console.log(`    ${key}: ${value}`)
            }
          })
        }
      }
    }

    // Now fetch with better understanding
    console.log('\n📊 Step 2: Fetching leads in batches...\n')

    let allMoltasLeads = []
    let successfulMoltasLeads = []
    let totalProcessed = 0
    const maxPages = 50 // Limit for now

    for (let page = 1; page <= maxPages; page++) {
      console.log(`📄 Processing page ${page}...`)

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
        break
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log('  No more leads')
        break
      }

      totalProcessed += leads.length

      // Search for Moltas in each lead
      leads.forEach((lead: any) => {
        let isMoltasLead = false
        let leadStatus = lead.status

        // Convert entire lead to string to search
        const leadString = JSON.stringify(lead).toLowerCase()

        // Check if Moltas appears anywhere
        if (leadString.includes('moltas')) {
          isMoltasLead = true
        }

        // Also check specific fields
        if (lead.resultData && typeof lead.resultData === 'object') {
          Object.values(lead.resultData).forEach((value: any) => {
            if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
              isMoltasLead = true
            }
          })
        }

        if (lead.masterData && typeof lead.masterData === 'object') {
          Object.values(lead.masterData).forEach((value: any) => {
            if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
              isMoltasLead = true
            }
          })
        }

        if (isMoltasLead) {
          allMoltasLeads.push(lead)

          if (leadStatus === 'success' || leadStatus === 'successful') {
            successfulMoltasLeads.push(lead)
          }
        }
      })

      console.log(`  Processed: ${leads.length} leads`)
      console.log(`  Moltas leads found so far: ${allMoltasLeads.length}`)
      console.log(`  Successful Moltas leads: ${successfulMoltasLeads.length}`)

      // Don't overwhelm the API
      await new Promise(resolve => setTimeout(resolve, 500))

      // Stop if we have enough data to analyze
      if (allMoltasLeads.length > 100) {
        console.log('\n✅ Found enough Moltas leads for analysis')
        break
      }
    }

    // Results
    console.log('\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS')
    console.log('═'.repeat(60))
    console.log(`Total leads processed: ${totalProcessed}`)
    console.log(`Moltas leads found: ${allMoltasLeads.length}`)
    console.log(`Moltas leads with status="success": ${successfulMoltasLeads.length}`)

    if (allMoltasLeads.length > 0) {
      // Save sample
      fs.writeFileSync(
        'moltas-leads-found.json',
        JSON.stringify(allMoltasLeads.slice(0, 10), null, 2)
      )
      console.log('\n📁 Sample saved to moltas-leads-found.json')

      // Analyze where Moltas appears
      console.log('\n🔍 Field analysis for Moltas:')
      const moltasFields = new Map<string, number>()

      allMoltasLeads.forEach(lead => {
        function findMoltas(obj: any, path = '') {
          if (!obj) return

          Object.entries(obj).forEach(([key, value]) => {
            const fullPath = path ? `${path}.${key}` : key

            if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
              const count = moltasFields.get(fullPath) || 0
              moltasFields.set(fullPath, count + 1)
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              findMoltas(value, fullPath)
            }
          })
        }

        findMoltas(lead)
      })

      console.log('\nFields where "Moltas" appears:')
      moltasFields.forEach((count, field) => {
        console.log(`  ${field}: ${count} times`)
      })
    }

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

// Run the smart fetch
smartMoltasFetch().catch(console.error)