import { adversusEnhancedAPI } from '../src/lib/adversus-enhanced'

async function populateDatabase() {
  console.log('🚀 Starting database population with Adversus success leads...\n')
  console.log('📋 Target openers: Moltas, Frank, Gustaf, Carl\n')

  try {
    // Define the opener names we're looking for
    const targetOpeners = ['Moltas', 'Frank', 'Gustaf', 'Carl']

    // Step 1: Get field metadata to understand the API structure
    console.log('🔍 Step 1: Fetching field metadata...')
    const fields = await adversusEnhancedAPI.getFields()
    console.log(`Found ${fields.length} fields in Adversus`)

    const openerField = fields.find(f =>
      f.name.toLowerCase().includes('opener') ||
      f.name.toLowerCase().includes('öppnare')
    )

    if (openerField) {
      console.log(`✅ Opener field found: "${openerField.name}" (ID: ${openerField.id})`)
    } else {
      console.log('⚠️ No opener field found, will search in all result fields')
    }

    // Step 2: Get user information
    console.log('\n🔍 Step 2: Fetching user information...')
    const users = await adversusEnhancedAPI.getUsers()
    console.log(`Found ${users.length} users in Adversus`)

    targetOpeners.forEach(opener => {
      const user = users.find(u =>
        u.name.toLowerCase().includes(opener.toLowerCase())
      )
      if (user) {
        console.log(`✅ Found user for ${opener}: ${user.name} (ID: ${user.id})`)
      } else {
        console.log(`⚠️ No user found for ${opener}`)
      }
    })

    // Step 3: Get success leads filtered by opener
    console.log('\n🔍 Step 3: Fetching and filtering success leads...')
    const openerLeadsMap = await adversusEnhancedAPI.getSuccessLeadsByOpener(targetOpeners)

    // Display summary
    console.log('\n📊 LEAD SUMMARY:')
    console.log('═'.repeat(50))
    let totalLeads = 0
    openerLeadsMap.forEach((leads, opener) => {
      console.log(`${opener.padEnd(15)}: ${leads.length} success leads`)
      totalLeads += leads.length
    })
    console.log('─'.repeat(50))
    console.log(`${'TOTAL'.padEnd(15)}: ${totalLeads} success leads`)

    if (totalLeads === 0) {
      console.log('\n❌ No leads found. This could mean:')
      console.log('  - The opener field name is different than expected')
      console.log('  - The opener values don\'t match exactly')
      console.log('  - All leads are in a different status than "success"')
      console.log('  - API credentials might not have access to lead data')

      console.log('\n🔍 Let\'s debug by checking a few leads...')
      const allLeads = await adversusEnhancedAPI.getAllLeads({ status: 'success' })
      if (allLeads.length > 0) {
        console.log(`Found ${allLeads.length} total success leads`)
        console.log('Sample lead structure:')
        console.log(JSON.stringify(allLeads[0], null, 2))
      }

      return
    }

    // Step 4: Import to database
    console.log('\n💾 Step 4: Importing leads to PostgreSQL database...')
    await adversusEnhancedAPI.importLeadsToDatabase(openerLeadsMap)

    // Step 5: Calculate commission summary
    console.log('\n💰 COMMISSION SUMMARY:')
    console.log('═'.repeat(60))

    const COMMISSION_RATES = {
      base: 100,      // 100 SEK per lead
      offert: 100,    // 100 SEK per offert request
      platsbesok: 300 // 300 SEK per site visit request
    }

    let totalCommission = 0
    openerLeadsMap.forEach((leads, opener) => {
      const baseCommission = leads.length * COMMISSION_RATES.base
      totalCommission += baseCommission

      console.log(`${opener.padEnd(15)}: ${leads.length} leads × ${COMMISSION_RATES.base} SEK = ${baseCommission} SEK`)
    })

    console.log('─'.repeat(60))
    console.log(`${'TOTAL BASE'.padEnd(15)}: ${totalCommission} SEK`)
    console.log(`\n💡 Additional commission for offerts and platsbesök will be calculated`)
    console.log(`   based on lead content analysis (${COMMISSION_RATES.offert} + ${COMMISSION_RATES.platsbesok} SEK respectively)`)

    console.log('\n✅ Database population completed successfully!')
    console.log('\n📈 Next steps:')
    console.log('  1. Check the reports page to see real data')
    console.log('  2. Verify commission calculations')
    console.log('  3. Set up automated daily imports')

  } catch (error) {
    console.error('💥 Error during database population:', error)
  } finally {
    await adversusEnhancedAPI.disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  populateDatabase().catch(console.error)
}

export { populateDatabase }