import { prisma } from '../src/lib/db/prisma'
import { hash } from 'bcryptjs'

async function setupAdmin() {
  console.log('🔍 Checking existing users...')

  // Check all users in the database
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true
    }
  })

  console.log('📊 Existing users:')
  allUsers.forEach(user => {
    console.log(`  - ${user.email} (${user.role}) - ${user.active ? 'Active' : 'Inactive'}`)
  })

  // Check if ADMIN user exists
  const adminUsers = allUsers.filter(user => user.role === 'ADMIN')

  if (adminUsers.length === 0) {
    console.log('\n🚨 No ADMIN users found. Creating admin user...')

    const hashedPassword = await hash('admin123', 12)

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@proffskontakt.se',
        name: 'System Administrator',
        password: hashedPassword,
        role: 'ADMIN',
        openerName: 'SA',
        adversusAgentId: 'admin_system',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log('✅ Admin user created:')
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Password: admin123`)
    console.log(`   Role: ${adminUser.role}`)
    console.log('\n🔐 IMPORTANT: Change the password after first login!')

  } else {
    console.log(`\n✅ Found ${adminUsers.length} ADMIN user(s):`)
    adminUsers.forEach(admin => {
      console.log(`   - ${admin.email} (${admin.active ? 'Active' : 'Inactive'})`)
    })
  }

  // Show role distribution
  const roleStats = allUsers.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\n📊 User role distribution:')
  Object.entries(roleStats).forEach(([role, count]) => {
    console.log(`   ${role}: ${count} users`)
  })

  await prisma.$disconnect()
}

setupAdmin().catch(console.error)