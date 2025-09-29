import { PrismaClient, UserRole, LeadType, DealStatus, AdminApproval, CommissionStatus } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Swedish Solar Commission Tracker database...')

  try {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12)
    const admin = await prisma.user.upsert({
      where: { email: 'admin@proffskontakt.se' },
      update: {},
      create: {
        email: 'admin@proffskontakt.se',
        name: 'System Administrator',
        password: adminPassword,
        role: UserRole.ADMIN,
        openerName: 'SystemAdmin',
        active: true
      }
    })
    console.log('✅ Created admin user:', admin.email)

    // Create manager user
    const managerPassword = await bcrypt.hash('manager123', 12)
    const manager = await prisma.user.upsert({
      where: { email: 'manager@proffskontakt.se' },
      update: {},
      create: {
        email: 'manager@proffskontakt.se',
        name: 'Sales Manager',
        password: managerPassword,
        role: UserRole.MANAGER,
        openerName: 'SalesManager',
        active: true
      }
    })
    console.log('✅ Created manager user:', manager.email)

    // Create actual appointment setters
    const setterPassword = await bcrypt.hash('setter123', 12)
    const setters = [
      {
        email: 'moltas.roslund@proffskontakt.se',
        name: 'Moltas Roslund',
        openerName: 'Moltas R',
        adversusAgentId: 'agent_moltas'
      },
      {
        email: 'gustaf.linder@proffskontakt.se',
        name: 'Gustaf Linder',
        openerName: 'Gustaf L',
        adversusAgentId: 'agent_gustaf'
      },
      {
        email: 'carl.brun@proffskontakt.se',
        name: 'Carl Brun',
        openerName: 'Carl B',
        adversusAgentId: 'agent_carl'
      },
      {
        email: 'frank.omsen@proffskontakt.se',
        name: 'Frank Omsén',
        openerName: 'Frank O',
        adversusAgentId: 'agent_frank'
      }
    ]

    const createdSetters = []
    for (const setterData of setters) {
      const setter = await prisma.user.upsert({
        where: { email: setterData.email },
        update: {},
        create: {
          ...setterData,
          password: setterPassword,
          role: UserRole.SETTER,
          active: true
        }
      })
      createdSetters.push(setter)
      console.log('✅ Created setter:', setter.email)
    }

    // Create Swedish solar installation companies
    const companies = [
      {
        name: 'SolarTech Stockholm AB',
        organisationsnummer: '556789-1234',
        contactEmail: 'info@solartech-stockholm.se',
        contactPhone: '+46812345678',
        address: 'Sveavägen 123, 111 57 Stockholm'
      },
      {
        name: 'Nordic Solar Solutions',
        organisationsnummer: '556789-2345',
        contactEmail: 'kontakt@nordicsolar.se',
        contactPhone: '+46812345679',
        address: 'Götgatan 45, 118 26 Stockholm'
      },
      {
        name: 'Energi & Miljöteknik i Sverige AB',
        organisationsnummer: '556789-3456',
        contactEmail: 'info@energimiljo.se',
        contactPhone: '+46812345680',
        address: 'Drottninggatan 89, 111 60 Stockholm'
      },
      {
        name: 'Solceller Sverige AB',
        organisationsnummer: '556789-4567',
        contactEmail: 'kontakt@solcellersverige.se',
        contactPhone: '+46812345681',
        address: 'Kungsgatan 12, 411 19 Göteborg'
      },
      {
        name: 'Green Energy Nordic',
        organisationsnummer: '556789-5678',
        contactEmail: 'info@greenenergynordic.se',
        contactPhone: '+46812345682',
        address: 'Malmskillnadsgatan 67, 111 57 Stockholm'
      },
      {
        name: 'Svensk Solenergi AB',
        organisationsnummer: '556789-6789',
        contactEmail: 'kontakt@svensksolenergi.se',
        contactPhone: '+46812345683',
        address: 'Storgatan 34, 211 42 Malmö'
      },
      {
        name: 'EcoSolar Scandinavia',
        organisationsnummer: '556789-7890',
        contactEmail: 'info@ecosolar.se',
        contactPhone: '+46812345684',
        address: 'Vasagatan 78, 111 20 Stockholm'
      }
    ]

    for (const companyData of companies) {
      await prisma.company.upsert({
        where: { name: companyData.name },
        update: {},
        create: companyData
      })
      console.log('✅ Created company:', companyData.name)
    }

    // Create commission rules (Swedish business logic)
    const commissionRules = [
      {
        name: 'BASE_BONUS',
        value: 100,
        description: 'Basbonus - utbetalas en gång per lead om minst ett bolag finns'
      },
      {
        name: 'OFFERT_RATE',
        value: 100,
        description: 'Provision per bolag för Offert-leads'
      },
      {
        name: 'PLATSBESOK_RATE',
        value: 300,
        description: 'Provision per bolag för Platsbesök-leads'
      }
    ]

    for (const rule of commissionRules) {
      await prisma.commissionRule.upsert({
        where: { name: rule.name },
        update: {},
        create: rule
      })
      console.log('✅ Created commission rule:', rule.name)
    }

    // Create sample deals with different scenarios
    const sampleDeals = [
      {
        id: 100001,
        title: 'Solceller Villa Bromma',
        opener: 'Moltas R',
        contactPerson: 'Johan Karlsson',
        phoneNumber: '+46701234567',
        streetAddress: 'Storgatan 15, 168 67 Bromma',
        adminChecked: 'Godkänt',
        adminApproval: AdminApproval.APPROVED,
        leadSource: 'Telefon',
        companyPool: 'Stockholm',
        propertyOwner: 'Ja',
        interestedIn: 'Solceller',
        notes: 'Kund intresserad av solceller för villa. Bra ekonomi, snabb process.',
        company1: companies[0].name,
        company1LeadType: LeadType.OFFERT,
        company2: companies[1].name,
        company2LeadType: LeadType.PLATSBESOK,
        totalCommission: 500, // 100 base + 100 offert + 300 platsbesök
        baseBonus: 100,
        creditedCompanies: []
      },
      {
        id: 100002,
        title: 'Solpaneler Radhus Täby',
        opener: 'Gustaf L',
        contactPerson: 'Lisa Berglund',
        phoneNumber: '+46702345678',
        streetAddress: 'Björkgatan 8, 183 52 Täby',
        adminChecked: 'Godkänt',
        adminApproval: AdminApproval.APPROVED,
        leadSource: 'Telefon',
        companyPool: 'Stockholm',
        propertyOwner: 'Ja',
        interestedIn: 'Solpaneler',
        notes: 'Radhus med bra solförhållanden. Kund motiverad.',
        company1: companies[2].name,
        company1LeadType: LeadType.OFFERT,
        totalCommission: 200, // 100 base + 100 offert
        baseBonus: 100,
        creditedCompanies: []
      },
      {
        id: 100003,
        title: 'Solenergi Lägenhet Göteborg',
        opener: 'Carl B',
        contactPerson: 'Magnus Lindström',
        phoneNumber: '+46703456789',
        streetAddress: 'Avenyn 42, 411 36 Göteborg',
        adminChecked: 'Underkänt',
        adminApproval: AdminApproval.REJECTED,
        leadSource: 'Telefon',
        companyPool: 'Göteborg',
        propertyOwner: 'Nej',
        interestedIn: 'Solenergi',
        notes: 'Kund visade sig inte vara fastighetsägare. Underkänt.',
        company1: companies[3].name,
        company1LeadType: LeadType.PLATSBESOK,
        totalCommission: 0,
        baseBonus: 0,
        creditedCompanies: []
      },
      {
        id: 100004,
        title: 'Solceller Villa Malmö',
        opener: 'Frank O',
        contactPerson: 'Sara Johansson',
        phoneNumber: '+46704567890',
        streetAddress: 'Rosengård 123, 212 33 Malmö',
        adminChecked: 'Godkänt',
        adminApproval: AdminApproval.APPROVED,
        leadSource: 'Telefon',
        companyPool: 'Malmö',
        propertyOwner: 'Ja',
        interestedIn: 'Solceller',
        notes: 'Stor villa med utmärkt solläge. Kund har hög betalningsförmåga.',
        company1: companies[4].name,
        company1LeadType: LeadType.PLATSBESOK,
        company2: companies[5].name,
        company2LeadType: LeadType.PLATSBESOK,
        company3: companies[6].name,
        company3LeadType: LeadType.OFFERT,
        creditedCompanies: [companies[5].name], // One company credited back
        totalCommission: 500, // 100 base + 300 platsbesök + 100 offert (one platsbesök credited)
        baseBonus: 100
      },
      {
        id: 100005,
        title: 'Solceller Kedjehus Västerås',
        opener: 'Moltas R',
        contactPerson: 'Peter Magnusson',
        phoneNumber: '+46705678901',
        streetAddress: 'Kyrkogatan 56, 722 15 Västerås',
        adminChecked: 'Godkänt',
        adminApproval: AdminApproval.APPROVED,
        leadSource: 'Telefon',
        companyPool: 'Stockholm',
        propertyOwner: 'Ja',
        interestedIn: 'Solceller',
        notes: 'Kedjehus med söderläge. Kund vill ha snabb installation.',
        company1: companies[0].name,
        company1LeadType: LeadType.OFFERT,
        company2: companies[2].name,
        company2LeadType: LeadType.OFFERT,
        company3: companies[4].name,
        company3LeadType: LeadType.OFFERT,
        company4: companies[6].name,
        company4LeadType: LeadType.OFFERT,
        totalCommission: 500, // 100 base + 4 * 100 offert
        baseBonus: 100,
        creditedCompanies: []
      },
      {
        id: 100006,
        title: 'Solenergi Företag Uppsala',
        opener: 'Gustaf L',
        contactPerson: 'Anna Hedberg',
        phoneNumber: '+46706789012',
        streetAddress: 'Industrivägen 23, 754 50 Uppsala',
        adminChecked: null,
        adminApproval: AdminApproval.PENDING,
        leadSource: 'Telefon',
        companyPool: 'Stockholm',
        propertyOwner: 'Ja',
        interestedIn: 'Solenergi för företag',
        notes: 'Företagskund med stort tak. Väntar på ytterligare information.',
        company1: companies[1].name,
        company1LeadType: LeadType.PLATSBESOK,
        company2: companies[3].name,
        company2LeadType: LeadType.PLATSBESOK,
        totalCommission: null, // Pending approval
        baseBonus: null,
        creditedCompanies: []
      }
    ]

    for (const dealData of sampleDeals) {
      const deal = await prisma.deal.upsert({
        where: { id: dealData.id },
        update: {},
        create: {
          ...dealData,
          stage: 'Won',
          status: DealStatus.WON,
          dealCreated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          meetingDay: new Date(Date.now() + (Math.random() * 14 + 1) * 24 * 60 * 60 * 1000), // 1-14 days from now
          meetingTime: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'][Math.floor(Math.random() * 6)],
          pipedriveData: {},
          creditedCompanies: dealData.creditedCompanies || []
        }
      })
      console.log('✅ Created deal:', deal.id, deal.title)

      // Create corresponding commissions for approved deals
      if (deal.adminApproval === AdminApproval.APPROVED) {
        const user = await prisma.user.findUnique({
          where: { openerName: deal.opener }
        })

        if (user) {
          // Create commission records for each company
          const companies = [
            { name: deal.company1, leadType: deal.company1LeadType },
            { name: deal.company2, leadType: deal.company2LeadType },
            { name: deal.company3, leadType: deal.company3LeadType },
            { name: deal.company4, leadType: deal.company4LeadType }
          ].filter(c => c.name && c.leadType)

          for (const company of companies) {
            const creditedCompanies = Array.isArray(dealData.creditedCompanies)
              ? dealData.creditedCompanies
              : []
            const isCredited = creditedCompanies.includes(company.name!)

            const leadTypeAmount = company.leadType === LeadType.OFFERT ? 100 : 300

            await prisma.commission.upsert({
              where: {
                dealId_companyName: {
                  dealId: deal.id,
                  companyName: company.name!
                }
              },
              update: {},
              create: {
                dealId: deal.id,
                userId: user.id,
                companyName: company.name!,
                leadType: company.leadType!,
                leadTypeAmount: leadTypeAmount,
                isBaseIncluded: false, // Base is tracked separately
                creditedBack: isCredited,
                creditedAt: isCredited ? new Date() : null,
                creditReason: isCredited ? 'Krediterad av bolag' : null,
                status: isCredited ? CommissionStatus.CREDITED : CommissionStatus.APPROVED
              }
            })
          }
          console.log(`✅ Created commissions for deal ${deal.id}`)
        }
      }
    }

    // Create sample Adversus calls
    const sampleCalls = [
      {
        adversusCallId: 'call_001',
        agentId: 'agent_moltas',
        customerPhone: '+46701234567',
        callDuration: 380, // 6 minutes 20 seconds
        callTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        markedSuccess: true,
        successMarkedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        adminReviewed: true,
        adminStatus: 'Godkänt',
        pipedriveDealId: 100001
      },
      {
        adversusCallId: 'call_002',
        agentId: 'agent_gustaf',
        customerPhone: '+46702345678',
        callDuration: 520, // 8 minutes 40 seconds
        callTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        markedSuccess: true,
        successMarkedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        adminReviewed: true,
        adminStatus: 'Godkänt',
        pipedriveDealId: 100002
      },
      {
        adversusCallId: 'call_003',
        agentId: 'agent_carl',
        customerPhone: '+46703456789',
        callDuration: 180, // 3 minutes
        callTimestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        markedSuccess: true,
        successMarkedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        adminReviewed: true,
        adminStatus: 'Underkänt',
        pipedriveDealId: 100003
      },
      {
        adversusCallId: 'call_004',
        agentId: 'agent_gustaf',
        customerPhone: '+46706789012',
        callDuration: 420, // 7 minutes
        callTimestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        markedSuccess: true,
        successMarkedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        adminReviewed: false,
        adminStatus: null,
        pipedriveDealId: 100006
      }
    ]

    for (const callData of sampleCalls) {
      const call = await prisma.adversusCall.upsert({
        where: { adversusCallId: callData.adversusCallId },
        update: {},
        create: {
          ...callData,
          recordingUrl: `https://recordings.adversus.dk/${callData.adversusCallId}.mp3`,
          adversusData: {
            campaignId: 'solar_campaign_2024',
            leadSource: 'cold_call',
            duration: callData.callDuration
          }
        }
      })
      console.log('✅ Created Adversus call:', callData.adversusCallId)

      // Create admin review for reviewed calls
      if (callData.adminReviewed && callData.adminStatus) {
        await prisma.adminReview.upsert({
          where: { callId: call.id },
          update: {},
          create: {
            callId: call.id,
            reviewerId: admin.id,
            status: callData.adminStatus,
            notes: callData.adminStatus === 'Godkänt'
              ? 'Bra kvalitet på samtalet, kund verkar genuint intresserad.'
              : 'Kund visade sig inte vara fastighetsägare.',
            reviewDuration: Math.floor(Math.random() * 300) + 60 // 1-5 minutes
          }
        })
        console.log(`✅ Created admin review for call ${callData.adversusCallId}`)
      }
    }

    // Create system logs
    await prisma.systemLog.create({
      data: {
        type: 'seed',
        source: 'database',
        message: 'Database seeded with Swedish sample data',
        data: {
          timestamp: new Date().toISOString(),
          deals_created: sampleDeals.length,
          users_created: setters.length + 2, // setters + admin + manager
          companies_created: companies.length,
          calls_created: sampleCalls.length,
          commission_rules_created: commissionRules.length
        }
      }
    })

    // Create a sample payment batch
    await prisma.paymentBatch.create({
      data: {
        batchNumber: `2024-${String(new Date().getMonth() + 1).padStart(2, '0')}-BATCH`,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        totalAmount: 1200, // Total of approved commissions
        commissionCount: 8,
        status: 'pending',
        notes: 'Månatlig utbetalning för godkända provisioner'
      }
    })

    console.log('🎉 Database seeding completed successfully!')
    console.log('')
    console.log('📋 Login credentials:')
    console.log('👨‍💼 Admin: admin@proffskontakt.se / admin123')
    console.log('👩‍💼 Manager: manager@proffskontakt.se / manager123')
    console.log('🎯 Setter: moltas.roslund@proffskontakt.se / setter123')
    console.log('🎯 Setter: gustaf.linder@proffskontakt.se / setter123')
    console.log('🎯 Setter: carl.brun@proffskontakt.se / setter123')
    console.log('🎯 Setter: frank.omsen@proffskontakt.se / setter123')
    console.log('')
    console.log('💰 Commission Summary:')
    console.log('• 4 approved deals with commissions')
    console.log('• 1 pending deal awaiting admin review')
    console.log('• 1 rejected deal with no commission')
    console.log('• 1 deal with credited company (partial commission reduction)')
    console.log('')
    console.log('🏢 Swedish Companies:')
    companies.forEach(company => {
      console.log(`• ${company.name} (${company.organisationsnummer})`)
    })

  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error during database seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })