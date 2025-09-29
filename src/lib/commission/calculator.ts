import { COMMISSION_RATES } from '@/config/constants'

// Commission calculation utilities for Swedish Solar Business Logic

export interface CommissionCalculation {
  baseBonus: number
  offertCommissions: number
  platsbesokCommissions: number
  total: number
  breakdown: CommissionBreakdownItem[]
}

export interface CommissionBreakdownItem {
  type: 'base_bonus' | 'offert' | 'platsbesok'
  amount: number
  description: string
  companyName?: string
}

/**
 * Calculate commission for a deal based on Swedish business rules
 */
export function calculateDealCommission(
  companies: Array<{
    name: string
    leadType: 'OFFERT' | 'PLATSBESOK'
    credited?: boolean
  }>
): CommissionCalculation {
  const breakdown: CommissionBreakdownItem[] = []

  // Base bonus (100 SEK) - paid once per deal if at least one company
  const baseBonus = companies.length > 0 ? COMMISSION_RATES.BASE_BONUS : 0
  if (baseBonus > 0) {
    breakdown.push({
      type: 'base_bonus',
      amount: baseBonus,
      description: 'Grundbonus (en gång per affär)'
    })
  }

  // Calculate per-company commissions
  let offertCommissions = 0
  let platsbesokCommissions = 0

  companies.forEach(company => {
    if (company.credited) return // Skip credited companies

    if (company.leadType === 'OFFERT') {
      offertCommissions += COMMISSION_RATES.OFFERT_RATE
      breakdown.push({
        type: 'offert',
        amount: COMMISSION_RATES.OFFERT_RATE,
        description: `Offert provision`,
        companyName: company.name
      })
    } else if (company.leadType === 'PLATSBESOK') {
      platsbesokCommissions += COMMISSION_RATES.PLATSBESOK_RATE
      breakdown.push({
        type: 'platsbesok',
        amount: COMMISSION_RATES.PLATSBESOK_RATE,
        description: `Platsbesök provision`,
        companyName: company.name
      })
    }
  })

  const total = baseBonus + offertCommissions + platsbesokCommissions

  return {
    baseBonus,
    offertCommissions,
    platsbesokCommissions,
    total,
    breakdown
  }
}

/**
 * Format commission amount in Swedish Kronor
 */
export function formatCommissionSEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Calculate monthly commission for a setter
 */
export function calculateMonthlyCommission(
  deals: Array<{
    id: number
    totalCommission: number | null
    adminApproval: 'APPROVED' | 'PENDING' | 'REJECTED'
    dealCreated: Date
  }>,
  month: number,
  year: number
): {
  approved: number
  pending: number
  total: number
  dealCount: number
} {
  const monthlyDeals = deals.filter(deal => {
    const dealDate = new Date(deal.dealCreated)
    return dealDate.getMonth() === month && dealDate.getFullYear() === year
  })

  const approved = monthlyDeals
    .filter(deal => deal.adminApproval === 'APPROVED')
    .reduce((sum, deal) => sum + (deal.totalCommission || 0), 0)

  const pending = monthlyDeals
    .filter(deal => deal.adminApproval === 'PENDING')
    .reduce((sum, deal) => sum + (deal.totalCommission || 0), 0)

  return {
    approved,
    pending,
    total: approved + pending,
    dealCount: monthlyDeals.length
  }
}

/**
 * Calculate commission goal progress
 */
export function calculateGoalProgress(
  currentAmount: number,
  goalAmount: number
): {
  percentage: number
  remaining: number
  achieved: boolean
} {
  const percentage = Math.min((currentAmount / goalAmount) * 100, 100)
  const remaining = Math.max(goalAmount - currentAmount, 0)
  const achieved = currentAmount >= goalAmount

  return {
    percentage: Math.round(percentage),
    remaining,
    achieved
  }
}

/**
 * Get commission breakdown by type
 */
export function getCommissionBreakdown(
  deals: Array<{
    totalCommission: number | null
    baseBonus: number | null
    adminApproval: 'APPROVED' | 'PENDING' | 'REJECTED'
    companies: Array<{
      name: string
      leadType: 'OFFERT' | 'PLATSBESOK'
      credited?: boolean
    }>
  }>
): {
  totalBase: number
  totalOffert: number
  totalPlatsbesok: number
  totalCommission: number
} {
  const approvedDeals = deals.filter(deal => deal.adminApproval === 'APPROVED')

  let totalBase = 0
  let totalOffert = 0
  let totalPlatsbesok = 0

  approvedDeals.forEach(deal => {
    totalBase += deal.baseBonus || 0

    deal.companies.forEach(company => {
      if (company.credited) return

      if (company.leadType === 'OFFERT') {
        totalOffert += COMMISSION_RATES.OFFERT_RATE
      } else if (company.leadType === 'PLATSBESOK') {
        totalPlatsbesok += COMMISSION_RATES.PLATSBESOK_RATE
      }
    })
  })

  return {
    totalBase,
    totalOffert,
    totalPlatsbesok,
    totalCommission: totalBase + totalOffert + totalPlatsbesok
  }
}