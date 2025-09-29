import { adversusEnhancedAPI } from '../src/lib/adversus-enhanced'

async function testAdversusConnection() {
  console.log('🔍 Testing Adversus API connection...\n')

  try {
    // Test basic connection
    console.log('1. Testing field metadata...')
    const openerFieldId = await adversusEnhancedAPI.getOpenerFieldId()
    console.log(`✅ Opener field ID: ${openerFieldId}`)

    // Test user lookup
    console.log('\n2. Testing user lookup...')
    const users = await adversusEnhancedAPI.getUsers()
    console.log(`✅ Found ${users.length} users`)

    const targetOpeners = ['Moltas', 'Frank', 'Gustaf', 'Carl']
    targetOpeners.forEach(opener => {
      const user = users.find(u => u.name.toLowerCase().includes(opener.toLowerCase()))
      if (user) {
        console.log(`   ✅ ${opener}: ${user.name} (ID: ${user.id})`)
      } else {
        console.log(`   ❌ ${opener}: Not found`)
      }
    })

    // Test a small sample of leads
    console.log('\n3. Testing lead fetching (first 100 success leads)...')
    const response = await fetch('https://api.adversus.io/v1/leads?page=1&pageSize=100&status=success&includeMeta=true', {
      headers: {
        'Authorization': `Basic ${Buffer.from('Provisions_tracker:4ok0yxyb652c4kg8oo8oc88o4').toString('base64')}`,
        'Accept': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      const leads = data.leads || data.data || data
      console.log(`✅ Fetched ${leads.length} sample leads`)

      // Check for opener field in sample
      let openerLeadsFound = 0
      leads.forEach((lead: any) => {
        if (lead.resultData && Array.isArray(lead.resultData)) {
          const openerResult = lead.resultData.find((result: any) => result.id === openerFieldId)
          if (openerResult && openerResult.value) {
            const matchingOpener = targetOpeners.find(opener =>
              openerResult.value.toLowerCase().includes(opener.toLowerCase())
            )
            if (matchingOpener) {
              openerLeadsFound++
              console.log(`   🎯 Found ${matchingOpener} lead: ${lead.id}`)
            }
          }
        }
      })

      console.log(`\n📊 In sample of ${leads.length} leads: ${openerLeadsFound} opener leads found`)

      if (openerLeadsFound > 0) {
        console.log('\n✅ SUCCESS: The system can successfully find opener leads!')
        console.log('   Ready for full database population.')
      } else {
        console.log('\n⚠️ No opener leads found in sample.')
        console.log('   This could mean:')
        console.log('   - Opener leads are rare (need larger sample)')
        console.log('   - Field values might be slightly different')
        console.log('   - Need to check different pages')
      }

    } else {
      console.log(`❌ Lead fetch failed: ${response.status}`)
    }

  } catch (error) {
    console.error('💥 Test failed:', error)
  } finally {
    await adversusEnhancedAPI.disconnect()
  }
}

testAdversusConnection().catch(console.error)