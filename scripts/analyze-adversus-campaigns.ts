import fetch from 'node-fetch'
import * as fs from 'fs'

const ADVERSUS_BASE_URL = 'https://api.adversus.dk/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

async function analyzeAdversusCampaigns() {
  console.log('🔍 Analyzing Adversus Campaigns and Results\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Step 1: Get campaigns
    console.log('📊 Step 1: Fetching campaigns...')

    const campaignsResponse = await fetch(
      `${ADVERSUS_BASE_URL}/campaigns`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!campaignsResponse.ok) {
      throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`)
    }

    const campaignsData = await campaignsResponse.json()
    const campaigns = campaignsData.data || campaignsData

    console.log(`✅ Found ${campaigns.length} campaigns\n`)

    // Analyze each campaign
    for (const campaign of campaigns.slice(0, 5)) {
      console.log(`\n📌 Campaign ID: ${campaign.id}`)
      console.log(`   Campaign keys: ${Object.keys(campaign).join(', ')}`)

      if (campaign.settings) {
        console.log('   Settings keys:', Object.keys(campaign.settings).slice(0, 10).join(', '))
      }

      if (campaign.masterFields) {
        console.log('\n   📊 Master Fields:')
        analyzeCampaignFields(campaign.masterFields, 'master')
      }

      if (campaign.resultFields) {
        console.log('\n   ⭐ Result Fields:')
        analyzeCampaignFields(campaign.resultFields, 'result')
      }

      if (campaign.campaignFields) {
        console.log('\n   📋 Campaign Fields:')
        analyzeCampaignFields(campaign.campaignFields, 'campaign')
      }

      // Try to get results for this campaign
      console.log(`\n   🎯 Fetching results for campaign ${campaign.id}...`)
      await fetchCampaignResults(campaign.id, authString)
    }

    // Step 2: Try different endpoints for results
    console.log('\n\n📊 Step 2: Exploring result endpoints...')

    const resultEndpoints = [
      '/results',
      '/campaign-results',
      '/call-results',
      '/leads/results',
      '/appointments',
      '/bookings'
    ]

    for (const endpoint of resultEndpoints) {
      console.log(`\n🔍 Trying ${endpoint}...`)

      try {
        const response = await fetch(
          `${ADVERSUS_BASE_URL}${endpoint}?per_page=10`,
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
              console.log(`   ✅ Found ${records.length} records`)
              console.log(`   Sample keys: ${Object.keys(records[0]).join(', ')}`)

              // Look for Moltas
              const moltasRecords = records.filter((r: any) =>
                JSON.stringify(r).toLowerCase().includes('moltas')
              )
              if (moltasRecords.length > 0) {
                console.log(`   🎯 Found ${moltasRecords.length} records with "Moltas"!`)
                console.log('   Sample:', JSON.stringify(moltasRecords[0], null, 2).substring(0, 500))
              }
            } else if (typeof data === 'object') {
              console.log(`   ⚠️  Received object with keys: ${Object.keys(data).join(', ')}`)
            } else {
              console.log(`   ⚠️  Empty or invalid response`)
            }
          } catch (e) {
            console.log(`   ⚠️  Response not JSON`)
          }
        } else {
          console.log(`   ❌ ${response.status} ${response.statusText}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
    }

    // Step 3: Try to get leads with result data
    console.log('\n\n📊 Step 3: Fetching leads with expanded data...')

    const expandedQueries = [
      'expand=masterData,resultData',
      'include=masterData,resultData',
      'with=masterData,resultData',
      'fields=*'
    ]

    for (const query of expandedQueries) {
      console.log(`\n🔍 Trying /leads?${query}`)

      try {
        const response = await fetch(
          `${ADVERSUS_BASE_URL}/leads?${query}&per_page=5`,
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

          if (Array.isArray(leads) && leads.length > 0) {
            console.log(`   ✅ Found ${leads.length} leads`)

            const firstLead = leads[0]
            console.log('\n   📋 Lead Structure:')
            console.log(`   Top-level keys: ${Object.keys(firstLead).join(', ')}`)

            if (firstLead.masterData) {
              const masterKeys = Object.keys(firstLead.masterData)
              console.log(`\n   Master Data (${masterKeys.length} fields):`)

              // Look for Bolag fields
              const bolagFields = masterKeys.filter(k =>
                k.toLowerCase().includes('bolag') ||
                k.match(/^bolag_?\d/i)
              )
              if (bolagFields.length > 0) {
                console.log(`   🏢 Bolag fields found: ${bolagFields.join(', ')}`)
                bolagFields.forEach(field => {
                  console.log(`      ${field}: ${firstLead.masterData[field]}`)
                })
              }

              // Look for name/phone fields
              const contactFields = masterKeys.filter(k =>
                k.toLowerCase().includes('name') ||
                k.toLowerCase().includes('phone') ||
                k.toLowerCase().includes('namn') ||
                k.toLowerCase().includes('telefon')
              )
              if (contactFields.length > 0) {
                console.log(`\n   📞 Contact fields: ${contactFields.join(', ')}`)
              }
            }

            if (firstLead.resultData) {
              const resultKeys = Object.keys(firstLead.resultData)
              console.log(`\n   Result Data (${resultKeys.length} fields):`)

              // Look for status fields
              const statusFields = resultKeys.filter(k =>
                k.toLowerCase().includes('status') ||
                k.toLowerCase().includes('result')
              )
              if (statusFields.length > 0) {
                console.log(`   ⭐ Status fields: ${statusFields.join(', ')}`)
                statusFields.forEach(field => {
                  console.log(`      ${field}: ${firstLead.resultData[field]}`)
                })
              }
            }

            // Save sample for analysis
            fs.writeFileSync(
              'adversus-lead-sample.json',
              JSON.stringify(leads, null, 2)
            )
            console.log('\n   📁 Sample saved to adversus-lead-sample.json')
          }
        } else {
          console.log(`   ❌ ${response.status}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

function analyzeCampaignFields(fields: any, type: string) {
  if (!fields || typeof fields !== 'object') {
    console.log(`      No ${type} fields`)
    return
  }

  if (Array.isArray(fields)) {
    console.log(`      ${fields.length} fields defined`)

    // Look for Bolag fields
    const bolagFields = fields.filter((f: any) =>
      (f.name && f.name.toLowerCase().includes('bolag')) ||
      (f.label && f.label.toLowerCase().includes('bolag')) ||
      (f.field && f.field.toLowerCase().includes('bolag'))
    )

    if (bolagFields.length > 0) {
      console.log(`      🏢 Found ${bolagFields.length} Bolag fields:`)
      bolagFields.forEach((f: any) => {
        console.log(`         - ${f.name || f.label || f.field}: ${f.type || 'unknown type'}`)
      })
    }

    // Look for important fields
    const importantFields = fields.filter((f: any) => {
      const name = (f.name || f.label || f.field || '').toLowerCase()
      return name.includes('status') ||
             name.includes('success') ||
             name.includes('agent') ||
             name.includes('setter') ||
             name.includes('opener')
    })

    if (importantFields.length > 0) {
      console.log(`      📌 Important fields:`)
      importantFields.forEach((f: any) => {
        console.log(`         - ${f.name || f.label || f.field}: ${f.type || 'unknown type'}`)
      })
    }
  } else {
    const keys = Object.keys(fields)
    console.log(`      ${keys.length} fields: ${keys.slice(0, 10).join(', ')}`)
  }
}

async function fetchCampaignResults(campaignId: number, authString: string) {
  try {
    const resultsResponse = await fetch(
      `${ADVERSUS_BASE_URL}/campaigns/${campaignId}/results?per_page=5`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (resultsResponse.ok) {
      const data = await resultsResponse.json()
      const results = data.data || data

      if (Array.isArray(results) && results.length > 0) {
        console.log(`      ✅ Found ${results.length} results`)
        console.log(`      Result keys: ${Object.keys(results[0]).slice(0, 10).join(', ')}`)
      } else {
        console.log(`      ⚠️  No results found`)
      }
    } else {
      console.log(`      ❌ Failed to fetch results: ${resultsResponse.status}`)
    }
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message}`)
  }
}

// Run the analysis
analyzeAdversusCampaigns().catch(console.error)