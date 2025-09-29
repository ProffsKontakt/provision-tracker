import fetch from 'node-fetch'
import * as fs from 'fs'

// Correct Adversus API configuration
const ADVERSUS_BASE_URL = 'https://api.adversus.dk/v1'
const ADVERSUS_USERNAME = process.env.ADVERSUS_USERNAME || 'Provisions_tracker'
const ADVERSUS_PASSWORD = process.env.ADVERSUS_PASSWORD || '4ok0yxyb652c4kg8oo8oc88o4'

async function deepAnalyzeAdversus() {
  console.log('🔬 Deep Analysis of Adversus Data Structure\n')

  const authString = Buffer.from(`${ADVERSUS_USERNAME}:${ADVERSUS_PASSWORD}`).toString('base64')

  try {
    // Fetch leads with detailed analysis
    console.log('📊 Fetching leads for deep analysis...')

    const response = await fetch(
      `${ADVERSUS_BASE_URL}/leads?per_page=10`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const leads = data.data || data

    if (!Array.isArray(leads) || leads.length === 0) {
      console.log('❌ No leads found')
      return
    }

    console.log(`✅ Fetched ${leads.length} leads for analysis\n`)

    // Analyze the first few leads in detail
    for (let i = 0; i < Math.min(3, leads.length); i++) {
      console.log(`\n═══════════════════════════════════════════════`)
      console.log(`📋 LEAD ${i + 1} DETAILED ANALYSIS`)
      console.log(`═══════════════════════════════════════════════\n`)

      const lead = leads[i]

      // Basic info
      console.log('📌 Basic Information:')
      console.log(`   ID: ${lead.id}`)
      console.log(`   Campaign ID: ${lead.campaignId}`)
      console.log(`   Status: ${lead.status}`)
      console.log(`   Active: ${lead.active}`)
      console.log(`   Created: ${lead.created}`)
      console.log(`   Last Contact By: ${lead.lastContactedBy || 'N/A'}`)

      // Master Data Analysis
      if (lead.masterData) {
        console.log('\n📊 Master Data Fields:')
        analyzeMasterData(lead.masterData)
      }

      // Result Data Analysis
      if (lead.resultData) {
        console.log('\n⭐ Result Data Fields:')
        analyzeResultData(lead.resultData)
      }

      // Look for Bolag fields in all data
      console.log('\n🏢 Company (Bolag) Fields Search:')
      findBolagInAllData(lead)

      // Look for agent/setter information
      console.log('\n👤 Agent/Setter Information:')
      findAgentInfo(lead)

      // Look for success markers
      console.log('\n✅ Success Markers:')
      findSuccessMarkers(lead)
    }

    // Now search for patterns across all leads
    console.log('\n\n═══════════════════════════════════════════════')
    console.log('📊 PATTERN ANALYSIS ACROSS ALL LEADS')
    console.log('═══════════════════════════════════════════════\n')

    analyzePatterns(leads)

    // Save detailed analysis to file
    const analysisData = {
      timestamp: new Date().toISOString(),
      totalLeads: leads.length,
      sampleLeads: leads.slice(0, 5),
      fieldAnalysis: analyzeAllFields(leads)
    }

    fs.writeFileSync(
      'adversus-deep-analysis.json',
      JSON.stringify(analysisData, null, 2)
    )
    console.log('\n📁 Detailed analysis saved to adversus-deep-analysis.json')

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

function analyzeMasterData(masterData: any) {
  if (!masterData) {
    console.log('   No master data')
    return
  }

  Object.entries(masterData).forEach(([key, value]) => {
    // Special handling for important fields
    if (key.toLowerCase().includes('name') ||
        key.toLowerCase().includes('phone') ||
        key.toLowerCase().includes('email') ||
        key.toLowerCase().includes('address')) {
      console.log(`   ${key}: ${JSON.stringify(value)}`)
    }

    // Look for Bolag fields
    if (key.toLowerCase().includes('bolag') ||
        key.toLowerCase().includes('company') ||
        key.toLowerCase().includes('företag') ||
        key.match(/^(bolag_?\d|company_?\d)/i)) {
      console.log(`   🏢 ${key}: ${JSON.stringify(value)}`)
    }

    // Look for agent/setter fields
    if (key.toLowerCase().includes('agent') ||
        key.toLowerCase().includes('setter') ||
        key.toLowerCase().includes('opener')) {
      console.log(`   👤 ${key}: ${JSON.stringify(value)}`)
    }
  })
}

function analyzeResultData(resultData: any) {
  if (!resultData) {
    console.log('   No result data')
    return
  }

  Object.entries(resultData).forEach(([key, value]) => {
    // Look for status/success indicators
    if (key.toLowerCase().includes('status') ||
        key.toLowerCase().includes('success') ||
        key.toLowerCase().includes('result')) {
      console.log(`   ${key}: ${JSON.stringify(value)}`)
    }

    // Look for Bolag fields in results
    if (key.toLowerCase().includes('bolag') ||
        key.match(/^(bolag_?\d)/i)) {
      console.log(`   🏢 ${key}: ${JSON.stringify(value)}`)
    }
  })
}

function findBolagInAllData(lead: any, prefix = '') {
  const bolagFields: any[] = []

  function search(obj: any, path: string) {
    if (!obj || typeof obj !== 'object') return

    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key

      // Check for Bolag patterns
      if (key.match(/bolag/i) ||
          key.match(/^bolag_?\d/i) ||
          key.match(/company_?\d/i) ||
          (typeof value === 'string' && value.match(/bolag/i))) {
        bolagFields.push({ path: fullPath, value })
      }

      // Recurse
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        search(value, fullPath)
      }
    })
  }

  search(lead, '')

  if (bolagFields.length > 0) {
    bolagFields.forEach(field => {
      console.log(`   Found: ${field.path} = ${JSON.stringify(field.value)}`)
    })
  } else {
    console.log('   No Bolag fields found')
  }
}

function findAgentInfo(lead: any) {
  const agentFields: any[] = []

  function search(obj: any, path: string) {
    if (!obj || typeof obj !== 'object') return

    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key

      // Check for agent/setter patterns
      if (key.match(/agent/i) ||
          key.match(/setter/i) ||
          key.match(/opener/i) ||
          key === 'lastContactedBy' ||
          (typeof value === 'string' && (value.includes('Moltas') || value.includes('moltas')))) {
        agentFields.push({ path: fullPath, value })
      }

      // Recurse
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        search(value, fullPath)
      }
    })
  }

  search(lead, '')

  if (agentFields.length > 0) {
    agentFields.forEach(field => {
      console.log(`   Found: ${field.path} = ${JSON.stringify(field.value)}`)
    })
  } else {
    console.log('   No agent fields found')
  }
}

function findSuccessMarkers(lead: any) {
  const successFields: any[] = []

  function search(obj: any, path: string) {
    if (!obj || typeof obj !== 'object') return

    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key

      // Check for success patterns
      if (key.match(/success/i) ||
          key.match(/status/i) ||
          key.match(/result/i) ||
          (typeof value === 'string' &&
           (value.toLowerCase() === 'success' ||
            value.toLowerCase() === 'successful' ||
            value.toLowerCase() === 'completed' ||
            value.toLowerCase() === 'godkänd'))) {
        successFields.push({ path: fullPath, value })
      }

      // Recurse
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        search(value, fullPath)
      }
    })
  }

  search(lead, '')

  if (successFields.length > 0) {
    successFields.forEach(field => {
      console.log(`   Found: ${field.path} = ${JSON.stringify(field.value)}`)
    })
  } else {
    console.log('   No success markers found')
  }
}

function analyzePatterns(leads: any[]) {
  // Collect all unique field paths
  const allFieldPaths = new Set<string>()
  const fieldValues = new Map<string, Set<string>>()

  leads.forEach(lead => {
    collectFieldPaths(lead, '', allFieldPaths, fieldValues)
  })

  console.log('📝 Unique Field Paths Found:')
  const sortedPaths = Array.from(allFieldPaths).sort()

  // Filter for interesting paths
  const interestingPaths = sortedPaths.filter(path =>
    path.match(/bolag/i) ||
    path.match(/company/i) ||
    path.match(/agent/i) ||
    path.match(/setter/i) ||
    path.match(/opener/i) ||
    path.match(/status/i) ||
    path.match(/success/i)
  )

  if (interestingPaths.length > 0) {
    console.log('\n🎯 Relevant Fields:')
    interestingPaths.forEach(path => {
      const values = fieldValues.get(path)
      if (values && values.size > 0) {
        const sampleValues = Array.from(values).slice(0, 5)
        console.log(`   ${path}:`)
        console.log(`     Sample values: ${sampleValues.join(', ')}`)
      }
    })
  }

  // Look for Moltas in any field
  console.log('\n🔍 Searching for "Moltas" in all field values...')
  let moltasFound = false
  fieldValues.forEach((values, path) => {
    values.forEach(value => {
      if (value.toLowerCase().includes('moltas')) {
        console.log(`   ✅ Found "Moltas" in ${path}: ${value}`)
        moltasFound = true
      }
    })
  })

  if (!moltasFound) {
    console.log('   ❌ "Moltas" not found in any field')
  }
}

function collectFieldPaths(obj: any, path: string, paths: Set<string>, values: Map<string, Set<string>>) {
  if (!obj || typeof obj !== 'object') return

  Object.entries(obj).forEach(([key, value]) => {
    const fullPath = path ? `${path}.${key}` : key
    paths.add(fullPath)

    // Collect string values
    if (typeof value === 'string' && value.trim() !== '') {
      if (!values.has(fullPath)) {
        values.set(fullPath, new Set())
      }
      values.get(fullPath)!.add(value)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      if (!values.has(fullPath)) {
        values.set(fullPath, new Set())
      }
      values.get(fullPath)!.add(String(value))
    }

    // Recurse
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      collectFieldPaths(value, fullPath, paths, values)
    }
  })
}

function analyzeAllFields(leads: any[]) {
  const fieldAnalysis: any = {
    totalLeads: leads.length,
    uniqueFieldPaths: new Set<string>(),
    fieldFrequency: new Map<string, number>(),
    sampleValues: new Map<string, any[]>()
  }

  leads.forEach(lead => {
    analyzeFieldsRecursive(lead, '', fieldAnalysis)
  })

  return {
    totalLeads: fieldAnalysis.totalLeads,
    uniqueFieldCount: fieldAnalysis.uniqueFieldPaths.size,
    topFields: Array.from(fieldAnalysis.fieldFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([path, count]) => ({
        path,
        frequency: count,
        sampleValues: fieldAnalysis.sampleValues.get(path)?.slice(0, 3)
      }))
  }
}

function analyzeFieldsRecursive(obj: any, path: string, analysis: any) {
  if (!obj || typeof obj !== 'object') return

  Object.entries(obj).forEach(([key, value]) => {
    const fullPath = path ? `${path}.${key}` : key

    analysis.uniqueFieldPaths.add(fullPath)

    // Update frequency
    const currentCount = analysis.fieldFrequency.get(fullPath) || 0
    analysis.fieldFrequency.set(fullPath, currentCount + 1)

    // Collect sample values
    if (value !== null && value !== undefined && value !== '') {
      if (!analysis.sampleValues.has(fullPath)) {
        analysis.sampleValues.set(fullPath, [])
      }
      const samples = analysis.sampleValues.get(fullPath)
      if (samples.length < 5 && !samples.includes(value)) {
        samples.push(value)
      }
    }

    // Recurse
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      analyzeFieldsRecursive(value, fullPath, analysis)
    }
  })
}

// Run the analysis
deepAnalyzeAdversus().catch(console.error)