/**
 * YNAI Bar Exam Prep - Full Curriculum Seed Script
 * 
 * Seeds the complete ATP curriculum for all 9 units:
 * - ATP 100: Civil Litigation
 * - ATP 101: Criminal Litigation
 * - ATP 102: Probate and Administration
 * - ATP 103: Legal Writing and Drafting
 * - ATP 104: Trial Advocacy
 * - ATP 105: Professional Ethics
 * - ATP 106: Legal Practice Management
 * - ATP 107: Conveyancing
 * - ATP 108: Commercial Transactions
 * 
 * Run with: npx tsx scripts/seed-full-curriculum.ts
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MicroSkill {
  code: string;
  title: string;
  description?: string;
  formats: ('written' | 'oral' | 'drafting' | 'mcq')[];
  examWeight: number;
  minPracticeReps?: number;
  minTimedProofs?: number;
  minVerificationPasses?: number;
  prerequisites?: string[];
}

interface ATPUnit {
  id: string;
  name: string;
  description: string;
  assessmentWeights: {
    projectWork: number;
    oralExam: number;
    writtenExam: number;
  };
  skills: MicroSkill[];
}

// ============================================
// FULL CURRICULUM DATA
// ============================================

const ATP_UNITS: ATPUnit[] = [
  // ========================================
  // ATP 100: CIVIL LITIGATION
  // ========================================
  {
    id: 'atp-100',
    name: 'Civil Litigation',
    description: 'Practical skills in resolution of civil disputes under Kenyan law',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Taking Instructions
      { code: 'civ-client-interview', title: 'Client Interview & Conferencing', description: 'Conduct effective client interviews and establish advocate-client relationship', formats: ['oral', 'written'], examWeight: 0.05 },
      { code: 'civ-legal-opinion', title: 'Legal Opinion Drafting', description: 'Formulate legal opinions from interview circumstances', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'civ-demand-letter', title: 'Demand Letter Drafting', description: 'Construct demand letters before action', formats: ['drafting'], examWeight: 0.04 },
      { code: 'civ-prelim-considerations', title: 'Pre-Litigation Considerations', description: 'Assess cause of action, limitation, feasibility, and ethical considerations', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Courts and Jurisdiction
      { code: 'civ-jurisdiction', title: 'Courts and Jurisdiction Analysis', description: 'Analyze hierarchical court structure and jurisdictional factors in Kenya', formats: ['written', 'mcq'], examWeight: 0.06, prerequisites: [] },
      { code: 'civ-pecuniary-jurisdiction', title: 'Pecuniary Jurisdiction', description: 'Determine appropriate court based on monetary value of claims', formats: ['mcq', 'written'], examWeight: 0.03 },
      { code: 'civ-subject-matter', title: 'Subject Matter Jurisdiction', description: 'Identify correct forum based on nature of dispute', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Overriding Objective
      { code: 'civ-overriding-obj', title: 'Overriding Objective Principle', description: 'Apply the overriding objective concept in civil litigation (s.1A-1C CPA)', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Parties to a Suit
      { code: 'civ-parties', title: 'Parties to Civil Suits', description: 'Identify proper parties, joinder, mis-joinder, and non-joinder', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'civ-third-party', title: 'Third Party Proceedings', description: 'Conduct third party process and interpleader proceedings', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'civ-representative', title: 'Representative Suits', description: 'Handle representative suits, interested parties, and amicus curiae', formats: ['written'], examWeight: 0.03 },
      
      // Commencement of Suits
      { code: 'civ-plaint-draft', title: 'Plaint Drafting', description: 'Draft plaints, statements of claim, and memorandum of claim', formats: ['drafting'], examWeight: 0.06, prerequisites: ['civ-jurisdiction', 'civ-parties'] },
      { code: 'civ-defence-draft', title: 'Defence Drafting', description: 'Draft defence, counterclaim, and reply pleadings', formats: ['drafting'], examWeight: 0.05, prerequisites: ['civ-plaint-draft'] },
      { code: 'civ-originating-summons', title: 'Originating Summons', description: 'Prepare originating summons and notices of motion', formats: ['drafting'], examWeight: 0.04 },
      { code: 'civ-petitions', title: 'Petition Drafting', description: 'Draft election, constitutional, matrimonial and winding up petitions', formats: ['drafting'], examWeight: 0.05 },
      { code: 'civ-affidavits', title: 'Affidavits in Pleadings', description: 'Draft and use affidavits in civil proceedings', formats: ['drafting'], examWeight: 0.04 },
      { code: 'civ-service', title: 'Service of Process', description: 'Effect service of summons and other court processes', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'civ-amendment', title: 'Amendment of Pleadings', description: 'Execute amendment of pleadings process', formats: ['written', 'drafting'], examWeight: 0.03 },
      
      // Interlocutory Applications
      { code: 'civ-interlocutory', title: 'Interlocutory Applications', description: 'Draft various types of interlocutory applications', formats: ['written', 'drafting', 'oral'], examWeight: 0.05, prerequisites: ['civ-plaint-draft'] },
      { code: 'civ-injunctions', title: 'Injunction Applications', description: 'Apply for orders under Order 40, Mareva injunctions, Anton-Piller orders', formats: ['written', 'drafting', 'oral'], examWeight: 0.05, prerequisites: ['civ-interlocutory'] },
      { code: 'civ-discovery', title: 'Discovery and Inspection', description: 'Conduct discovery and inspection processes', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'civ-summary-judg', title: 'Summary Judgment', description: 'Apply for disposal by summary procedure', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'civ-striking-out', title: 'Striking Out Applications', description: 'Draft and respond to striking out applications', formats: ['written', 'drafting'], examWeight: 0.03 },
      
      // Pre-Trial Process
      { code: 'civ-pretrial', title: 'Pre-Trial Process', description: 'Conduct case conferencing and obtain pre-trial directions', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Hearing of Suits
      { code: 'civ-trial-conduct', title: 'Trial Conduct', description: 'Follow proper trial procedure and order of proceedings', formats: ['oral', 'written'], examWeight: 0.05, prerequisites: ['civ-pretrial'] },
      { code: 'civ-examination', title: 'Examination of Witnesses', description: 'Conduct examination-in-chief, cross-examination and re-examination', formats: ['oral'], examWeight: 0.05, prerequisites: ['civ-trial-conduct'] },
      { code: 'civ-submissions', title: 'Making Submissions', description: 'Prepare and deliver oral and written submissions', formats: ['oral', 'written'], examWeight: 0.04 },
      
      // Rulings, Orders, Judgments and Decrees
      { code: 'civ-judgment-analysis', title: 'Judgment Analysis', description: 'Analyze rulings, judgments and extract orders and decrees', formats: ['written'], examWeight: 0.04 },
      { code: 'civ-decree-extraction', title: 'Decree Extraction', description: 'Extract orders and decrees after judgment', formats: ['drafting'], examWeight: 0.03 },
      
      // Remedies and Execution
      { code: 'civ-stay-execution', title: 'Stay of Execution', description: 'Apply for stay of execution and payment in instalments', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'civ-objection', title: 'Objection Proceedings', description: 'Conduct objection proceedings', formats: ['written', 'oral'], examWeight: 0.03 },
      { code: 'civ-execution', title: 'Execution of Decrees', description: 'Conduct notice to show cause, garnishee proceedings, execution against government', formats: ['written', 'drafting'], examWeight: 0.05, prerequisites: ['civ-judgment-analysis'] },
      
      // Review and Appeal
      { code: 'civ-review', title: 'Review Applications', description: 'Apply for and conduct review proceedings', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'civ-appeal', title: 'Appeals Procedure', description: 'Handle appeals from subordinate courts to superior courts', formats: ['written', 'oral', 'drafting'], examWeight: 0.06, prerequisites: ['civ-judgment-analysis'] },
      { code: 'civ-appeal-docs', title: 'Appeal Documentation', description: 'Prepare record of appeal, memorandum of appeal, and submissions', formats: ['drafting'], examWeight: 0.04 },
      
      // Judicial Review and Constitutional Litigation
      { code: 'civ-judicial-review', title: 'Judicial Review', description: 'Apply judicial review procedures and remedies', formats: ['written', 'drafting', 'oral'], examWeight: 0.05 },
      { code: 'civ-const-litigation', title: 'Constitutional Litigation', description: 'Handle constitutional petitions and enforcement of rights', formats: ['written', 'drafting', 'oral'], examWeight: 0.06 },
      
      // Costs
      { code: 'civ-costs', title: 'Costs in Civil Proceedings', description: 'Apply principles of costs, taxation, and bills of costs', formats: ['written', 'mcq', 'drafting'], examWeight: 0.04, prerequisites: ['civ-judgment-analysis'] },
      
      // Tribunals
      { code: 'civ-tribunals', title: 'Tribunal Procedures', description: 'Navigate procedures in Business Rent Tribunal, Rent Tribunal, and NET', formats: ['written', 'mcq'], examWeight: 0.03 },
    ]
  },

  // ========================================
  // ATP 101: CRIMINAL LITIGATION
  // ========================================
  {
    id: 'atp-101',
    name: 'Criminal Litigation',
    description: 'Procedural aspects of applying Criminal Law in Kenya',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Jurisdiction
      { code: 'crim-jurisdiction', title: 'Criminal Court Jurisdiction', description: 'Understand jurisdiction across Magistrates courts, High Court, Court of Appeal, Supreme Court, ICC', formats: ['written', 'mcq'], examWeight: 0.05 },
      
      // Arrests
      { code: 'crim-arrest-warrant', title: 'Arrest with Warrant', description: 'Draft and execute warrants of arrest', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'crim-arrest-no-warrant', title: 'Arrest without Warrant', description: 'Understand circumstances and procedure for arrest without warrant', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Identification Parades
      { code: 'crim-id-parades', title: 'Identification Parades', description: 'Conduct and document identification parades (Form P.156)', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // File Preparation
      { code: 'crim-file-prep', title: 'Trial File Preparation', description: 'Prepare police/prosecution, advocate, and court files', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Complaint and Charge
      { code: 'crim-charge-draft', title: 'Charge Drafting', description: 'Draft charges including capital, alternative, conspiracy charges', formats: ['drafting'], examWeight: 0.06 },
      { code: 'crim-charge-defects', title: 'Charge Defects', description: 'Identify defects in drafting charges (duplicity, lack of ingredients)', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'crim-joinder', title: 'Joinder in Criminal Cases', description: 'Handle joinder of persons and counts', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'crim-motion-quash', title: 'Motion to Quash', description: 'Draft applications to dismiss charges', formats: ['drafting', 'oral'], examWeight: 0.03 },
      
      // Plea
      { code: 'crim-plea', title: 'Plea Procedure', description: 'Handle equivocal/unequivocal pleas, change of plea', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'crim-plea-bargain', title: 'Plea Bargaining', description: 'Negotiate and document plea agreements', formats: ['written', 'drafting', 'oral'], examWeight: 0.04 },
      { code: 'crim-autrefois', title: 'Autrefois Acquit/Convict', description: 'Apply doctrines of autrefois acquit, autrefois convict, and pardon', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Bail and Bond
      { code: 'crim-bail', title: 'Bail Applications', description: 'Apply for police bond, anticipatory bail, bail pending trial/appeal', formats: ['written', 'drafting', 'oral'], examWeight: 0.05 },
      { code: 'crim-sureties', title: 'Sureties and Recognizance', description: 'Handle sureties, discharge, forfeitures', formats: ['written', 'drafting'], examWeight: 0.03 },
      
      // Pre-Trial
      { code: 'crim-pretrial', title: 'Pre-trial Conferencing', description: 'Conduct meetings with accused, prosecution communication, witness statements', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Trial Process
      { code: 'crim-fair-hearing', title: 'Right to Fair Hearing', description: 'Apply constitutional fair hearing principles in criminal trials', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'crim-opening', title: 'Opening Statement', description: 'Deliver effective opening statements in criminal trials', formats: ['oral'], examWeight: 0.03 },
      { code: 'crim-examination', title: 'Witness Examination', description: 'Examine ordinary, minor, expert, hostile witnesses', formats: ['oral'], examWeight: 0.06 },
      { code: 'crim-exhibits', title: 'Production of Exhibits', description: 'Present and handle exhibits at trial', formats: ['oral', 'written'], examWeight: 0.03 },
      { code: 'crim-trial-within', title: 'Trial within Trial', description: 'Conduct voir dire proceedings', formats: ['oral', 'written'], examWeight: 0.04 },
      { code: 'crim-no-case', title: 'No Case to Answer', description: 'Make submissions of no case to answer', formats: ['oral', 'written'], examWeight: 0.04 },
      { code: 'crim-defence', title: 'Defence Case', description: 'Present defence evidence and witnesses', formats: ['oral'], examWeight: 0.04 },
      { code: 'crim-final-submissions', title: 'Final Submissions', description: 'Prepare and deliver closing arguments', formats: ['oral', 'written'], examWeight: 0.04 },
      
      // Post-Trial
      { code: 'crim-judgment', title: 'Judgment Analysis', description: 'Analyze criminal judgments', formats: ['written'], examWeight: 0.03 },
      { code: 'crim-victim-impact', title: 'Victim Impact Assessment', description: 'Handle victim impact assessment proceedings', formats: ['written', 'oral'], examWeight: 0.03 },
      { code: 'crim-mitigation', title: 'Mitigation/Aggravation', description: 'Present mitigation and respond to aggravation', formats: ['oral', 'written'], examWeight: 0.04 },
      { code: 'crim-sentencing', title: 'Sentencing Process', description: 'Navigate the sentencing process', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Lunacy
      { code: 'crim-lunacy', title: 'Accused Incapacity', description: 'Handle lunacy or other incapacity of accused', formats: ['written', 'mcq'], examWeight: 0.02 },
      
      // Interlocutory Applications
      { code: 'crim-interlocutory', title: 'Criminal Interlocutory Applications', description: 'Draft transfer, termination applications, amicus curiae', formats: ['drafting', 'oral'], examWeight: 0.03 },
      
      // Revision and Appeals
      { code: 'crim-revision', title: 'Criminal Revision', description: 'Apply for revision in criminal matters', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'crim-appeal', title: 'Criminal Appeals', description: 'Handle appeals across court hierarchy', formats: ['written', 'drafting', 'oral'], examWeight: 0.06 },
      
      // Special Procedures
      { code: 'crim-private-prosecution', title: 'Private Prosecutions', description: 'Initiate and conduct private prosecutions', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'crim-inquest', title: 'Inquests', description: 'Participate in inquest proceedings', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'crim-extradition', title: 'Extradition Proceedings', description: 'Handle extradition applications', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'crim-habeas-corpus', title: 'Habeas Corpus', description: 'Apply for habeas corpus', formats: ['drafting', 'oral'], examWeight: 0.03 },
      { code: 'crim-judicial-review', title: 'Judicial Review (Criminal)', description: 'Apply judicial review in criminal matters', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'crim-special-courts', title: 'Special Courts Procedure', description: 'Practice in Children\'s, Anti-corruption, Traffic, Courts-Martial', formats: ['written', 'mcq'], examWeight: 0.03 },
    ]
  },

  // ========================================
  // ATP 102: PROBATE AND ADMINISTRATION
  // ========================================
  {
    id: 'atp-102',
    name: 'Probate and Administration',
    description: 'Advising and resolving issues relating to estates of deceased persons',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Introduction
      { code: 'prob-historical', title: 'Succession Law Framework', description: 'Apply historical background and commencement of Law of Succession Act', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'prob-exemptions', title: 'Property Exemptions', description: 'Identify property exempted from Law of Succession (Islamic, co-ownership, nominations)', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Testate Succession
      { code: 'prob-wills-validity', title: 'Valid Will Requirements', description: 'Identify essentials of valid written and oral wills (s.11 LSA)', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'prob-wills-draft', title: 'Will Drafting', description: 'Draw valid wills, codicils, and concurrent wills', formats: ['drafting'], examWeight: 0.06 },
      { code: 'prob-wills-capacity', title: 'Testamentary Capacity', description: 'Assess mental capacity, insane delusions, knowledge and approval', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'prob-revocation', title: 'Revocation of Wills', description: 'Handle revocation, alteration and revival of wills (s.17-21)', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'prob-wills-proof', title: 'Proof of Wills', description: 'Prove oral wills, wills with/without executors', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Objections
      { code: 'prob-objections', title: 'Succession Objections', description: 'Handle objections under s.26, 29 LSA', formats: ['written', 'drafting', 'oral'], examWeight: 0.05 },
      { code: 'prob-reasonable-provision', title: 'Reasonable Provision', description: 'Apply for reasonable provision (testate and intestate)', formats: ['written', 'drafting'], examWeight: 0.05 },
      
      // Intestate Succession
      { code: 'prob-intestate', title: 'Intestate Succession', description: 'Apply rules of intestate succession including dependents and children', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'prob-marriage-effect', title: 'Marriage and Succession', description: 'Analyze effect of different marriages on succession', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Estate Protection
      { code: 'prob-intermeddling', title: 'Estate Protection', description: 'Handle intermeddling and protection of estate', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Grants
      { code: 'prob-jurisdiction', title: 'Succession Jurisdiction', description: 'Determine jurisdiction under Magistrates Courts Act 2015', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'prob-petition', title: 'Petition for Grant', description: 'Draft petitions for letters of administration', formats: ['drafting'], examWeight: 0.06 },
      { code: 'prob-gazettement', title: 'Gazettement Process', description: 'Handle gazettement and simple grants', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'prob-confirmation', title: 'Confirmation of Grants', description: 'Apply for confirmation of grants', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'prob-revocation-grant', title: 'Revocation of Grants', description: 'Apply for revocation and annulment of grants', formats: ['written', 'drafting', 'oral'], examWeight: 0.05 },
      { code: 'prob-limited-grants', title: 'Limited Grants', description: 'Handle various types of limited grants', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Foreign Succession
      { code: 'prob-foreign', title: 'Foreign Succession', description: 'Handle succession for property in foreign jurisdictions', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Administration
      { code: 'prob-admin-duties', title: 'Administrator Duties', description: 'Advise on roles and duties of administrators', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'prob-estate-accounts', title: 'Estate Accounts', description: 'Prepare and file estate accounts', formats: ['written', 'drafting'], examWeight: 0.05 },
    ]
  },

  // ========================================
  // ATP 103: LEGAL WRITING AND DRAFTING
  // ========================================
  {
    id: 'atp-103',
    name: 'Legal Writing and Drafting',
    description: 'Skills for undertaking writing tasks demanded of advocates',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Legal Writing
      { code: 'lwd-qualities', title: 'Good Legal Writing', description: 'Apply qualities of good legal writing including plain English', formats: ['written'], examWeight: 0.04 },
      { code: 'lwd-gender-neutral', title: 'Bias-Free Language', description: 'Use gender-neutral and bias-free language', formats: ['written'], examWeight: 0.03 },
      { code: 'lwd-process', title: 'Writing Process', description: 'Apply outlines, drafting, revising, editing, proofreading', formats: ['written'], examWeight: 0.04 },
      { code: 'lwd-paragraphing', title: 'Paragraphing', description: 'Construct coherent paragraphs with unity and transitions', formats: ['written'], examWeight: 0.04 },
      { code: 'lwd-sentences', title: 'Sentence Construction', description: 'Use active voice, action verbs, concrete subjects', formats: ['written'], examWeight: 0.04 },
      { code: 'lwd-transitions', title: 'Transitions', description: 'Use generic, orienting, and substantive transitions', formats: ['written'], examWeight: 0.03 },
      { code: 'lwd-research', title: 'Advanced Legal Research', description: 'Apply research skills in legal writing', formats: ['written'], examWeight: 0.05 },
      { code: 'lwd-case-briefs', title: 'Case Briefs', description: 'Prepare case briefs with essential elements', formats: ['written'], examWeight: 0.05 },
      { code: 'lwd-case-analysis', title: 'Case Analysis', description: 'Conduct comprehensive case analysis', formats: ['written'], examWeight: 0.05 },
      
      // Legal Drafting
      { code: 'lwd-letters', title: 'Legal Correspondence', description: 'Draft letters to clients, opponents, and demand letters', formats: ['drafting'], examWeight: 0.05 },
      { code: 'lwd-demand-letter', title: 'Demand Letters', description: 'Draft effective demand letters', formats: ['drafting'], examWeight: 0.04 },
      { code: 'lwd-legal-opinion', title: 'Legal Opinion Writing', description: 'Draft legal opinions and memoranda', formats: ['drafting'], examWeight: 0.06 },
      { code: 'lwd-contracts', title: 'Contract Drafting', description: 'Draft employment contracts, leases, sale agreements', formats: ['drafting'], examWeight: 0.06 },
      { code: 'lwd-affidavits', title: 'Affidavits & Declarations', description: 'Draft affidavits and statutory declarations', formats: ['drafting'], examWeight: 0.05 },
      { code: 'lwd-deed-polls', title: 'Deed Polls', description: 'Draft deed polls', formats: ['drafting'], examWeight: 0.03 },
      { code: 'lwd-power-attorney', title: 'Power of Attorney', description: 'Draft general and specific powers of attorney', formats: ['drafting'], examWeight: 0.04 },
      
      // Legislative Drafting
      { code: 'lwd-legis-intro', title: 'Legislative Drafting Introduction', description: 'Understand role of drafter and legislative process', formats: ['written'], examWeight: 0.04 },
      { code: 'lwd-bill-structure', title: 'Structure of a Bill', description: 'Draft preliminary, substantive, miscellaneous, final provisions', formats: ['drafting'], examWeight: 0.05 },
      { code: 'lwd-legis-sentence', title: 'Legislative Sentence', description: 'Apply proper syntax and time in legislation', formats: ['drafting', 'written'], examWeight: 0.04 },
      { code: 'lwd-amendments', title: 'Amending Legislation', description: 'Draft amending legislation', formats: ['drafting'], examWeight: 0.04 },
      { code: 'lwd-penal', title: 'Penal Provisions', description: 'Draft offences and penalties', formats: ['drafting'], examWeight: 0.04 },
      { code: 'lwd-delegated', title: 'Delegated Legislation', description: 'Draft regulations and subsidiary legislation', formats: ['drafting'], examWeight: 0.04 },
    ]
  },

  // ========================================
  // ATP 104: TRIAL ADVOCACY
  // ========================================
  {
    id: 'atp-104',
    name: 'Trial Advocacy',
    description: 'Development of legal skills for trial advocacy practice',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Introduction
      { code: 'adv-intro', title: 'Trial Advocacy Fundamentals', description: 'Understand key skills, history, and sources of trial advocacy', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'adv-places', title: 'Places of Advocacy', description: 'Navigate courts, tribunals, and ADR venues', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Qualities and Ethics
      { code: 'adv-qualities', title: 'Qualities of Trial Lawyer', description: 'Demonstrate clarity, integrity, judgment, courage, tenacity', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'adv-ethics', title: 'Ethical Duties', description: 'Apply duties to client, opposing counsel, witnesses, court', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'adv-conflict', title: 'Conflict of Interest', description: 'Handle cab rank rule, voluntary/compelled disqualification', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Court Etiquette
      { code: 'adv-etiquette', title: 'Court Etiquette', description: 'Observe dress, punctuality, introductions, mode of address', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Psychology
      { code: 'adv-psychology', title: 'Psychology of Advocacy', description: 'Apply sympathy rule, likability, competence, listening', formats: ['written', 'oral'], examWeight: 0.04 },
      
      // Pre-Trial
      { code: 'adv-client-interview', title: 'Client Interview', description: 'Conduct effective client and witness interviews', formats: ['oral', 'written'], examWeight: 0.05 },
      { code: 'adv-case-theory', title: 'Case Theory Development', description: 'Develop case theory through pre-trial analysis', formats: ['written'], examWeight: 0.05 },
      { code: 'adv-case-analysis', title: 'Case Analysis', description: 'Analyze who, where, when, elements, pleadings, issues, evidence', formats: ['written'], examWeight: 0.05 },
      
      // Trial Skills
      { code: 'adv-opening', title: 'Opening Statement', description: 'Present effective opening statements', formats: ['oral'], examWeight: 0.06 },
      { code: 'adv-examination-chief', title: 'Examination-in-Chief', description: 'Conduct effective examination-in-chief', formats: ['oral'], examWeight: 0.08 },
      { code: 'adv-cross-examination', title: 'Cross-Examination', description: 'Conduct effective cross-examination of lay and expert witnesses', formats: ['oral'], examWeight: 0.10 },
      { code: 'adv-re-examination', title: 'Re-Examination', description: 'Conduct effective re-examination', formats: ['oral'], examWeight: 0.05 },
      { code: 'adv-exhibits', title: 'Exhibit Presentation', description: 'Present exhibits effectively at trial', formats: ['oral'], examWeight: 0.04 },
      { code: 'adv-closing', title: 'Closing Argument', description: 'Present effective closing arguments', formats: ['oral'], examWeight: 0.06 },
      
      // Objections
      { code: 'adv-objections', title: 'Making Objections', description: 'Make preliminary and trial objections', formats: ['oral'], examWeight: 0.04 },
      
      // Appellate and Written
      { code: 'adv-appellate', title: 'Appellate Advocacy', description: 'Apply advocacy skills in appeals', formats: ['oral', 'written'], examWeight: 0.04 },
      { code: 'adv-skeleton', title: 'Skeleton Arguments', description: 'Draft and present skeleton arguments', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Contempt and ADR
      { code: 'adv-contempt', title: 'Contempt of Court', description: 'Handle civil and criminal contempt', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'adv-adr', title: 'ADR Advocacy', description: 'Apply trial advocacy skills in ADR', formats: ['oral', 'written'], examWeight: 0.03 },
    ]
  },

  // ========================================
  // ATP 105: PROFESSIONAL ETHICS
  // ========================================
  {
    id: 'atp-105',
    name: 'Professional Ethics',
    description: 'Professional and ethical standards in the practice of law',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Introduction
      { code: 'eth-foundations', title: 'Ethical Foundations', description: 'Apply philosophical foundations of legal ethics', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'eth-profession', title: 'Law as Profession', description: 'Understand nature and evolution of legal profession in Kenya', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Law Society
      { code: 'eth-lsk', title: 'Law Society of Kenya', description: 'Navigate LSK membership, governance, and obligations', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Duties
      { code: 'eth-duty-court', title: 'Duty to Court', description: 'Apply advocate duties to court under s.55 Advocates Act', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'eth-duty-client', title: 'Duty to Client', description: 'Apply loyalty, confidentiality, communication, candor duties', formats: ['written', 'mcq'], examWeight: 0.06 },
      { code: 'eth-privilege', title: 'Advocate-Client Privilege', description: 'Apply legal privilege and handle waiver', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'eth-duty-profession', title: 'Duty to Profession', description: 'Apply duties under s.4 LSK Act', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Role in Society
      { code: 'eth-justice', title: 'Administration of Justice', description: 'Role in justice administration and upholding Constitution', formats: ['written'], examWeight: 0.04 },
      { code: 'eth-pro-bono', title: 'Pauper Briefs & Pro Bono', description: 'Handle pauper briefs and pro bono services', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Professional Practice
      { code: 'eth-undertakings', title: 'Professional Undertakings', description: 'Draft and honor professional undertakings', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'eth-conflict', title: 'Conflict of Interest', description: 'Identify and handle conflicts of interest', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'eth-limits', title: 'Limits of Duties', description: 'Navigate transactions with clients and advocate negligence', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'eth-etiquette', title: 'Professional Etiquette', description: 'Follow LSK dress code and professional decorum', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Other Sectors
      { code: 'eth-judicial', title: 'Judicial Ethics', description: 'Apply Bangalore Principles and judicial ethics', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'eth-inhouse', title: 'In-house Counsel Ethics', description: 'Handle ethics for public and private in-house counsel', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Remuneration
      { code: 'eth-remuneration', title: 'Advocate Remuneration', description: 'Apply Part IX Advocates Act and Remuneration Order', formats: ['written', 'mcq', 'drafting'], examWeight: 0.05 },
      { code: 'eth-retainer', title: 'Retainer Practice', description: 'Handle nature, modes, limits, and termination of retainer', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'eth-lien', title: 'Advocate Lien', description: 'Apply retaining, specific, and statutory liens', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Marketing and Advertising
      { code: 'eth-advertising', title: 'Marketing and Advertising', description: 'Navigate advertising, touting, and champerty rules', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Liability
      { code: 'eth-liability', title: 'Advocate Liability', description: 'Handle negligence, trusteeship, and third party liability', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'eth-contempt', title: 'Contempt of Court', description: 'Handle contempt in and outside court', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Business and Discipline
      { code: 'eth-law-firm', title: 'Law Firm Establishment', description: 'Establish and manage law firms and multi-disciplinary practice', formats: ['written'], examWeight: 0.04 },
      { code: 'eth-discipline', title: 'Disciplinary Process', description: 'Navigate ACC, ADT, and professional offences', formats: ['written', 'mcq'], examWeight: 0.05 },
    ]
  },

  // ========================================
  // ATP 106: LEGAL PRACTICE MANAGEMENT
  // ========================================
  {
    id: 'atp-106',
    name: 'Legal Practice Management',
    description: 'Skills to establish and manage a law practice',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Office Management
      { code: 'lpm-intro', title: 'Legal Practice Introduction', description: 'Understand historical background and types of law offices', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'lpm-business-org', title: 'Business Organizations', description: 'Choose appropriate business structure for law practice', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'lpm-office-manager', title: 'Office Manager Role', description: 'Understand roles and functions in law firm management', formats: ['written'], examWeight: 0.03 },
      { code: 'lpm-customer-service', title: 'Customer Service Management', description: 'Apply modern trends in client service', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-standards', title: 'Standards and Policies', description: 'Develop and implement firm standards, policies, procedures', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'lpm-ict', title: 'ICT in Legal Practice', description: 'Apply automation, document management, cybersecurity', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'lpm-records', title: 'Record Management', description: 'Implement filing systems and records management', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-procurement', title: 'Procurement', description: 'Apply supply chain and procurement principles', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'lpm-safety', title: 'Safety and Disaster Management', description: 'Implement safety protocols and disaster recovery', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'lpm-harassment', title: 'Workplace Discrimination', description: 'Handle discrimination and sexual harassment issues', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Human Resources
      { code: 'lpm-hr-planning', title: 'Human Resource Planning', description: 'Apply strategic HR management principles', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-job-analysis', title: 'Job Analysis & Design', description: 'Conduct job analysis and competency modelling', formats: ['written'], examWeight: 0.03 },
      { code: 'lpm-recruitment', title: 'Recruitment & Selection', description: 'Handle recruitment, selection, and scientific selection', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-placement', title: 'Placement & Induction', description: 'Implement placement, socialization and induction', formats: ['written'], examWeight: 0.03 },
      { code: 'lpm-training', title: 'Training & Development', description: 'Develop training and development programs', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-career', title: 'Career Development', description: 'Manage career development and advancement', formats: ['written'], examWeight: 0.03 },
      { code: 'lpm-separation', title: 'Internal Mobility & Separation', description: 'Handle promotions, demotions, and separations', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Accounting
      { code: 'lpm-accounting-concepts', title: 'Accounting Framework', description: 'Apply accounting principles and IFRS', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'lpm-bookkeeping', title: 'Book Keeping', description: 'Record transactions, trial balance, adjustments', formats: ['written'], examWeight: 0.05 },
      { code: 'lpm-reconciliation', title: 'Bank Reconciliation', description: 'Prepare bank reconciliation statements', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-final-accounts', title: 'Final Accounts', description: 'Prepare income statements and balance sheets', formats: ['written'], examWeight: 0.05 },
      { code: 'lpm-partnership-accounts', title: 'Partnership Accounts', description: 'Prepare partnership accounts and handle changes', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-advocate-accounts', title: 'Advocate Accounts', description: 'Manage client accounts and trust accounting', formats: ['written'], examWeight: 0.06 },
      { code: 'lpm-cash-flow', title: 'Cash Flow Analysis', description: 'Prepare and analyze cash flow statements', formats: ['written'], examWeight: 0.04 },
      { code: 'lpm-budgeting', title: 'Cost Accounting & Budgeting', description: 'Apply cost classification and budgeting techniques', formats: ['written'], examWeight: 0.04 },
    ]
  },

  // ========================================
  // ATP 107: CONVEYANCING
  // ========================================
  {
    id: 'atp-107',
    name: 'Conveyancing',
    description: 'Knowledge and skills of conveyancing practice in Kenya',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Introduction
      { code: 'conv-intro', title: 'Conveyancing Fundamentals', description: 'Understand nature, scope, and conceptual framework', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'conv-history', title: 'Conveyancing History', description: 'Trace evolution of land law in Kenya from 1897', formats: ['written', 'mcq'], examWeight: 0.03 },
      { code: 'conv-framework', title: 'Legal Framework', description: 'Apply Land Act 2012, Land Registration Act 2012, Community Land Act', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'conv-tenure', title: 'Land Tenure & Estates', description: 'Analyze freehold, leasehold, and interests in land', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'conv-categories', title: 'Land Categories', description: 'Distinguish public, private, community land', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Pre-Contract
      { code: 'conv-instructions', title: 'Taking Instructions', description: 'Conduct client interview and prepare brief', formats: ['written', 'oral'], examWeight: 0.04 },
      { code: 'conv-due-diligence', title: 'Due Diligence', description: 'Conduct searches, title investigation, requisitions', formats: ['written', 'drafting'], examWeight: 0.06 },
      { code: 'conv-professionals', title: 'Conveyancing Professionals', description: 'Work with estate agents, valuers, surveyors, planners', formats: ['written', 'mcq'], examWeight: 0.03 },
      
      // Contract Stage
      { code: 'conv-sale-agreement', title: 'Sale Agreement Drafting', description: 'Draft agreements for sale with general and special conditions', formats: ['drafting'], examWeight: 0.08 },
      { code: 'conv-deposits', title: 'Deposits & Completion', description: 'Handle deposits, stakeholders, completion notices', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'conv-undertakings', title: 'Professional Undertakings', description: 'Draft and fulfill professional undertakings', formats: ['drafting'], examWeight: 0.05 },
      { code: 'conv-lsk-conditions', title: 'LSK Conditions of Sale', description: 'Apply LSK Conditions 1989 and 2015 editions', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Special Contracts
      { code: 'conv-auction', title: 'Auction Sales', description: 'Handle sale and purchase through auction', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'conv-off-plan', title: 'Off-Plan Sales', description: 'Handle developmental conveyancing', formats: ['written', 'drafting'], examWeight: 0.03 },
      { code: 'conv-sectional', title: 'Sectional Properties', description: 'Handle sectional property transactions (SPA 2020)', formats: ['written', 'drafting'], examWeight: 0.05 },
      
      // Transfer & Registration
      { code: 'conv-transfer', title: 'Transfer Documents', description: 'Draft transfer forms for freehold, leasehold, charge', formats: ['drafting'], examWeight: 0.06 },
      { code: 'conv-completion-docs', title: 'Completion Documents', description: 'Obtain consents, clearances, and identification', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'conv-transmissions', title: 'Transmissions', description: 'Handle transfers on death, vesting orders, insolvency', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Leases
      { code: 'conv-lease-draft', title: 'Lease Drafting', description: 'Draft leases with covenants and conditions', formats: ['drafting'], examWeight: 0.06 },
      { code: 'conv-controlled-tenancy', title: 'Controlled Tenancies', description: 'Apply Rent Acts and Landlord Tenant Act', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'conv-lease-remedies', title: 'Lease Remedies', description: 'Handle forfeiture, distress, injunctions', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Charges
      { code: 'conv-charge-draft', title: 'Charge Drafting', description: 'Draft formal charges with covenants', formats: ['drafting'], examWeight: 0.06 },
      { code: 'conv-charge-types', title: 'Types of Charges', description: 'Handle formal, informal, equitable, legal charges', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'conv-chargee-remedies', title: 'Chargee Remedies', description: 'Apply power of sale, appointment of receiver, foreclosure', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'conv-chargor-remedies', title: 'Chargor Remedies', description: 'Apply equity of redemption, discharge, variation', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Other Interests
      { code: 'conv-easements', title: 'Easements & Profits', description: 'Handle easements, profits a prendre, restrictive covenants', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'conv-cautions', title: 'Cautions & Restrictions', description: 'Lodge and remove cautions, inhibitions, restrictions', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Taxation
      { code: 'conv-stamp-duty', title: 'Stamp Duty', description: 'Compute and process stamp duty payments', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'conv-cgt', title: 'Capital Gains Tax', description: 'Compute and process CGT on property transactions', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Other Acquisition
      { code: 'conv-compulsory', title: 'Compulsory Acquisition', description: 'Handle compulsory acquisition and valuation', formats: ['written'], examWeight: 0.03 },
      { code: 'conv-planning', title: 'Land Planning & Use', description: 'Handle change and extension of user', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Institutions
      { code: 'conv-institutions', title: 'Land Administration', description: 'Navigate Ministry of Lands, NLC, and county governments', formats: ['written', 'mcq'], examWeight: 0.03 },
    ]
  },

  // ========================================
  // ATP 108: COMMERCIAL TRANSACTIONS
  // ========================================
  {
    id: 'atp-108',
    name: 'Commercial Transactions',
    description: 'Practical legal skills in commercial transactions',
    assessmentWeights: { projectWork: 20, oralExam: 20, writtenExam: 60 },
    skills: [
      // Companies
      { code: 'comm-incorporation', title: 'Company Incorporation', description: 'Handle incorporation of private, public, guarantee, foreign companies', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'comm-company-docs', title: 'Company Documentation', description: 'Draft statutory returns, resolutions, registers', formats: ['drafting'], examWeight: 0.05 },
      { code: 'comm-meetings', title: 'Company Meetings', description: 'Conduct meetings and resolutions procedures', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-shares', title: 'Share Capital', description: 'Handle share allotment, transfer, shareholder agreements', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'comm-company-charges', title: 'Company Charges', description: 'Register company charges', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-beneficial', title: 'Beneficial Ownership', description: 'Handle beneficial ownership disclosure', formats: ['written', 'drafting'], examWeight: 0.03 },
      
      // Partnerships
      { code: 'comm-partnership', title: 'Partnership Formation', description: 'Form partnerships and LLPs', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-partnership-deed', title: 'Partnership Deed', description: 'Draft partnership deeds', formats: ['drafting'], examWeight: 0.05 },
      { code: 'comm-dissolution', title: 'Partnership Dissolution', description: 'Handle partnership dissolution', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // M&A
      { code: 'comm-ma-framework', title: 'M&A Framework', description: 'Apply legal framework for mergers and acquisitions', formats: ['written', 'mcq'], examWeight: 0.05 },
      { code: 'comm-due-diligence', title: 'M&A Due Diligence', description: 'Conduct legal due diligence and prepare reports', formats: ['written', 'drafting'], examWeight: 0.06 },
      { code: 'comm-merger-notifications', title: 'Merger Notifications', description: 'Handle CAK and COMESA merger thresholds and forms', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'comm-takeovers', title: 'Take-overs', description: 'Handle listed company take-overs and defences', formats: ['written'], examWeight: 0.04 },
      { code: 'comm-minority', title: 'Minority Rights', description: 'Protect minority shareholder rights in M&A', formats: ['written'], examWeight: 0.03 },
      
      // Insolvency
      { code: 'comm-bankruptcy', title: 'Bankruptcy Proceedings', description: 'Handle debtors and creditors bankruptcy applications', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'comm-bankruptcy-alt', title: 'Bankruptcy Alternatives', description: 'Handle voluntary arrangement, instalment orders', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-liquidation', title: 'Company Liquidation', description: 'Handle members and creditors voluntary liquidation', formats: ['written', 'drafting'], examWeight: 0.05 },
      { code: 'comm-administration', title: 'Company Administration', description: 'Handle administration and company voluntary arrangement', formats: ['written', 'drafting'], examWeight: 0.05 },
      
      // Financial Services
      { code: 'comm-payment-systems', title: 'Payment Systems', description: 'Apply National Payments Systems Act to digital payments', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'comm-data-protection', title: 'Data Protection', description: 'Apply Data Protection Act to financial services', formats: ['written', 'mcq'], examWeight: 0.04 },
      
      // Commercial Agreements
      { code: 'comm-joint-venture', title: 'Joint Venture Agreements', description: 'Draft joint venture agreements', formats: ['drafting'], examWeight: 0.05 },
      { code: 'comm-distributorship', title: 'Distributorship Agreements', description: 'Draft distributorship agreements', formats: ['drafting'], examWeight: 0.04 },
      { code: 'comm-franchise', title: 'Franchise Agreements', description: 'Draft franchise agreements', formats: ['drafting'], examWeight: 0.04 },
      { code: 'comm-guarantee', title: 'Guarantee Drafting', description: 'Draft guarantee and indemnity documents', formats: ['drafting'], examWeight: 0.04 },
      { code: 'comm-trust-deed', title: 'Trust Deed Drafting', description: 'Draft trust deeds', formats: ['drafting'], examWeight: 0.04 },
      
      // Movable Property Security
      { code: 'comm-mpsr-creation', title: 'Security Rights Creation', description: 'Create security rights under MPSRA 2017', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-mpsr-perfection', title: 'Security Rights Perfection', description: 'Perfect and register movable property security', formats: ['written', 'drafting'], examWeight: 0.04 },
      { code: 'comm-mpsr-enforcement', title: 'Security Rights Enforcement', description: 'Enforce movable property security rights', formats: ['written', 'drafting'], examWeight: 0.04 },
      
      // Tax
      { code: 'comm-tax-classification', title: 'Tax Classification', description: 'Classify taxes in commercial transactions', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'comm-income-tax', title: 'Income Taxation', description: 'Apply income taxation to commercial transactions', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'comm-tax-planning', title: 'Tax Planning', description: 'Distinguish tax planning, avoidance, evasion', formats: ['written', 'mcq'], examWeight: 0.04 },
      { code: 'comm-tax-disputes', title: 'Tax Dispute Resolution', description: 'Navigate tax dispute resolution mechanisms', formats: ['written'], examWeight: 0.04 },
      { code: 'comm-tax-procedures', title: 'Tax Procedures', description: 'Apply Tax Procedures Act to returns, assessment, recovery', formats: ['written', 'mcq'], examWeight: 0.04 },
    ]
  },
];

// ============================================
// SEED FUNCTION
// ============================================

async function seedFullCurriculum() {
  console.log('🌱 Starting FULL curriculum seed for all 9 ATP units...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Use Neon HTTP client for serverless connections
  const sql = neon(DATABASE_URL);
  
  try {
    // Set search_path
    await sql`SET search_path TO public`;
    
    // Track totals
    let totalSkills = 0;
    let totalUnits = 0;
    
    // Seed each unit
    for (const unit of ATP_UNITS) {
      console.log(`\n📚 Seeding: ${unit.name} (${unit.id})`);
      console.log(`   ${unit.description}`);
      console.log(`   Assessment: Project ${unit.assessmentWeights.projectWork}% | Oral ${unit.assessmentWeights.oralExam}% | Written ${unit.assessmentWeights.writtenExam}%`);
      
      let unitSkillCount = 0;
      
      for (const skill of unit.skills) {
        const formatTags = `{${skill.formats.join(',')}}`;
        // Map difficulty from exam weight
        const difficulty = skill.examWeight >= 0.06 ? 'advanced' : skill.examWeight >= 0.04 ? 'core' : 'foundation';
        const isCore = skill.examWeight >= 0.05;
        
        // Insert using actual database schema columns
        await sql`
          INSERT INTO micro_skills (
            code, 
            name,
            unit_id, 
            description,
            format_tags,
            exam_weight,
            difficulty,
            is_core,
            is_active,
            created_at,
            updated_at
          )
          VALUES (
            ${skill.code},
            ${skill.title},
            ${unit.id},
            ${skill.description || null},
            ${formatTags}::text[],
            ${skill.examWeight},
            ${difficulty},
            ${isCore},
            true,
            NOW(),
            NOW()
          )
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            format_tags = EXCLUDED.format_tags,
            exam_weight = EXCLUDED.exam_weight,
            difficulty = EXCLUDED.difficulty,
            is_core = EXCLUDED.is_core,
            updated_at = NOW()
        `;
        unitSkillCount++;
      }
      
      console.log(`   ✓ ${unitSkillCount} micro-skills seeded`);
      totalSkills += unitSkillCount;
      totalUnits++;
    }
    
    // Verify counts
    const [skillCount] = await sql`SELECT COUNT(*) as count FROM micro_skills`;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ FULL CURRICULUM SEED COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Units Seeded:     ${totalUnits}/9`);
    console.log(`   Skills Created:   ${totalSkills}`);
    console.log(`   Skills in DB:     ${skillCount.count}`);
    console.log('\n📊 Skills per Unit:');
    
    for (const unit of ATP_UNITS) {
      const [count] = await sql`
        SELECT COUNT(*) as count FROM micro_skills WHERE unit_id = ${unit.id}
      `;
      console.log(`   ${unit.id}: ${count.count} skills (${unit.name})`);
    }
    
    console.log('\n🎯 Mastery Hub should now show dynamic readiness data!\n');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedFullCurriculum();
