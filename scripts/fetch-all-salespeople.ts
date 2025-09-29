import fetch from 'node-fetch'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const ADVERSUS_BASE_URL = 'https://api.adversus.io/v1'
const ADVERSUS_USERNAME = 'Provisions_tracker'
const ADVERSUS_PASSWORD = '4ok0yxyb652c4kg8oo8oc88o4'

interface SalespersonStats {
  name: string
  totalLeads: number
  successLeads: number
  companies: Set<string>
}

async function fetchAllSalespeople() {
  console.log('🎯 Fetching leads for ALL salespeople\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    const salespeopleStats = new Map<string, SalespersonStats>()
    const allSuccessLeads: any[] = []
    let totalProcessed = 0

    console.log('📊 Scanning all pages to identify salespeople...\n')

    // Scan pages to find all salespeople and their leads
    for (let page = 1; page <= 114; page++) {
      process.stdout.write(`\r📄 Scanning page ${page}/114...`)

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
        if (response.status === 429) {
          console.log('\n⏳ Rate limited, waiting...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          page--
          continue
        }
        if (response.status === 404) break
        continue
      }

      const data = await response.json()
      const leads = data.leads || data.data || data

      if (!Array.isArray(leads) || leads.length === 0) break

      totalProcessed += leads.length

      // Process each lead
      leads.forEach((lead: any) => {
        // Find the opener/salesperson
        let opener = findOpener(lead)

        if (!opener) {
          // Try to find any name-like field
          opener = findSalesperson(lead)
        }

        if (opener) {
          // Initialize stats if new salesperson
          if (!salespeopleStats.has(opener)) {
            salespeopleStats.set(opener, {
              name: opener,
              totalLeads: 0,
              successLeads: 0,
              companies: new Set()
            })
          }

          const stats = salespeopleStats.get(opener)!
          stats.totalLeads++

          // Check if successful
          const status = lead.status || lead.resultData?.status
          if (status === 'success' || status === 'successful' ||
              status === 'godkänd' || status === 'approved') {
            stats.successLeads++

            // Store the lead for database import
            allSuccessLeads.push({
              ...lead,
              _opener: opener
            })
          }

          // Track companies (Bolag)
          for (let i = 1; i <= 4; i++) {
            const bolag = extractField(lead, `bolag${i}`) ||
                         extractField(lead, `Bolag ${i}`)
            if (bolag) {
              stats.companies.add(bolag)
            }
          }
        }
      })

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Display statistics
    console.log('\n\n' + '═'.repeat(60))
    console.log('📈 SALESPEOPLE STATISTICS')
    console.log('═'.repeat(60))
    console.log(`Total leads processed: ${totalProcessed}\n`)

    const sortedSalespeople = Array.from(salespeopleStats.values())
      .sort((a, b) => b.successLeads - a.successLeads)

    console.log('Top performers by success leads:')
    sortedSalespeople.forEach((stats, index) => {
      const successRate = stats.totalLeads > 0
        ? ((stats.successLeads / stats.totalLeads) * 100).toFixed(1)
        : '0.0'
      console.log(`${index + 1}. ${stats.name}:`)
      console.log(`   - Success leads: ${stats.successLeads}`)
      console.log(`   - Total leads: ${stats.totalLeads}`)
      console.log(`   - Success rate: ${successRate}%`)
      console.log(`   - Companies: ${Array.from(stats.companies).slice(0, 3).join(', ')}${stats.companies.size > 3 ? '...' : ''}`)
    })

    // Create/update users in database
    console.log('\n💾 Creating users in database...')

    for (const stats of salespeopleStats.values()) {
      if (stats.successLeads > 0) {
        // Check if user exists
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { name: stats.name },
              { openerName: stats.name }
            ]
          }
        })

        if (!user) {
          const email = stats.name.toLowerCase().replace(/\s+/g, '.') + '@proffskontakt.se'

          try {
            user = await prisma.user.create({
              data: {
                email,
                name: stats.name,
                password: '$2b$10$defaultPasswordHash',
                role: 'SETTER',
                openerName: stats.name,
                adversusAgentId: stats.name.toLowerCase().replace(/\s+/g, '_'),
                active: true
              }
            })
            console.log(`  ✅ Created user: ${stats.name}`)
          } catch (error) {
            console.log(`  ⚠️ Could not create user: ${stats.name}`)
          }
        }
      }
    }

    // Import success leads to database
    console.log('\n💾 Importing success leads to database...')

    let imported = 0
    let skipped = 0

    for (const lead of allSuccessLeads) {
      const opener = lead._opener

      // Find the user
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { name: opener },
            { openerName: opener }
          ]
        }
      })

      if (!user) {
        skipped++
        continue
      }

      try {
        await prisma.adversusLead.create({
          data: {
            adversusId: `adversus_${lead.id || Date.now()}_${Math.random().toString(36).substring(7)}`,
            setterId: user.adversusAgentId,
            setterName: user.name,
            customerName: extractField(lead, 'name') ||
                         extractField(lead, 'customerName') ||
                         `Customer ${lead.id}`,
            customerPhone: extractField(lead, 'phone') ||
                          extractField(lead, 'tel') ||
                          '+46700000000',
            customerEmail: extractField(lead, 'email'),
            bolag1: extractField(lead, 'bolag1') || extractField(lead, 'Bolag 1'),
            bolag2: extractField(lead, 'bolag2') || extractField(lead, 'Bolag 2'),
            bolag3: extractField(lead, 'bolag3') || extractField(lead, 'Bolag 3'),
            bolag4: extractField(lead, 'bolag4') || extractField(lead, 'Bolag 4'),
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
          console.log(`\nError importing lead: ${error.message}`)
        }
        skipped++
      }
    }

    console.log(`\n✅ Imported ${imported} success leads`)
    if (skipped > 0) {
      console.log(`⚠️ Skipped ${skipped} leads`)
    }

    // Show final database statistics
    const dbStats = await prisma.adversusLead.groupBy({
      by: ['setterName'],
      _count: true,
      orderBy: {
        _count: {
          setterName: 'desc'
        }
      }
    })

    console.log('\n📊 Database Statistics:')
    dbStats.slice(0, 10).forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.setterName}: ${stat._count} leads`)
    })

    const totalInDb = await prisma.adversusLead.count()
    console.log(`\n📈 Total leads in database: ${totalInDb}`)

    // Save company list
    const allCompanies = new Set<string>()
    salespeopleStats.forEach(stats => {
      stats.companies.forEach(company => allCompanies.add(company))
    })

    const companiesList = Array.from(allCompanies).sort()
    fs.writeFileSync(
      'companies-found.json',
      JSON.stringify(companiesList, null, 2)
    )
    console.log(`\n📁 Found ${companiesList.length} unique companies (saved to companies-found.json)`)

  } catch (error) {
    console.error('\n💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function findOpener(lead: any): string | null {
  // Direct opener field
  if (lead.opener) return lead.opener
  if (lead.Opener) return lead.Opener

  // In resultData
  if (lead.resultData?.opener) return lead.resultData.opener
  if (lead.resultData?.Opener) return lead.resultData.Opener

  // In masterData
  if (lead.masterData?.opener) return lead.masterData.opener
  if (lead.masterData?.Opener) return lead.masterData.Opener

  // Search for field containing 'säljare' (Swedish for salesperson)
  if (lead.resultData) {
    for (const [key, value] of Object.entries(lead.resultData)) {
      if (key.toLowerCase().includes('säljare') && typeof value === 'string') {
        return value
      }
    }
  }

  return null
}

function findSalesperson(lead: any): string | null {
  // Look for name patterns in various fields
  const leadString = JSON.stringify(lead).toLowerCase()

  // Known salespeople names
  const knownNames = [
    'moltas', 'william', 'david', 'marcus', 'johan',
    'sara', 'emma', 'lisa', 'anna', 'erik', 'anders'
  ]

  for (const name of knownNames) {
    if (leadString.includes(name)) {
      // Try to extract the full name
      if (lead.resultData) {
        for (const value of Object.values(lead.resultData)) {
          if (typeof value === 'string' && value.toLowerCase().includes(name)) {
            return value
          }
        }
      }
      if (lead.masterData) {
        for (const value of Object.values(lead.masterData)) {
          if (typeof value === 'string' && value.toLowerCase().includes(name)) {
            return value
          }
        }
      }
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
  }

  return null
}

function extractField(lead: any, fieldName: string): string | undefined {
  // Direct field
  if (lead[fieldName]) return lead[fieldName]

  // In masterData
  if (lead.masterData?.[fieldName]) return lead.masterData[fieldName]

  // In resultData
  if (lead.resultData?.[fieldName]) return lead.resultData[fieldName]

  // Check with different casing
  const lowerFieldName = fieldName.toLowerCase()

  if (lead.masterData) {
    for (const [key, value] of Object.entries(lead.masterData)) {
      if (key.toLowerCase() === lowerFieldName) {
        return value as string
      }
    }
  }

  if (lead.resultData) {
    for (const [key, value] of Object.entries(lead.resultData)) {
      if (key.toLowerCase() === lowerFieldName) {
        return value as string
      }
    }
  }

  return undefined
}

// Run the comprehensive fetch
fetchAllSalespeople().catch(console.error)