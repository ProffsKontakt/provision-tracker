import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function cleanupAndAnalyze() {
  console.log('🧹 Cleaning up mock data and analyzing real situation\n')

  try {
    // Clean up all the mock data I created
    const deleteResult = await prisma.adversusLead.deleteMany({
      where: {
        OR: [
          { adversusId: { startsWith: 'mock_' } },
          { adversusId: { startsWith: 'enhanced_mock_' } },
          { adversusId: { startsWith: 'adv_moltas_' } },
          { adversusId: { startsWith: 'pipedrive_' } }
        ]
      }
    })

    console.log(`✅ Deleted ${deleteResult.count} mock leads\n`)

    // Check what's left
    const remaining = await prisma.adversusLead.count()
    console.log(`📊 Remaining leads in database: ${remaining}\n`)

    // Get real statistics
    const realStats = await prisma.adversusLead.groupBy({
      by: ['setterName', 'adminStatus'],
      _count: true
    })

    console.log('📈 Real Data Statistics:')
    realStats.forEach(stat => {
      console.log(`  ${stat.setterName} - ${stat.adminStatus}: ${stat._count}`)
    })

    console.log('\n✅ Database cleaned. Ready for real Adversus data import.')

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupAndAnalyze().catch(console.error)