const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function cleanupFakeNotifications() {
  console.log('🧹 Starting cleanup of fake system notifications and messages...')

  try {
    // Fake names to remove from system logs
    const fakeNames = [
      'Erik J',
      'Anna A',
      'Maria L',
      'Erik',
      'Anna',
      'Maria',
      'Lena S',
      'Petra K',
      'Johan M',
      'Lisa H'
    ]

    // Fake messages patterns to remove
    const fakeMessagePatterns = [
      'hit rate-målet',
      'Solceller Villa',
      '145k SEK',
      '8.2% → 10.5%',
      '+2.3%',
      'över 12%',
      'aktiva setters',
      'behöver extra fokus',
      'Ny deal skapad'
    ]

    console.log('🗑️  Removing fake system log entries...')

    // Build complex OR conditions for fake names and patterns
    const deleteConditions = []

    // Add conditions for fake names
    fakeNames.forEach(name => {
      deleteConditions.push({
        message: {
          contains: name
        }
      })
    })

    // Add conditions for fake message patterns
    fakeMessagePatterns.forEach(pattern => {
      deleteConditions.push({
        message: {
          contains: pattern
        }
      })
    })

    // Delete system logs with fake data
    const deletedLogs = await prisma.systemLog.deleteMany({
      where: {
        OR: deleteConditions
      }
    })

    console.log(`📝 Deleted ${deletedLogs.count} fake system log entries`)

    // Also clean up any activity feed entries with fake data in the data field
    const deletedActivityLogs = await prisma.systemLog.deleteMany({
      where: {
        AND: [
          {
            type: {
              in: ['user_activity', 'deal_created', 'performance_update', 'notification']
            }
          },
          {
            OR: [
              // Check if data field contains fake names
              ...fakeNames.map(name => ({
                data: {
                  path: ['userName'],
                  equals: name
                }
              })),
              // Check if data field contains fake agent names
              ...fakeNames.map(name => ({
                data: {
                  path: ['agentName'],
                  equals: name
                }
              })),
              // Check if data field contains fake customer names
              ...fakeNames.map(name => ({
                data: {
                  path: ['customerName'],
                  equals: name
                }
              }))
            ]
          }
        ]
      }
    })

    console.log(`📋 Deleted ${deletedActivityLogs.count} fake activity log entries`)

    // Clean up any remaining logs that might have JSON data with fake info
    const jsonCleanup = await prisma.systemLog.deleteMany({
      where: {
        OR: [
          {
            data: {
              string_contains: 'Erik J'
            }
          },
          {
            data: {
              string_contains: 'Anna A'
            }
          },
          {
            data: {
              string_contains: 'Maria L'
            }
          }
        ]
      }
    })

    console.log(`🔍 Deleted ${jsonCleanup.count} logs with fake JSON data`)

    console.log('\n🎉 Fake notification cleanup completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Deleted ${deletedLogs.count} fake system messages`)
    console.log(`   - Deleted ${deletedActivityLogs.count} fake activity logs`)
    console.log(`   - Deleted ${jsonCleanup.count} logs with fake JSON data`)
    console.log(`\n✅ System is now clean of fake notifications and dummy data!`)

  } catch (error) {
    console.error('❌ Error during fake notification cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanupFakeNotifications()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  })