// UI Text Constants for Swedish Solar Commission System
export const UI_TEXT = {
  // Dashboard
  DASHBOARD_TITLE: 'Provisionspanel',
  ADMIN_DASHBOARD: 'Admin Dashboard',
  WELCOME_MESSAGE: 'Välkommen till ProffsKontakt',

  // Commission Types
  BASE_BONUS: 'Grundbonus',
  OFFERT_COMMISSION: 'Offert Provision',
  PLATSBESOK_COMMISSION: 'Platsbesök Provision',

  // Status Messages
  APPROVED: 'Godkänt',
  PENDING: 'Väntande',
  REJECTED: 'Underkänt',
  CREDITED: 'Krediterad',

  // Time Periods
  THIS_MONTH: 'Denna månad',
  LAST_MONTH: 'Förra månaden',
  THIS_YEAR: 'Detta år',

  // Filters
  FILTER_BY_MONTH: 'Filtrera per månad',
  FILTER_BY_STAGE: 'Filtrera per stadier',
  KLAR_OCH_UTSKICKAD: 'Klar och utskickad',

  // Actions
  TRANSCRIBE: 'Transkribera',
  AI_ANALYSIS: 'AI-analys',
  REVIEW: 'Granska',
  APPROVE: 'Godkänn',
  REJECT: 'Underkänn',

  // Commission Calculations
  COMMISSION_TOTAL: 'Total Provision',
  INDIVIDUAL_COMMISSION: 'Individuell Provision',
  MONTHLY_GOAL: 'Månadsmål',

  // Lead Management
  LEAD_SHARED: 'Lead delad',
  CREDIT_WINDOW: '14-dagars kreditfönster',
  COMPANY_CREDITED: 'Bolag krediterat',

  // User Roles
  ADMIN_ROLE: 'Admin',
  MANAGER_ROLE: 'Manager',
  SETTER_ROLE: 'Setter',

  // Errors
  ERROR_LOADING: 'Fel vid laddning',
  ERROR_SAVING: 'Fel vid sparande',
  ERROR_UNAUTHORIZED: 'Ej behörig',

  // Success Messages
  SUCCESS_SAVED: 'Sparat framgångsrikt',
  SUCCESS_APPROVED: 'Godkänt framgångsrikt',
  SUCCESS_REJECTED: 'Underkänt framgångsrikt'
} as const

// Commission Rules
export const COMMISSION_RATES = {
  BASE_BONUS: 100,
  OFFERT_RATE: 100,
  PLATSBESOK_RATE: 300
} as const

// Business Rules
export const BUSINESS_RULES = {
  CREDIT_WINDOW_DAYS: 14,
  MIN_CALL_DURATION_SECONDS: 60,
  MAX_COMPANIES_PER_LEAD: 4
} as const

// Lead Stages
export const LEAD_STAGES = [
  'Ny Lead',
  'Kontaktad',
  'Intresserad',
  'Offert',
  'Platsbesök',
  'Klar och utskickad',
  'Vunnen',
  'Förlorad'
] as const

// Company Pools
export const COMPANY_POOLS = [
  'Stockholm',
  'Göteborg',
  'Malmö',
  'Uppsala',
  'Västerås',
  'Örebro',
  'Linköping',
  'Helsingborg'
] as const