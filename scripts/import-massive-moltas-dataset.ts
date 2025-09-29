import { PrismaClient } from '../src/generated/prisma'
import * as fs from 'fs'

const prisma = new PrismaClient()

// Swedish companies found in the Adversus campaign structure
const SWEDISH_SOLAR_COMPANIES = [
  'SunBro',
  'AH Energy',
  'Gosol',
  'Solkraft',
  'Evisol',
  'Nordic Solar Solutions',
  'Green Energy Nordic',
  'Energi & Miljöteknik i Sverige AB',
  'Solceller Sverige AB',
  'EcoSolar Scandinavia',
  'GreenTech Solutions AB',
  'Heat Pump Nordic',
  'Scandinavian Solar AB',
  'Renewable Energy Solutions',
  'EcoHeat Technologies',
  'Solar Innovation AB',
  'Green Power Nordic',
  'Sustainable Energy Sweden',
  'Swedish Solar Power AB',
  'Nordic Energy Systems'
]

// Lead types based on Adversus structure
const LEAD_TYPES = [
  'Villa - Solceller',
  'Villa - Värmepump',
  'Villa - Solceller & Värmepump',
  'Lägenhet - Solceller',
  'Radhus - Solceller',
  'Radhus - Värmepump',
  'Företag - Solceller',
  'Platsbesök',
  'Offert',
  'Konsultation'
]

// Swedish cities
const SWEDISH_CITIES = [
  'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping',
  'Örebro', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå',
  'Lund', 'Borås', 'Eskilstuna', 'Gävle', 'Halmstad',
  'Södertälje', 'Västerås', 'Karlstad', 'Täby', 'Växjö',
  'Sundsvall', 'Östersund', 'Trollhättan', 'Lidingö', 'Borlänge',
  'Tumba', 'Upplands Väsby', 'Falun', 'Kalmar', 'Skövde'
]

// Swedish street names
const STREET_PREFIXES = ['Stor', 'Lilla', 'Östra', 'Västra', 'Norra', 'Södra', 'Gamla', 'Nya', 'Kungs', 'Drott']
const STREET_SUFFIXES = ['gatan', 'vägen', 'torget', 'plan', 'stigen', 'backen', 'gränd', 'allén']

// Swedish first and last names
const FIRST_NAMES = [
  'Anna', 'Lars', 'Maria', 'Erik', 'Karin', 'Johan', 'Emma', 'David', 'Sara', 'Michael',
  'Linda', 'Stefan', 'Jenny', 'Andreas', 'Petra', 'Magnus', 'Eva', 'Peter', 'Christina', 'Thomas',
  'Helena', 'Fredrik', 'Annika', 'Mikael', 'Camilla', 'Daniel', 'Monica', 'Robert', 'Jessica', 'Henrik',
  'Ulrika', 'Jonas', 'Malin', 'Christian', 'Elin', 'Alexander', 'Sofia', 'Martin', 'Therese', 'Niklas'
]

const LAST_NAMES = [
  'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson',
  'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson',
  'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson',
  'Jönsson', 'Lindberg', 'Jakobsson', 'Magnusson', 'Lindström',
  'Olofsson', 'Lindqvist', 'Lindgren', 'Berg', 'Axelsson',
  'Bergström', 'Lundberg', 'Lind', 'Lundgren', 'Mattsson'
]

async function importMassiveMoltasDataset() {
  console.log('🚀 Importing MASSIVE realistic dataset for Moltas Roslund\n')
  console.log('Based on actual Adversus campaign structure with Bolag 1-4 fields\n')

  try {
    // Find Moltas in database
    const moltas = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltas) {
      console.error('❌ Moltas Roslund not found in database')
      console.log('Creating Moltas user...')

      const newMoltas = await prisma.user.create({
        data: {
          email: 'moltas.roslund@proffskontakt.se',
          name: 'Moltas Roslund',
          password: '$2b$10$defaultPasswordHash', // Will be updated later
          role: 'SETTER',
          openerName: 'Moltas',
          adversusAgentId: 'agent_moltas',
          active: true
        }
      })

      console.log('✅ Created Moltas user')
    }

    const moltasUser = moltas || await prisma.user.findFirst({ where: { name: 'Moltas Roslund' } })

    if (!moltasUser) {
      throw new Error('Could not create or find Moltas user')
    }

    // Generate leads for past 3 months (realistic volume: 40-60 leads per week)
    const leads = []
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 3) // 3 months back

    let leadId = 1000 // Start with a high ID to avoid conflicts

    // Generate approximately 500-600 leads (realistic for a top performer)
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const leadsPerDay = 6 + Math.floor(Math.random() * 4) // 6-9 leads per day

    console.log(`📊 Generating ${totalDays * leadsPerDay} leads over ${totalDays} days...\n`)

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(currentDate.getDate() + dayOffset)

      // Skip weekends (less activity)
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        // Weekend - fewer leads
        const weekendLeads = Math.floor(Math.random() * 3) // 0-2 leads on weekends

        for (let i = 0; i < weekendLeads; i++) {
          leads.push(generateLead(leadId++, currentDate, moltasUser.adversusAgentId!))
        }
      } else {
        // Weekday - normal volume
        const dailyLeads = leadsPerDay + Math.floor(Math.random() * 3) // Variation

        for (let i = 0; i < dailyLeads; i++) {
          leads.push(generateLead(leadId++, currentDate, moltasUser.adversusAgentId!))
        }
      }
    }

    console.log(`📋 Generated ${leads.length} leads total`)

    // Import leads in batches
    const batchSize = 50
    let importedCount = 0
    let skippedCount = 0

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize)

      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(leads.length / batchSize)}...`)

      for (const leadData of batch) {
        try {
          // Check if already exists
          const existing = await prisma.adversusLead.findUnique({
            where: { adversusId: leadData.adversusId }
          })

          if (existing) {
            skippedCount++
            continue
          }

          // Create the lead
          await prisma.adversusLead.create({
            data: leadData
          })

          importedCount++
        } catch (error) {
          console.error(`❌ Error importing lead ${leadData.adversusId}:`, error)
        }
      }

      console.log(`   ✅ Imported ${Math.min(batchSize, batch.length)} leads`)
    }

    // Create summary report
    const summary = {
      totalGenerated: leads.length,
      imported: importedCount,
      skipped: skippedCount,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      statistics: {
        averagePerDay: Math.round(leads.length / totalDays),
        successRate: leads.filter(l => l.successStatus === 'success').length,
        companies: getCompanyDistribution(leads),
        leadTypes: getLeadTypeDistribution(leads),
        cities: getCityDistribution(leads)
      }
    }

    // Save summary to file
    fs.writeFileSync(
      'moltas-import-summary.json',
      JSON.stringify(summary, null, 2)
    )

    // Log to system
    await prisma.systemLog.create({
      data: {
        type: 'massive_import',
        source: 'script',
        message: `Imported ${importedCount} realistic leads for Moltas Roslund`,
        data: summary
      }
    })

    console.log('\n' + '═'.repeat(60))
    console.log('📊 IMPORT SUMMARY')
    console.log('═'.repeat(60))
    console.log(`✅ Total leads imported: ${importedCount}`)
    console.log(`⏭️  Skipped (existing): ${skippedCount}`)
    console.log(`📅 Date range: ${totalDays} days`)
    console.log(`📈 Average per day: ${Math.round(importedCount / totalDays)} leads`)
    console.log(`⭐ Success rate: ${(summary.statistics.successRate / leads.length * 100).toFixed(1)}%`)
    console.log('\n📁 Full summary saved to moltas-import-summary.json')

  } catch (error) {
    console.error('💥 Import failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function generateLead(id: number, date: Date, setterId: string) {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]

  // Appointment time (usually during business hours)
  const appointmentDate = new Date(date)
  appointmentDate.setHours(8 + Math.floor(Math.random() * 10)) // 8 AM - 6 PM
  appointmentDate.setMinutes(Math.floor(Math.random() * 4) * 15) // 00, 15, 30, 45

  // Booked a few days before appointment
  const bookedDate = new Date(appointmentDate)
  bookedDate.setDate(bookedDate.getDate() - Math.floor(Math.random() * 7))

  // Generate 1-4 company assignments (weighted: most have 2-3)
  const companyCount = Math.random() < 0.1 ? 1 :
                      Math.random() < 0.7 ? 2 :
                      Math.random() < 0.95 ? 3 : 4

  const selectedCompanies = []
  const usedCompanies = new Set<string>()

  for (let i = 0; i < companyCount; i++) {
    let company
    do {
      company = SWEDISH_SOLAR_COMPANIES[Math.floor(Math.random() * SWEDISH_SOLAR_COMPANIES.length)]
    } while (usedCompanies.has(company))

    usedCompanies.add(company)

    selectedCompanies.push({
      company,
      leadType: LEAD_TYPES[Math.floor(Math.random() * LEAD_TYPES.length)]
    })
  }

  // Status distribution (realistic)
  const statusRandom = Math.random()
  const successStatus = statusRandom < 0.85 ? 'success' : 'pending' // 85% success rate for Moltas

  const adminRandom = Math.random()
  const adminStatus = adminRandom < 0.70 ? 'approved' :  // 70% approved
                     adminRandom < 0.95 ? 'pending' :     // 25% pending
                     'rejected'                            // 5% rejected

  const city = SWEDISH_CITIES[Math.floor(Math.random() * SWEDISH_CITIES.length)]
  const streetPrefix = STREET_PREFIXES[Math.floor(Math.random() * STREET_PREFIXES.length)]
  const streetSuffix = STREET_SUFFIXES[Math.floor(Math.random() * STREET_SUFFIXES.length)]
  const streetNumber = Math.floor(Math.random() * 200) + 1

  // Property types (weighted distribution)
  const propertyRandom = Math.random()
  const propertyType = propertyRandom < 0.60 ? 'Villa' :
                      propertyRandom < 0.80 ? 'Radhus' :
                      propertyRandom < 0.95 ? 'Lägenhet' : 'Företag'

  // Energy interests based on property type
  const energyInterests = propertyType === 'Villa' ? ['Solceller', 'Värmepump'] :
                         propertyType === 'Radhus' ? ['Solceller', 'Värmepump'] :
                         propertyType === 'Lägenhet' ? ['Solceller'] :
                         ['Solceller', 'Batterilager']

  return {
    adversusId: `adv_moltas_${String(id).padStart(6, '0')}`,
    setterId,
    setterName: 'Moltas Roslund',
    customerName: `${firstName} ${lastName}`,
    customerPhone: `+467${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    customerEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${['gmail.com', 'hotmail.com', 'outlook.com', 'telia.com'][Math.floor(Math.random() * 4)]}`,
    appointmentDate,
    bookedAt: bookedDate,
    adversusStatus: 'completed',
    successStatus,
    adminStatus,
    campaignId: `campaign_${95524 + Math.floor(Math.random() * 500)}`, // Based on real campaign IDs
    campaignName: 'Solar Campaign 2024',

    // Bolag assignments (matching Adversus structure)
    bolag1: selectedCompanies[0]?.company || null,
    bolag1LeadType: selectedCompanies[0]?.leadType || null,
    bolag2: selectedCompanies[1]?.company || null,
    bolag2LeadType: selectedCompanies[1]?.leadType || null,
    bolag3: selectedCompanies[2]?.company || null,
    bolag3LeadType: selectedCompanies[2]?.leadType || null,
    bolag4: selectedCompanies[3]?.company || null,
    bolag4LeadType: selectedCompanies[3]?.leadType || null,

    // Property and location
    propertyType,
    energyInterest: energyInterests,
    streetAddress: `${streetPrefix}${streetSuffix} ${streetNumber}`,
    postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
    city,
    county: getCountyForCity(city),

    // Custom fields matching Adversus structure
    customFields: {
      opener: 'Moltas',
      opener_full: 'Moltas Roslund',
      property_type: propertyType,
      energy_interest: energyInterests,
      meeting_time: appointmentDate.toTimeString().substring(0, 5),
      companies_assigned: companyCount,
      lead_quality: statusRandom < 0.5 ? 'Hög' : statusRandom < 0.8 ? 'Medium' : 'Låg'
    },

    // Original Adversus data structure
    adversusData: {
      source: 'adversus_realistic',
      campaign: {
        id: 95524 + Math.floor(Math.random() * 500),
        name: 'Solar Campaign 2024'
      },
      resultData: {
        'Bolag 1': selectedCompanies[0]?.company || '',
        'Bolag 1: Leadtyp': selectedCompanies[0]?.leadType || '',
        'Bolag 2': selectedCompanies[1]?.company || '',
        'Bolag 2: Leadtyp': selectedCompanies[1]?.leadType || '',
        'Bolag 3': selectedCompanies[2]?.company || '',
        'Bolag 3: Leadtyp': selectedCompanies[2]?.leadType || '',
        'Bolag 4': selectedCompanies[3]?.company || '',
        'Bolag 4: Leadtyp': selectedCompanies[3]?.leadType || '',
        'Opener': 'Moltas',
        'Status': successStatus
      },
      generated_at: new Date().toISOString()
    }
  }
}

function getCountyForCity(city: string): string {
  const countyMap: { [key: string]: string } = {
    'Stockholm': 'Stockholms län',
    'Göteborg': 'Västra Götalands län',
    'Malmö': 'Skåne län',
    'Uppsala': 'Uppsala län',
    'Linköping': 'Östergötlands län',
    'Örebro': 'Örebro län',
    'Helsingborg': 'Skåne län',
    'Norrköping': 'Östergötlands län',
    'Jönköping': 'Jönköpings län',
    'Umeå': 'Västerbottens län',
    'Lund': 'Skåne län',
    'Borås': 'Västra Götalands län',
    'Eskilstuna': 'Södermanlands län',
    'Gävle': 'Gävleborgs län',
    'Halmstad': 'Hallands län'
  }

  return countyMap[city] || 'Sverige'
}

function getCompanyDistribution(leads: any[]) {
  const companies: { [key: string]: number } = {}

  leads.forEach(lead => {
    if (lead.bolag1) companies[lead.bolag1] = (companies[lead.bolag1] || 0) + 1
    if (lead.bolag2) companies[lead.bolag2] = (companies[lead.bolag2] || 0) + 1
    if (lead.bolag3) companies[lead.bolag3] = (companies[lead.bolag3] || 0) + 1
    if (lead.bolag4) companies[lead.bolag4] = (companies[lead.bolag4] || 0) + 1
  })

  return Object.entries(companies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }))
}

function getLeadTypeDistribution(leads: any[]) {
  const types: { [key: string]: number } = {}

  leads.forEach(lead => {
    if (lead.bolag1LeadType) types[lead.bolag1LeadType] = (types[lead.bolag1LeadType] || 0) + 1
    if (lead.bolag2LeadType) types[lead.bolag2LeadType] = (types[lead.bolag2LeadType] || 0) + 1
    if (lead.bolag3LeadType) types[lead.bolag3LeadType] = (types[lead.bolag3LeadType] || 0) + 1
    if (lead.bolag4LeadType) types[lead.bolag4LeadType] = (types[lead.bolag4LeadType] || 0) + 1
  })

  return Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }))
}

function getCityDistribution(leads: any[]) {
  const cities: { [key: string]: number } = {}

  leads.forEach(lead => {
    if (lead.city) cities[lead.city] = (cities[lead.city] || 0) + 1
  })

  return Object.entries(cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([city, count]) => ({ city, count }))
}

// Run the import
importMassiveMoltasDataset().catch(console.error)