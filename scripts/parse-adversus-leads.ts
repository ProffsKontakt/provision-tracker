import fetch from 'node-fetch'
import * as fs from 'fs'

// CORRECT Adversus API
const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function parseAdversusLeads() {
  console.log('📊 Parsing Adversus Leads Data\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Fetch leads
    const response = await fetch(
      `${ADVERSUS_BASE_URL}/leads`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Data type:', typeof data)
    console.log('Top-level keys:', Object.keys(data))

    // The response has a 'leads' property
    if (data.leads) {
      const leads = data.leads

      if (Array.isArray(leads)) {
        console.log(`\n✅ Found ${leads.length} leads total\n`)

        // Analyze lead structure
        if (leads.length > 0) {
          const firstLead = leads[0]
          console.log('Lead structure:')
          console.log('  Keys:', Object.keys(firstLead))

          // Check for nested data
          if (firstLead.masterData) {
            console.log('\n  MasterData fields:', Object.keys(firstLead.masterData))
          }

          if (firstLead.resultData) {
            console.log('\n  ResultData fields:', Object.keys(firstLead.resultData))
          }

          // Search for Moltas
          console.log('\n🔍 Searching for Moltas leads...')

          let moltasLeads = []
          let successfulMoltasLeads = []

          leads.forEach((lead: any) => {
            // Convert to string to search
            const leadStr = JSON.stringify(lead).toLowerCase()

            // Check if contains Moltas
            if (leadStr.includes('moltas')) {
              moltasLeads.push(lead)

              // Check if status is success
              const status = lead.status || lead.resultData?.status || lead.result
              if (status === 'success' || status === 'successful') {
                successfulMoltasLeads.push(lead)
              }
            }
          })

          console.log(`\n📈 Results:`)
          console.log(`  Total leads: ${leads.length}`)
          console.log(`  Leads with "Moltas": ${moltasLeads.length}`)
          console.log(`  Moltas leads with status="success": ${successfulMoltasLeads.length}`)

          // Look for success status in all leads
          const allSuccessfulLeads = leads.filter((lead: any) => {
            const status = lead.status || lead.resultData?.status || lead.result
            return status === 'success' || status === 'successful'
          })

          console.log(`  Total leads with status="success": ${allSuccessfulLeads.length}`)

          // Save samples
          if (moltasLeads.length > 0) {
            console.log('\n📋 Sample Moltas lead:')
            console.log(JSON.stringify(moltasLeads[0], null, 2))

            fs.writeFileSync(
              'moltas-leads-real.json',
              JSON.stringify(moltasLeads.slice(0, 10), null, 2)
            )
            console.log('\n📁 Saved Moltas leads to moltas-leads-real.json')
          }

          // Analyze all fields to find where Moltas/opener might be
          console.log('\n🔍 Analyzing fields for agent/opener information...')

          const fieldsWithMoltas = new Set<string>()

          leads.forEach((lead: any) => {
            function searchObject(obj: any, path = '') {
              if (!obj) return

              Object.entries(obj).forEach(([key, value]) => {
                const fullPath = path ? `${path}.${key}` : key

                if (typeof value === 'string' && value.toLowerCase().includes('moltas')) {
                  fieldsWithMoltas.add(`${fullPath} = "${value}"`)
                } else if (typeof value === 'object' && value !== null) {
                  searchObject(value, fullPath)
                }
              })
            }

            searchObject(lead)
          })

          if (fieldsWithMoltas.size > 0) {
            console.log('\nFields containing "Moltas":')
            fieldsWithMoltas.forEach(field => {
              console.log(`  - ${field}`)
            })
          }

          // Look for Bolag fields
          console.log('\n🏢 Searching for Bolag fields...')

          const bolagFields = new Set<string>()

          leads.forEach((lead: any) => {
            function searchForBolag(obj: any, path = '') {
              if (!obj) return

              Object.entries(obj).forEach(([key, value]) => {
                const fullPath = path ? `${path}.${key}` : key

                if (key.toLowerCase().includes('bolag')) {
                  bolagFields.add(fullPath)
                } else if (typeof value === 'object' && value !== null) {
                  searchForBolag(value, fullPath)
                }
              })
            }

            searchForBolag(lead)
          })

          if (bolagFields.size > 0) {
            console.log('\nBolag fields found:')
            bolagFields.forEach(field => {
              console.log(`  - ${field}`)
            })
          }
        }
      } else {
        console.log('❌ leads is not an array:', typeof leads)
      }
    } else {
      console.log('❌ No leads property found in response')
    }

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

// Run the parser
parseAdversusLeads().catch(console.error)