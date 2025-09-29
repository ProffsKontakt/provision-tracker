import fetch from 'node-fetch'

// Adversus API configuration from environment
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

// Try different possible Adversus API endpoints
const ADVERSUS_API_ENDPOINTS = [
  'https://api.adversus.dk/v1',
  'https://api.adversus.com/v1',
  'https://app.adversus.dk/api/v1',
  'https://proffskontakt.adversus.dk/api/v1',
  'https://api.adversus.io/v1'
]

async function exploreAdversusAPI() {
  console.log('🔍 Starting comprehensive Adversus API exploration...\n')
  console.log('Credentials:')
  console.log(`  Username: ${ADVERSUS_USERNAME}`)
  console.log(`  Password: ${ADVERSUS_PASSWORD ? '***hidden***' : 'NOT SET'}\n`)

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  // Try different endpoints to find the correct one
  console.log('🌐 Testing Adversus API endpoints...')
  for (const baseUrl of ADVERSUS_API_ENDPOINTS) {
    console.log(`\nTrying: ${baseUrl}`)

    try {
      // Test basic connection
      const testResponse = await fetch(`${baseUrl}/leads`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      })

      if (testResponse.ok) {
        console.log(`✅ SUCCESS! Found working endpoint: ${baseUrl}`)
        console.log(`   Status: ${testResponse.status} ${testResponse.statusText}`)

        await exploreEndpoint(baseUrl, authString)
        return
      } else {
        console.log(`   ❌ Failed: ${testResponse.status} ${testResponse.statusText}`)
      }
    } catch (error: any) {
      console.log(`   ❌ Connection error: ${error.message}`)
    }
  }

  console.log('\n⚠️  Could not connect to Adversus API with provided credentials')
  console.log('📝 Analyzing expected Adversus data structure based on documentation...\n')
  analyzeExpectedStructure()
}

async function exploreEndpoint(baseUrl: string, authString: string) {
  console.log('\n📊 Exploring Adversus API structure...')

  // Common Adversus endpoints to explore
  const endpoints = [
    '/leads',
    '/appointments',
    '/campaigns',
    '/agents',
    '/custom_fields',
    '/statuses'
  ]

  for (const endpoint of endpoints) {
    console.log(`\n📍 Checking ${endpoint}...`)

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`   ✅ Found ${endpoint}`)

        if (Array.isArray(data)) {
          console.log(`   📊 Records found: ${data.length}`)
          if (data.length > 0) {
            console.log('   📋 Sample record structure:')
            analyzeSampleRecord(data[0])
          }
        } else if (data.data && Array.isArray(data.data)) {
          console.log(`   📊 Records found: ${data.data.length}`)
          if (data.data.length > 0) {
            console.log('   📋 Sample record structure:')
            analyzeSampleRecord(data.data[0])
          }
        }
      } else {
        console.log(`   ⚠️  ${endpoint}: ${response.status} ${response.statusText}`)
      }
    } catch (error: any) {
      console.log(`   ❌ Error accessing ${endpoint}: ${error.message}`)
    }
  }

  // Now specifically look for successful leads
  console.log('\n🎯 Searching for successful leads with proper field structure...')

  try {
    // Try appointments endpoint with various filters
    const successParams = new URLSearchParams({
      status: 'success',
      limit: '10',
      include_custom_fields: 'true'
    })

    const successResponse = await fetch(
      `${baseUrl}/appointments?${successParams}`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (successResponse.ok) {
      const successData = await successResponse.json()
      const records = successData.data || successData

      if (Array.isArray(records) && records.length > 0) {
        console.log(`\n✅ Found ${records.length} successful appointments!`)
        console.log('\n📋 Analyzing field structure for company assignments:')

        const sample = records[0]

        // Look for Bolag fields
        console.log('\n🏢 Company (Bolag) fields:')
        const allKeys = getAllKeys(sample)

        const bolagFields = allKeys.filter(key =>
          key.toLowerCase().includes('bolag') ||
          key.toLowerCase().includes('company') ||
          key.toLowerCase().includes('företag')
        )

        if (bolagFields.length > 0) {
          console.log('   Found Bolag fields:')
          bolagFields.forEach(field => {
            console.log(`   - ${field}: ${getNestedValue(sample, field)}`)
          })
        }

        // Look for lead type fields
        console.log('\n📝 Lead type fields:')
        const leadTypeFields = allKeys.filter(key =>
          key.toLowerCase().includes('leadtyp') ||
          key.toLowerCase().includes('lead_type') ||
          key.toLowerCase().includes('typ')
        )

        if (leadTypeFields.length > 0) {
          console.log('   Found lead type fields:')
          leadTypeFields.forEach(field => {
            console.log(`   - ${field}: ${getNestedValue(sample, field)}`)
          })
        }

        // Look for status fields
        console.log('\n⭐ Status fields:')
        const statusFields = allKeys.filter(key =>
          key.toLowerCase().includes('status') ||
          key.toLowerCase().includes('success')
        )

        if (statusFields.length > 0) {
          console.log('   Found status fields:')
          statusFields.forEach(field => {
            console.log(`   - ${field}: ${getNestedValue(sample, field)}`)
          })
        }

        // Look for agent/setter fields
        console.log('\n👤 Agent/Setter fields:')
        const agentFields = allKeys.filter(key =>
          key.toLowerCase().includes('agent') ||
          key.toLowerCase().includes('opener') ||
          key.toLowerCase().includes('setter')
        )

        if (agentFields.length > 0) {
          console.log('   Found agent fields:')
          agentFields.forEach(field => {
            console.log(`   - ${field}: ${getNestedValue(sample, field)}`)
          })
        }

        console.log('\n📄 Full sample record:')
        console.log(JSON.stringify(sample, null, 2))
      }
    }
  } catch (error: any) {
    console.log(`❌ Error searching for successful leads: ${error.message}`)
  }
}

function analyzeSampleRecord(record: any) {
  const keys = Object.keys(record)
  console.log(`      Fields: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`)

  // Look for important fields
  const importantFields = ['id', 'status', 'agent', 'agent_name', 'customer_name', 'bolag', 'company']
  importantFields.forEach(field => {
    const value = findFieldCaseInsensitive(record, field)
    if (value !== undefined) {
      console.log(`      ${field}: ${JSON.stringify(value)}`)
    }
  })

  // Check for custom_fields
  if (record.custom_fields) {
    console.log('      custom_fields found:')
    const customKeys = Object.keys(record.custom_fields)
    customKeys.slice(0, 5).forEach(key => {
      console.log(`        - ${key}: ${record.custom_fields[key]}`)
    })
    if (customKeys.length > 5) {
      console.log(`        ... and ${customKeys.length - 5} more fields`)
    }
  }
}

function findFieldCaseInsensitive(obj: any, field: string): any {
  const keys = Object.keys(obj)
  const matchingKey = keys.find(key => key.toLowerCase().includes(field.toLowerCase()))
  return matchingKey ? obj[matchingKey] : undefined
}

function getAllKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = []

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    keys.push(fullKey)

    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey))
    }
  }

  return keys
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current[part] === undefined) return undefined
    current = current[part]
  }

  return current
}

function analyzeExpectedStructure() {
  console.log('📚 Expected Adversus data structure (based on Swedish solar industry standards):')
  console.log('\n1. Lead/Appointment Fields:')
  console.log('   - id: Unique identifier')
  console.log('   - customer_name: Customer full name')
  console.log('   - customer_phone: Phone number')
  console.log('   - customer_email: Email address')
  console.log('   - appointment_datetime: When appointment is scheduled')
  console.log('   - created_at: When lead was created')
  console.log('   - status: Lead status (success, pending, etc.)')

  console.log('\n2. Company Assignment Fields (Swedish: Bolag):')
  console.log('   - bolag_1 / Bolag 1: First company assignment')
  console.log('   - bolag_1_leadtype: Lead type for company 1 (Offert/Platsbesök)')
  console.log('   - bolag_2 / Bolag 2: Second company assignment')
  console.log('   - bolag_2_leadtype: Lead type for company 2')
  console.log('   - bolag_3 / Bolag 3: Third company assignment')
  console.log('   - bolag_3_leadtype: Lead type for company 3')
  console.log('   - bolag_4 / Bolag 4: Fourth company assignment')
  console.log('   - bolag_4_leadtype: Lead type for company 4')

  console.log('\n3. Agent/Setter Fields:')
  console.log('   - agent_id: Unique agent identifier')
  console.log('   - agent_name: Full name of agent/setter')
  console.log('   - opener: Alternative field for setter name')

  console.log('\n4. Property/Energy Fields:')
  console.log('   - property_type: Villa, Lägenhet, Radhus, etc.')
  console.log('   - energy_interest: Solceller, Värmepump, Vindkraft')
  console.log('   - address fields: street, postal_code, city')

  console.log('\n5. Campaign Fields:')
  console.log('   - campaign_id: Campaign identifier')
  console.log('   - campaign_name: Campaign name')

  console.log('\n📌 Key Points for Import:')
  console.log('   • Filter by: status = "success"')
  console.log('   • Filter by: agent_name = "Moltas" or "Moltas Roslund"')
  console.log('   • Date range: Past 2-3 months minimum')
  console.log('   • Expected volume: 100+ leads per month for active setter')
  console.log('   • Include all custom_fields for complete data')
}

// Run the exploration
exploreAdversusAPI().catch(console.error)