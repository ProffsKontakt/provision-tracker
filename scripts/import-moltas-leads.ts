import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// Adversus API configuration
const ADVERSUS_BASE_URL = process.env.ADVERSUS_BASE_URL || 'https://api.adversus.com'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD

// Moltas's agent ID mapping
const MOLTAS_AGENT_ID = 'agent_moltas'

interface AdversusAppointment {
  id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  agent_id: string
  agent_name: string
  campaign_id: string
  campaign_name?: string
  created_at: string
  appointment_datetime: string
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled'
  success_status?: string
  custom_fields: {
    bolag_1?: string
    bolag_1_leadtype?: string
    bolag_2?: string
    bolag_2_leadtype?: string
    bolag_3?: string
    bolag_3_leadtype?: string
    bolag_4?: string
    bolag_4_leadtype?: string
    property_type?: string
    energy_interest?: string[]
    street_address?: string
    postal_code?: string
    city?: string
    county?: string
    admin_status?: 'pending' | 'approved' | 'rejected'
    [key: string]: any
  }
}

async function importMoltasLeads() {
  try {
    if (!ADVERSUS_USERNAME || !ADVERSUS_PASSWORD) {
      console.log('⚠️  Adversus API credentials not configured, using mock data for import')
      await importMockData()
      return
    }

    console.log('🚀 Starting import of Moltas successful leads from past 2 months...')

    // Calculate date range (past 2 months)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 2)

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Find Moltas in our database
    const moltas = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltas) {
      console.error('❌ Moltas Roslund not found in database')
      return
    }

    console.log(`👤 Found Moltas: ${moltas.name} (${moltas.adversusAgentId})`)

    // Create Basic Auth header for Adversus
    const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

    // Fetch appointments from Adversus API
    const params = new URLSearchParams({
      agent_id: MOLTAS_AGENT_ID,
      date_from: startDate.toISOString(),
      date_to: endDate.toISOString(),
      status: 'booked,confirmed,completed',
      success_status: 'success', // Only successful leads
      limit: '500',
      include_custom_fields: 'true'
    })

    console.log('📡 Fetching data from Adversus API...')

    let response
    try {
      response = await fetch(
        `${ADVERSUS_BASE_URL}/appointments?${params}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (fetchError) {
      console.log('⚠️  Unable to connect to Adversus API, falling back to mock data')
      await importMockData()
      return
    }

    if (!response.ok) {
      console.log(`⚠️  Adversus API returned error ${response.status}, falling back to mock data`)
      await importMockData()
      return
    }

    const data = await response.json()
    const appointments: AdversusAppointment[] = data.data || []

    console.log(`📊 Fetched ${appointments.length} successful appointments from Adversus`)

    // Import each appointment
    let importedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const appointment of appointments) {
      try {
        // Check if already exists
        const existing = await prisma.adversusLead.findUnique({
          where: { adversusId: appointment.id }
        })

        if (existing) {
          skippedCount++
          console.log(`⏭️  Skipping ${appointment.customer_name} (already exists)`)
          continue
        }

        // Create the lead
        await prisma.adversusLead.create({
          data: {
            adversusId: appointment.id,
            setterId: moltas.adversusAgentId,
            setterName: appointment.agent_name,
            customerName: appointment.customer_name,
            customerPhone: appointment.customer_phone,
            customerEmail: appointment.customer_email,
            appointmentDate: new Date(appointment.appointment_datetime),
            bookedAt: new Date(appointment.created_at),
            adversusStatus: appointment.status,
            successStatus: appointment.success_status || 'success',
            campaignId: appointment.campaign_id,
            campaignName: appointment.campaign_name,

            // Company assignments
            bolag1: appointment.custom_fields.bolag_1,
            bolag1LeadType: appointment.custom_fields.bolag_1_leadtype,
            bolag2: appointment.custom_fields.bolag_2,
            bolag2LeadType: appointment.custom_fields.bolag_2_leadtype,
            bolag3: appointment.custom_fields.bolag_3,
            bolag3LeadType: appointment.custom_fields.bolag_3_leadtype,
            bolag4: appointment.custom_fields.bolag_4,
            bolag4LeadType: appointment.custom_fields.bolag_4_leadtype,

            // Property information
            propertyType: appointment.custom_fields.property_type,
            energyInterest: appointment.custom_fields.energy_interest,

            // Address information
            streetAddress: appointment.custom_fields.street_address,
            postalCode: appointment.custom_fields.postal_code,
            city: appointment.custom_fields.city,
            county: appointment.custom_fields.county,

            // Admin status
            adminStatus: appointment.custom_fields.admin_status || 'pending',

            // Store original data
            customFields: appointment.custom_fields,
            adversusData: appointment
          }
        })

        importedCount++
        console.log(`✅ Imported: ${appointment.customer_name} (${appointment.appointment_datetime})`)

      } catch (error) {
        errorCount++
        console.error(`❌ Error importing ${appointment.customer_name}:`, error)
      }
    }

    // Log summary
    await prisma.systemLog.create({
      data: {
        type: 'adversus_import',
        source: 'script',
        message: `Imported ${importedCount} successful leads for Moltas Roslund`,
        data: {
          setterName: 'Moltas Roslund',
          totalFetched: appointments.length,
          imported: importedCount,
          skipped: skippedCount,
          errors: errorCount,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          }
        }
      }
    })

    console.log('\n📈 Import Summary:')
    console.log(`   Total fetched: ${appointments.length}`)
    console.log(`   ✅ Imported: ${importedCount}`)
    console.log(`   ⏭️  Skipped: ${skippedCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

  } catch (error) {
    console.error('💥 Import failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function importMockData() {
  console.log('📦 Importing mock successful leads for Moltas...')

  // Find Moltas in our database
  const moltas = await prisma.user.findFirst({
    where: { name: 'Moltas Roslund' }
  })

  if (!moltas) {
    console.error('❌ Moltas Roslund not found in database')
    return
  }

  // Create mock successful leads for past 2 months
  const mockLeads = [
    {
      adversusId: 'mock_moltas_001',
      customerName: 'Anna Eriksson',
      customerPhone: '+46701234567',
      customerEmail: 'anna.eriksson@email.com',
      appointmentDate: new Date('2024-08-15T10:00:00Z'),
      bookedAt: new Date('2024-08-10T14:30:00Z'),
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'solar_campaign_2024',
      bolag1: 'SolarTech Stockholm AB',
      bolag1LeadType: 'Villa - Solceller',
      bolag2: 'Nordic Heat Solutions',
      bolag2LeadType: 'Villa - Värmepump',
      propertyType: 'Villa',
      energyInterest: ['Solceller', 'Värmepump'],
      streetAddress: 'Storgatan 123',
      postalCode: '11122',
      city: 'Stockholm',
      adminStatus: 'approved'
    },
    {
      adversusId: 'mock_moltas_002',
      customerName: 'Lars Johansson',
      customerPhone: '+46709876543',
      customerEmail: 'lars.johansson@email.com',
      appointmentDate: new Date('2024-08-20T14:00:00Z'),
      bookedAt: new Date('2024-08-18T09:15:00Z'),
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'solar_campaign_2024',
      bolag1: 'Green Energy Nordic',
      bolag1LeadType: 'Lägenhet - Solceller',
      propertyType: 'Lägenhet',
      energyInterest: ['Solceller'],
      streetAddress: 'Ringvägen 45',
      postalCode: '11833',
      city: 'Stockholm',
      adminStatus: 'pending'
    },
    {
      adversusId: 'mock_moltas_003',
      customerName: 'Maria Andersson',
      customerPhone: '+46705551234',
      customerEmail: 'maria.andersson@email.com',
      appointmentDate: new Date('2024-09-05T11:30:00Z'),
      bookedAt: new Date('2024-09-01T16:45:00Z'),
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'solar_campaign_2024',
      bolag1: 'Energi & Miljöteknik i Sverige AB',
      bolag1LeadType: 'Villa - Värmepump',
      bolag2: 'Solceller Sverige AB',
      bolag2LeadType: 'Villa - Solceller',
      bolag3: 'EcoSolar Scandinavia',
      bolag3LeadType: 'Villa - Vindkraft',
      propertyType: 'Villa',
      energyInterest: ['Värmepump', 'Solceller', 'Vindkraft'],
      streetAddress: 'Lindgatan 78',
      postalCode: '41705',
      city: 'Göteborg',
      adminStatus: 'approved'
    },
    {
      adversusId: 'mock_moltas_004',
      customerName: 'Erik Nilsson',
      customerPhone: '+46703339876',
      customerEmail: 'erik.nilsson@email.com',
      appointmentDate: new Date('2024-09-12T13:15:00Z'),
      bookedAt: new Date('2024-09-10T10:20:00Z'),
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'solar_campaign_2024',
      bolag1: 'Nordic Solar Solutions',
      bolag1LeadType: 'Radhus - Solceller',
      bolag2: 'Heat Pump Nordic',
      bolag2LeadType: 'Radhus - Värmepump',
      propertyType: 'Radhus',
      energyInterest: ['Solceller', 'Värmepump'],
      streetAddress: 'Bryggargatan 12',
      postalCode: '21142',
      city: 'Malmö',
      adminStatus: 'approved'
    },
    {
      adversusId: 'mock_moltas_005',
      customerName: 'Karin Svensson',
      customerPhone: '+46706667788',
      customerEmail: 'karin.svensson@email.com',
      appointmentDate: new Date('2024-09-18T09:45:00Z'),
      bookedAt: new Date('2024-09-15T13:30:00Z'),
      adversusStatus: 'completed',
      successStatus: 'success',
      campaignId: 'solar_campaign_2024',
      bolag1: 'GreenTech Solutions AB',
      bolag1LeadType: 'Villa - Solceller',
      propertyType: 'Villa',
      energyInterest: ['Solceller'],
      streetAddress: 'Ekmansplan 8',
      postalCode: '75323',
      city: 'Uppsala',
      adminStatus: 'pending'
    }
  ]

  let importedCount = 0

  for (const leadData of mockLeads) {
    try {
      // Check if already exists
      const existing = await prisma.adversusLead.findUnique({
        where: { adversusId: leadData.adversusId }
      })

      if (existing) {
        console.log(`⏭️  Skipping ${leadData.customerName} (already exists)`)
        continue
      }

      await prisma.adversusLead.create({
        data: {
          ...leadData,
          setterId: moltas.adversusAgentId,
          setterName: moltas.name,
          customFields: {
            property_type: leadData.propertyType,
            energy_interest: leadData.energyInterest,
            street_address: leadData.streetAddress,
            postal_code: leadData.postalCode,
            city: leadData.city
          },
          adversusData: {
            mock: true,
            generated_at: new Date().toISOString()
          }
        }
      })

      importedCount++
      console.log(`✅ Imported mock lead: ${leadData.customerName}`)

    } catch (error) {
      console.error(`❌ Error importing ${leadData.customerName}:`, error)
    }
  }

  // Log summary
  await prisma.systemLog.create({
    data: {
      type: 'adversus_import',
      source: 'mock_data',
      message: `Imported ${importedCount} mock successful leads for Moltas Roslund`,
      data: {
        setterName: 'Moltas Roslund',
        totalMockLeads: mockLeads.length,
        imported: importedCount,
        type: 'mock_data'
      }
    }
  })

  console.log(`\n📈 Mock Import Summary: ✅ ${importedCount} leads imported`)
}

// Run the import
importMoltasLeads().catch(console.error)