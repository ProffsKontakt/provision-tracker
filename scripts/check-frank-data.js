const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function checkFrankData() {
  console.log('🔍 Checking Frank Omsén\'s user data and leads...')

  try {
    // Find Frank's user record
    const frank = await prisma.user.findFirst({
      where: {
        name: 'Frank Omsén'
      }
    })

    if (!frank) {
      console.log('❌ Frank Omsén not found in users table')
      return
    }

    console.log('👤 Frank Omsén user data:')
    console.log({
      id: frank.id,
      name: frank.name,
      email: frank.email,
      openerName: frank.openerName,
      adversusAgentId: frank.adversusAgentId,
      role: frank.role
    })

    // Check if Frank has any AdversusLeads by setterId (adversusAgentId)
    const leadsBySetter = await prisma.adversusLead.findMany({
      where: {
        setterId: frank.adversusAgentId
      }
    })

    console.log(`\n📋 Leads found by setterId (${frank.adversusAgentId}): ${leadsBySetter.length}`)
    if (leadsBySetter.length > 0) {
      leadsBySetter.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.customerName} - ${lead.adversusStatus} (ID: ${lead.id})`)
      })
    }

    // Check if Frank has any AdversusLeads by userId (wrong field - this is what the API is currently using)
    const leadsByUserId = await prisma.adversusLead.findMany({
      where: {
        userId: frank.id  // This field doesn't exist in AdversusLead schema!
      }
    })

    console.log(`\n📋 Leads found by userId (${frank.id}): ${leadsByUserId.length}`)

    // Check if there are any leads with Frank's name
    const leadsByName = await prisma.adversusLead.findMany({
      where: {
        setterName: {
          contains: 'Frank',
          mode: 'insensitive'
        }
      }
    })

    console.log(`\n📋 Leads found by setterName containing 'Frank': ${leadsByName.length}`)
    if (leadsByName.length > 0) {
      leadsByName.forEach((lead, index) => {
        console.log(`   ${index + 1}. ${lead.customerName} - Setter: "${lead.setterName}" - ID: ${lead.setterId}`)
      })
    }

    // Check all setter IDs in the database
    const allSetterIds = await prisma.adversusLead.findMany({
      select: {
        setterId: true,
        setterName: true
      },
      distinct: ['setterId']
    })

    console.log('\n🔧 All unique setter IDs in database:')
    allSetterIds.forEach(lead => {
      console.log(`   SetterId: "${lead.setterId}" - Name: "${lead.setterName}"`)
    })

  } catch (error) {
    console.error('❌ Error checking Frank data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFrankData()