// ============================================================
// KENYAN BAR EXAM PREP - LEGAL CONTENT CONSTANTS
// Aligned with Kenya School of Law ATP Curriculum 2024/2025
// ============================================================

// -----------------------------------------------
// ATP UNITS - Official 9 Units from Kenya School of Law
// -----------------------------------------------
export const ATP_UNITS = [
  {
    id: 'atp-100',
    code: 'ATP 100',
    name: 'Civil Litigation',
    description: 'Practice and procedure in civil courts including filing suits, interlocutory applications, discovery, trial, and enforcement of decrees.',
    icon: 'Gavel',
    statutes: [
      'Civil Procedure Act, Cap 21',
      'Civil Procedure Rules, 2010',
      'Appellate Jurisdiction Act',
      'Court of Appeal Rules',
      'Supreme Court Act & Rules',
    ],
  },
  {
    id: 'atp-101',
    code: 'ATP 101',
    name: 'Criminal Litigation',
    description: 'Criminal prosecution and defence, bail, charge, plea, trial, sentencing, and appeals in Kenyan criminal courts.',
    icon: 'Scale',
    statutes: [
      'Criminal Procedure Code, Cap 75',
      'Penal Code, Cap 63',
      'Evidence Act, Cap 80',
      'Bail and Bond Policy Guidelines',
      'Victim Protection Act, 2014',
    ],
  },
  {
    id: 'atp-102',
    code: 'ATP 102',
    name: 'Probate and Administration',
    description: 'Wills, intestate succession, grants of probate and letters of administration, and distribution of estates.',
    icon: 'FileText',
    statutes: [
      'Law of Succession Act, Cap 160',
      'Probate and Administration Rules',
      'Public Trustee Act, Cap 168',
      'Mental Health Act, 1989',
    ],
  },
  {
    id: 'atp-103',
    code: 'ATP 103',
    name: 'Legal Writing and Drafting',
    description: 'Drafting pleadings, contracts, conveyancing instruments, legal opinions, memoranda, and other legal documents.',
    icon: 'PenTool',
    statutes: [
      'Advocates Act, Cap 16',
      'Law of Contract Act, Cap 23',
      'Stamp Duty Act, Cap 480',
      'Land Registration Act, 2012',
    ],
  },
  {
    id: 'atp-104',
    code: 'ATP 104',
    name: 'Trial Advocacy',
    description: 'Courtroom skills, examination of witnesses, cross-examination, oral submissions, and presentation of evidence.',
    icon: 'Mic',
    statutes: [
      'Evidence Act, Cap 80',
      'Advocates Act, Cap 16',
      'Civil Procedure Rules, 2010',
      'Criminal Procedure Code, Cap 75',
    ],
  },
  {
    id: 'atp-105',
    code: 'ATP 105',
    name: 'Professional Ethics',
    description: 'Advocate-client relationship, conflict of interest, fees, trust accounts, professional misconduct, and disciplinary proceedings.',
    icon: 'Shield',
    statutes: [
      'Advocates Act, Cap 16',
      'Advocates (Accounts) Rules',
      'Advocates (Practice) Rules',
      'Advocates (Complaints Handling Commission) Rules',
      'LSK Code of Standards of Professional Practice and Ethical Conduct',
    ],
  },
  {
    id: 'atp-106',
    code: 'ATP 106',
    name: 'Legal Practice Management',
    description: 'Law firm operations, client management, billing, legal technology, office administration, and business development.',
    icon: 'Briefcase',
    statutes: [
      'Advocates Act, Cap 16',
      'Advocates (Accounts) Rules',
      'Data Protection Act, 2019',
      'Companies Act, 2015',
    ],
  },
  {
    id: 'atp-107',
    code: 'ATP 107',
    name: 'Conveyancing',
    description: 'Land transactions, registration, transfer, charging, leasing, and related conveyancing procedures.',
    icon: 'Building',
    statutes: [
      'Land Act, 2012',
      'Land Registration Act, 2012',
      'Sectional Properties Act, 2020',
      'Stamp Duty Act, Cap 480',
      'Physical and Land Use Planning Act, 2019',
      'National Land Commission Act, 2012',
    ],
  },
  {
    id: 'atp-108',
    code: 'ATP 108',
    name: 'Commercial Transactions',
    description: 'Sale of goods, hire purchase, partnerships, agency, insurance, negotiable instruments, and banking law.',
    icon: 'TrendingUp',
    statutes: [
      'Sale of Goods Act, Cap 31',
      'Hire Purchase Act, Cap 507',
      'Partnership Act, Cap 29',
      'Insurance Act, Cap 487',
      'Bills of Exchange Act, Cap 27',
      'Central Bank of Kenya Act, Cap 491',
    ],
  },
] as const;

// -----------------------------------------------
// LEGAL DOCUMENT TYPES - for the Drafting module
// -----------------------------------------------
export const LEGAL_DOCUMENT_TYPES = {
  pleadings: {
    category: 'Pleadings & Court Documents',
    documents: [
      { id: 'plaint', name: 'Plaint', description: 'Originating document in a civil suit filed in the High Court or subordinate courts.' },
      { id: 'defence', name: 'Defence (Statement of Defence)', description: "Response to a plaint setting out the defendant's case." },
      { id: 'counterclaim', name: 'Counterclaim', description: 'A claim by the defendant against the plaintiff within the same suit.' },
      { id: 'reply-to-defence', name: 'Reply to Defence', description: "Plaintiff's response to new matters raised in the defence." },
      { id: 'petition', name: 'Petition', description: 'Originating document used in constitutional petitions, election petitions, and winding-up.' },
      { id: 'originating-summons', name: 'Originating Summons', description: 'Used to commence proceedings where there is unlikely to be a substantial dispute of fact.' },
      { id: 'chamber-summons', name: 'Chamber Summons', description: 'Application to court for interlocutory orders during pending proceedings.' },
      { id: 'notice-of-motion', name: 'Notice of Motion', description: 'Formal application to the court for an order, usually for interlocutory relief.' },
      { id: 'witness-statement', name: 'Witness Statement', description: 'Written evidence of a witness for use in civil proceedings.' },
    ],
  },
  affidavits: {
    category: 'Affidavits',
    documents: [
      { id: 'supporting-affidavit', name: 'Supporting Affidavit', description: 'Sworn statement supporting an application to court.' },
      { id: 'replying-affidavit', name: 'Replying Affidavit', description: "Sworn response to an opposing party's affidavit." },
      { id: 'supplementary-affidavit', name: 'Supplementary Affidavit', description: 'Additional sworn evidence on matters already covered.' },
      { id: 'affidavit-of-service', name: 'Affidavit of Service', description: 'Sworn proof that a document was served on a party.' },
      { id: 'statutory-declaration', name: 'Statutory Declaration', description: 'Declaration made under the Oaths and Statutory Declarations Act.' },
    ],
  },
  submissions: {
    category: 'Submissions & Arguments',
    documents: [
      { id: 'written-submissions', name: 'Written Submissions', description: 'Structured legal arguments filed before the court after hearing.' },
      { id: 'heads-of-argument', name: 'Heads of Argument', description: 'Summary points of argument used in oral advocacy.' },
      { id: 'skeleton-arguments', name: 'Skeleton Arguments', description: 'Brief outline of arguments used in appeals and complex matters.' },
    ],
  },
  contracts: {
    category: 'Contracts & Agreements',
    documents: [
      { id: 'sale-agreement', name: 'Sale Agreement', description: 'Contract for sale of goods or property between parties.' },
      { id: 'lease-agreement', name: 'Lease Agreement', description: 'Landlord-tenant agreement for use and occupation of premises.' },
      { id: 'employment-contract', name: 'Employment Contract', description: 'Agreement between employer and employee setting out terms of engagement.' },
      { id: 'partnership-deed', name: 'Partnership Deed', description: 'Agreement governing rights and obligations of business partners.' },
      { id: 'service-agreement', name: 'Service Agreement', description: 'Contract for provision of professional or commercial services.' },
      { id: 'nda', name: 'Non-Disclosure Agreement (NDA)', description: 'Confidentiality agreement between parties sharing sensitive information.' },
      { id: 'loan-agreement', name: 'Loan Agreement', description: 'Contract for lending and borrowing of money with repayment terms.' },
      { id: 'shareholders-agreement', name: 'Shareholders Agreement', description: 'Agreement among shareholders governing company management and share transfers.' },
    ],
  },
  conveyancing: {
    category: 'Conveyancing Documents',
    documents: [
      { id: 'transfer-instrument', name: 'Transfer Instrument', description: 'Document effecting transfer of registered land under the Land Registration Act.' },
      { id: 'charge-instrument', name: 'Charge Instrument', description: 'Document creating a charge (mortgage) over registered land.' },
      { id: 'discharge-of-charge', name: 'Discharge of Charge', description: 'Document releasing a charge upon satisfaction of the secured debt.' },
      { id: 'consent-to-transfer', name: 'Consent to Transfer', description: 'Application for land control board consent where required.' },
    ],
  },
  corporate: {
    category: 'Company/Corporate Documents',
    documents: [
      { id: 'memorandum-articles', name: 'Memorandum & Articles of Association', description: 'Constitutional documents of a company under the Companies Act 2015.' },
      { id: 'board-resolution', name: 'Board Resolution', description: 'Formal decision of the board of directors.' },
      { id: 'shareholder-resolution', name: 'Shareholder Resolution', description: 'Formal decision of shareholders in a general meeting or by written resolution.' },
      { id: 'minutes', name: 'Minutes of Meeting', description: 'Record of proceedings at board or shareholder meetings.' },
    ],
  },
  opinions: {
    category: 'Legal Opinions & Memoranda',
    documents: [
      { id: 'legal-opinion', name: 'Legal Opinion', description: 'Formal advice on a legal question addressed to a client.' },
      { id: 'legal-memorandum', name: 'Legal Memorandum', description: 'Internal research and analysis document within a law firm.' },
      { id: 'client-advisory', name: 'Client Advisory Letter', description: 'Letter advising a client on a legal matter and recommended course of action.' },
    ],
  },
  criminal: {
    category: 'Criminal Practice Documents',
    documents: [
      { id: 'charge-sheet', name: 'Charge Sheet', description: 'Document setting out criminal charges against an accused person.' },
      { id: 'bail-bond-application', name: 'Bail/Bond Application', description: 'Application to court for release of an accused on bail or bond.' },
      { id: 'plea-bargain', name: 'Plea Bargain Agreement', description: 'Negotiated agreement between prosecution and defence on plea and sentence.' },
      { id: 'mitigation', name: 'Mitigation', description: 'Submissions on sentencing aimed at reducing the sentence.' },
    ],
  },
  notices: {
    category: 'Notices & Correspondence',
    documents: [
      { id: 'demand-letter', name: 'Demand Letter', description: 'Formal letter demanding payment or action before litigation.' },
      { id: 'notice-to-admit', name: 'Notice to Admit Facts', description: 'Pre-trial notice requiring the other party to admit or deny facts.' },
      { id: 'notice-of-appeal', name: 'Notice of Appeal', description: 'Formal notice initiating an appeal against a court decision.' },
      { id: 'statutory-notice', name: 'Statutory Notice', description: 'Notice required by legislation before commencement of proceedings.' },
    ],
  },
} as const;

// -----------------------------------------------
// DIFFICULTY LEVELS
// -----------------------------------------------
export const DIFFICULTY_LEVELS = [
  { id: 'beginner', name: 'Beginner', description: 'Foundation level - core concepts and definitions', color: 'emerald' },
  { id: 'intermediate', name: 'Intermediate', description: 'Applied knowledge - analysis and application', color: 'amber' },
  { id: 'advanced', name: 'Advanced', description: 'Bar exam standard - complex scenarios and integration', color: 'rose' },
] as const;

// -----------------------------------------------
// QUESTION TYPES
// -----------------------------------------------
export const QUESTION_TYPES = [
  { id: 'multiple_choice', name: 'Multiple Choice', icon: 'CircleDot' },
  { id: 'essay', name: 'Essay', icon: 'FileText' },
  { id: 'case_analysis', name: 'Case Analysis', icon: 'Search' },
  { id: 'practical', name: 'Practical Application', icon: 'Hammer' },
] as const;

// -----------------------------------------------
// Flatten document types helper
// -----------------------------------------------
export function getAllDocuments() {
  return Object.values(LEGAL_DOCUMENT_TYPES).flatMap((cat) =>
    cat.documents.map((doc) => ({ ...doc, category: cat.category }))
  );
}

export function getDocumentById(id: string) {
  for (const cat of Object.values(LEGAL_DOCUMENT_TYPES)) {
    const doc = cat.documents.find((d) => d.id === id);
    if (doc) return { ...doc, category: cat.category };
  }
  return null;
}

export function getUnitById(id: string) {
  return ATP_UNITS.find((u) => u.id === id) ?? null;
}

export const DIFFICULTY_LEVELS_SIMPLE = ['beginner', 'intermediate', 'advanced'] as const;

export const QUESTION_TYPES_SIMPLE = [
  'multiple_choice',
  'essay',
  'case_analysis',
  'practical',
] as const;

// -----------------------------------------------
// TOPICS BY UNIT - Topics for each ATP unit
// -----------------------------------------------
export const TOPICS_BY_UNIT: Record<string, { id: string; name: string; description: string }[]> = {
  'atp-100': [
    { id: 'civil-jurisdiction', name: 'Jurisdiction & Venue', description: 'Courts hierarchy, territorial and pecuniary jurisdiction' },
    { id: 'civil-pleadings', name: 'Pleadings', description: 'Plaints, defences, counterclaims, and amendments' },
    { id: 'civil-interlocutory', name: 'Interlocutory Applications', description: 'Injunctions, stay orders, security for costs' },
    { id: 'civil-discovery', name: 'Discovery & Inspection', description: 'Interrogatories, discovery of documents, admissions' },
    { id: 'civil-trial', name: 'Trial & Judgment', description: 'Trial procedure, evidence, judgment and decree' },
    { id: 'civil-appeals', name: 'Appeals & Reviews', description: 'Filing appeals, grounds, stay pending appeal' },
    { id: 'civil-execution', name: 'Execution', description: 'Enforcement of decrees, attachment, garnishee orders' },
  ],
  'atp-101': [
    { id: 'criminal-procedure', name: 'Criminal Procedure Overview', description: 'Investigation, arrest, charge sheet, first appearance' },
    { id: 'criminal-bail', name: 'Bail & Bond', description: 'Types of bail, conditions, forfeiture, surety' },
    { id: 'criminal-charge', name: 'Charges & Pleas', description: 'Framing charges, plea taking, plea bargaining' },
    { id: 'criminal-trial', name: 'Criminal Trial', description: 'Prosecution evidence, defence case, submissions' },
    { id: 'criminal-sentencing', name: 'Sentencing', description: 'Sentencing guidelines, mitigation, probation' },
    { id: 'criminal-appeals', name: 'Criminal Appeals', description: 'Appeal process, grounds of appeal, revision' },
  ],
  'atp-102': [
    { id: 'prob-wills', name: 'Wills & Testaments', description: 'Execution, revocation, interpretation of wills' },
    { id: 'prob-intestate', name: 'Intestate Succession', description: 'Distribution rules, dependants, surviving spouse' },
    { id: 'prob-grants', name: 'Grants of Representation', description: 'Probate, letters of administration, resealing' },
    { id: 'prob-admin', name: 'Administration of Estates', description: 'Duties of executors/administrators, distribution' },
    { id: 'prob-disputes', name: 'Probate Disputes', description: 'Caveats, citations, contentious matters' },
  ],
  'atp-103': [
    { id: 'draft-pleadings', name: 'Pleadings Drafting', description: 'Structure, style, prayers, verification' },
    { id: 'draft-affidavits', name: 'Affidavits', description: 'Sworn statements, supporting affidavits, format' },
    { id: 'draft-contracts', name: 'Contract Drafting', description: 'Terms, conditions, boilerplate clauses' },
    { id: 'draft-conveyancing', name: 'Conveyancing Documents', description: 'Transfers, charges, leases' },
    { id: 'draft-opinions', name: 'Legal Opinions', description: 'Structure, analysis, recommendations' },
  ],
  'atp-104': [
    { id: 'trial-opening', name: 'Opening Statements', description: 'Theory of case, persuasion techniques' },
    { id: 'trial-examination', name: 'Examination-in-Chief', description: 'Leading evidence, refreshing memory' },
    { id: 'trial-cross', name: 'Cross-Examination', description: 'Techniques, impeachment, prior inconsistent statements' },
    { id: 'trial-objections', name: 'Objections', description: 'Grounds, timing, preserving record' },
    { id: 'trial-closing', name: 'Closing Arguments', description: 'Summarizing evidence, legal arguments' },
  ],
  'atp-105': [
    { id: 'ethics-relationship', name: 'Advocate-Client Relationship', description: 'Retainer, confidentiality, privilege' },
    { id: 'ethics-conflict', name: 'Conflict of Interest', description: 'Identifying conflicts, waivers, screening' },
    { id: 'ethics-fees', name: 'Fees & Billing', description: 'Fee agreements, taxation of costs, contingency' },
    { id: 'ethics-trust', name: 'Trust Accounts', description: 'Client money, accounting requirements' },
    { id: 'ethics-misconduct', name: 'Professional Misconduct', description: 'Disciplinary process, sanctions' },
  ],
  'atp-106': [
    { id: 'practice-firm', name: 'Law Firm Setup', description: 'Sole practice, partnerships, LLPs' },
    { id: 'practice-client', name: 'Client Management', description: 'Intake, communication, file management' },
    { id: 'practice-billing', name: 'Billing & Collections', description: 'Time recording, invoicing, debt recovery' },
    { id: 'practice-tech', name: 'Legal Technology', description: 'Case management, research tools, cybersecurity' },
  ],
  'atp-107': [
    { id: 'conv-due-diligence', name: 'Due Diligence', description: 'Searches, encumbrances, title investigation' },
    { id: 'conv-transfer', name: 'Land Transfer', description: 'Sale agreements, transfer instruments, registration' },
    { id: 'conv-charge', name: 'Charges & Mortgages', description: 'Creating charges, discharge, foreclosure' },
    { id: 'conv-leases', name: 'Leases', description: 'Commercial leases, residential tenancies' },
    { id: 'conv-sectional', name: 'Sectional Properties', description: 'Sectional titles, management corporations' },
  ],
  'atp-108': [
    { id: 'comm-sale', name: 'Sale of Goods', description: 'Formation, terms, passing of property, remedies' },
    { id: 'comm-agency', name: 'Agency', description: 'Creation, authority, duties, termination' },
    { id: 'comm-partnership', name: 'Partnerships', description: 'Formation, rights, dissolution' },
    { id: 'comm-negotiable', name: 'Negotiable Instruments', description: 'Bills of exchange, cheques, promissory notes' },
    { id: 'comm-insurance', name: 'Insurance', description: 'Principles, claims, subrogation' },
  ],
};
