/**
 * Source Governance Configuration
 * 
 * Defines the allowlist + tiers for authority sources.
 * Tier A: Primary law (preferred for black letter rules)
 * Tier B: Secondary commentary (allowed for explanation, not sole support)
 * Tier C: Restricted (no verbatim unless explicit license)
 */

export type SourceTier = 'A' | 'B' | 'C';
export type SourceType = 'CASE' | 'STATUTE' | 'REGULATION' | 'ARTICLE' | 'TEXTBOOK' | 'OTHER';
export type LicenseTag = 'PUBLIC_LEGAL_TEXT' | 'CC_BY_SA' | 'RESTRICTED' | 'UNKNOWN';

export interface AllowedDomain {
  domain: string;
  patterns?: RegExp[]; // Additional URL patterns for matching
  tier: SourceTier;
  license: LicenseTag;
  allowVerbatim: boolean;
  jurisdiction?: string[];
  description: string;
}

export interface SourcePolicy {
  maxVerbatimChars: number;
  requirePinpoint: boolean;
  editorialCopyForbidden: boolean;
}

// ============================================
// TIER A: PRIMARY LAW (Preferred for rules)
// ============================================

const TIER_A_DOMAINS: AllowedDomain[] = [
  // Kenya
  {
    domain: 'kenyalaw.org',
    patterns: [/new\.kenyalaw\.org/, /kenyalaw\.org/],
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Kenya'],
    description: 'Kenya Law Reports - Official case law and legislation',
  },
  {
    domain: 'parliament.go.ke',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Kenya'],
    description: 'Kenya Parliament - Bills and Acts',
  },
  {
    domain: 'judiciary.go.ke',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Kenya'],
    description: 'Kenya Judiciary - Official court documents',
  },
  {
    domain: 'sheriaplex.com',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Kenya'],
    description: 'SheriaPlex - Kenya legal information platform',
  },
  // UK (relevant for common law heritage)
  {
    domain: 'bailii.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['UK', 'Commonwealth'],
    description: 'BAILII - British and Irish Legal Information Institute',
  },
  {
    domain: 'legislation.gov.uk',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['UK'],
    description: 'UK Government Legislation',
  },
  // Commonwealth Legal Institutes
  {
    domain: 'saflii.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['South Africa', 'Commonwealth'],
    description: 'SAFLII - Southern African Legal Information Institute',
  },
  {
    domain: 'canlii.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Canada', 'Commonwealth'],
    description: 'CanLII - Canadian Legal Information Institute',
  },
  {
    domain: 'austlii.edu.au',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Australia', 'Commonwealth'],
    description: 'AustLII - Australian Legal Information Institute',
  },
  {
    domain: 'nzlii.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['New Zealand', 'Commonwealth'],
    description: 'NZLII - New Zealand Legal Information Institute',
  },
  {
    domain: 'eacj.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['East Africa'],
    description: 'East African Court of Justice',
  },
  {
    domain: 'african-court.org',
    tier: 'A',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true,
    jurisdiction: ['Africa', 'AU'],
    description: 'African Court on Human and Peoples\' Rights',
  },
];

// ============================================
// TIER B: SECONDARY (Commentary, not sole support)
// ============================================

const TIER_B_DOMAINS: AllowedDomain[] = [
  {
    domain: 'papers.ssrn.com',
    tier: 'B',
    license: 'CC_BY_SA',
    allowVerbatim: false, // Must paraphrase
    description: 'SSRN - Academic legal papers',
  },
  {
    domain: 'jurist.org',
    tier: 'B',
    license: 'CC_BY_SA',
    allowVerbatim: false,
    description: 'JURIST - Legal news and commentary',
  },
  {
    domain: 'law.cornell.edu',
    tier: 'B',
    license: 'PUBLIC_LEGAL_TEXT',
    allowVerbatim: true, // LII is generally open
    jurisdiction: ['USA'],
    description: 'Cornell LII - Legal Information Institute',
  },
  {
    domain: 'journals.cambridge.org',
    tier: 'B',
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'Cambridge Journals - Academic journals',
  },
  {
    domain: 'oxfordjournals.org',
    tier: 'B',  
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'Oxford Journals - Academic journals',
  },
  // Reputable Kenya law firms (commentary only)
  {
    domain: 'bowmanslaw.com',
    tier: 'B',
    license: 'UNKNOWN',
    allowVerbatim: false,
    jurisdiction: ['Kenya', 'Africa'],
    description: 'Bowmans Law - Law firm briefings',
  },
  {
    domain: 'oraro.co.ke',
    tier: 'B',
    license: 'UNKNOWN',
    allowVerbatim: false,
    jurisdiction: ['Kenya'],
    description: 'Oraro & Company - Law firm briefings',
  },
  {
    domain: 'tripleoklaw.com',
    tier: 'B',
    license: 'UNKNOWN',
    allowVerbatim: false,
    jurisdiction: ['Kenya'],
    description: 'Triple OK Law - Law firm briefings',
  },
];

// ============================================
// TIER C: RESTRICTED (No verbatim without license)
// ============================================

const TIER_C_DOMAINS: AllowedDomain[] = [
  {
    domain: 'westlaw.com',
    tier: 'C',
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'Westlaw - Paid legal database (headnotes copyrighted)',
  },
  {
    domain: 'lexisnexis.com',
    tier: 'C',
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'LexisNexis - Paid legal database',
  },
  {
    domain: 'practicallaw.com',
    tier: 'C',
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'Practical Law - Thomson Reuters',
  },
  {
    domain: 'kluwerlawonline.com',
    tier: 'C',
    license: 'RESTRICTED',
    allowVerbatim: false,
    description: 'Kluwer Law - Paid database',
  },
];

// ============================================
// COMBINED ALLOWLIST
// ============================================

export const ALLOWED_DOMAINS: AllowedDomain[] = [
  ...TIER_A_DOMAINS,
  ...TIER_B_DOMAINS,
  ...TIER_C_DOMAINS,
];

// ============================================
// SOURCE POLICIES BY TIER
// ============================================

export const SOURCE_POLICIES: Record<SourceTier, SourcePolicy> = {
  A: {
    maxVerbatimChars: 2000, // Allow longer quotes from primary law
    requirePinpoint: true,
    editorialCopyForbidden: false, // Can quote holdings verbatim
  },
  B: {
    maxVerbatimChars: 300, // Limited quotes from commentary
    requirePinpoint: true,
    editorialCopyForbidden: true, // No copying commentary verbatim
  },
  C: {
    maxVerbatimChars: 0, // No verbatim copying
    requirePinpoint: true,
    editorialCopyForbidden: true, // Paraphrase only with citation
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a URL is from an allowed domain
 */
export function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(d => 
      hostname.includes(d.domain) || 
      d.patterns?.some(p => p.test(url))
    );
  } catch {
    return false;
  }
}

/**
 * Get domain info for a URL
 */
export function getDomainInfo(url: string): AllowedDomain | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_DOMAINS.find(d => 
      hostname.includes(d.domain) ||
      d.patterns?.some(p => p.test(url))
    ) || null;
  } catch {
    return null;
  }
}

/**
 * Check if verbatim quoting is allowed for a URL
 */
export function canQuoteVerbatim(url: string, licenseOverride?: LicenseTag): boolean {
  const info = getDomainInfo(url);
  if (!info) return false;
  
  // License override (e.g., admin marked as safe)
  if (licenseOverride === 'PUBLIC_LEGAL_TEXT' || licenseOverride === 'CC_BY_SA') {
    return true;
  }
  
  return info.allowVerbatim;
}

/**
 * Get source tier for a URL
 */
export function getSourceTier(url: string): SourceTier | null {
  const info = getDomainInfo(url);
  return info?.tier || null;
}

/**
 * Get policy for a URL
 */
export function getSourcePolicy(url: string): SourcePolicy | null {
  const tier = getSourceTier(url);
  return tier ? SOURCE_POLICIES[tier] : null;
}

/**
 * Validate a source URL against governance rules
 */
export function validateSource(url: string): {
  valid: boolean;
  tier: SourceTier | null;
  allowVerbatim: boolean;
  reason?: string;
} {
  if (!isAllowedDomain(url)) {
    return {
      valid: false,
      tier: null,
      allowVerbatim: false,
      reason: 'Domain not in allowlist',
    };
  }

  const info = getDomainInfo(url)!;
  return {
    valid: true,
    tier: info.tier,
    allowVerbatim: info.allowVerbatim,
  };
}

/**
 * Check if domain is Tier A (primary law)
 */
export function isTierAPrimary(url: string): boolean {
  return getSourceTier(url) === 'A';
}

/**
 * Get Kenya-specific primary sources
 */
export function getKenyaPrimarySources(): AllowedDomain[] {
  return TIER_A_DOMAINS.filter(d => 
    d.jurisdiction?.includes('Kenya') || d.jurisdiction?.includes('East Africa')
  );
}

/**
 * Build search query suggestions for Kenya Law
 */
export function buildKenyaLawSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `http://kenyalaw.org/caselaw/cases/view/?query=${encoded}`;
}

// ============================================
// GROUNDING RULES
// ============================================

export const GROUNDING_RULES = {
  /**
   * For "black letter" rule statements, require Tier A source
   */
  ruleStatementRequiresTierA: true,

  /**
   * Tier B can support explanation but not sole authority
   */
  tierBCanSupportOnly: true,

  /**
   * Minimum evidence spans per substantive claim
   */
  minEvidencePerClaim: 1,

  /**
   * Minimum citation count per asset item (unless instruction-only)
   */
  minCitationCount: 1,

  /**
   * Fallback message when no grounding found
   */
  fallbackMessage: 'Not found in verified sources yet',

  /**
   * Whether to log missing authorities
   */
  logMissingAuthorities: true,

  /**
   * Max age for cached authority (days)
   */
  maxAuthorityAgeDays: 90,
};

export default {
  ALLOWED_DOMAINS,
  SOURCE_POLICIES,
  GROUNDING_RULES,
  isAllowedDomain,
  getDomainInfo,
  canQuoteVerbatim,
  getSourceTier,
  getSourcePolicy,
  validateSource,
  isTierAPrimary,
  getKenyaPrimarySources,
  buildKenyaLawSearchUrl,
};
