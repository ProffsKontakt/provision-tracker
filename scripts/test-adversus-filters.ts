import fetch from 'node-fetch'

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function testAdversusFilters() {
  console.log('🔍 Testing Adversus API filter combinations to find Moltas success leads efficiently\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  // Test various filter combinations
  const filterTests = [
    {
      name: 'Filter by agent and status',
      params: {
        'agent': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by agent_id',
      params: {
        'agent_id': 'moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter using query parameter',
      params: {
        'q': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by customField',
      params: {
        'customField[opener]': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by custom_fields',
      params: {
        'custom_fields[opener]': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter with date range (last 3 months)',
      params: {
        'created_from': '2025-06-01',
        'created_to': '2025-09-30',
        'status': 'success',
        'q': 'Moltas',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by campaign and status',
      params: {
        'campaign': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Using search with status',
      params: {
        'search': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by user_id',
      params: {
        'user_id': 'moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by assigned_to',
      params: {
        'assigned_to': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Using filters array',
      params: {
        'filters[agent]': 'Moltas',
        'filters[status]': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by tags',
      params: {
        'tags': 'Moltas',
        'status': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Using where clause',
      params: {
        'where[opener]': 'Moltas',
        'where[status]': 'success',
        'per_page': '100'
      }
    },
    {
      name: 'Filter by outcome',
      params: {
        'outcome': 'success',
        'agent': 'Moltas',
        'per_page': '100'
      }
    }
  ]

  console.log('Testing ' + filterTests.length + ' different filter combinations...\n')

  for (const test of filterTests) {
    console.log(`📌 Test: ${test.name}`)

    const params = new URLSearchParams(test.params)
    const url = `${ADVERSUS_BASE_URL}/leads?${params}`

    console.log(`   URL: ${url}`)

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const leads = data.leads || data.data || data

        if (Array.isArray(leads)) {
          // Check how many are actually Moltas success leads
          const moltasCount = leads.filter((lead: any) => {
            const leadStr = JSON.stringify(lead).toLowerCase()
            return leadStr.includes('moltas') &&
                   (lead.status === 'success' || lead.status === 'successful')
          }).length

          const totalCount = data.total || data.total_count || data.count || leads.length

          console.log(`   ✅ Success! Found ${leads.length} leads in this page`)
          console.log(`      Moltas success leads: ${moltasCount}`)
          console.log(`      Total available: ${totalCount}`)

          if (moltasCount > 0) {
            console.log(`   🎯 THIS FILTER WORKS! Use this to fetch all Moltas leads efficiently`)
          }
        } else {
          console.log(`   ⚠️ Unexpected response format`)
        }
      } else {
        console.log(`   ❌ Failed: ${response.status} ${response.statusText}`)
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`)
    }

    console.log()
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Also test the API documentation endpoint
  console.log('\n📚 Checking for API documentation...')

  try {
    const docResponse = await fetch(`${ADVERSUS_BASE_URL}/documentation`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    })

    if (docResponse.ok) {
      console.log('   ✅ Documentation endpoint exists')
    } else {
      console.log('   ℹ️ No documentation endpoint')
    }
  } catch (error) {
    console.log('   ℹ️ No documentation endpoint')
  }

  // Try getting API schema
  try {
    const schemaResponse = await fetch(`${ADVERSUS_BASE_URL}/schema`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    })

    if (schemaResponse.ok) {
      console.log('   ✅ Schema endpoint exists')
    } else {
      console.log('   ℹ️ No schema endpoint')
    }
  } catch (error) {
    console.log('   ℹ️ No schema endpoint')
  }

  console.log('\n💡 RECOMMENDATION:')
  console.log('Use the filter combination that returned the most Moltas success leads')
  console.log('to efficiently fetch all 82 leads without scanning hundreds of pages!')
}

testAdversusFilters().catch(console.error)