// ============================================================
// KENYAN BAR EXAM PREP — LEGAL CONTENT CONSTANTS
// Aligned with Council of Legal Education (CLE) ATP Curriculum
// ============================================================

// -----------------------------------------------
// ATP UNITS — the full syllabus as taught in CLE
// -----------------------------------------------
export const ATP_UNITS = [
  {
    id: 'civil-litigation',
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
    id: 'criminal-litigation',
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
    id: 'legal-writing-drafting',
    name: 'Legal Writing & Drafting',
    description: 'Drafting pleadings, contracts, conveyancing instruments, legal opinions, memoranda, and other legal documents.',
    icon: 'FileText',
    statutes: [
      'Advocates Act, Cap 16',
      'Law of Contract Act, Cap 23',
      'Stamp Duty Act, Cap 480',
      'Land Registration Act, 2012',
    ],
  },
  {
    id: 'professional-ethics',
    name: 'Professional Ethics & Practice',
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
    id: 'conveyancing',
    name: 'Conveyancing & Real Property',
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
    id: 'commercial-transactions',
    name: 'Commercial Transactions',
    description: 'Sale of goods, hire purchase, partnerships, agency, insurance, negotiable instruments, and banking law.',
    icon: 'Briefcase',
    statutes: [
      'Sale of Goods Act, Cap 31',
      'Hire Purchase Act, Cap 507',
      'Partnership Act, Cap 29',
      'Insurance Act, Cap 487',
      'Bills of Exchange Act, Cap 27',
      'Central Bank of Kenya Act, Cap 491',
    ],
  },
  {
    id: 'family-law',
    name: 'Family Law & Succession',
    description: 'Marriage, divorce, maintenance, custody, adoption, wills, and administration of estates under Kenyan law.',
    icon: 'Users',
    statutes: [
      'Marriage Act, 2014',
      'Matrimonial Property Act, 2013',
      'Children Act, 2022',
      'Law of Succession Act, Cap 160',
      'Mental Health Act, 1989',
    ],
  },
  {
    id: 'constitutional-admin',
    name: 'Constitutional & Administrative Law',
    description: 'Constitution of Kenya 2010, devolution, judicial review, human rights, administrative justice, and public law practice.',
    icon: 'BookOpen',
    statutes: [
      'Constitution of Kenya, 2010',
      'Fair Administrative Action Act, 2015',
      'Commission on Administrative Justice Act, 2011',
      'County Governments Act, 2012',
      'Leadership and Integrity Act, 2012',
    ],
  },
  {
    id: 'company-law',
    name: 'Company & Corporate Practice',
    description: 'Company formation, governance, restructuring, insolvency, securities regulation, and corporate compliance.',
    icon: 'Building2',
    statutes: [
      'Companies Act, 2015',
      'Insolvency Act, 2015',
      'Capital Markets Act, Cap 485A',
      'Business Registration Service Act, 2015',
      'Limited Liability Partnerships Act, 2011',
    ],
  },
  {
    id: 'employment-law',
    name: 'Employment & Labour Relations',
    description: 'Employment contracts, termination, trade unions, industrial disputes, and occupational safety.',
    icon: 'Handshake',
    statutes: [
      'Employment Act, 2007',
      'Labour Relations Act, 2007',
      'Labour Institutions Act, 2007',
      'Work Injury Benefits Act, 2007',
      'Occupational Safety and Health Act, 2007',
    ],
  },
  {
    id: 'tax-law',
    name: 'Tax Law & Revenue Practice',
    description: 'Income tax, VAT, customs, tax compliance, disputes, and representation before the Tax Appeals Tribunal.',
    icon: 'Calculator',
    statutes: [
      'Income Tax Act, Cap 470',
      'Value Added Tax Act, 2013',
      'Tax Procedures Act, 2015',
      'Tax Appeals Tribunal Act, 2013',
      'Excise Duty Act, 2015',
      'Customs and Excise Act, Cap 472',
    ],
  },
  {
    id: 'adr',
    name: 'Alternative Dispute Resolution',
    description: 'Arbitration, mediation, negotiation, and traditional dispute resolution as applied in Kenya.',
    icon: 'Handshake',
    statutes: [
      'Arbitration Act, 1995',
      'Nairobi Centre for International Arbitration Act, 2013',
      'Mediation Bill (pending)',
      'Civil Procedure Act, Cap 21 — Section 59',
    ],
  },
] as const;

// -----------------------------------------------
// LEGAL DOCUMENT TYPES — for the Drafting module
// -----------------------------------------------
export const LEGAL_DOCUMENT_TYPES = {
  pleadings: {
    category: 'Pleadings & Court Documents',
    documents: [
      { id: 'plaint', name: 'Plaint', description: 'Originating document in a civil suit filed in the High Court or subordinate courts.' },
      { id: 'defence', name: 'Defence (Statement of Defence)', description: 'Response to a plaint setting out the defendant\'s case.' },
      { id: 'counterclaim', name: 'Counterclaim', description: 'A claim by the defendant against the plaintiff within the same suit.' },
      { id: 'reply-to-defence', name: 'Reply to Defence', description: 'Plaintiff\'s response to new matters raised in the defence.' },
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
      { id: 'replying-affidavit', name: 'Replying Affidavit', description: 'Sworn response to an opposing party\'s affidavit.' },
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
      { id: 'lease-agreement', name: 'Lease Agreement', description: 'Landlord–tenant agreement for use and occupation of premises.' },
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
  { id: 'beginner', name: 'Beginner', description: 'Foundation level — core concepts and definitions', color: 'emerald' },
  { id: 'intermediate', name: 'Intermediate', description: 'Applied knowledge — analysis and application', color: 'amber' },
  { id: 'advanced', name: 'Advanced', description: 'Bar exam standard — complex scenarios and integration', color: 'rose' },
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

// Keep legacy reference 
export const KENYAN_LEGAL_TOPICS = {
  constitutional: {
    name: 'Constitutional Law',
    subtopics: [
      'Bill of Rights',
      'Devolution',
      'Land and Environment',
      'Leadership and Integrity',
      'Judicial Authority',
    ],
  },
  criminal: {
    name: 'Criminal Law & Procedure',
    subtopics: [
      'Substantive Criminal Law',
      'Criminal Procedure',
      'Evidence in Criminal Cases',
      'Sentencing',
    ],
  },
  civil: {
    name: 'Civil Procedure',
    subtopics: [
      'Jurisdiction',
      'Pleadings',
      'Discovery',
      'Judgments and Orders',
      'Appeals',
    ],
  },
  contract: {
    name: 'Law of Contract',
    subtopics: [
      'Formation of Contract',
      'Terms and Conditions',
      'Breach and Remedies',
      'Specific Contracts',
    ],
  },
  tort: {
    name: 'Law of Tort',
    subtopics: [
      'Negligence',
      'Defamation',
      'Nuisance',
      'Strict Liability',
    ],
  },
  land: {
    name: 'Land Law',
    subtopics: [
      'Land Registration',
      'Land Rights',
      'Leases',
      'Succession',
    ],
  },
  company: {
    name: 'Company Law',
    subtopics: [
      'Company Formation',
      'Directors and Officers',
      'Corporate Financing',
      'Insolvency',
    ],
  },
  commercial: {
    name: 'Commercial Law',
    subtopics: [
      'Sale of Goods',
      'Agency',
      'Banking Law',
      'Insurance',
    ],
  },
  family: {
    name: 'Family Law',
    subtopics: [
      'Marriage',
      'Divorce',
      'Custody',
      'Maintenance',
    ],
  },
  succession: {
    name: 'Succession Law',
    subtopics: [
      'Wills',
      'Intestate Succession',
      'Administration of Estates',
    ],
  },
  evidence: {
    name: 'Law of Evidence',
    subtopics: [
      'Admissibility',
      'Burden of Proof',
      'Witnesses',
      'Documentary Evidence',
    ],
  },
  ethics: {
    name: 'Legal Ethics',
    subtopics: [
      'Professional Conduct',
      'Advocate-Client Relationship',
      'Conflict of Interest',
      'Disciplinary Procedures',
    ],
  },
};

export const COMPETENCY_TYPES = {
  drafting: {
    name: 'Legal Drafting',
    description: 'Master legal document preparation',
    documents: [
      'Contracts',
      'Pleadings',
      'Legal Opinions',
      'Memoranda',
      'Affidavits',
      'Notices',
    ],
  },
  research: {
    name: 'Legal Research',
    description: 'Develop comprehensive research skills',
    skills: [
      'Case Law Analysis',
      'Statutory Interpretation',
      'Legal Reasoning',
      'Source Verification',
    ],
  },
  oral: {
    name: 'Oral Advocacy',
    description: 'Practice courtroom and client skills',
    areas: [
      'Court Arguments',
      'Client Counseling',
      'Negotiation',
      'Presentation Skills',
    ],
  },
};

export const DIFFICULTY_LEVELS_SIMPLE = ['beginner', 'intermediate', 'advanced'] as const;

export const QUESTION_TYPES_SIMPLE = [
  'multiple_choice',
  'essay',
  'case_analysis',
  'practical',
] as const;
