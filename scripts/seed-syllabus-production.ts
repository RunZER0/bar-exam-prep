/**
 * PRODUCTION SEED SCRIPT: All Syllabus Nodes from ATP 2026/2027 Course Outlines
 * Source: ATP_2026-2027_Combined_Course_Outlines_neatly_organized.docx
 *
 * Courses: ATP 100–108 (9 courses, ~270 nodes)
 * Every node maps to a specific week in the KSL academic calendar.
 * Drafting flags are set ONLY where the PDF explicitly marks "(with a drafting component)".
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
dotenv.config();

interface SeedNode {
  unitCode: string;
  weekNumber: number;
  kslTerm: number;
  topicName: string;
  subtopicName: string | null;
  isDraftingNode: boolean;
  isHighYield: boolean;
  learningOutcome: string | null;
  sectionReference: string | null;
}

// Compact node builder
function n(
  unit: string, week: number, term: number, topic: string,
  sub: string | null = null, drafting = false, hy = false,
  outcome: string | null = null, ref: string | null = null
): SeedNode {
  return {
    unitCode: unit, weekNumber: week, kslTerm: term,
    topicName: topic, subtopicName: sub,
    isDraftingNode: drafting, isHighYield: hy,
    learningOutcome: outcome, sectionReference: ref,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 100: CIVIL LITIGATION (33 weeks)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP100: SeedNode[] = [
  // TERM 1
  n('ATP100', 1, 1, 'Overview of the Course', 'Introduction, expectations, ground rules'),
  n('ATP100', 2, 1, 'Taking of Instructions in Civil Litigation', 'Client interview and conferencing', false, true, 'Conduct effective client interviews and establish advocate-client relationship', 'Order 1, CPR 2010'),
  n('ATP100', 3, 1, 'Taking of Instructions in Civil Litigation', 'Legal opinion and pre-litigation considerations', false, true, 'Formulate a legal opinion from interview circumstances'),
  n('ATP100', 4, 1, 'Taking of Instructions in Civil Litigation', 'Demand letter drafting', true, true, 'Construct a demand letter before action'),
  n('ATP100', 5, 1, 'Courts and Jurisdiction', 'Constitutional and statutory jurisdiction, forum vs venue', false, true, 'Distinguish between forum, venue and jurisdiction; analyze hierarchical court structure', 'Articles 23, 163-165, Constitution'),
  n('ATP100', 6, 1, 'The Overriding Objective in Civil Litigation', 'Concept, application, and sanctions', false, false, 'Analyze the overriding objective and sanctions for contravention', 'Sections 1A, 1B, 1C CPA'),
  n('ATP100', 7, 1, 'Parties to a Suit', 'Joinder, mis-joinder, third party', false, false, 'Distinguish the various parties to a suit'),
  n('ATP100', 8, 1, 'Parties to a Suit', 'Interested party, interpleader, amicus curiae', false, false, 'Develop an interpleader proceeding', 'Order 1 Rules 2-23, Order 32, Order 34'),
  n('ATP100', 9, 1, 'Parties to a Suit', 'Representative suits and persons of unsound mind', false, false, 'Conduct third-party process'),
  n('ATP100', 10, 1, 'Commencement of Suits', 'Pleadings: Plaint, Statement of Claim, OS, Petition', true, true, 'Draft pleadings for commencing civil suits', 'Sections 2 CPA; Orders 2, 3, 4 CPR'),
  n('ATP100', 11, 1, 'Commencement of Suits', 'Defence, counter-claim, affidavits, service of process', true, true, 'Execute filing, service, and amendment of pleadings'),
  // TERM 2
  n('ATP100', 12, 2, 'Interlocutory Applications', 'Injunctions (Order 40), Mareva, Anton Piller', true, true, 'Draft various types of interlocutory applications', 'Orders 38, 39, 40 CPR'),
  n('ATP100', 13, 2, 'Interlocutory Applications', 'Discovery, inspection, summary procedure', true, true, 'Analyze interlocutory pre-trial processes'),
  n('ATP100', 14, 2, 'Interlocutory Applications', 'Striking out, vacation, leave applications', true, false, 'Apply disposal of suits by summary procedure'),
  n('ATP100', 15, 2, 'Pre-Trial Process', 'Framing issues, discovery, case conferencing', false, false, 'Develop pre-trial processes and directions'),
  n('ATP100', 16, 2, 'Hearing of Suits', 'Attendance, order of proceedings, examination of witnesses', false, true, 'Appraise the trial procedure in civil cases'),
  n('ATP100', 17, 2, 'Hearing of Suits', 'Making submissions, withdrawal, discontinuance', false, false, 'Conduct and manage civil hearings'),
  n('ATP100', 18, 2, 'Rulings, Orders, Judgements and Decrees', 'Writing and delivery; extraction of orders', false, true, 'Formulate a decree after judgment'),
  n('ATP100', 19, 2, 'Rulings, Orders, Judgements and Decrees', 'Contents of rulings and judgments', false, true, 'Demonstrate judgment writing and delivery'),
  n('ATP100', 20, 2, 'Remedies upon Judgment', 'Stay of execution, payment in instalments', false, false, 'Differentiate modes of execution of decrees'),
  n('ATP100', 21, 2, 'Execution of Decrees and Orders', 'Garnishee proceedings, execution against Government', false, true, 'Conduct execution processes including garnishee', 'Government Proceedings Act'),
  n('ATP100', 22, 2, 'Execution of Decrees and Orders', 'Notice to show cause, specific property', false, false, 'Devise the process of execution against the Government'),
  // TERM 3
  n('ATP100', 23, 3, 'Review', 'Nature, scope, grounds, procedure for review', false, false, 'Establish and execute the process of review'),
  n('ATP100', 24, 3, 'Appeals', 'Right of appeal, time limits, parties', true, true, 'Review appeal procedure from subordinate courts to High Court'),
  n('ATP100', 25, 3, 'Appeals', 'Appeals: High Court to Court of Appeal to Supreme Court', true, true, 'Demonstrate the process of appeal', 'Appellate Jurisdiction Act; CA Rules 2022; SC Rules 2020'),
  n('ATP100', 26, 3, 'Appeals', 'Documents of appeal, stay pending appeal', true, true, 'Execute appeal document preparation'),
  n('ATP100', 27, 3, 'Procedure in Judicial Review', 'Stages under CPR; Fair Administrative Action Act', true, true, 'Analyze procedures and remedies in judicial review', 'Order 53 CPR; FAAA'),
  n('ATP100', 28, 3, 'Procedure in Judicial Review', 'Remedies under judicial review; service', true, true, 'Execute the judicial review application'),
  n('ATP100', 29, 3, 'Constitutional Litigation', 'Determining constitutional questions; locus standi', true, true, 'Theorize constitutional litigation and establish jurisdiction', 'Constitution 2010; Mutunga Rules 2013'),
  n('ATP100', 30, 3, 'Constitutional Litigation', 'Jurisdiction in Constitution Litigation', true, true, 'Construct proper procedure in constitutional litigation'),
  n('ATP100', 31, 3, 'Constitutional Litigation', 'Practice rules, non-compliance, remedies', true, true, 'Develop the basic constitutional petition documents'),
  n('ATP100', 32, 3, 'Costs', 'Costs inter partes, taxation process, bills of costs', true, false, 'Appraise taxation process and governing principles', 'Advocates Act; Advocates Remuneration Order'),
  n('ATP100', 33, 3, 'Procedures Before Tribunals', 'Business Premises Rent, Rent, Environmental', false, false, 'Explain procedure in rent and environmental tribunals'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 101: CRIMINAL LITIGATION (33 weeks, continuous numbering)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP101: SeedNode[] = [
  // TERM 1
  n('ATP101', 1, 1, 'Introduction to Criminal Litigation', 'Criminal Procedure Code overview, criminal law principles', false, false, 'Understand the CPC and overview of criminal law', 'CPC Cap 75'),
  n('ATP101', 2, 1, 'Jurisdiction and Structure of Courts', 'Magistrates courts, tribunals, High Court', false, true, 'Identify various jurisdictions in criminal litigation', 'Magistrates Courts Act 2015'),
  n('ATP101', 3, 1, 'Jurisdiction and Structure of Courts', 'Court of Appeal, Supreme Court, ICC', false, true, 'Analyze court structure and appellate hierarchy'),
  n('ATP101', 4, 1, 'Arrests', 'Arrest without warrant', true, true, 'Draft documents relating to arrest procedures', 'CPC S.21-36'),
  n('ATP101', 5, 1, 'Arrests', 'Arrest with warrant; rights of arrested persons', true, true, 'Apply constitutional rights of arrested persons', 'Article 49, Constitution 2010'),
  n('ATP101', 6, 1, 'Identification Parades', 'Conduct and procedures of ID parades', true, false, 'Prepare Form P.156 for identification parade'),
  n('ATP101', 7, 1, 'Identification Parades', 'Production of ID parade evidence', true, false, 'Analyze admissibility of identification evidence'),
  n('ATP101', 8, 1, 'Preparation of Files for Trial', 'Police/Prosecution file contents', true, false, 'Prepare a complete prosecution case file'),
  n('ATP101', 9, 1, 'Preparation of Files for Trial', 'Advocates file and court file', true, false, 'Organize defence and court files for trial'),
  n('ATP101', 10, 1, 'Complaint and Charge', 'Methods and rules of framing charges', true, true, 'Frame charges correctly; identify defects in charges', 'CPC S.134-140'),
  n('ATP101', 11, 1, 'Complaint and Charge', 'Defects in drafting: duplicity, lack of ingredients', true, true, 'Identify and cure defects in charge sheets'),
  // TERM 2 (weeks 12-22)
  n('ATP101', 12, 2, 'Complaint and Charge', 'Capital, alternative charges, conspiracy, attempts', true, true, 'Draft capital and alternative charges'),
  n('ATP101', 13, 2, 'Complaint and Charge', 'Joinder of persons/counts, amendment, motion to quash', true, true, 'Apply rules on joinder and amendment of charges'),
  n('ATP101', 14, 2, 'Plea and Plea Bargain', 'Nature of plea, equivocal/unequivocal plea', false, true, 'Distinguish equivocal from unequivocal pleas'),
  n('ATP101', 15, 2, 'Plea and Plea Bargain', 'Plea agreements, autrefois acquit/convict, pardon', false, true, 'Apply plea bargain procedures'),
  n('ATP101', 16, 2, 'Bail and Bond', 'Police bond, anticipatory bail, bail pending trial', false, true, 'Apply bail procedures at various stages', 'CPC S.123-132; Article 49(1)(h) Constitution'),
  n('ATP101', 17, 2, 'Bail and Bond', 'Sureties, forfeitures, recognizance, securities', false, true, 'Draft bail applications and evaluate sureties'),
  n('ATP101', 18, 2, 'Pre-Trial Conferencing', 'Accused meeting, prosecution communication, witness statements', false, false, 'Manage pre-trial preparation and conferencing'),
  n('ATP101', 19, 2, 'Trial Process', 'Right to fair hearing, opening statement, examination', true, true, 'Conduct criminal trial proceedings', 'Article 50, Constitution'),
  n('ATP101', 20, 2, 'Trial Process', 'Production of exhibits, trial within a trial', true, true, 'Handle evidentiary challenges during trial'),
  n('ATP101', 21, 2, 'Trial Process and Sentencing', 'Judgment, victim impact, mitigation, sentencing', true, true, 'Draft interlocutory applications in criminal matters'),
  n('ATP101', 22, 2, 'Revision', 'Criminal revision procedures', true, false, 'Draft and file revision applications', 'CPC S.362-367'),
  // TERM 3 (weeks 23-33)
  n('ATP101', 23, 3, 'Revision', 'Revision practice and procedure', true, false, 'Apply revision mechanisms in criminal matters'),
  n('ATP101', 24, 3, 'Appellate Jurisdiction', 'Right of appeal; appeal from Magistrates to High Court', true, true, 'File criminal appeals at various court levels', 'CPC S.346-361'),
  n('ATP101', 25, 3, 'Appellate Jurisdiction', 'Appeal from HC to CA to Supreme Court', true, true, 'Apply principles governing criminal appeals'),
  n('ATP101', 26, 3, 'Specialized Prosecutors', 'ODPP, specialized prosecution units', false, false, 'Understand role of specialized prosecutors', 'ODPP Act No.2 of 2013'),
  n('ATP101', 27, 3, 'Private Prosecutions', 'Private prosecution procedures', true, false, 'Draft private prosecution documents'),
  n('ATP101', 28, 3, 'Inquests', 'Inquest procedures and documentation', true, false, 'Prepare inquest documentation', 'CPC S.386-396'),
  n('ATP101', 29, 3, 'Extradition Proceedings', 'Extradition law and procedure', true, false, 'Draft extradition application documents'),
  n('ATP101', 30, 3, 'Miscellaneous Applications', 'Freezing accounts, search, confiscation, summons', true, false, 'Draft miscellaneous criminal applications'),
  n('ATP101', 31, 3, 'Habeas Corpus', 'Habeas corpus procedure and practice', true, true, 'Draft habeas corpus applications', 'Article 51, Constitution'),
  n('ATP101', 32, 3, 'Judicial Review in Criminal Matters', 'Judicial review of criminal proceedings', true, true, 'Apply judicial review to criminal matters'),
  n('ATP101', 33, 3, 'Procedures in Special Courts', 'Children\'s court, anti-corruption, courts-martial, traffic', false, false, 'Navigate specialized criminal court procedures'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 102: PROBATE AND ADMINISTRATION (40 weeks, continuous)
// Note: Weeks 20-24 are oral exams. Content nodes for actual teaching weeks only.
// ═══════════════════════════════════════════════════════════════════════════════
const ATP102: SeedNode[] = [
  // TERM 1
  n('ATP102', 1, 1, 'Introduction to Succession Law', 'Historical background, commencement of LSA', false, false, 'Apply Law of Succession in the right context', 'Law of Succession Act S.2, S.32'),
  n('ATP102', 2, 1, 'Legal Framework of Succession', 'Relationship between LSA and other laws', false, false, 'Understand principles of application of LSA', 'LSA S.2(2)'),
  n('ATP102', 3, 1, 'Legal Framework of Succession', 'Marriage Act, customary law, conveyancing, co-ownership, exemptions', false, false, 'Analyze law of succession in relation to Marriage Act and customary law'),
  n('ATP102', 4, 1, 'Testate Succession – Wills and Codicils', 'Definition, physical requirements, types of wills', true, true, 'Draft a valid written will', 'LSA S.3, S.8, S.9'),
  n('ATP102', 5, 1, 'Testate Succession – Wills and Codicils', 'Execution, concurrent wills, capacity', true, true, 'Identify essentials of a valid written will'),
  n('ATP102', 6, 1, 'Drawing of Valid Wills', 'Drafting practice: will structure and content', true, true, 'Draw a valid will and codicil'),
  n('ATP102', 7, 1, 'Drawing of Valid Wills', 'Who may not be left out; drafting codicils', true, true, 'Apply rules on testamentary capacity'),
  n('ATP102', 8, 1, 'Revocation, Alteration and Revival of Wills', 'Express revocation, by marriage, by destruction', false, true, 'Apply processes of revocation, alteration and revival', 'LSA S.17-21'),
  n('ATP102', 9, 1, 'Revocation, Alteration and Revival of Wills', 'Alteration by other wills/codicils, revival', false, false, 'Analyze revival of wills under S.21 LSA'),
  n('ATP102', 10, 1, 'Proof of Wills', 'Proof of oral and written wills', false, true, 'Demonstrate understanding of proof procedures for different will types'),
  n('ATP102', 11, 1, 'Objection to Wills', 'Propounding, grounds for objection, procedure', false, true, 'Apply objection procedures under S.29, S.67-70', 'LSA S.26, S.29; Rules 7(4), 17(1)'),
  // Continuing into Term 2
  n('ATP102', 12, 2, 'Application for Reasonable Provision (Testate)', 'Dependants S.26-30, procedure', false, false, 'Seek reasonable provision for dependants', 'LSA S.26-30'),
  n('ATP102', 13, 2, 'Intestate Succession', 'Citations, dependents, effect of marriages', false, true, 'Apply rules of intestate succession', 'LSA S.29, S.3(5)'),
  n('ATP102', 14, 2, 'Intestate Succession', 'Woman under S.3(5), definition of children', false, true, 'Determine rights of various categories of dependants'),
  n('ATP102', 15, 2, 'Protection of Estate', 'Intermeddling: definition and remedies', false, false, 'Identify and address intermeddling'),
  n('ATP102', 16, 2, 'Intestate Succession – Distribution', 'Distribution of estate under intestacy', false, true, 'Apply distribution rules to various family situations'),
  n('ATP102', 17, 2, 'Intestate Succession – Special Cases', 'Community land, nominations, Islamic law', false, false, 'Distinguish property exempted from LSA'),
  n('ATP102', 19, 2, 'Jurisdiction on Succession Matters', 'Magistrates Courts, HC original and appellate, CA', false, false, 'Identify proper court for succession matters', 'Magistrates Courts Act 2015'),
  // Weeks 20-24: Oral Examinations (no content nodes)
  // TERM 3
  n('ATP102', 25, 3, 'Petition for Grant of Letters of Administration', 'Who may take out grants, petitions', true, true, 'Draft a petition for grant of letters', 'LSA S.51-56'),
  n('ATP102', 26, 3, 'Petition for Grant of Letters of Administration', 'Gazettement, simple grant procedure', true, true, 'Process a simple grant application'),
  n('ATP102', 27, 3, 'Objections to Grants', 'Who may file, reasons, timing, process', true, true, 'Draft and file objections to grants', 'LSA S.68'),
  n('ATP102', 28, 3, 'Objections to Grants', 'Cohabitee, donation mortis causa, S.68 grounds', true, false, 'Analyze grounds for objection to grants'),
  n('ATP102', 29, 3, 'Grants – Hearing and Determination', 'Contested and non-contested hearings', true, true, 'Demonstrate court process of contentious succession'),
  n('ATP102', 30, 3, 'Grants – Complex Applications', 'Multiple applicants, foreign domicile', true, false, 'Handle succession for property in foreign jurisdictions'),
  n('ATP102', 31, 3, 'Confirmation of Grants', 'Pleadings for confirmation, hearing', false, true, 'Process confirmation of grants'),
  n('ATP102', 32, 3, 'Reasonable Provision (Intestate)', 'Application for reasonable provision by dependants', false, false, 'Apply for reasonable provision under intestacy'),
  n('ATP102', 33, 3, 'Confirmation of Grants (continued)', 'Complex confirmation scenarios', false, false, 'Handle contested confirmation proceedings'),
  n('ATP102', 34, 3, 'Revocation and Annulment of Grants', 'Grounds and procedure for revocation', false, true, 'Apply revocation procedures', 'LSA S.76'),
  n('ATP102', 35, 3, 'Limited Grants', 'Types, purpose, procedure', false, false, 'Identify and apply various types of limited grants'),
  n('ATP102', 36, 3, 'Limited Grants and Civil Claims', 'Procedure for civil claims against estates', false, false, 'File civil claims against an estate without grants'),
  n('ATP102', 37, 3, 'Foreign Succession', 'Moveable and immoveable property in foreign jurisdictions', false, false, 'Understand relationship between domicile and deceased person\'s property'),
  n('ATP102', 38, 3, 'Powers and Duties of Personal Representatives', 'PR duties and obligations', false, true, 'Apply duties and powers of personal representatives'),
  n('ATP102', 39, 3, 'Estate Accounts', 'Preparation and filing of estate accounts', false, false, 'Prepare estate accounts'),
  n('ATP102', 40, 3, 'Estate Accounts (continued)', 'Audit and approval of accounts', false, false, 'File and defend estate accounts'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 103: LEGAL WRITING AND DRAFTING (33 weeks)
// Term 1 = Legal Writing, Term 2 = Legal Drafting, Term 3 = Legislative Drafting
// ═══════════════════════════════════════════════════════════════════════════════
const ATP103: SeedNode[] = [
  // TERM 1: LEGAL WRITING
  n('ATP103', 1, 1, 'Introduction to Legal Writing', 'Overview, expectations, ground rules', false, false, 'Understand course objectives for legal writing'),
  n('ATP103', 2, 1, 'Qualities of Good Legal Writing', 'Plain English vs legalese', false, true, 'Apply plain English principles in legal writing'),
  n('ATP103', 3, 1, 'Introduction to Legal Writing', 'Gender-neutral language, bias-free language', false, false, 'Use gender-neutral and bias-free language'),
  n('ATP103', 4, 1, 'Introduction to Legal Writing', 'Advanced qualities and strategic word choice', false, false, 'Apply strategic choice of language in writing'),
  n('ATP103', 5, 1, 'Process of Effective Writing', 'Psychology of writing, outlines, drafting, revising, editing', false, true, 'Apply the complete writing process from outline to proofreading'),
  n('ATP103', 6, 1, 'Paragraphing', 'Function, unity, coherence, topic and concluding sentences', false, true, 'Structure paragraphs with unity and coherence'),
  n('ATP103', 7, 1, 'Sentences and Voice in Legal Writing', 'Active/passive voice, action verbs, sentence length', false, true, 'Use active voice and concrete subjects effectively'),
  n('ATP103', 8, 1, 'Transitions', 'Generic, orienting, and substantive transitions', false, false, 'Apply transition techniques between sentences and paragraphs'),
  n('ATP103', 9, 1, 'Advanced Legal Research and Analysis', 'Research skills applied to legal writing', false, true, 'Apply research skills in legal writing'),
  n('ATP103', 10, 1, 'Case Briefs', 'Elements and purpose of case briefing', false, true, 'Brief cases effectively'),
  n('ATP103', 11, 1, 'Case Analysis', 'Case briefs vs case analysis, analytical frameworks', false, true, 'Distinguish case briefs from case analysis'),
  // TERM 2: LEGAL DRAFTING (all drafting nodes)
  n('ATP103', 12, 2, 'Introduction to Legal Drafting', 'Definition, stages of drafting a legal document', true, false, 'Understand the stages of drafting a legal document'),
  n('ATP103', 13, 2, 'Drafting Letters and Correspondence', 'Format, body of letter, letters to client', true, true, 'Draft professional letters to clients and opposing counsel'),
  n('ATP103', 14, 2, 'Drafting Demand Letters', 'Demand letter structure and content', true, true, 'Draft effective demand letters'),
  n('ATP103', 15, 2, 'Drafting Legal Opinions', 'Preparing to write, writing process, points of content', true, true, 'Draft comprehensive legal opinions'),
  n('ATP103', 16, 2, 'Drafting Legal Opinions', 'Style, format, office memorandum', true, true, 'Apply proper format to legal opinions and office memos'),
  n('ATP103', 17, 2, 'Drafting Contracts', 'Employment contracts, lease agreements', true, true, 'Draft standard commercial contracts'),
  n('ATP103', 18, 2, 'Drafting Contracts', 'Sale of goods contracts, key clauses', true, true, 'Apply contract drafting principles to various agreement types'),
  n('ATP103', 19, 2, 'Drafting Affidavits vs Statutory Declarations', 'Points of content, format, writing process', true, true, 'Draft affidavits and statutory declarations', 'Oaths and Statutory Declarations Act'),
  n('ATP103', 20, 2, 'Drafting Affidavits vs Statutory Declarations', 'Distinguishing features, evidentiary use', true, true, 'Distinguish affidavits from statutory declarations'),
  n('ATP103', 21, 2, 'Drafting Deed Polls', 'Format, points of content, writing process', true, false, 'Draft deed polls for change of name and other purposes'),
  n('ATP103', 22, 2, 'Drafting Sessions', 'Practical group drafting exercises', true, false, 'Apply drafting skills in collaborative exercises'),
  // TERM 3: LEGISLATIVE DRAFTING (all drafting nodes)
  n('ATP103', 23, 3, 'Introduction to Legislative Drafting', 'Role of drafter, legislative process, challenges', true, true, 'Understand the legislative process in Kenya'),
  n('ATP103', 24, 3, 'Introduction to Legislative Drafting', 'Qualities of a good draftsperson', true, false, 'Identify qualities required for legislative drafting'),
  n('ATP103', 25, 3, 'Key Reference Legislations', 'Tools for the drafter, drafting instructions', true, true, 'Use key reference legislations in drafting', 'KLRC Guide to Legislative Drafting'),
  n('ATP103', 26, 3, 'Key Reference Legislations', 'Designing a legislative solution, policy process', true, true, 'Design legislative solutions from policy objectives'),
  n('ATP103', 27, 3, 'Structure of a Bill', 'Preliminary provisions, substantive provisions', true, true, 'Structure a bill with proper preliminary and substantive provisions'),
  n('ATP103', 28, 3, 'Structure of a Bill', 'Miscellaneous and final provisions', true, true, 'Complete a bill structure with miscellaneous and final provisions'),
  n('ATP103', 29, 3, 'The Legislative Sentence', 'Words and expressions in legislative drafting; syntax', true, false, 'Apply proper syntax and word choice in legislation'),
  n('ATP103', 30, 3, 'The Legislative Sentence', 'Time in legislation', true, false, 'Handle time references in legislative drafting'),
  n('ATP103', 31, 3, 'Amending Legislation', 'Drafting amending legislation', true, true, 'Draft amending legislation correctly'),
  n('ATP103', 32, 3, 'Penal Provisions', 'Drafting offences and penalties', true, true, 'Draft penal provisions for legislation'),
  n('ATP103', 33, 3, 'Delegated Legislation', 'Drafting delegated legislation', true, false, 'Draft delegated legislation and regulations'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 104: TRIAL ADVOCACY (33 weeks)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP104: SeedNode[] = [
  // TERM 1
  n('ATP104', 1, 1, 'Overview of the Course', 'Introduction, expectations, learning outcomes', false, false, 'Understand course objectives for trial advocacy'),
  n('ATP104', 2, 1, 'Introduction to Trial Advocacy', 'UN Basic Principles, key skills, legal research', false, false, 'Identify key skills in trial advocacy'),
  n('ATP104', 3, 1, 'Introduction to Trial Advocacy', 'History: Greek, Roman, England, Kenya', false, false, 'Trace the history of trial advocacy'),
  n('ATP104', 4, 1, 'Introduction to Trial Advocacy', 'Formal sources of law; courts, tribunals, ADR', false, false, 'Identify places for practice of advocacy'),
  n('ATP104', 5, 1, 'Qualities of a Good Trial Lawyer', 'Clarity, honesty, judgment, objectivity, courage', false, true, 'Demonstrate qualities of an effective trial lawyer'),
  n('ATP104', 6, 1, 'Qualities of a Good Trial Lawyer', 'Alertness, tenacity, sincerity, humanity', false, false, 'Apply professional qualities in mock advocacy'),
  n('ATP104', 7, 1, 'General Ethical Duties of Trial Lawyers', 'Duties to client, opposing counsel, witnesses', false, true, 'Identify ethical duties owed to various stakeholders'),
  n('ATP104', 8, 1, 'General Ethical Duties of Trial Lawyers', 'Duty to court and administration of justice', false, true, 'Apply ethical duties in trial scenarios'),
  n('ATP104', 9, 1, 'Conflict of Interest in Trial Advocacy', 'Cab Rank rule, voluntary disqualification', false, true, 'Navigate conflicts of interest in trial practice'),
  n('ATP104', 10, 1, 'Conflict of Interest in Trial Advocacy', 'Compelled disqualification scenarios', false, false, 'Apply disqualification principles'),
  n('ATP104', 11, 1, 'Conflict of Interest in Trial Advocacy', 'Judicial officers: voluntary recusal, disqualification upon application', false, false, 'Understand judicial recusal procedures'),
  // TERM 2
  n('ATP104', 12, 2, 'Conflict of Interest – Judicial Officers', 'Recusal upon application by a party', false, false, 'Apply tests for judicial disqualification'),
  n('ATP104', 13, 2, 'Court Etiquette', 'Dress, punctuality, introductions, mode of address', false, false, 'Demonstrate proper court etiquette'),
  n('ATP104', 14, 2, 'Court Etiquette', 'Behaviour, witnesses, terminology, humour', false, false, 'Apply courtroom decorum standards'),
  n('ATP104', 15, 2, 'Dimensions, Rules and Psychology of Advocacy', 'Trial as search for truth; rules of advocacy', false, true, 'Apply rules and psychology of advocacy'),
  n('ATP104', 16, 2, 'Dimensions, Rules and Psychology of Advocacy', 'Being likeable, sympathy rule, preparation', false, true, 'Apply psychological principles in advocacy'),
  n('ATP104', 17, 2, 'Preparation for Trial – Pre-Trial Advocacy', 'Client interview, research, demand letter', false, true, 'Conduct pre-trial preparation activities'),
  n('ATP104', 18, 2, 'Preparation for Trial – Pre-Trial Advocacy', 'Pre-trial case analysis: objectives, case theory', false, true, 'Develop case theory through analysis'),
  n('ATP104', 19, 2, 'Preparation for Trial – Pre-Trial Advocacy', 'Good/bad facts analysis; practical approach', false, true, 'Apply practical approach to case analysis'),
  n('ATP104', 20, 2, 'The Opening Statement', 'Meaning, statutory basis, objectives', false, true, 'Present an effective opening statement'),
  n('ATP104', 21, 2, 'The Opening Statement', 'Techniques for effective opening', false, true, 'Apply opening statement techniques'),
  // TERM 3
  n('ATP104', 23, 3, 'Examination-in-Chief', 'Meaning, statutory basis, case law', false, true, 'Conduct effective examination-in-chief', 'Evidence Act Cap 80'),
  n('ATP104', 24, 3, 'Examination-in-Chief', 'Objectives and techniques', false, true, 'Apply examination-in-chief techniques'),
  n('ATP104', 25, 3, 'Examination-in-Chief', 'Lay and expert witnesses; presentation of exhibits', false, true, 'Handle different types of witnesses'),
  n('ATP104', 26, 3, 'Cross-Examination', 'Meaning, statutory basis, objectives', false, true, 'Conduct effective cross-examination', 'Evidence Act, S.145-154'),
  n('ATP104', 27, 3, 'Cross-Examination', 'Techniques generally and for lay witnesses', false, true, 'Apply cross-examination techniques'),
  n('ATP104', 28, 3, 'Cross-Examination', 'Techniques for lay witnesses (advanced)', false, true, 'Cross-examine lay witnesses effectively'),
  n('ATP104', 29, 3, 'Cross-Examination', 'Techniques for expert witnesses', false, true, 'Cross-examine expert witnesses'),
  n('ATP104', 30, 3, 'Re-Examination', 'Meaning, statutory basis, objectives, techniques', false, false, 'Conduct re-examination to rehabilitate witnesses'),
  n('ATP104', 31, 3, 'The Closing Argument', 'Meaning, statutory basis, objectives, techniques', false, true, 'Present an effective closing argument'),
  n('ATP104', 32, 3, 'Objections and Skeleton Arguments', 'Preliminary and trial objections; drafting skeleton arguments', false, true, 'Draft and present effective objections and skeleton arguments'),
  n('ATP104', 33, 3, 'Appellate Advocacy, Contempt, and ADR', 'Appellate skills; contempt of court; ADR', false, false, 'Apply advocacy in appellate courts and ADR'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 105: PROFESSIONAL ETHICS (33 weeks)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP105: SeedNode[] = [
  // TERM 1
  n('ATP105', 1, 1, 'Introduction to Professional Ethics', 'Defining ethics and profession; relevance to modern practice', false, false, 'Explain what makes law a profession rather than a business'),
  n('ATP105', 2, 1, 'Law as a Profession in Kenya', 'Evolution of legal profession; regulatory framework; senior bar', false, false, 'Appraise categories of advocates and senior counsel', 'Advocates Act Cap 16; LSK Act'),
  n('ATP105', 3, 1, 'The Law Society of Kenya', 'Establishment, objects, governance, role in democracy', false, false, 'Explain the role of LSK in upholding rule of law', 'LSK Act No. 21 of 2014'),
  n('ATP105', 4, 1, 'Professional Practice and Ethical Conduct', 'Overriding values: independence, integrity, confidentiality', false, true, 'Identify overriding values of professional practice', 'Advocates Act S.55-56; SOPPEC'),
  n('ATP105', 5, 1, 'Professional Practice and Ethical Conduct', 'SOPPEC overview: Standards 1-12', false, true, 'Familiarise with all SOPPEC standards'),
  n('ATP105', 6, 1, 'Fidelity to the Law', 'Officers of court; duty of candour; limits of zealous advocacy', false, true, 'Apply officer-of-the-court concept to fact patterns', 'SOPPEC-8, SOPPEC-12; Advocates Act S.55-56'),
  n('ATP105', 7, 1, 'Role of a Lawyer in Kenyan Society', 'LSK and politics; administration of justice; mentorship', false, false, 'Discuss role of lawyers in safeguarding rule of law'),
  n('ATP105', 8, 1, 'Role of a Lawyer in Kenyan Society', 'AML obligations; victim representation; pro bono', false, false, 'Explain rationale for pauper briefs and pro bono practice', 'Victim Protection Act'),
  n('ATP105', 9, 1, 'Confidentiality and Privilege', 'Duty of confidentiality; advocate-client privilege', false, true, 'Explain rationale for confidentiality and identify exceptions', 'SOPPEC-7; Evidence Act S.134-137'),
  n('ATP105', 10, 1, 'Professional Undertakings', 'Definition, four elements, due diligence, liability', true, true, 'Draft applications to enforce professional undertakings', 'SOPPEC-9; Order 52 Rule 7 CPR'),
  n('ATP105', 11, 1, 'Professional Undertakings', 'Consequences of breach; enforcement procedure', true, true, 'Assess liability for breach of professional undertakings'),
  // TERM 2
  n('ATP105', 12, 2, 'Conflict of Interest', 'Defining conflict; Rule 8 Advocates Practice Rules; common situations', false, true, 'Apply Rule 9 to practical scenarios involving conflicts', 'SOPPEC-6; Rule 8 Advocates Practice Rules'),
  n('ATP105', 13, 2, 'Conflict of Interest', 'Test for disqualification; IBA Guidelines', false, true, 'Assess factual scenarios for conflicts of interest'),
  n('ATP105', 14, 2, 'Bias and Judicial Recusal', 'Grounds for recusal; test for bias', true, false, 'Draft a Notice of Motion for judicial recusal', 'SOPPEC-6'),
  n('ATP105', 15, 2, 'Competence and Diligence', 'Professional negligence; CPD; professional indemnity', true, true, 'Draft a Plaint claiming professional negligence', 'SOPPEC-3'),
  n('ATP105', 16, 2, 'Professional Fee – Retainer', 'Defining retainer; types; letter of engagement', true, true, 'Draft a letter of engagement or retainer agreement', 'SOPPEC-4; Advocates Act S.45'),
  n('ATP105', 17, 2, 'Professional Fee – Remuneration', 'Undercutting; overcharging; bill of costs', true, true, 'Draft a bill of costs for taxation', 'SOPPEC-4; Advocates Remuneration Order'),
  n('ATP105', 18, 2, 'Taxation of Bills of Costs', 'Principles of taxation; instruction fees; disbursements', false, true, 'Apply principles of taxation to bills of costs'),
  n('ATP105', 19, 2, 'Fiduciary Duty', 'Champerty; trusts; misappropriation; client accounts', false, true, 'Apply fiduciary duty rules to client fund scenarios', 'SOPPEC-5; Advocates Act S.46, S.80'),
  n('ATP105', 20, 2, 'The Advocate\'s Lien', 'Types: retaining, specific, statutory; limitations', false, false, 'Differentiate types of advocate\'s lien', 'Advocates Act S.47-48, S.52'),
  n('ATP105', 21, 2, 'The Advocate\'s Lien', 'Enforcing liens; no lien before taxation', false, false, 'Explain when advocate can hold lien over client money'),
  n('ATP105', 22, 2, 'Touting, Marketing, and Advertising', 'Prohibition of touting; permissible advertising', false, false, 'Contrast touting prohibition with regulated advertising', 'SOPPEC-2; Advocates Marketing Rules 2014'),
  // TERM 3
  n('ATP105', 23, 3, 'Practicing Certificate and CPDs', 'S.9(c), S.34 Advocates Act; consequences of acting without', false, false, 'Explain consequences of acting without practising certificate', 'SOPPEC-1; Advocates Act S.9(c), S.34'),
  n('ATP105', 24, 3, 'Conduct in Other Sectors', 'Judicial officers; AG; ODPP; county attorneys; in-house counsel', false, false, 'Identify codes of conduct for lawyers in various sectors'),
  n('ATP105', 25, 3, 'Contempt of Court', 'Civil vs criminal contempt; sources of power to punish', true, true, 'Explain how punishing contempt preserves rule of law', 'Advocates Act S.56'),
  n('ATP105', 26, 3, 'Contempt of Court', 'Elements; procedure; abuse of power; drafting application', true, true, 'Draft a Notice of Motion application for contempt'),
  n('ATP105', 27, 3, 'Law as a Business', 'Establishing law firms; types; multi-disciplinary practice', false, false, 'Identify merits and demerits of various types of law firms'),
  n('ATP105', 28, 3, 'Advocates Disciplinary Process', 'Disciplinary Tribunal; professional misconduct; penalties', true, false, 'Draft a complaint letter about professional misconduct', 'Advocates Act Part V, S.19, S.60'),
  n('ATP105', 29, 3, 'Social Media and Outside Interests', 'Appropriate/inappropriate social media use', false, false, 'Identify appropriate and inappropriate social media use for advocates', 'SOPPEC-10, SOPPEC-11'),
  n('ATP105', 30, 3, 'Techno Ethics, AI, and Legal Professionals', 'AI risks: bias, hallucination; IBA Report 2024', false, false, 'Assess benefits and risks of AI for legal professionals'),
  n('ATP105', 31, 3, 'Anti-Money Laundering', 'Client due diligence; suspicious transactions; privilege limits', false, true, 'Apply AML obligations to legal practice', 'LSK Act S.4A; Kenya AML/CFT/PF Guidelines 2025'),
  n('ATP105', 32, 3, 'Reflection and Revision', 'Comprehensive review of Term 1-3 concepts', false, false, 'Synthesize and apply professional ethics principles'),
  n('ATP105', 33, 3, 'Reflection and Revision', 'Exam preparation and ethical dilemma practice', false, false, 'Resolve complex ethical dilemmas using principles learned'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 106: LEGAL PRACTICE MANAGEMENT (33 weeks)
// Term 1 = Office Practice, Term 2 = Human Resource, Term 3 = Accounting
// ═══════════════════════════════════════════════════════════════════════════════
const ATP106: SeedNode[] = [
  // TERM 1: OFFICE PRACTICE
  n('ATP106', 1, 1, 'General Introduction and Overview', 'Introduction, course contents, tools', false, false, 'Understand objectives of legal practice management'),
  n('ATP106', 2, 1, 'Introduction to Office Administration', 'Historical background, office defined, types of offices', false, false, 'Describe various types of business organizations'),
  n('ATP106', 3, 1, 'Introduction to Office Administration', 'Nature of a law firm, office organization', false, false, 'Appreciate the role of an office in a law firm'),
  n('ATP106', 4, 1, 'Front Office Services', 'Office location, layout, types of offices', false, false, 'Explain front office services and management'),
  n('ATP106', 5, 1, 'Front Office Services', 'Customer service management, ICT in service delivery', false, false, 'Appreciate role of ICT in customer service', 'Advocates Marketing Rules 2014'),
  n('ATP106', 6, 1, 'Standards, Policies and Procedures', 'Standards, policies, systems applicable in law offices', false, false, 'Explain standards, policies and procedures in a law office', 'Advocates Act Cap 16; Standards Act'),
  n('ATP106', 7, 1, 'Information and Communication Technology', 'Automation, computer literacy, document management', false, false, 'Understand role of ICT in modern legal practice', 'Kenya Information and Communication Act'),
  n('ATP106', 8, 1, 'Record Management', 'Filing systems, modern technology in records, disposal', false, false, 'Appreciate need for proper record management', 'Records Disposal Act; Official Secrets Act'),
  n('ATP106', 9, 1, 'Supply Chain Management', 'Stock control, procurement, disposal', false, false, 'Understand procurement methods and principles', 'Public Procurement Act'),
  n('ATP106', 10, 1, 'Safety, Security and Disaster Management', 'Continuity planning, disaster recovery', false, false, 'Prepare disaster response plan for a law firm', 'Occupational Safety and Health Act'),
  n('ATP106', 11, 1, 'Discrimination and Sexual Harassment', 'Types, ingredients for charge, addressing discrimination', false, false, 'Understand legal implications of harassment and discrimination', 'Employment Act; Sexual Offences Act'),
  // TERM 2: HUMAN RESOURCE
  n('ATP106', 12, 2, 'HR Planning and Management', 'Strategic HRM, HR planning, ICT in HR', false, false, 'Understand functions of human resource management', 'Employment Act; HR Professionals Act'),
  n('ATP106', 13, 2, 'Job Analysis and Design', 'Methods of job analysis, competency modelling', false, false, 'Conduct job analysis for legal practice'),
  n('ATP106', 14, 2, 'Recruitment and Selection', 'Sources, process, selection tools, scientific selection', false, true, 'Apply recruitment and selection processes', 'Constitution 2010; Employment Act'),
  n('ATP106', 15, 2, 'Placement, Socialization and Induction', 'Principles of placement, forms of induction', false, false, 'Understand placement and induction processes'),
  n('ATP106', 16, 2, 'Placement, Socialization and Induction', 'Socialization in the workplace, legal framework', false, false, 'Apply socialization principles in legal practice'),
  n('ATP106', 17, 2, 'Training and Development', 'Conceptual framework, methods, role in legal practice', false, false, 'Explain training and development processes'),
  n('ATP106', 18, 2, 'Training and Development', 'Approaches and factors limiting training', false, false, 'Conceptualize theories of training and development'),
  n('ATP106', 19, 2, 'Career Development and Management', 'Stages, planning process, impact on legal practice', false, false, 'Understand career development and management'),
  n('ATP106', 20, 2, 'Career Development and Management', 'Emerging trends, legal framework', false, false, 'Be aware of trends in career development'),
  n('ATP106', 21, 2, 'Internal Mobility and Separation', 'Promotion, transfer, demotion, termination', false, true, 'Analyze elements of separation policy', 'Employment Act; Labour Relations Act'),
  n('ATP106', 22, 2, 'Internal Mobility and Separation', 'Forms of separation, intervention by ELRC', false, false, 'Review key forms of separation'),
  // TERM 3: ACCOUNTING
  n('ATP106', 23, 3, 'Conceptual Framework of Accounting', 'Definition, objectives, principles, IFRS1', false, true, 'Define accounting and explain its purpose in a legal office'),
  n('ATP106', 24, 3, 'Book Keeping and End Year Adjustments', 'Accounting equation, T accounts, journalizing', false, true, 'Understand balancing accounts and trial balance'),
  n('ATP106', 25, 3, 'Book Keeping and End Year Adjustments', 'Trial balance, end year adjustments, error correction', false, true, 'Make adjustments and correct accounting errors'),
  n('ATP106', 26, 3, 'Bank Reconciliation Statements', 'Meaning, causes of differences, steps, benefits', false, true, 'Draft a complete bank reconciliation statement'),
  n('ATP106', 27, 3, 'Preparation of Final Accounts', 'Comprehensive income statement for sole trader', false, true, 'Prepare income statement and balance sheet'),
  n('ATP106', 28, 3, 'Preparation of Final Accounts', 'Balance sheet / statement of financial position', false, true, 'Differentiate between assets, liabilities and equity'),
  n('ATP106', 29, 3, 'Partnership Accounts', 'Partners capital and current accounts; balance sheet', false, true, 'Prepare partnership accounts and balance sheet'),
  n('ATP106', 30, 3, 'Advocates Accounts', 'Income account, client accounts, cashbook', false, true, 'Prepare advocate\'s income account and balance sheet', 'Advocates Accounts Rules'),
  n('ATP106', 31, 3, 'Advocates Accounts', 'Comprehensive statements; compliance with client money rules', false, true, 'Demonstrate compliance with client money handling rules'),
  n('ATP106', 32, 3, 'Cash Flow Statements', 'Purpose, direct and indirect methods, analysis', false, false, 'Prepare cash flow statement and assess liquidity'),
  n('ATP106', 33, 3, 'Cost Accounting and Budgeting', 'Cost classification, statements, types of budgets', false, false, 'Classify costs and prepare budgets'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 107: CONVEYANCING (33 weeks, continuous numbering)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP107: SeedNode[] = [
  // TERM 1 (Weeks 1-11)
  n('ATP107', 1, 1, 'Introduction to Conveyancing', 'Definition, nature, scope, conceptual framework', false, false, 'Understand the nature and scope of conveyancing'),
  n('ATP107', 2, 1, 'Historical and Legal Framework', 'History of conveyancing in UK from 1535', false, false, 'Trace the history of conveyancing law'),
  n('ATP107', 3, 1, 'Historical and Legal Framework', 'Evolution in Kenya: pre and post colonization', false, false, 'Analyze evolution of land law in Kenya', 'Constitution 2010; Land Registration Act 2012; Land Act 2012'),
  n('ATP107', 4, 1, 'Historical and Legal Framework', 'Categories of land, tenure, estates and interests', false, true, 'Classify categories of land under the Constitution'),
  n('ATP107', 5, 1, 'Pre-Contract Stage and Client Interview', 'Instructions, parties, power of attorney, due diligence', true, true, 'Conduct pre-contract due diligence and client interview', 'Land Registration Act; Advocates Act'),
  n('ATP107', 6, 1, 'The Contract Stage', 'Law of contract basics; parts of sale agreement', true, true, 'Draft and advise on a sale agreement for land', 'Law of Contract Act S.3'),
  n('ATP107', 7, 1, 'The Contract Stage', 'Conditions of sale, deposit, completion, professional undertakings', true, true, 'Apply LSK conditions of sale in conveyancing'),
  n('ATP107', 8, 1, 'Other Forms of Disposition', 'Auction, off-plan, sub-lease, sectional, community land', false, false, 'Compare conventional and alternative disposition methods', 'Sectional Properties Act 2020'),
  n('ATP107', 9, 1, 'Transfer and Registration', 'Voluntary transfers, requirements, transfer forms', true, true, 'Draft transfer instruments for land', 'Land Act S.43; LRA S.37'),
  n('ATP107', 10, 1, 'Transfer and Registration', 'Freehold, leasehold, charge transfers; sectional properties', true, true, 'Process transfer of various interests in land'),
  n('ATP107', 11, 1, 'Completion Documents', 'Land Control Board consent, spousal consent, clearance certificates', false, true, 'Identify and procure all completion documents'),
  // TERM 2 (Weeks 12-22)
  n('ATP107', 12, 2, 'Transmissions / Involuntary Transfers', 'Death, court attachment, vesting orders, insolvency', false, false, 'Process transmissions by operation of law', 'LRA S.60-61; Limitation of Actions Act'),
  n('ATP107', 13, 2, 'Leases and Tenancies', 'Definition, essentials, types of tenancies', true, true, 'Draft lease and tenancy agreements', 'Land Act S.56-61'),
  n('ATP107', 14, 2, 'Leases and Tenancies', 'Registration, covenants, rights of lessor/lessee', true, true, 'Apply implied conditions and express covenants', 'Land Act S.65; LRA S.54'),
  n('ATP107', 15, 2, 'Controlled Tenancies and Determination', 'Rent Acts regime; assignments; determination of leases', false, false, 'Navigate controlled tenancy legislation', 'Landlord & Tenant Act Cap 301; Rent Restriction Act'),
  n('ATP107', 16, 2, 'Remedies and Relief', 'Forfeiture, distress for rent, recovery, injunctions', false, true, 'Apply remedies available to lessor and lessee', 'Land Act S.73-76'),
  n('ATP107', 17, 2, 'Introduction to Charges', 'Definition, types: formal/informal, equitable/legal, priority', true, true, 'Draft a charge instrument', 'LRA S.65, S.84; Land Act S.79-82'),
  n('ATP107', 18, 2, 'Charges – Form and Content', 'Basic requirements, parts of charge document, execution', true, true, 'Advise on contents of a charge instrument', 'Land Act S.80, S.88'),
  n('ATP107', 19, 2, 'Remedies of the Chargee', 'Action for money, receiver, leasing, possession, power of sale', false, true, 'Apply chargee remedies', 'Land Act S.91-96'),
  n('ATP107', 20, 2, 'Remedies of the Chargor', 'Equity of redemption, notice, variation, discharge', false, true, 'Apply chargor remedies and equity of redemption', 'Land Act S.89-105; LRA S.72'),
  n('ATP107', 21, 2, 'Sale by Chargee', 'Notices, duty of care, application of proceeds', false, true, 'Process a sale by chargee under power of sale'),
  n('ATP107', 22, 2, 'Easements and Analogous Rights', 'Entry order, access order, easements, profits, covenants', false, false, 'Create and cancel easements', 'Land Act S.138-140; LRA S.99'),
  // TERM 3 (Weeks 23-33)
  n('ATP107', 23, 3, 'Cautions, Inhibitions and Restrictions', 'Definition, procedure for lodging and removing', true, false, 'Draft caution and inhibition applications', 'LRA S.71-76'),
  n('ATP107', 24, 3, 'Taxation on Instruments', 'Stamp duty computation, CGT, VAT, land rent/rates', false, true, 'Compute stamp duty and capital gains tax', 'Stamp Duty Act; Income Tax Act'),
  n('ATP107', 25, 3, 'Compulsory Acquisition', 'Process, valuation for compensation', false, false, 'Navigate compulsory acquisition procedure', 'Constitution Art.40(3); Land Act S.107'),
  n('ATP107', 26, 3, 'Allocation', 'Pre-requisites, allocation process, prescription', false, false, 'Understand land allocation procedures'),
  n('ATP107', 27, 3, 'Change of User and Extension of User', 'Application, provisional approval, survey, titling', false, false, 'Process change of user applications', 'Physical and Land Use Planning Act 2019'),
  n('ATP107', 28, 3, 'Extension and Renewal of Leases', 'Application, approval, new lease preparation', false, false, 'Process extension and renewal of leases', 'Land Act; Extension/Renewal Rules 2017'),
  n('ATP107', 29, 3, 'Ministry of Lands', 'Departments and roles in land administration', false, false, 'Identify institutional framework for land administration'),
  n('ATP107', 30, 3, 'National Land Commission', 'Conversion, public auction, tenders, public rights of way', false, false, 'Understand NLC functions in conveyancing', 'NLC Act No.5 of 2012'),
  n('ATP107', 31, 3, 'Environmental Management', 'NEMA, EIA licence, environmental audit', false, false, 'Navigate environmental requirements in conveyancing', 'EMCA'),
  n('ATP107', 32, 3, 'Contemporary Issues in Conveyancing', 'Replacement of lost titles, rectification', false, false, 'Process replacement and rectification of titles', 'LRA S.33'),
  n('ATP107', 33, 3, 'Contemporary Issues in Conveyancing', 'Electronic land registration (NLIMS/Ardhi Sasa), reforms', false, false, 'Understand electronic conveyancing systems'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ATP 108: COMMERCIAL TRANSACTIONS (33 weeks, continuous numbering)
// ═══════════════════════════════════════════════════════════════════════════════
const ATP108: SeedNode[] = [
  // TERM 1 (Weeks 1-11)
  n('ATP108', 1, 1, 'Companies – Formation and Basics', 'Types of companies; incorporation procedure; execution of documents', false, true, 'Apply procedures for company formation', 'Companies Act 2015'),
  n('ATP108', 2, 1, 'Companies – Statutory Compliance', 'Statutory returns, notices, appointments, annual returns', false, true, 'Process statutory compliance documentation'),
  n('ATP108', 3, 1, 'Companies – Resolutions, Meetings and Shares', 'Resolutions, share capital, shareholder agreements', true, true, 'Draft shareholder agreements and resolutions', 'Companies Act 2015'),
  n('ATP108', 4, 1, 'Companies – Charges and Beneficial Ownership', 'Company charges, registration, beneficial ownership', false, true, 'Register company charges and beneficial ownership'),
  n('ATP108', 5, 1, 'Partnerships – Forms and Incorporation', 'Types of partnerships; statutory compliance', true, true, 'Process partnership incorporation', 'Partnership Act 2012; LLP Act 2011'),
  n('ATP108', 6, 1, 'Partnerships – Deed, Property and Dissolution', 'Partnership deed drafting; property; dissolution', true, true, 'Draft a partnership deed', 'Partnership Act 2012'),
  n('ATP108', 7, 1, 'Mergers and Take-overs – Framework', 'Legal framework; term sheet; due diligence', true, true, 'Prepare due diligence questionnaire and report', 'Competition Act 2015; Capital Markets Act'),
  n('ATP108', 8, 1, 'Mergers – Notification and Thresholds', 'Disclosure, notifiable mergers, CAK thresholds, COMESA', false, true, 'Determine merger notification requirements', 'Capital Markets (Take-overs) Regulations'),
  n('ATP108', 9, 1, 'Take-overs – Listed Companies', 'Listed company take-over procedures', false, false, 'Apply take-over procedures for listed companies'),
  n('ATP108', 10, 1, 'Take-overs – Minority Rights', 'Rights of minorities; defenses to take-overs', false, false, 'Evaluate minority shareholder protections'),
  n('ATP108', 11, 1, 'Share Transfers', 'Share transfer process and documentation', false, false, 'Process share transfers'),
  // TERM 2 (Weeks 12-22)
  n('ATP108', 12, 2, 'Insolvency/Bankruptcy – Applications', 'Debtor and creditor applications; discharge', false, true, 'Draft bankruptcy application documents', 'Insolvency Act 2015'),
  n('ATP108', 13, 2, 'Bankruptcy – Alternatives', 'Voluntary arrangement, summary instalment order, no asset procedure', false, true, 'Evaluate alternatives to bankruptcy'),
  n('ATP108', 14, 2, 'Corporate Insolvency – Liquidation', 'Members vs creditors voluntary; court liquidation', false, true, 'Process liquidation proceedings'),
  n('ATP108', 15, 2, 'Corporate Insolvency – Alternatives', 'Administration; company voluntary arrangement (CVA)', false, true, 'Draft administration and CVA documents'),
  n('ATP108', 16, 2, 'Financial Services Regulation', 'Financial regulation, key players, digital payments', false, false, 'Understand financial services regulatory framework'),
  n('ATP108', 17, 2, 'National Payment Systems Act', 'CBK authority, PSP authorization, risk management', false, false, 'Apply National Payment Systems Act provisions', 'National Payment Systems Act 2011'),
  n('ATP108', 18, 2, 'Data Protection', 'Principles of data processing; data subject rights; ODPC', false, false, 'Apply data protection principles in commercial contexts', 'Data Protection Act 2019'),
  n('ATP108', 19, 2, 'Commercial Arrangements – JV and Distribution', 'Joint venture and distributorship agreements', true, true, 'Draft joint venture and distributorship agreements'),
  n('ATP108', 20, 2, 'Commercial Arrangements – Franchise, Guarantee, Trust', 'Franchise, guarantee, and trust deed agreements', true, true, 'Draft franchise agreements and trust deeds'),
  n('ATP108', 21, 2, 'MPSR Security Rights – Creation', 'Creation of security rights in movable property', false, true, 'Create security rights under MPSR Act', 'MPSR Act 2017'),
  n('ATP108', 22, 2, 'Security Rights – Perfection', 'Perfection of security rights', false, true, 'Perfect security interests in movable property'),
  // TERM 3 (Weeks 23-33)
  n('ATP108', 23, 3, 'Security Rights – Registration and Priorities', 'Registration effect; third parties; priorities', false, true, 'Determine priority of competing security interests'),
  n('ATP108', 24, 3, 'Security Rights – Enforcement', 'Enforcement of security rights', false, true, 'Enforce security rights under MPSR Act'),
  n('ATP108', 25, 3, 'Taxation – Classification', 'Introduction to taxation in commerce; classification', false, true, 'Classify taxes applicable to commercial transactions', 'Income Tax Act'),
  n('ATP108', 26, 3, 'Taxation – Types of Income Tax', 'Types of income tax provisions', false, true, 'Identify types of income tax'),
  n('ATP108', 27, 3, 'Taxation – Planning, Avoidance, and CGT', 'Tax planning vs avoidance vs evasion; CGT computation', false, true, 'Compute capital gains tax', 'Income Tax Act Cap 470'),
  n('ATP108', 28, 3, 'Tax Dispute Resolution', 'Dispute resolution mechanisms; objections; appeals', false, true, 'Navigate tax dispute resolution', 'Tax Appeals Tribunal Act'),
  n('ATP108', 29, 3, 'Tax Procedures Act', 'Tax returns, assessment, collection, recovery, penalties', false, true, 'Apply Tax Procedures Act provisions', 'Tax Procedures Act'),
  n('ATP108', 30, 3, 'Revision – Past Paper Analysis', 'Analysis of past paper questions (Companies & Partnerships)', false, false, 'Apply learned principles to past paper scenarios'),
  n('ATP108', 31, 3, 'Revision – Past Paper Analysis', 'Analysis of past paper questions (M&A & Insolvency)', false, false, 'Analyze M&A and insolvency past paper questions'),
  n('ATP108', 32, 3, 'Revision – Past Paper Analysis', 'Analysis of past paper questions (MPSR & Tax)', false, false, 'Apply MPSR and taxation principles to exam scenarios'),
  n('ATP108', 33, 3, 'Revision – Past Paper Analysis', 'Comprehensive revision for written examination', false, false, 'Demonstrate mastery of commercial transactions'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINE ALL COURSES
// ═══════════════════════════════════════════════════════════════════════════════
const ALL_NODES: SeedNode[] = [
  ...ATP100, ...ATP101, ...ATP102, ...ATP103, ...ATP104,
  ...ATP105, ...ATP106, ...ATP107, ...ATP108,
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
async function seedProduction() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  console.log(`🌱 Seeding ${ALL_NODES.length} syllabus nodes from ATP 2026/2027 Course Outlines...`);

  // 1. Ensure table exists with updated schema
  await sql`
    CREATE TABLE IF NOT EXISTS syllabus_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_code TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      ksl_term INTEGER NOT NULL DEFAULT 1,
      topic_name TEXT NOT NULL,
      subtopic_name TEXT,
      is_drafting_node BOOLEAN DEFAULT false NOT NULL,
      is_high_yield BOOLEAN DEFAULT false NOT NULL,
      learning_outcome TEXT,
      section_reference TEXT,
      core_texts JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `;

  // 2. Ensure node_progress table exists
  await sql`
    CREATE TABLE IF NOT EXISTS node_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      node_id UUID NOT NULL REFERENCES syllabus_nodes(id),
      phase TEXT NOT NULL DEFAULT 'NOTE',
      note_completed BOOLEAN DEFAULT false NOT NULL,
      exhibit_viewed BOOLEAN DEFAULT false NOT NULL,
      diagnosis_score REAL,
      diagnosis_passed BOOLEAN DEFAULT false NOT NULL,
      mastery_score REAL,
      mastery_passed BOOLEAN DEFAULT false NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      last_attempt_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `;

  // 3. Clear existing mock data
  await sql`DELETE FROM syllabus_nodes;`;
  console.log('🗑️  Cleared existing syllabus data');

  // 4. Insert all production nodes one at a time (Neon HTTP tagged-template requirement)
  let inserted = 0;

  for (const nd of ALL_NODES) {
    await sql`
      INSERT INTO syllabus_nodes
        (id, unit_code, week_number, ksl_term, topic_name, subtopic_name,
         is_drafting_node, is_high_yield, learning_outcome, section_reference, core_texts, created_at)
      VALUES (
        gen_random_uuid(),
        ${nd.unitCode},
        ${nd.weekNumber},
        ${nd.kslTerm},
        ${nd.topicName},
        ${nd.subtopicName},
        ${nd.isDraftingNode},
        ${nd.isHighYield},
        ${nd.learningOutcome},
        ${nd.sectionReference},
        NULL,
        NOW()
      )
    `;
    inserted++;
    if (inserted % 50 === 0) {
      console.log(`   ✅ Inserted ${inserted}/${ALL_NODES.length}`);
    }
  }
  console.log(`   ✅ Inserted ${inserted}/${ALL_NODES.length} total`);

  // 5. Verification
  const countResult = await sql`SELECT COUNT(*) as count FROM syllabus_nodes;`;
  const draftingCount = await sql`SELECT COUNT(*) as count FROM syllabus_nodes WHERE is_drafting_node = true;`;
  const highYieldCount = await sql`SELECT COUNT(*) as count FROM syllabus_nodes WHERE is_high_yield = true;`;

  const courseCounts = await sql`
    SELECT unit_code, COUNT(*) as count
    FROM syllabus_nodes
    GROUP BY unit_code
    ORDER BY unit_code;
  `;

  console.log('\n═══════════════════════════════════════');
  console.log('📊 SEED VERIFICATION REPORT');
  console.log('═══════════════════════════════════════');
  console.log(`Total nodes:      ${countResult[0].count}`);
  console.log(`Drafting nodes:   ${draftingCount[0].count}`);
  console.log(`High-yield nodes: ${highYieldCount[0].count}`);
  console.log('\nPer course:');
  for (const row of courseCounts) {
    console.log(`  ${row.unit_code}: ${row.count} nodes`);
  }
  console.log('═══════════════════════════════════════');
  console.log('✅ Production seed complete!');

  process.exit(0);
}

seedProduction().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
