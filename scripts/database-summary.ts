import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function databaseSummary() {
  console.log('📊 DATABASE SUMMARY\n')
  console.log('═'.repeat(60))

  try {
    // Total leads count
    const totalLeads = await prisma.adversusLead.count()
    console.log(`\n📈 Total leads in database: ${totalLeads}`)

    // Leads by salesperson
    const leadsBySalesperson = await prisma.adversusLead.groupBy({
      by: ['setterName'],
      _count: true,
      orderBy: {
        _count: {
          setterName: 'desc'
        }
      }
    })

    console.log('\n👥 Leads by Salesperson:')
    leadsBySalesperson.forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.setterName}: ${stat._count} leads`)
    })

    // Moltas specific stats
    const moltasLeads = await prisma.adversusLead.count({
      where: { setterName: 'Moltas Roslund' }
    })
    console.log(`\n🎯 Moltas Roslund total: ${moltasLeads} success leads`)

    // Admin status breakdown
    const adminStatusBreakdown = await prisma.adversusLead.groupBy({
      by: ['adminStatus'],
      _count: true
    })

    console.log('\n📋 Admin Status Breakdown:')
    adminStatusBreakdown.forEach(stat => {
      console.log(`  ${stat.adminStatus}: ${stat._count} leads`)
    })

    // Success status breakdown
    const successStatusBreakdown = await prisma.adversusLead.groupBy({
      by: ['successStatus'],
      _count: true
    })

    console.log('\n✅ Success Status Breakdown:')
    successStatusBreakdown.forEach(stat => {
      console.log(`  ${stat.successStatus || 'null'}: ${stat._count} leads`)
    })

    // Company (Bolag) analysis
    const leadsWithBolag = await prisma.adversusLead.findMany({
      select: {
        bolag1: true,
        bolag2: true,
        bolag3: true,
        bolag4: true
      }
    })

    const companies = new Set<string>()
    leadsWithBolag.forEach(lead => {
      if (lead.bolag1) companies.add(lead.bolag1)
      if (lead.bolag2) companies.add(lead.bolag2)
      if (lead.bolag3) companies.add(lead.bolag3)
      if (lead.bolag4) companies.add(lead.bolag4)
    })

    console.log(`\n🏢 Unique companies found: ${companies.size}`)
    if (companies.size > 0) {
      console.log('Top companies:')
      const companyArray = Array.from(companies)
      companyArray.slice(0, 10).forEach((company, index) => {
        console.log(`  ${index + 1}. ${company}`)
      })
    }

    // Date range
    const oldestLead = await prisma.adversusLead.findFirst({
      orderBy: { bookedAt: 'asc' },
      select: { bookedAt: true }
    })

    const newestLead = await prisma.adversusLead.findFirst({
      orderBy: { bookedAt: 'desc' },
      select: { bookedAt: true }
    })

    if (oldestLead && newestLead) {
      console.log(`\n📅 Date Range:`)
      console.log(`  Oldest lead: ${oldestLead.bookedAt.toISOString().split('T')[0]}`)
      console.log(`  Newest lead: ${newestLead.bookedAt.toISOString().split('T')[0]}`)
    }

    // Users count
    const totalUsers = await prisma.user.count()
    const activeSetters = await prisma.user.count({
      where: { role: 'SETTER', active: true }
    })

    console.log(`\n👤 Users:`)
    console.log(`  Total users: ${totalUsers}`)
    console.log(`  Active setters: ${activeSetters}`)

    console.log('\n' + '═'.repeat(60))
    console.log('✅ Database summary complete!')

  } catch (error) {
    console.error('💥 Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

databaseSummary().catch(console.error)