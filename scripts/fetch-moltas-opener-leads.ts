import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// Correct Adversus API endpoint
const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

async function fetchMoltasOpenerLeads() {
  console.log('🎯 Fetching leads where Opener = Moltas\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    let allMoltasLeads = []
    let successfulMoltasLeads = []
    let page = 1
    let hasMore = true
    const perPage = 500 // Fetch more per page to reduce requests

    console.log('📊 Starting paginated fetch...\n')

    while (hasMore) {
      console.log(`📄 Fetching page ${page}...`)

      // Build query parameters to filter by Opener field
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        // Try different filter formats
        'filter[opener]': 'Moltas',
        'opener': 'Moltas'
      })

      const response = await fetch(
        `${ADVERSUS_BASE_URL}/leads?${params}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.log(`  ⚠️  Error on page ${page}: ${response.status} ${response.statusText}`)

        // If we get rate limited, wait a bit
        if (response.status === 429) {
          console.log('  ⏳ Rate limited, waiting 5 seconds...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }
        break
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) {
        console.log(`  ✅ No more leads on page ${page}`)
        hasMore = false
        break
      }

      console.log(`  📦 Found ${leads.length} leads on page ${page}`)

      // Process leads to find Moltas as Opener
      leads.forEach((lead: any) => {
        // Check multiple possible field locations for Opener
        const opener =
          lead.opener ||
          lead.Opener ||
          lead.resultData?.opener ||
          lead.resultData?.Opener ||
          lead.masterData?.opener ||
          lead.masterData?.Opener ||
          (lead.resultData && typeof lead.resultData === 'object' ?
            Object.values(lead.resultData).find((v: any) =>
              typeof v === 'string' && v.toLowerCase().includes('moltas')
            ) : null)

        if (opener && (opener === 'Moltas' || opener.toString().toLowerCase().includes('moltas'))) {
          allMoltasLeads.push(lead)

          // Check if status is success
          const status = lead.status || lead.resultData?.status || lead.result
          if (status === 'success' || status === 'successful' || status === 'godkänd') {
            successfulMoltasLeads.push(lead)
          }
        }
      })

      // Check if we got full page (means there might be more)
      if (leads.length < perPage) {
        console.log(`  📍 Last page reached (only ${leads.length} leads)`)
        hasMore = false
      }

      page++

      // Don't overwhelm the API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('\n' + '═'.repeat(60))
    console.log('📈 RESULTS SUMMARY')
    console.log('═'.repeat(60))
    console.log(`Total Moltas leads found: ${allMoltasLeads.length}`)
    console.log(`Moltas leads with status="success": ${successfulMoltasLeads.length}`)

    // If the filter didn't work, try fetching ALL leads and filtering locally
    if (allMoltasLeads.length === 0) {
      console.log('\n⚠️  Direct filter didn\'t work, fetching all leads and filtering locally...\n')

      page = 1
      hasMore = true
      let totalLeads = 0

      while (hasMore && page <= 10) { // Limit to 10 pages to avoid infinite loop
        console.log(`📄 Fetching all leads page ${page}...`)

        const response = await fetch(
          `${ADVERSUS_BASE_URL}/leads?page=${page}&per_page=${perPage}`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json'
            }
          }
        )

        if (!response.ok) {
          console.log(`  ⚠️  Error: ${response.status}`)
          if (response.status === 429) {
            console.log('  ⏳ Rate limited, waiting...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            continue
          }
          break
        }

        const data = await response.json()
        const leads = data.leads || data.data || data

        if (!Array.isArray(leads) || leads.length === 0) {
          hasMore = false
          break
        }

        totalLeads += leads.length
        console.log(`  📦 Processing ${leads.length} leads...`)

        // Search each lead thoroughly for Moltas
        leads.forEach((lead: any) => {
          let foundMoltas = false
          let openerValue = null

          // Deep search for Opener field
          function searchForOpener(obj: any, path = '') {
            if (!obj || typeof obj !== 'object') return

            Object.entries(obj).forEach(([key, value]) => {
              if (key.toLowerCase() === 'opener' || key === 'Opener') {
                openerValue = value
                if (value && value.toString().toLowerCase().includes('moltas')) {
                  foundMoltas = true
                }
              } else if (typeof value === 'string' && value.toLowerCase() === 'moltas') {
                foundMoltas = true
                openerValue = value
              } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                searchForOpener(value)
              }
            })
          }

          searchForOpener(lead)

          if (foundMoltas) {
            allMoltasLeads.push(lead)

            // Check status
            const status = lead.status || lead.resultData?.status || lead.result
            if (status === 'success' || status === 'successful') {
              successfulMoltasLeads.push(lead)
            }
          }
        })

        console.log(`  ✅ Found ${allMoltasLeads.length} Moltas leads so far`)

        if (leads.length < perPage) {
          hasMore = false
        }

        page++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log(`\n📊 Processed ${totalLeads} total leads`)
    }

    // Final results
    console.log('\n' + '═'.repeat(60))
    console.log('🎯 FINAL RESULTS FOR MOLTAS')
    console.log('═'.repeat(60))
    console.log(`✅ Total leads where Opener = "Moltas": ${allMoltasLeads.length}`)
    console.log(`⭐ Leads with status = "success": ${successfulMoltasLeads.length}`)
    console.log(`📊 Success rate: ${allMoltasLeads.length > 0 ? (successfulMoltasLeads.length / allMoltasLeads.length * 100).toFixed(1) : 0}%`)

    // Save samples
    if (successfulMoltasLeads.length > 0) {
      fs.writeFileSync(
        'moltas-successful-leads.json',
        JSON.stringify(successfulMoltasLeads.slice(0, 10), null, 2)
      )
      console.log('\n📁 Sample successful leads saved to moltas-successful-leads.json')

      // Import to database
      console.log('\n💾 Importing to database...')

      const moltas = await prisma.user.findFirst({
        where: { name: 'Moltas Roslund' }
      })

      if (moltas) {
        let imported = 0

        for (const lead of successfulMoltasLeads) {
          try {
            await prisma.adversusLead.create({
              data: {
                adversusId: `adversus_${lead.id}`,
                setterId: moltas.adversusAgentId,
                setterName: 'Moltas Roslund',
                customerName: extractCustomerName(lead),
                customerPhone: extractPhone(lead),
                customerEmail: extractEmail(lead),
                appointmentDate: new Date(lead.created || new Date()),
                bookedAt: new Date(lead.created || new Date()),
                adversusStatus: lead.status || 'success',
                successStatus: 'success',
                adminStatus: 'pending',
                customFields: lead.resultData || {},
                adversusData: lead
              }
            })
            imported++
          } catch (error) {
            // Skip duplicates
          }
        }

        console.log(`✅ Imported ${imported} successful Moltas leads to database`)
      }
    }

    // Analyze structure of found leads
    if (allMoltasLeads.length > 0) {
      console.log('\n🔍 Sample lead structure:')
      const sample = allMoltasLeads[0]
      console.log('Keys:', Object.keys(sample))

      if (sample.resultData) {
        console.log('ResultData keys:', Object.keys(sample.resultData))
      }

      if (sample.masterData) {
        console.log('MasterData keys:', Object.keys(sample.masterData))
      }
    }

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function extractCustomerName(lead: any): string {
  return lead.name ||
         lead.customerName ||
         lead.masterData?.name ||
         lead.masterData?.[0] ||
         'Unknown Customer'
}

function extractPhone(lead: any): string {
  return lead.phone ||
         lead.customerPhone ||
         lead.masterData?.phone ||
         lead.masterData?.[1] ||
         '+46700000000'
}

function extractEmail(lead: any): string | undefined {
  return lead.email ||
         lead.customerEmail ||
         lead.masterData?.email ||
         lead.masterData?.[2]
}

// Run the fetch
fetchMoltasOpenerLeads().catch(console.error)