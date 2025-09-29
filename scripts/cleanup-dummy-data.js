const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function cleanupDummyData() {
  console.log('🧹 Starting cleanup of dummy appointment setter data...')

  try {
    // Real setters to keep (Moltas, Carl, Gustaf, Frank)
    const realSetters = [
      'Moltas Roslund',
      'Carl Brun',
      'Gustaf Linder',
      'Frank Omsén'
    ]

    console.log(`✅ Real setters to keep: ${realSetters.join(', ')}`)

    // Find all users that are NOT in the real setters list
    const usersToDelete = await prisma.user.findMany({
      where: {
        AND: [
          {
            name: {
              notIn: realSetters
            }
          },
          {
            role: 'SETTER'
          }
        ]
      },
      include: {
        adversusLeads: true,
        commissions: true,
        deals: true
      }
    })

    console.log(`🗑️  Found ${usersToDelete.length} dummy setters to remove:`)
    usersToDelete.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.adversusLeads.length} leads`)
    })

    if (usersToDelete.length === 0) {
      console.log('✅ No dummy setters found. Database is clean!')
      return
    }

    // Delete associated data in correct order (foreign key constraints)
    let totalCommissionsDeleted = 0
    let totalLeadsDeleted = 0
    let totalDealsDeleted = 0

    for (const user of usersToDelete) {
      console.log(`\n🔥 Removing data for: ${user.name}`)

      // Delete commissions first (they have foreign keys to users and deals)
      if (user.commissions.length > 0) {
        const deletedCommissions = await prisma.commission.deleteMany({
          where: {
            userId: user.id
          }
        })
        totalCommissionsDeleted += deletedCommissions.count
        console.log(`   💰 Deleted ${deletedCommissions.count} commissions`)
      }

      // Delete deals
      if (user.deals.length > 0) {
        const deletedDeals = await prisma.deal.deleteMany({
          where: {
            userId: user.id
          }
        })
        totalDealsDeleted += deletedDeals.count
        console.log(`   🤝 Deleted ${deletedDeals.count} deals`)
      }

      // Delete adversus leads
      if (user.adversusLeads.length > 0) {
        const deletedLeads = await prisma.adversusLead.deleteMany({
          where: {
            setterId: user.adversusAgentId
          }
        })
        totalLeadsDeleted += deletedLeads.count
        console.log(`   📋 Deleted ${deletedLeads.count} adversus leads`)
      }

      // Delete user
      await prisma.user.delete({
        where: {
          id: user.id
        }
      })
      console.log(`   👤 Deleted user: ${user.name}`)
    }

    // Clean up system logs with dummy data
    const deletedLogs = await prisma.systemLog.deleteMany({
      where: {
        OR: [
          {
            message: {
              contains: 'Erik J'
            }
          },
          {
            message: {
              contains: 'Anna A'
            }
          },
          {
            message: {
              contains: 'Maria L'
            }
          },
          {
            message: {
              contains: 'hit rate-målet'
            }
          },
          {
            message: {
              contains: 'Solceller Villa'
            }
          }
        ]
      }
    })

    console.log(`\n📝 Deleted ${deletedLogs.count} dummy system log entries`)

    // Clean up any activity feed entries with fake data
    await prisma.systemLog.deleteMany({
      where: {
        AND: [
          {
            type: {
              in: ['user_activity', 'deal_created', 'performance_update']
            }
          },
          {
            OR: [
              {
                data: {
                  path: ['userName'],
                  not: {
                    in: realSetters
                  }
                }
              },
              {
                message: {
                  contains: 'Erik'
                }
              },
              {
                message: {
                  contains: 'Anna'
                }
              },
              {
                message: {
                  contains: 'Maria'
                }
              }
            ]
          }
        ]
      }
    })

    console.log('\n🎉 Cleanup completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Deleted ${usersToDelete.length} dummy setters`)
    console.log(`   - Deleted ${totalDealsDeleted} dummy deals`)
    console.log(`   - Deleted ${totalLeadsDeleted} dummy adversus leads`)
    console.log(`   - Deleted ${totalCommissionsDeleted} dummy commissions`)
    console.log(`   - Cleaned up system logs`)
    console.log(`\n✅ Only real setters remain: ${realSetters.join(', ')}`)

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanupDummyData()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  })