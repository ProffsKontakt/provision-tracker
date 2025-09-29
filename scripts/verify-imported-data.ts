import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function verifyImportedData() {
  try {
    console.log('🔍 Verifying imported Adversus leads data...\n')

    // Get Moltas's imported leads
    const moltas = await prisma.user.findFirst({
      where: { name: 'Moltas Roslund' }
    })

    if (!moltas) {
      console.error('❌ Moltas Roslund not found in database')
      return
    }

    const leads = await prisma.adversusLead.findMany({
      where: { setterId: moltas.adversusAgentId },
      orderBy: { bookedAt: 'desc' },
      include: {
        setter: {
          select: { name: true, openerName: true }
        }
      }
    })

    console.log(`📊 Found ${leads.length} imported leads for ${moltas.name}\n`)

    // Data integrity checks
    const validationResults = {
      totalLeads: leads.length,
      hasCustomerInfo: 0,
      hasCompanyAssignments: 0,
      hasAddressInfo: 0,
      hasValidStatus: 0,
      hasSuccessMarking: 0,
      approvedByAdmin: 0,
      pendingReview: 0,
      withMultipleCompanies: 0,
      validPhoneNumbers: 0,
      validEmails: 0
    }

    // Detailed analysis of each lead
    console.log('📋 Lead Details:')
    console.log('================')

    leads.forEach((lead, index) => {
      console.log(`\n${index + 1}. ${lead.customerName}`)
      console.log(`   📞 Phone: ${lead.customerPhone}`)
      console.log(`   📧 Email: ${lead.customerEmail || 'N/A'}`)
      console.log(`   📅 Appointment: ${lead.appointmentDate.toLocaleDateString('sv-SE')}`)
      console.log(`   🏠 Property: ${lead.propertyType || 'N/A'}`)
      console.log(`   📍 Address: ${lead.streetAddress ? `${lead.streetAddress}, ${lead.city}` : 'N/A'}`)
      console.log(`   ⭐ Status: ${lead.adminStatus} (Adversus: ${lead.adversusStatus})`)

      // Company assignments
      const companies = []
      if (lead.bolag1) companies.push(`${lead.bolag1} (${lead.bolag1LeadType})`)
      if (lead.bolag2) companies.push(`${lead.bolag2} (${lead.bolag2LeadType})`)
      if (lead.bolag3) companies.push(`${lead.bolag3} (${lead.bolag3LeadType})`)
      if (lead.bolag4) companies.push(`${lead.bolag4} (${lead.bolag4LeadType})`)

      console.log(`   🏢 Companies: ${companies.length > 0 ? companies.join(', ') : 'None'}`)

      if (lead.energyInterest && Array.isArray(lead.energyInterest)) {
        console.log(`   ⚡ Interests: ${lead.energyInterest.join(', ')}`)
      }

      // Validation checks
      if (lead.customerName && lead.customerPhone) validationResults.hasCustomerInfo++
      if (lead.bolag1) validationResults.hasCompanyAssignments++
      if (lead.streetAddress && lead.city) validationResults.hasAddressInfo++
      if (['pending', 'approved', 'rejected'].includes(lead.adminStatus)) validationResults.hasValidStatus++
      if (lead.successStatus === 'success') validationResults.hasSuccessMarking++
      if (lead.adminStatus === 'approved') validationResults.approvedByAdmin++
      if (lead.adminStatus === 'pending') validationResults.pendingReview++
      if (companies.length > 1) validationResults.withMultipleCompanies++
      if (lead.customerPhone && lead.customerPhone.startsWith('+46')) validationResults.validPhoneNumbers++
      if (lead.customerEmail && lead.customerEmail.includes('@')) validationResults.validEmails++
    })

    // Summary statistics
    console.log('\n📈 Data Validation Summary:')
    console.log('============================')
    console.log(`✅ Total leads imported: ${validationResults.totalLeads}`)
    console.log(`👤 Complete customer info: ${validationResults.hasCustomerInfo}/${validationResults.totalLeads}`)
    console.log(`🏢 Has company assignments: ${validationResults.hasCompanyAssignments}/${validationResults.totalLeads}`)
    console.log(`📍 Has address information: ${validationResults.hasAddressInfo}/${validationResults.totalLeads}`)
    console.log(`📞 Valid phone numbers: ${validationResults.validPhoneNumbers}/${validationResults.totalLeads}`)
    console.log(`📧 Valid email addresses: ${validationResults.validEmails}/${validationResults.totalLeads}`)
    console.log(`⭐ Marked as successful: ${validationResults.hasSuccessMarking}/${validationResults.totalLeads}`)
    console.log(`✅ Approved by admin: ${validationResults.approvedByAdmin}`)
    console.log(`⏳ Pending review: ${validationResults.pendingReview}`)
    console.log(`🏢 Multiple company assignments: ${validationResults.withMultipleCompanies}`)

    // Data quality percentage
    const dataQualityScore = Math.round((
      (validationResults.hasCustomerInfo +
       validationResults.hasCompanyAssignments +
       validationResults.hasValidStatus +
       validationResults.hasSuccessMarking) /
      (validationResults.totalLeads * 4)
    ) * 100)

    console.log(`\n🎯 Overall Data Quality Score: ${dataQualityScore}%`)

    // Check system logs for import records
    const importLogs = await prisma.systemLog.findMany({
      where: {
        type: 'adversus_import',
        message: { contains: 'Moltas' }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log('\n📝 Recent Import Logs:')
    console.log('=======================')
    importLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.createdAt.toISOString()}: ${log.message}`)
      if (log.data) {
        const data = log.data as any
        if (data.imported) console.log(`   ✅ Imported: ${data.imported}`)
        if (data.skipped) console.log(`   ⏭️  Skipped: ${data.skipped}`)
        if (data.errors) console.log(`   ❌ Errors: ${data.errors}`)
      }
    })

    // Validate field mappings match expected Adversus schema
    console.log('\n🗺️  Field Mapping Validation:')
    console.log('==============================')

    const sampleLead = leads[0]
    if (sampleLead) {
      console.log('✅ Required fields present:')
      console.log(`   - adversusId: ${sampleLead.adversusId ? '✅' : '❌'}`)
      console.log(`   - setterId: ${sampleLead.setterId ? '✅' : '❌'}`)
      console.log(`   - setterName: ${sampleLead.setterName ? '✅' : '❌'}`)
      console.log(`   - customerName: ${sampleLead.customerName ? '✅' : '❌'}`)
      console.log(`   - customerPhone: ${sampleLead.customerPhone ? '✅' : '❌'}`)
      console.log(`   - appointmentDate: ${sampleLead.appointmentDate ? '✅' : '❌'}`)
      console.log(`   - bookedAt: ${sampleLead.bookedAt ? '✅' : '❌'}`)

      console.log('\n✅ Optional fields structure:')
      console.log(`   - customFields: ${sampleLead.customFields ? '✅ JSON' : '❌'}`)
      console.log(`   - adversusData: ${sampleLead.adversusData ? '✅ JSON' : '❌'}`)
      console.log(`   - energyInterest: ${sampleLead.energyInterest ? '✅ Array' : '❌'}`)
    }

    console.log('\n🎉 Data verification completed successfully!')

  } catch (error) {
    console.error('💥 Verification failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run verification
verifyImportedData().catch(console.error)