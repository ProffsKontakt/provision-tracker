import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function fetchAllMoltas() {
  console.log('🎯 Comprehensive fetch for ALL Moltas leads\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    let allMoltasLeads = []
    let successfulMoltasLeads = []
    let totalPagesScanned = 0
    let pagesWithMoltas = []

    // We know Moltas data is on pages 24, 32, 39, 46
    // Let's scan systematically from page 1 to 200
    const startPage = 1
    const endPage = 200
    const batchSize = 100

    console.log(`📊 Scanning pages ${startPage}-${endPage} for ALL Moltas data...\n`)

    for (let page = startPage; page <= endPage; page++) {
      process.stdout.write(`\r📄 Scanning page ${page}/${endPage}... (Found ${successfulMoltasLeads.length} success leads so far)`)

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=${batchSize}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`\n⏳ Rate limited at page ${page}, waiting 3 seconds...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          page-- // Retry this page
          continue
        }
        if (response.status === 404) {
          console.log(`\n📍 No more pages after ${page - 1}`)
          break
        }
        continue
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log(`\n📍 No more data after page ${page - 1}`)
        break
      }

      totalPagesScanned++
      let pageMoltasCount = 0
      let pageSuccessCount = 0

      // Search for Moltas in each lead
      leads.forEach((lead: any) => {
        const leadString = JSON.stringify(lead).toLowerCase()

        // Check if Moltas appears anywhere in the lead
        if (leadString.includes('moltas')) {
          pageMoltasCount++
          allMoltasLeads.push(lead)

          // Check if status is success
          const status = lead.status || lead.resultData?.status
          if (status === 'success' || status === 'successful' ||
              status === 'godkänd' || status === 'approved') {
            pageSuccessCount++
            successfulMoltasLeads.push(lead)
          }
        }
      })

      if (pageMoltasCount > 0) {
        pagesWithMoltas.push(page)
        console.log(`\n✅ Page ${page}: Found ${pageMoltasCount} Moltas leads (${pageSuccessCount} successful)`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))

      // Save progress every 10 pages
      if (page % 10 === 0 && successfulMoltasLeads.length > 0) {
        fs.writeFileSync(
          'moltas-all-success-leads.json',
          JSON.stringify(successfulMoltasLeads, null, 2)
        )
      }
    }

    // Final results
    console.log('\n\n' + '═'.repeat(60))
    console.log('📈 FINAL RESULTS - ALL MOLTAS LEADS')
    console.log('═'.repeat(60))
    console.log(`Pages scanned: ${totalPagesScanned}`)
    console.log(`Pages with Moltas data: ${pagesWithMoltas.join(', ')}`)
    console.log(`\nTotal Moltas leads found: ${allMoltasLeads.length}`)
    console.log(`Moltas leads with status="success": ${successfulMoltasLeads.length}`)

    if (allMoltasLeads.length > 0) {
      const successRate = ((successfulMoltasLeads.length / allMoltasLeads.length) * 100).toFixed(1)
      console.log(`Success rate: ${successRate}%`)
    }

    // Save all data
    fs.writeFileSync(
      'moltas-all-success-leads.json',
      JSON.stringify(successfulMoltasLeads, null, 2)
    )
    console.log('\n📁 All success leads saved to moltas-all-success-leads.json')

    // Import to database
    console.log('\n💾 Importing to PostgreSQL database...')

    // Ensure Moltas user exists
    let moltasUser = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltasUser) {
      console.log('Creating Moltas user...')
      moltasUser = await prisma.user.create({
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

    // Clear existing Moltas leads to avoid duplicates
    const deletedCount = await prisma.adversusLead.deleteMany({
      where: {
        setterName: 'Moltas Roslund'
      }
    })
    console.log(`Cleared ${deletedCount.count} existing Moltas leads`)

    // Import all success leads
    let imported = 0
    let skipped = 0

    for (const lead of successfulMoltasLeads) {
      try {
        // Extract customer info from various possible locations
        const customerName = extractField(lead, 'name') ||
                           extractField(lead, 'customerName') ||
                           extractField(lead, 'company') ||
                           `Customer ${lead.id}`

        const customerPhone = extractField(lead, 'phone') ||
                            extractField(lead, 'tel') ||
                            extractField(lead, 'mobile') ||
                            '+46700000000'

        const customerEmail = extractField(lead, 'email') ||
                            extractField(lead, 'mail')

        // Extract company assignments (Bolag)
        const bolag1 = extractField(lead, 'bolag1') || extractField(lead, 'Bolag 1')
        const bolag2 = extractField(lead, 'bolag2') || extractField(lead, 'Bolag 2')
        const bolag3 = extractField(lead, 'bolag3') || extractField(lead, 'Bolag 3')
        const bolag4 = extractField(lead, 'bolag4') || extractField(lead, 'Bolag 4')

        await prisma.adversusLead.create({
          data: {
            adversusId: `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`,
            setterId: moltasUser.adversusAgentId,
            setterName: 'Moltas Roslund',
            customerName,
            customerPhone,
            customerEmail,
            bolag1,
            bolag2,
            bolag3,
            bolag4,
            appointmentDate: new Date(lead.appointmentDate || lead.created || Date.now()),
            bookedAt: new Date(lead.created || Date.now()),
            adversusStatus: lead.status || 'success',
            successStatus: 'success',
            adminStatus: 'pending',
            customFields: {
              masterData: lead.masterData || {},
              resultData: lead.resultData || {}
            },
            adversusData: lead
          }
        })
        imported++
      } catch (error: any) {
        if (!error.message?.includes('Unique constraint')) {
          console.error(`\nError importing lead ${lead.id}:`, error.message)
        }
        skipped++
      }
    }

    console.log(`\n✅ Successfully imported ${imported} Moltas success leads to PostgreSQL`)
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} leads (duplicates or errors)`)
    }

    // Show database statistics
    const dbStats = await prisma.adversusLead.groupBy({
      by: ['setterName', 'adminStatus'],
      _count: true
    })

    console.log('\n📊 Database Statistics:')
    dbStats.forEach(stat => {
      console.log(`  ${stat.setterName} - ${stat.adminStatus}: ${stat._count}`)
    })

    const totalInDb = await prisma.adversusLead.count({
      where: { setterName: 'Moltas Roslund' }
    })
    console.log(`\n📈 Total Moltas leads in database: ${totalInDb}`)

  } catch (error) {
    console.error('\n💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function extractField(lead: any, fieldName: string): string | undefined {
  // Try different locations where the field might be

  // Direct field
  if (lead[fieldName]) return lead[fieldName]

  // In masterData
  if (lead.masterData) {
    if (lead.masterData[fieldName]) return lead.masterData[fieldName]

    // Check with different casing
    const lowerFieldName = fieldName.toLowerCase()
    for (const [key, value] of Object.entries(lead.masterData)) {
      if (key.toLowerCase() === lowerFieldName) {
        return value as string
      }
    }

    // Check numbered masterData fields (masterData1, masterData2, etc.)
    for (let i = 1; i <= 20; i++) {
      const numberedKey = `masterData${i}`
      if (lead.masterData[numberedKey] &&
          typeof lead.masterData[numberedKey] === 'string') {
        const value = lead.masterData[numberedKey] as string

        // Match email pattern
        if (fieldName.includes('email') && value.includes('@')) {
          return value
        }
        // Match phone pattern
        if (fieldName.includes('phone') && (value.includes('+46') || value.match(/^\d{8,}$/))) {
          return value
        }
        // Match company names for Bolag fields
        if (fieldName.toLowerCase().includes('bolag') &&
            !value.includes('@') && !value.match(/^\+?\d+$/)) {
          return value
        }
      }
    }
  }

  // In resultData
  if (lead.resultData) {
    if (lead.resultData[fieldName]) return lead.resultData[fieldName]

    // Check with different casing
    const lowerFieldName = fieldName.toLowerCase()
    for (const [key, value] of Object.entries(lead.resultData)) {
      if (key.toLowerCase() === lowerFieldName) {
        return value as string
      }
    }
  }

  // In customFields
  if (lead.customFields && lead.customFields[fieldName]) {
    return lead.customFields[fieldName]
  }

  return undefined
}

// Run the comprehensive fetch
fetchAllMoltas().catch(console.error)