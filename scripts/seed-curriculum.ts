/**
 * YNAI Mastery Engine v3 — Comprehensive Curriculum Seed
 *
 * Seeds ALL 9 ATP units into the CKG (Curriculum Knowledge Graph):
 *   • 9 Domains
 *   • ~170 Micro-skills (including Case Law Mastery per unit)
 *   • ~850 Items (MCQ, written, oral, drafting)
 *   • Prerequisite edges (DAG)
 *   • Item ↔ Skill mappings
 *
 * Run: npx tsx scripts/seed-curriculum.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────
interface SkillDef {
  code: string;
  name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weight: number;
  formats: ('mcq' | 'written' | 'oral' | 'drafting')[];
  isCore: boolean;
  prereqs?: string[];
  isCaseLaw?: boolean;
}

interface DomainDef {
  name: string;
  code: string;
  unitId: string;
  description: string;
  skills: SkillDef[];
}

interface ItemSeed {
  prompt: string;
  context?: string;
  modelAnswer?: string;
  keyPoints: string[];
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function fmtToItemType(f: string): string {
  switch (f) {
    case 'mcq': return 'mcq';
    case 'written': return 'issue_spot';
    case 'oral': return 'oral_prompt';
    case 'drafting': return 'drafting_task';
    default: return 'issue_spot';
  }
}
function fmtToMinutes(f: string): number {
  switch (f) {
    case 'mcq': return 5;
    case 'written': return 20;
    case 'oral': return 15;
    case 'drafting': return 30;
    default: return 15;
  }
}

// ========================================================================
// DOMAIN & SKILL DEFINITIONS — ALL 9 ATP UNITS
// ========================================================================

// ─────────────────────────────────────────
// ATP 100: CIVIL LITIGATION
// ─────────────────────────────────────────
const ATP100_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'cp-jurisdiction', name: 'Jurisdiction Analysis', difficulty: 'beginner', weight: 0.08, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-parties', name: 'Parties to Civil Proceedings', difficulty: 'beginner', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-cause-action', name: 'Cause of Action Elements', difficulty: 'beginner', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-limitation', name: 'Limitation Periods', difficulty: 'beginner', weight: 0.05, formats: ['mcq', 'written'], isCore: false },
  { code: 'cp-service', name: 'Service of Process', difficulty: 'beginner', weight: 0.04, formats: ['mcq', 'drafting'], isCore: false },
  // Core
  { code: 'cp-plaint-draft', name: 'Plaint Drafting', difficulty: 'intermediate', weight: 0.08, formats: ['drafting'], isCore: true, prereqs: ['cp-jurisdiction', 'cp-parties', 'cp-cause-action'] },
  { code: 'cp-defence-draft', name: 'Defence Drafting', difficulty: 'intermediate', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-counterclaim', name: 'Counterclaim Procedure', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-defence-draft'] },
  { code: 'cp-interlocutory', name: 'Interlocutory Applications', difficulty: 'intermediate', weight: 0.07, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-injunction', name: 'Injunction Applications', difficulty: 'intermediate', weight: 0.08, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-interlocutory'] },
  { code: 'cp-summary-judg', name: 'Summary Judgment', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'oral'], isCore: false, prereqs: ['cp-plaint-draft', 'cp-defence-draft'] },
  { code: 'cp-discovery', name: 'Discovery & Interrogatories', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-plaint-draft'] },
  // Advanced
  { code: 'cp-trial-conduct', name: 'Trial Conduct & Evidence', difficulty: 'advanced', weight: 0.08, formats: ['oral', 'written'], isCore: true, prereqs: ['cp-interlocutory', 'cp-discovery'] },
  { code: 'cp-examination', name: 'Witness Examination', difficulty: 'advanced', weight: 0.06, formats: ['oral'], isCore: true, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-judgment-draft', name: 'Judgment Analysis & Decrees', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-execution', name: 'Execution of Judgments', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-appeals', name: 'Appeals & Review', difficulty: 'advanced', weight: 0.06, formats: ['written', 'oral'], isCore: true, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-jud-review', name: 'Judicial Review', difficulty: 'advanced', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['cp-interlocutory'] },
  { code: 'cp-const-lit', name: 'Constitutional Litigation', difficulty: 'advanced', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['cp-jud-review'] },
  { code: 'cp-overriding-obj', name: 'Overriding Objective in Civil Litigation', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-costs', name: 'Costs and Taxation of Bills', difficulty: 'advanced', weight: 0.07, formats: ['written', 'drafting', 'mcq'], isCore: true, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-civil-review', name: 'Civil Review under S.80 CPA', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-judgment-draft'] },
  // CASE LAW MASTERY
  { code: 'cp-case-giella', name: 'Case: Giella v Cassman Brown (Injunction Principles)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cp-injunction'] },
  { code: 'cp-case-shah', name: 'Case: Shah v Mbogo (Striking Out)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cp-interlocutory'] },
  { code: 'cp-case-anarita', name: 'Case: Anarita Karimi v Republic (Constitutional Petitions)', difficulty: 'advanced', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cp-const-lit'] },
  { code: 'cp-case-jasbir', name: 'Case: Jasbir Singh Rai v Tarlochan Singh (Default Judgment)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['cp-defence-draft'] },
  { code: 'cp-case-mukisa', name: 'Case: Mukisa Biscuit v West End Distributors (Preliminary Objections)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cp-interlocutory'] },
];

// ─────────────────────────────────────────
// ATP 101: CRIMINAL LITIGATION
// ─────────────────────────────────────────
const ATP101_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'cr-jurisdiction', name: 'Criminal Court Jurisdiction', difficulty: 'beginner', weight: 0.06, formats: ['mcq', 'written'], isCore: true },
  { code: 'cr-arrests', name: 'Arrests & Rights of Suspects', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'cr-bail-bond', name: 'Bail and Bond', difficulty: 'beginner', weight: 0.06, formats: ['written', 'drafting'], isCore: true },
  { code: 'cr-charges', name: 'Framing and Drafting Charges', difficulty: 'beginner', weight: 0.07, formats: ['drafting', 'mcq'], isCore: true },
  // Core
  { code: 'cr-plea', name: 'Plea and Plea Bargaining', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'oral'], isCore: true, prereqs: ['cr-charges'] },
  { code: 'cr-trial-process', name: 'Criminal Trial Process', difficulty: 'intermediate', weight: 0.08, formats: ['oral', 'written'], isCore: true, prereqs: ['cr-plea'] },
  { code: 'cr-evidence-handling', name: 'Evidence Handling in Criminal Trials', difficulty: 'intermediate', weight: 0.07, formats: ['oral', 'written'], isCore: true, prereqs: ['cr-trial-process'] },
  { code: 'cr-sentencing', name: 'Sentencing & Mitigation', difficulty: 'intermediate', weight: 0.06, formats: ['oral', 'written'], isCore: true, prereqs: ['cr-trial-process'] },
  { code: 'cr-id-parade', name: 'Identification Parade Procedures', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['cr-arrests'] },
  { code: 'cr-file-prep', name: 'Prosecution File Preparation', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cr-charges'] },
  // Advanced
  { code: 'cr-appeals', name: 'Criminal Appeals', difficulty: 'advanced', weight: 0.07, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cr-sentencing'] },
  { code: 'cr-revision', name: 'Criminal Revision', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cr-sentencing'] },
  { code: 'cr-habeas-corpus', name: 'Habeas Corpus', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: true, prereqs: ['cr-arrests'] },
  { code: 'cr-private-prosecution', name: 'Private Prosecution', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cr-charges'] },
  { code: 'cr-extradition', name: 'Extradition Proceedings', difficulty: 'advanced', weight: 0.03, formats: ['written'], isCore: false, prereqs: ['cr-jurisdiction'] },
  { code: 'cr-special-courts', name: 'Specialized Criminal Courts', difficulty: 'advanced', weight: 0.03, formats: ['written', 'mcq'], isCore: false, prereqs: ['cr-jurisdiction'] },
  { code: 'cr-inquests', name: 'Inquest Procedures', difficulty: 'advanced', weight: 0.03, formats: ['written', 'drafting'], isCore: false, prereqs: ['cr-jurisdiction'] },
  { code: 'cr-jud-review', name: 'Judicial Review in Criminal Matters', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cr-trial-process'] },
  // CASE LAW MASTERY
  { code: 'cr-case-woolmington', name: 'Case: Woolmington v DPP (Burden of Proof)', difficulty: 'beginner', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true },
  { code: 'cr-case-abolfathi', name: 'Case: Republic v Ahmad Abolfathi (Terrorism Trials)', difficulty: 'advanced', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['cr-trial-process'] },
  { code: 'cr-case-karanja', name: 'Case: Republic v Karanja (Confession & Voir Dire)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cr-evidence-handling'] },
  { code: 'cr-case-muruatetu', name: 'Case: Muruatetu v Republic (Mandatory Death Sentence)', difficulty: 'advanced', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cr-sentencing'] },
];

// ─────────────────────────────────────────
// ATP 102: PROBATE AND ADMINISTRATION
// ─────────────────────────────────────────
const ATP102_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'pb-succession-framework', name: 'Legal Framework of Succession', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'pb-wills-valid', name: 'Validity of Wills (Requirements)', difficulty: 'beginner', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  { code: 'pb-intestacy-rules', name: 'Intestate Succession Rules', difficulty: 'beginner', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  // Core
  { code: 'pb-will-drafting', name: 'Will & Codicil Drafting', difficulty: 'intermediate', weight: 0.08, formats: ['drafting'], isCore: true, prereqs: ['pb-wills-valid'] },
  { code: 'pb-revocation', name: 'Revocation & Alteration of Wills', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'mcq'], isCore: false, prereqs: ['pb-wills-valid'] },
  { code: 'pb-proof-wills', name: 'Proof of Wills', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'oral'], isCore: true, prereqs: ['pb-wills-valid'] },
  { code: 'pb-petition-grant', name: 'Petition for Grant of Letters', difficulty: 'intermediate', weight: 0.08, formats: ['drafting', 'written'], isCore: true, prereqs: ['pb-succession-framework'] },
  { code: 'pb-objections', name: 'Objections to Grants', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'drafting', 'oral'], isCore: true, prereqs: ['pb-petition-grant'] },
  { code: 'pb-distribution', name: 'Distribution of Estate', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'mcq'], isCore: true, prereqs: ['pb-intestacy-rules'] },
  { code: 'pb-reasonable-provision', name: 'Application for Reasonable Provision', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['pb-distribution'] },
  // Advanced
  { code: 'pb-confirmation', name: 'Confirmation of Grants', difficulty: 'advanced', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['pb-petition-grant'] },
  { code: 'pb-revocation-grant', name: 'Revocation & Annulment of Grants', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['pb-confirmation'] },
  { code: 'pb-pr-duties', name: 'Duties of Personal Representatives', difficulty: 'advanced', weight: 0.05, formats: ['written', 'mcq'], isCore: true, prereqs: ['pb-petition-grant'] },
  { code: 'pb-estate-accounts', name: 'Estate Accounts', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['pb-pr-duties'] },
  { code: 'pb-foreign-succession', name: 'Foreign Succession', difficulty: 'advanced', weight: 0.03, formats: ['written'], isCore: false, prereqs: ['pb-succession-framework'] },
  { code: 'pb-intermeddling', name: 'Intermeddling & Protection of Estate', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['pb-succession-framework'] },
  { code: 'pb-limited-grants', name: 'Limited Grants (Types & Procedure)', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['pb-petition-grant'] },
  // CASE LAW MASTERY
  { code: 'pb-case-otieno', name: 'Case: In re Estate of SM Otieno (Customary vs Statutory)', difficulty: 'intermediate', weight: 0.05, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['pb-succession-framework'] },
  { code: 'pb-case-ruenji', name: 'Case: In re Estate of Ruenji (Grant Applications)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['pb-petition-grant'] },
  { code: 'pb-case-wanjiku', name: 'Case: Hortensia Wanjiku v Stephen Thuita (Dependant Claims)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['pb-reasonable-provision'] },
];

// ─────────────────────────────────────────
// ATP 103: LEGAL WRITING AND DRAFTING
// ─────────────────────────────────────────
const ATP103_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'lw-plain-english', name: 'Plain English & Legal Clarity', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'lw-paragraphing', name: 'Paragraphing & Structure', difficulty: 'beginner', weight: 0.05, formats: ['written'], isCore: true },
  { code: 'lw-case-briefing', name: 'Case Briefing', difficulty: 'beginner', weight: 0.06, formats: ['written'], isCore: true },
  { code: 'lw-case-analysis', name: 'Case Analysis', difficulty: 'beginner', weight: 0.06, formats: ['written'], isCore: true, prereqs: ['lw-case-briefing'] },
  { code: 'lw-research-skills', name: 'Legal Research & Analysis', difficulty: 'beginner', weight: 0.05, formats: ['written'], isCore: false },
  // Core
  { code: 'lw-letters', name: 'Drafting Legal Letters', difficulty: 'intermediate', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['lw-plain-english'] },
  { code: 'lw-demand-letters', name: 'Drafting Demand Letters', difficulty: 'intermediate', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['lw-letters'] },
  { code: 'lw-legal-opinions', name: 'Drafting Legal Opinions', difficulty: 'intermediate', weight: 0.07, formats: ['drafting', 'written'], isCore: true, prereqs: ['lw-case-analysis', 'lw-letters'] },
  { code: 'lw-contracts', name: 'Contract Drafting', difficulty: 'intermediate', weight: 0.07, formats: ['drafting'], isCore: true, prereqs: ['lw-plain-english'] },
  { code: 'lw-affidavits', name: 'Drafting Affidavits & Statutory Declarations', difficulty: 'intermediate', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['lw-plain-english'] },
  // Advanced
  { code: 'lw-bill-structure', name: 'Structure of a Bill', difficulty: 'advanced', weight: 0.06, formats: ['drafting', 'written'], isCore: true, prereqs: ['lw-contracts'] },
  { code: 'lw-legislative-sentence', name: 'The Legislative Sentence', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['lw-bill-structure'] },
  { code: 'lw-amending-legislation', name: 'Amending Legislation', difficulty: 'advanced', weight: 0.05, formats: ['drafting', 'written'], isCore: true, prereqs: ['lw-bill-structure'] },
  { code: 'lw-penal-provisions', name: 'Penal Provisions Drafting', difficulty: 'advanced', weight: 0.04, formats: ['drafting'], isCore: false, prereqs: ['lw-bill-structure'] },
  { code: 'lw-delegated-legislation', name: 'Delegated Legislation', difficulty: 'advanced', weight: 0.04, formats: ['drafting', 'written'], isCore: false, prereqs: ['lw-bill-structure'] },
];

// ─────────────────────────────────────────
// ATP 104: TRIAL ADVOCACY
// ─────────────────────────────────────────
const ATP104_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'ta-qualities', name: 'Qualities of a Trial Lawyer', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'ta-ethics', name: 'Ethical Duties of Trial Lawyers', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'ta-court-etiquette', name: 'Court Etiquette', difficulty: 'beginner', weight: 0.04, formats: ['mcq', 'oral'], isCore: false },
  { code: 'ta-conflict-interest', name: 'Conflict of Interest in Advocacy', difficulty: 'beginner', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'ta-pretrial-prep', name: 'Pre-Trial Preparation & Case Theory', difficulty: 'beginner', weight: 0.07, formats: ['written'], isCore: true },
  // Core
  { code: 'ta-opening-statement', name: 'Opening Statement', difficulty: 'intermediate', weight: 0.07, formats: ['oral'], isCore: true, prereqs: ['ta-pretrial-prep'] },
  { code: 'ta-examination-chief', name: 'Examination-in-Chief', difficulty: 'intermediate', weight: 0.08, formats: ['oral'], isCore: true, prereqs: ['ta-opening-statement'] },
  { code: 'ta-cross-examination', name: 'Cross-Examination', difficulty: 'intermediate', weight: 0.09, formats: ['oral'], isCore: true, prereqs: ['ta-examination-chief'] },
  { code: 'ta-re-examination', name: 'Re-Examination', difficulty: 'intermediate', weight: 0.05, formats: ['oral'], isCore: true, prereqs: ['ta-cross-examination'] },
  { code: 'ta-objections', name: 'Trial Objections', difficulty: 'intermediate', weight: 0.06, formats: ['oral', 'written'], isCore: true, prereqs: ['ta-examination-chief'] },
  // Advanced
  { code: 'ta-closing-argument', name: 'Closing Argument', difficulty: 'advanced', weight: 0.07, formats: ['oral'], isCore: true, prereqs: ['ta-re-examination'] },
  { code: 'ta-expert-witnesses', name: 'Handling Expert Witnesses', difficulty: 'advanced', weight: 0.06, formats: ['oral', 'written'], isCore: true, prereqs: ['ta-cross-examination'] },
  { code: 'ta-skeleton-arguments', name: 'Skeleton Arguments Drafting', difficulty: 'advanced', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['ta-closing-argument'] },
  { code: 'ta-appellate-advocacy', name: 'Appellate Advocacy', difficulty: 'advanced', weight: 0.05, formats: ['oral', 'written'], isCore: true, prereqs: ['ta-closing-argument'] },
  { code: 'ta-adr', name: 'Alternative Dispute Resolution in Advocacy', difficulty: 'advanced', weight: 0.04, formats: ['written', 'oral'], isCore: false, prereqs: ['ta-pretrial-prep'] },
  // CASE LAW MASTERY
  { code: 'ta-case-browne', name: 'Case: Browne v Dunn (Duty to Cross-Examine)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['ta-cross-examination'] },
  { code: 'ta-case-turnbull', name: 'Case: R v Turnbull (Identification Evidence)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['ta-examination-chief'] },
];

// ─────────────────────────────────────────
// ATP 105: PROFESSIONAL ETHICS
// ─────────────────────────────────────────
const ATP105_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'pe-profession', name: 'Law as a Profession', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'pe-lsk-role', name: 'Role of LSK', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'pe-core-values', name: 'Core Professional Values (SOPPEC)', difficulty: 'beginner', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  { code: 'pe-confidentiality', name: 'Confidentiality & Privilege', difficulty: 'beginner', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  // Core
  { code: 'pe-conflict-interest', name: 'Conflict of Interest', difficulty: 'intermediate', weight: 0.07, formats: ['written', 'mcq'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-competence', name: 'Competence & Diligence', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'drafting'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-fees-retainer', name: 'Professional Fee & Retainer', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-taxation-costs', name: 'Taxation of Bills of Costs', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['pe-fees-retainer'] },
  { code: 'pe-fiduciary', name: 'Fiduciary Duty & Client Accounts', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'mcq'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-undertakings', name: 'Professional Undertakings', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-advocate-lien', name: 'Advocate Lien', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['pe-fees-retainer'] },
  // Advanced
  { code: 'pe-contempt', name: 'Contempt of Court', difficulty: 'advanced', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['pe-core-values'] },
  { code: 'pe-disciplinary', name: 'Advocates Disciplinary Process', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['pe-core-values'] },
  { code: 'pe-aml', name: 'Anti-Money Laundering Obligations', difficulty: 'advanced', weight: 0.05, formats: ['written', 'mcq'], isCore: true, prereqs: ['pe-fiduciary'] },
  { code: 'pe-ai-ethics', name: 'Techno Ethics & AI in Law', difficulty: 'advanced', weight: 0.03, formats: ['written', 'mcq'], isCore: false },
  // CASE LAW MASTERY
  { code: 'pe-case-otieno-clifford', name: 'Case: Republic v Otieno Clifford (Professional Misconduct)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['pe-disciplinary'] },
  { code: 'pe-case-lsk-police', name: 'Case: LSK v Kenya Police (Advocates Rights)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['pe-core-values'] },
];

// ─────────────────────────────────────────
// ATP 106: LEGAL PRACTICE MANAGEMENT
// ─────────────────────────────────────────
const ATP106_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'pm-office-admin', name: 'Office Administration', difficulty: 'beginner', weight: 0.05, formats: ['written', 'mcq'], isCore: false },
  { code: 'pm-record-mgmt', name: 'Record Management', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'pm-ict', name: 'ICT in Legal Practice', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'pm-standards', name: 'Standards & Policies in Law Offices', difficulty: 'beginner', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  // Core — HR
  { code: 'pm-hr-planning', name: 'HR Planning & Management', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'mcq'], isCore: false, prereqs: ['pm-office-admin'] },
  { code: 'pm-recruitment', name: 'Recruitment & Selection', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'mcq'], isCore: true, prereqs: ['pm-hr-planning'] },
  { code: 'pm-training', name: 'Training & Development', difficulty: 'intermediate', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['pm-hr-planning'] },
  { code: 'pm-separation', name: 'Internal Mobility & Separation', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['pm-hr-planning'] },
  // Core — Accounting
  { code: 'pm-accounting-basics', name: 'Accounting Principles (IFRS)', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'pm-bookkeeping', name: 'Bookkeeping & Trial Balance', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'mcq'], isCore: true, prereqs: ['pm-accounting-basics'] },
  { code: 'pm-bank-recon', name: 'Bank Reconciliation', difficulty: 'intermediate', weight: 0.06, formats: ['written'], isCore: true, prereqs: ['pm-bookkeeping'] },
  { code: 'pm-final-accounts', name: 'Preparation of Final Accounts', difficulty: 'intermediate', weight: 0.06, formats: ['written'], isCore: true, prereqs: ['pm-bookkeeping'] },
  // Advanced
  { code: 'pm-advocate-accounts', name: 'Advocates Accounts & Client Money', difficulty: 'advanced', weight: 0.08, formats: ['written', 'drafting'], isCore: true, prereqs: ['pm-final-accounts'] },
  { code: 'pm-partnership-accounts', name: 'Partnership Accounts', difficulty: 'advanced', weight: 0.05, formats: ['written'], isCore: false, prereqs: ['pm-final-accounts'] },
  { code: 'pm-cashflow', name: 'Cash Flow Statements', difficulty: 'advanced', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['pm-final-accounts'] },
  { code: 'pm-budgeting', name: 'Cost Accounting & Budgeting', difficulty: 'advanced', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['pm-final-accounts'] },
];

// ─────────────────────────────────────────
// ATP 107: CONVEYANCING
// ─────────────────────────────────────────
const ATP107_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'cv-legal-framework', name: 'Land Law Legal Framework', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'cv-categories-land', name: 'Categories of Land & Tenure', difficulty: 'beginner', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'cv-client-interview', name: 'Pre-Contract Due Diligence', difficulty: 'beginner', weight: 0.06, formats: ['written', 'drafting'], isCore: true },
  // Core
  { code: 'cv-sale-agreement', name: 'Sale Agreement Drafting', difficulty: 'intermediate', weight: 0.08, formats: ['drafting'], isCore: true, prereqs: ['cv-legal-framework', 'cv-client-interview'] },
  { code: 'cv-transfer', name: 'Transfer & Registration', difficulty: 'intermediate', weight: 0.07, formats: ['drafting', 'written'], isCore: true, prereqs: ['cv-sale-agreement'] },
  { code: 'cv-completion', name: 'Completion Documents', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'drafting'], isCore: true, prereqs: ['cv-transfer'] },
  { code: 'cv-leases', name: 'Leases & Tenancies', difficulty: 'intermediate', weight: 0.07, formats: ['drafting', 'written'], isCore: true, prereqs: ['cv-legal-framework'] },
  { code: 'cv-charges', name: 'Charges (Mortgages) Drafting', difficulty: 'intermediate', weight: 0.07, formats: ['drafting', 'written'], isCore: true, prereqs: ['cv-legal-framework'] },
  { code: 'cv-remedies-lessor', name: 'Remedies of Lessor & Lessee', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'oral'], isCore: false, prereqs: ['cv-leases'] },
  { code: 'cv-chargee-remedies', name: 'Remedies of the Chargee', difficulty: 'intermediate', weight: 0.05, formats: ['written', 'oral'], isCore: true, prereqs: ['cv-charges'] },
  // Advanced
  { code: 'cv-transmissions', name: 'Involuntary Transfers', difficulty: 'advanced', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['cv-transfer'] },
  { code: 'cv-stamp-duty', name: 'Stamp Duty & Taxation', difficulty: 'advanced', weight: 0.06, formats: ['written', 'mcq'], isCore: true, prereqs: ['cv-completion'] },
  { code: 'cv-compulsory-acq', name: 'Compulsory Acquisition', difficulty: 'advanced', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['cv-legal-framework'] },
  { code: 'cv-easements', name: 'Easements & Covenants', difficulty: 'advanced', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['cv-legal-framework'] },
  { code: 'cv-cautions', name: 'Cautions, Inhibitions & Restrictions', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['cv-transfer'] },
  { code: 'cv-electronic', name: 'Electronic Conveyancing (NLIMS)', difficulty: 'advanced', weight: 0.03, formats: ['written', 'mcq'], isCore: false },
  // CASE LAW MASTERY
  { code: 'cv-case-macharia', name: 'Case: Macharia v Kiome (Spousal Interest in Land)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['cv-sale-agreement'] },
  { code: 'cv-case-isack', name: 'Case: Isack MInanga Mwiru v AG (Trust Land)', difficulty: 'intermediate', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['cv-categories-land'] },
  { code: 'cv-case-mtana', name: 'Case: Mtana Lewa v Kahindi Ngala (Adverse Possession)', difficulty: 'advanced', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['cv-transfer'] },
];

// ─────────────────────────────────────────
// ATP 108: COMMERCIAL TRANSACTIONS
// ─────────────────────────────────────────
const ATP108_SKILLS: SkillDef[] = [
  // Foundation
  { code: 'ct-company-formation', name: 'Company Formation & Types', difficulty: 'beginner', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'ct-statutory-compliance', name: 'Statutory Compliance', difficulty: 'beginner', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'ct-partnerships', name: 'Partnerships (General & LLP)', difficulty: 'beginner', weight: 0.06, formats: ['written', 'drafting'], isCore: true },
  // Core
  { code: 'ct-shareholder-agreements', name: 'Shareholder Agreements & Resolutions', difficulty: 'intermediate', weight: 0.07, formats: ['drafting', 'written'], isCore: true, prereqs: ['ct-company-formation'] },
  { code: 'ct-partnership-deed', name: 'Partnership Deed Drafting', difficulty: 'intermediate', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['ct-partnerships'] },
  { code: 'ct-mergers', name: 'Mergers & Acquisitions', difficulty: 'intermediate', weight: 0.07, formats: ['written', 'drafting'], isCore: true, prereqs: ['ct-company-formation'] },
  { code: 'ct-due-diligence', name: 'Due Diligence', difficulty: 'intermediate', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['ct-mergers'] },
  { code: 'ct-commercial-agreements', name: 'Commercial Agreements (JV, Distribution, Franchise)', difficulty: 'intermediate', weight: 0.06, formats: ['drafting', 'written'], isCore: true, prereqs: ['ct-company-formation'] },
  { code: 'ct-share-transfers', name: 'Share Transfers', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['ct-shareholder-agreements'] },
  // Advanced — Insolvency
  { code: 'ct-bankruptcy', name: 'Bankruptcy Applications', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: true, prereqs: ['ct-company-formation'] },
  { code: 'ct-liquidation', name: 'Corporate Liquidation', difficulty: 'advanced', weight: 0.06, formats: ['written', 'drafting'], isCore: true, prereqs: ['ct-bankruptcy'] },
  { code: 'ct-administration', name: 'Administration & CVA', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['ct-liquidation'] },
  // Advanced — Securities & Tax
  { code: 'ct-mpsr', name: 'Security Rights (MPSR Act)', difficulty: 'advanced', weight: 0.05, formats: ['written', 'mcq'], isCore: true, prereqs: ['ct-company-formation'] },
  { code: 'ct-data-protection', name: 'Data Protection in Commerce', difficulty: 'advanced', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'ct-taxation', name: 'Taxation in Commercial Transactions', difficulty: 'advanced', weight: 0.06, formats: ['written', 'mcq'], isCore: true },
  { code: 'ct-tax-disputes', name: 'Tax Dispute Resolution', difficulty: 'advanced', weight: 0.04, formats: ['written', 'drafting'], isCore: false, prereqs: ['ct-taxation'] },
  { code: 'ct-financial-services', name: 'Financial Services Regulation', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false },
  { code: 'ct-payment-systems', name: 'National Payment Systems', difficulty: 'intermediate', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['ct-financial-services'] },
  // CASE LAW MASTERY
  { code: 'ct-case-foss', name: 'Case: Foss v Harbottle (Majority Rule)', difficulty: 'intermediate', weight: 0.04, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['ct-shareholder-agreements'] },
  { code: 'ct-case-salomon', name: 'Case: Salomon v Salomon (Separate Legal Entity)', difficulty: 'beginner', weight: 0.05, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true },
  { code: 'ct-case-nakumatt', name: 'Case: Nakumatt Holdings (Administration & Liquidation)', difficulty: 'advanced', weight: 0.03, formats: ['mcq', 'written'], isCore: true, isCaseLaw: true, prereqs: ['ct-liquidation'] },
  { code: 'ct-case-imperial', name: 'Case: CBK v Imperial Bank (Statutory Management)', difficulty: 'advanced', weight: 0.03, formats: ['mcq', 'written'], isCore: false, isCaseLaw: true, prereqs: ['ct-company-formation'] },
];

// ========================================================================
// BUILD DOMAIN DEFINITIONS
// ========================================================================
const DOMAINS: DomainDef[] = [
  { name: 'Civil Litigation', code: 'atp-100', unitId: 'ATP100', description: 'Civil Procedure and Practice under Kenyan law', skills: ATP100_SKILLS },
  { name: 'Criminal Litigation', code: 'atp-101', unitId: 'ATP101', description: 'Criminal Procedure and Practice under Kenyan law', skills: ATP101_SKILLS },
  { name: 'Probate and Administration', code: 'atp-102', unitId: 'ATP102', description: 'Law of Succession, Wills, Grants, and Estate Administration', skills: ATP102_SKILLS },
  { name: 'Legal Writing and Drafting', code: 'atp-103', unitId: 'ATP103', description: 'Legal Writing, Contract Drafting, and Legislative Drafting', skills: ATP103_SKILLS },
  { name: 'Trial Advocacy', code: 'atp-104', unitId: 'ATP104', description: 'Oral advocacy, examination of witnesses, and courtroom skills', skills: ATP104_SKILLS },
  { name: 'Professional Ethics', code: 'atp-105', unitId: 'ATP105', description: 'Professional Ethics and Practice under SOPPEC and Advocates Act', skills: ATP105_SKILLS },
  { name: 'Legal Practice Management', code: 'atp-106', unitId: 'ATP106', description: 'Office Administration, HR Management, and Accounting for Advocates', skills: ATP106_SKILLS },
  { name: 'Conveyancing', code: 'atp-107', unitId: 'ATP107', description: 'Land Law, Transfer of Interests, Charges, and Leases', skills: ATP107_SKILLS },
  { name: 'Commercial Transactions', code: 'atp-108', unitId: 'ATP108', description: 'Company Law, M&A, Insolvency, Securities, and Taxation', skills: ATP108_SKILLS },
];

// ========================================================================
// ITEM PROMPTS — Explicit items per skill (selected high-value skills)
// ========================================================================
const SKILL_PROMPTS: Record<string, ItemSeed[]> = {
  // ── ATP100 CIVIL LITIGATION ──
  'cp-jurisdiction': [
    { prompt: 'A dispute arises over a commercial contract worth KES 2 million executed in Nairobi but the defendant resides in Mombasa. Which court has jurisdiction and on what basis?', keyPoints: ['Subject matter jurisdiction', 'Territorial jurisdiction', 'CPC provisions', 'Pecuniary limits'] },
    { prompt: 'Distinguish original from appellate jurisdiction in the Kenyan court hierarchy with reference to civil matters.', keyPoints: ['Original jurisdiction', 'Appellate jurisdiction', 'Constitutional provisions'] },
    { prompt: 'Which court has jurisdiction over a claim for recovery of land valued at KES 300,000?', keyPoints: ['Environment and Land Court', 'Land disputes', 'Valuation threshold'] },
    { prompt: 'Under the CPC, the court of competent jurisdiction for a contract dispute worth KES 50,000 is: (A) High Court, (B) Magistrate Court, (C) Supreme Court, (D) Tribunal.', keyPoints: ['Pecuniary jurisdiction', 'Magistrates Courts Act'] },
    { prompt: 'A party challenges jurisdiction after filing a defence. Is this valid? Analyze timing requirements for jurisdictional objections.', keyPoints: ['Waiver', 'Timing', 'Order 6 CPC'] },
  ],
  'cp-plaint-draft': [
    { prompt: 'Draft a plaint for recovery of KES 5 million being money lent and not repaid, with full verification clause.', context: 'Client lent KES 5M on 1 January 2025, repayment due 1 July 2025. Written agreement exists. Defendant has not responded to three demand letters.', keyPoints: ['Parties', 'Jurisdiction', 'Cause of action', 'Relief sought', 'Verification'] },
    { prompt: 'Draft the averments section of a plaint for breach of employment contract resulting in wrongful dismissal.', keyPoints: ['Employment relationship', 'Contract terms', 'Breach particulars', 'Damages claimed'] },
    { prompt: 'Draft a plaint claiming specific performance of a land sale agreement.', keyPoints: ['Land description', 'Agreement particulars', 'Specific performance elements', 'Alternative damages'] },
    { prompt: 'Review the following plaint extract and identify all defects: "The Plaintiff is a person of full age. The Defendant owes the Plaintiff money. Wherefore the Plaintiff prays for judgment."', keyPoints: ['Missing jurisdiction clause', 'Vague averments', 'No verification', 'Insufficient particulars'] },
    { prompt: 'Draft a plaint for professional negligence against an advocate who failed to file an appeal within time.', keyPoints: ['Duty of care', 'Standard of care', 'Breach', 'Causation', 'Loss quantification'] },
  ],
  'cp-injunction': [
    { prompt: 'Draft a notice of motion for an interlocutory injunction to restrain the defendant from selling disputed property pending the hearing of the suit.', keyPoints: ['Notice of motion', 'Supporting affidavit', 'Giella principles', 'Prayer'] },
    { prompt: 'Explain the Giella v Cassman Brown principles for granting interlocutory injunctions in Kenya.', keyPoints: ['Prima facie case', 'Irreparable harm', 'Balance of convenience'] },
    { prompt: 'Your client needs urgent orders before the defendant dissipates assets. What procedure and what documents?', keyPoints: ['Ex parte application', 'Certificate of urgency', 'Return date', 'Undertaking as to damages'] },
    { prompt: 'Draft an application for Mareva injunction to freeze the defendant bank accounts pending trial.', keyPoints: ['Asset preservation', 'Worldwide Mareva', 'Disclosure orders', 'Evidence of dissipation risk'] },
    { prompt: 'Compare prohibitory, mandatory, and quia timet injunctions with examples from Kenyan practice.', keyPoints: ['Types of injunctions', 'Higher threshold for mandatory', 'Anticipatory relief'] },
  ],
  // ── CASE LAW: ATP100 ──
  'cp-case-giella': [
    { prompt: 'State the three-pronged test established in Giella v Cassman Brown & Co [1973] EA 358 for the grant of interlocutory injunctions.', keyPoints: ['Prima facie case with probability of success', 'Irreparable injury not compensable by damages', 'Balance of convenience'], modelAnswer: 'In Giella v Cassman Brown, the Court of Appeal for Eastern Africa established that an interlocutory injunction will be granted if the applicant shows: (1) a prima facie case with a probability of success, (2) irreparable injury not compensable by damages, and (3) the balance of convenience favors granting.' },
    { prompt: 'A client seeks an interim injunction. Applying Giella v Cassman Brown, draft the submissions section addressing all three limbs of the test.', keyPoints: ['Prima facie', 'Irreparable harm', 'Balance of convenience', 'Application to facts'] },
    { prompt: 'Has the Giella test been modified by subsequent Kenyan jurisprudence? Discuss with reference to at least two later decisions.', keyPoints: ['American Cyanamid influence', 'Kenya case law development', 'Serious issue to be tried'] },
    { prompt: 'Multiple choice: According to Giella v Cassman Brown, which is NOT a requirement for an interlocutory injunction? (A) Prima facie case, (B) Irreparable injury, (C) Payment of security deposit, (D) Balance of convenience', keyPoints: ['Security deposit not required'] },
    { prompt: 'Your opponent argues Giella does not apply to mandatory injunctions. Respond.', keyPoints: ['Higher threshold', 'High degree of assurance', 'Status quo argument'] },
  ],
  'cp-case-anarita': [
    { prompt: 'Explain the Anarita Karimi Rules for constitutional petitions as established in Anarita Karimi Njeru v Republic [1979] KLR 154.', keyPoints: ['Precision in pleading', 'Specific provision infringed', 'Manner of infringement', 'No vague generalities'], modelAnswer: 'The Anarita Karimi Rules require that a constitutional petition must: (1) specify the exact provision of the Constitution alleged to have been contravened, (2) explain precisely the manner of violation, and (3) avoid vague generalities.' },
    { prompt: 'Draft the constitutional provisions section of a petition applying Anarita Karimi requirements.', keyPoints: ['Specificity', 'Article-by-article', 'Manner of violation'] },
    { prompt: 'Have the Anarita Karimi Rules survived the 2010 Constitution? Discuss.', keyPoints: ['Mutunga Rules 2013', 'Access to justice considerations', 'Modified application'] },
    { prompt: 'Multiple choice: Under Anarita Karimi, a petition will be struck out if: (A) It cites too many Articles, (B) It fails to specify manner of contravention, (C) Filed late, (D) Petitioner has no lawyer', keyPoints: ['Failure to specify manner'] },
    { prompt: 'Distinguish the pleading requirements for a constitutional petition (Anarita) from an ordinary plaint.', keyPoints: ['Higher specificity', 'Constitutional provisions', 'Supporting documents'] },
  ],
  'cp-case-mukisa': [
    { prompt: 'State the principles in Mukisa Biscuit Manufacturing Co v West End Distributors [1969] EA 696 on preliminary objections.', keyPoints: ['Pure point of law', 'No investigation of facts', 'Must not be arguable', 'Disguised demurrers'], modelAnswer: 'A preliminary objection must be based on a point of law which, if sustained, would dispose of the case. It must not require investigation of evidence and must be clear and unambiguous.' },
    { prompt: 'Your opponent raises a preliminary objection based on limitation. Is this proper under Mukisa? Argue.', keyPoints: ['Point of law', 'May require factual investigation', 'Mixed law and fact'] },
    { prompt: 'Draft a notice of preliminary objection compliant with Mukisa Biscuit principles.', keyPoints: ['Clear statement', 'Point of law', 'No facts required', 'Dispositive if sustained'] },
    { prompt: 'Multiple choice: Under Mukisa Biscuit, a preliminary objection must: (A) Be filed before trial, (B) Concern only jurisdiction, (C) Be a pure point of law requiring no factual investigation, (D) Be agreed by both parties', keyPoints: ['Pure point of law'] },
    { prompt: 'Explain why an objection that requires investigation of the facts fails the Mukisa test. Give two examples.', keyPoints: ['Factual investigation disqualifies', 'Examples of mixed questions'] },
  ],

  // ── ATP100 NEW: Overriding Objective & Costs ──
  'cp-overriding-obj': [
    { prompt: 'Explain the concept of the "Overriding Objective" in civil litigation under Sections 1A and 1B of the Civil Procedure Act and its constitutional basis under Article 159.', keyPoints: ['Just determination', 'Efficient disposal', 'Proportionality', 'Use of ADR', 'Article 159 Constitution'] },
    { prompt: 'A party files frivolous interlocutory applications to delay trial. What sanctions can the court impose under the overriding objective?', keyPoints: ['S.1A CPA', 'Costs sanction', 'Strikes out delaying applications', 'Adverse cost orders'] },
    { prompt: 'How does the overriding objective affect the court\'s exercise of discretion in granting adjournments? Discuss with case law.', keyPoints: ['D\'Orta-Ekenaike principle', 'Proportionality', 'Active case management', 'Timely disposal'] },
    { prompt: 'Multiple choice: The overriding objective requires the court to deal with cases: (A) As cheaply as possible, (B) Justly, expeditiously, proportionately, and affordably, (C) Only according to strict rules, (D) In favour of unrepresented parties', keyPoints: ['Just, expeditious, proportionate, affordable'] },
    { prompt: 'Draft submissions invoking the overriding objective to oppose an application for extension of time to file a defence 6 months late.', keyPoints: ['Prejudice to plaintiff', 'Proportionality', 'Efficient use of court resources', 'S.1A obligations'] },
  ],
  'cp-costs': [
    { prompt: 'Explain the principle that "costs follow the event" and identify the exceptions recognized in Kenyan civil litigation.', keyPoints: ['General rule', 'Court discretion', 'Conduct of parties', 'Offer to settle', 'Constitutional petitions exception'] },
    { prompt: 'Draft a bill of costs for party-and-party taxation after a 3-day civil trial in the High Court. Include instruction fees, getting up, attendance, and disbursements.', keyPoints: ['Instruction fees', 'Getting up fees', 'Court attendance', 'Disbursements', 'Advocates Remuneration Order'], modelAnswer: 'A standard bill of costs should include: (1) Instruction fees based on the Advocates Remuneration Order scale, (2) Getting up fees per day of trial, (3) Attendance at court per day, (4) All disbursements with receipts.' },
    { prompt: 'Distinguish party-and-party costs from advocate-client costs. When does the court award each?', keyPoints: ['Standard basis', 'Indemnity basis', 'S.27 Advocates Act', 'Discretion of taxing officer'] },
    { prompt: 'Multiple choice: Throw-away costs are: (A) Costs of abandoned applications, (B) Costs paid immediately regardless of outcome, (C) Costs wasted due to adjournment caused by one party, (D) Costs that cannot be taxed', keyPoints: ['Costs wasted due to adjournment'] },
    { prompt: 'Explain the four principles of taxation applicable to bills of costs between party and party in Kenya.', keyPoints: ['Reasonableness', 'Proportionality', 'Necessity', 'Fair value for work done'] },
  ],
  'cp-civil-review': [
    { prompt: 'Distinguish a civil review under Section 80 CPA from an appeal. When is review the appropriate remedy?', keyPoints: ['Discovery of new evidence', 'Mistake apparent on record', 'Any sufficient reason', 'Same court', 'No appeal alternative'] },
    { prompt: 'Draft an application for review of a judgment under Order 45 Rule 1 CPR, stating all grounds.', keyPoints: ['New and important matter', 'Mistake or error apparent', 'Any other sufficient reason', 'Limitation period'] },
    { prompt: 'Multiple choice: A review under S.80 CPA can be filed: (A) Within 30 days of judgment, (B) At any time, (C) Only if no appeal has been filed, (D) Within 14 days', keyPoints: ['Within 30 days'] },
    { prompt: 'Is a review available where a party has already appealed? Discuss the relationship between review and appeal.', keyPoints: ['Cannot run parallel', 'Election of remedies', 'Review heard by same court'] },
    { prompt: 'Explain "mistake or error apparent on the face of the record" with reference to Kenyan case law.', keyPoints: ['Patent error', 'Not arguable point', 'Goes to jurisdiction or procedure'] },
  ],

  // ── ATP101 CRIMINAL LITIGATION ──
  'cr-charges': [
    { prompt: 'Frame a charge for the offence of robbery with violence under Section 296(2) of the Penal Code. Include all essential elements.', keyPoints: ['Being armed', 'Property stolen', 'Violence used', 'Date/Place particulars'], modelAnswer: 'COUNT: Robbery with Violence c/s 296(2) of the Penal Code. PARTICULARS: [Name of accused] on [date], at [place] in [County], being armed with [weapon], robbed [complainant] of [property] valued at KES [amount] and at the time of such robbery used actual violence on the said [complainant].' },
    { prompt: 'The charge sheet reads: "Stealing contrary to Section 268." Identify all defects.', keyPoints: ['Missing particulars', 'No specific subsection', 'No description of property', 'May be duplicitous'] },
    { prompt: 'Draft alternative charges where the accused may be guilty of murder or manslaughter.', keyPoints: ['Alternative counts', 'S.302 vs S.205 Penal Code', 'Charge structure'] },
    { prompt: 'Draft a charge for conspiracy to defraud, including joinder of two accused persons.', keyPoints: ['Conspiracy elements', 'Joinder rules', 'Particulars of agreement'] },
    { prompt: 'Multiple choice: Under the CPC, a charge is defective if: (A) Signed by a police officer, (B) Does not disclose an offence known to law, (C) Contains too many particulars, (D) Filed electronically', keyPoints: ['Must disclose offence known to law'] },
  ],
  'cr-bail-bond': [
    { prompt: 'Draft an application for bail pending trial in a case of economic crimes involving KES 50 million. Address all factors the court will consider.', keyPoints: ['Constitutional right', 'Compelling reasons against', 'Flight risk', 'Evidence tampering', 'Surety adequacy'] },
    { prompt: 'Explain the difference between police bond and court bail under Kenyan criminal procedure.', keyPoints: ['S.123 CPC', 'Article 49(1)(h)', 'Conditions', 'Application process'] },
    { prompt: 'Your client has been denied bail in a capital offence. What arguments can you advance on appeal?', keyPoints: ['Compelling reasons test', 'Presumption of innocence', 'Delay in trial'] },
    { prompt: 'Draft sureties evaluation questions for a bail hearing.', keyPoints: ['Financial ability', 'Residence', 'Relationship to accused', 'Awareness of obligations'] },
    { prompt: 'Multiple choice: Under the Bail and Bond Guidelines 2015, cash bail should: (A) Not exceed KES 100,000, (B) Not exceed one-third of accused income, (C) Not exceed KES 500,000, (D) Be a proportionate amount', keyPoints: ['Proportionality test'] },
  ],
  // ── CASE LAW: ATP101 ──
  'cr-case-woolmington': [
    { prompt: 'State the principle in Woolmington v DPP [1935] AC 462 regarding burden of proof in criminal cases and its application in Kenya.', keyPoints: ['Golden thread', 'Prosecution burden throughout', 'Beyond reasonable doubt', 'No burden on accused'], modelAnswer: 'Viscount Sankey LC stated: "Throughout the web of the English Criminal Law one golden thread is always to be seen — that it is the duty of the prosecution to prove the prisoner guilt." The prosecution must prove guilt beyond reasonable doubt.' },
    { prompt: 'How does Woolmington interact with statutory reverse burdens in Kenyan law? Give examples.', keyPoints: ['Presumption of innocence', 'Reverse onus provisions', 'Evidential vs legal burden'] },
    { prompt: 'Multiple choice: The Woolmington principle states that: (A) The accused must prove innocence, (B) The prosecution bears the burden throughout, (C) The judge decides guilt, (D) Circumstantial evidence is insufficient', keyPoints: ['Prosecution bears burden'] },
    { prompt: 'Draft submissions invoking Woolmington where the prosecution has failed to call a key witness.', keyPoints: ['Gaps in prosecution case', 'Standard of proof', 'Benefit of doubt'] },
    { prompt: 'Is the Woolmington principle absolute? Discuss exceptions recognized in Kenyan criminal law.', keyPoints: ['Insanity defence', 'Statutory exceptions', 'Evidential burden vs legal burden'] },
  ],
  'cr-case-muruatetu': [
    { prompt: 'Explain the significance of Francis Karioko Muruatetu & Another v Republic [2017] eKLR on mandatory death sentences.', keyPoints: ['Mandatory death unconstitutional', 'Right to fair hearing', 'Individualized sentencing', 'Mitigation rights'], modelAnswer: 'The Supreme Court declared that the mandatory nature of the death sentence under S.204 of the Penal Code was unconstitutional because it denied courts discretion to consider mitigating factors, violated the right to a fair hearing (Article 50), and failed to allow individualized sentencing.' },
    { prompt: 'After Muruatetu, what sentencing options does a trial court have in a murder conviction? Draft a sentencing recommendation.', keyPoints: ['Range of sentences', 'Mitigating factors', 'Aggravating factors', 'Proportionality'] },
    { prompt: 'How has Muruatetu been applied to other mandatory minimum sentences in Kenya?', keyPoints: ['Expansion to other offences', 'Robbery with violence', 'Sexual offences', 'Drug trafficking'] },
    { prompt: 'Multiple choice: Muruatetu v Republic held that: (A) Death penalty is abolished, (B) Mandatory death sentence is unconstitutional, (C) All prisoners must be released, (D) Life imprisonment replaces death', keyPoints: ['Mandatory nature, not sentence itself'] },
    { prompt: 'Draft a mitigation submission in a murder case relying on Muruatetu, addressing age, circumstances, and rehabilitation prospects.', keyPoints: ['Mitigating factors', 'Proportionality', 'Individualized assessment'] },
  ],

  // ── ATP102 PROBATE ──
  'pb-will-drafting': [
    { prompt: 'Draft a valid written will for a testator with a spouse, three adult children, and agricultural land in Kiambu. Include executors and attestation clause.', keyPoints: ['Testamentary capacity', 'Revocation of prior wills', 'Specific gifts', 'Residuary estate', 'Executor appointment', 'Attestation by two witnesses'] },
    { prompt: 'Draft a codicil to an existing will adding a charitable bequest of KES 500,000 to a children home.', keyPoints: ['Reference to original will', 'Republication', 'Attestation', 'Confirmation of other provisions'] },
    { prompt: 'Your client is terminally ill and wants an oral will. Advise on validity and procedure.', keyPoints: ['S.9 LSA', 'Presence of three witnesses', 'Limited to moveable property', 'Value limits', 'Time constraints'] },
    { prompt: 'Review this will: "I, John Kamau, give all my property to my son James. Signed this day." Identify all defects.', keyPoints: ['No attestation', 'No witnesses', 'No residuary clause', 'No executor', 'No revocation clause'] },
    { prompt: 'Draft the attestation clause and affidavit of due execution for a will.', keyPoints: ['Witness declarations', 'Testator capacity', 'Voluntary signing', 'Proper format'] },
  ],
  'pb-case-otieno': [
    { prompt: 'Analyze In re Estate of SM Otieno [1987] regarding conflict between customary and statutory law on burial and succession rights.', keyPoints: ['Customary law vs personal law', 'Burial rights', 'Wife vs clan rights', 'LSA S.2(2) exemptions'], modelAnswer: 'The Court of Appeal held that SM Otieno, a Luo by birth, was subject to Luo customary law regarding burial. Despite his wife Virginia having registered the death, the clan had the right to bury him according to Luo customs. The case highlighted the tension between the LSA and customary law.' },
    { prompt: 'Has the 2010 Constitution changed the SM Otieno principles regarding customary law in succession?', keyPoints: ['Article 2(4)', 'Gender equality provisions', 'S.2(2) LSA exemptions', 'Post-2010 developments'] },
    { prompt: 'Multiple choice: In the SM Otieno case, the court held burial rights were governed by: (A) Wishes of surviving spouse, (B) Luo customary law, (C) LSA exclusively, (D) Municipal by-laws', keyPoints: ['Customary law prevailed'] },
    { prompt: 'Discuss implications of SM Otieno for a succession dispute where a deceased Maasai man married under statutory law but had customary obligations.', keyPoints: ['Dual legal systems', 'Which law applies', 'S.2(2) exemptions'] },
    { prompt: 'Draft an opinion letter advising whether customary succession law or the LSA applies to a clients father estate, applying SM Otieno.', keyPoints: ['Community', 'Type of marriage', 'Nature of property', 'S.2(2) analysis'] },
  ],
  'pb-petition-grant': [
    { prompt: 'Draft a Petition for Grant of Letters of Administration Intestate for a deceased with a widow, three children, and property in Nairobi.', keyPoints: ['Form P&A 5', 'Particulars of deceased', 'Beneficiaries listed', 'Property schedule', 'Priority of entitlement'] },
    { prompt: 'Your petitioner is a creditor. Can they apply for a grant? Draft the supporting affidavit.', keyPoints: ['S.56 LSA', 'Creditor standing', 'No family member willing', 'Debt evidence'] },
    { prompt: 'Explain the gazettement procedure for succession petitions and consequences of non-compliance.', keyPoints: ['Publication requirement', 'Objection window', 'Dispensation power'] },
    { prompt: 'Draft the property schedule for a grant application involving a house, bank accounts, motor vehicle, and shares.', keyPoints: ['Accurate description', 'Title numbers', 'Account details', 'Estimated values'] },
    { prompt: 'Multiple choice: Under the LSA, the court must issue a grant to: (A) Any applicant, (B) The surviving spouse without exception, (C) The person with the best entitlement, (D) The eldest child', keyPoints: ['Priority under S.66'] },
  ],

  // ── ATP103 LEGAL WRITING ──
  'lw-legal-opinions': [
    { prompt: 'Draft a legal opinion advising a client on a viable cause of action for breach of a construction contract where the contractor abandoned at 60%.', keyPoints: ['Issue identification', 'Applicable law', 'Analysis', 'Conclusion', 'Recommendation'] },
    { prompt: 'Draft an office memorandum analyzing enforceability of a verbal agreement for sale of land in Kenya.', keyPoints: ['Statute of Frauds', 'Law of Contract Act S.3', 'Part performance doctrine', 'Equitable estoppel'] },
    { prompt: 'Compare the structure of a legal opinion with an office memorandum. Draft one of each on the same issue.', keyPoints: ['Audience difference', 'Formality level', 'Structure variations', 'Recommendation depth'] },
    { prompt: 'Draft a legal opinion on whether a company can sue its own director for competing business activities.', keyPoints: ['Fiduciary duty', 'Companies Act provisions', 'Non-compete analysis', 'Remedies available'] },
    { prompt: 'Review this opinion and identify deficiencies: "The client should sue. The law says they will win. We recommend filing urgently."', keyPoints: ['No issue stated', 'No legal analysis', 'Conclusory', 'No authority cited'] },
  ],
  'lw-contracts': [
    { prompt: 'Draft an employment contract for a legal secretary in a Nairobi law firm, including termination, confidentiality, and probation.', keyPoints: ['Employment Act compliance', 'Terms of employment', 'Termination notice', 'Confidentiality', 'NSSF/NHIF'] },
    { prompt: 'Draft a commercial lease for office space, including rent escalation and maintenance obligations.', keyPoints: ['Parties', 'Premises description', 'Term', 'Rent and escalation', 'Maintenance', 'Insurance'] },
    { prompt: 'Draft a sale of goods contract for 1,000 bags of cement with delivery terms and force majeure.', keyPoints: ['Description of goods', 'Price and payment', 'Delivery terms', 'Risk passage', 'Force majeure'] },
    { prompt: 'Identify and redraft defective clauses: "The party shall do their best to deliver goods. Payment will be sometime after delivery."', keyPoints: ['Vagueness', 'Best efforts vs obligation', 'Time for payment', 'Certainty of terms'] },
    { prompt: 'Draft an indemnity and limitation of liability clause for a technology services agreement.', keyPoints: ['Scope of indemnity', 'Cap on liability', 'Exclusions', 'Survival clause'] },
  ],

  // ── ATP104 TRIAL ADVOCACY ──
  'ta-cross-examination': [
    { prompt: 'Prepare 10 cross-examination questions for a prosecution witness in a fraud case, applying rules of leading questions.', keyPoints: ['Leading questions', 'Close-ended', 'One fact per question', 'Control the witness', 'Prior inconsistency'] },
    { prompt: 'Cross-examine an expert forensic accountant whose report incriminates the accused in embezzlement. Apply techniques for challenging experts.', keyPoints: ['Challenge qualifications', 'Test assumptions', 'Highlight limitations', 'Bias exploration'] },
    { prompt: 'The witness testified contrary to their police statement. Demonstrate confrontation with a prior inconsistent statement.', keyPoints: ['S.145 Evidence Act', 'Lay foundation', 'Put prior statement', 'Demand explanation'] },
    { prompt: 'Present a mock cross-examination script for a car accident defendant who claims the plaintiff ran a red light.', keyPoints: ['Establish facts favorable to client', 'Impeach with prior statement', 'Use documents', 'End on strong point'] },
    { prompt: 'Draft a cross-examination plan for a land dispute witness, identifying three areas of vulnerability.', keyPoints: ['Planning framework', 'Theme identification', 'Weak points', 'Order of questions'] },
  ],
  'ta-case-browne': [
    { prompt: 'Explain the rule in Browne v Dunn (1893) and its application in Kenyan trial advocacy.', keyPoints: ['Obligation to put case to witness', 'Fairness principle', 'Failure to cross-examine = acceptance'], modelAnswer: 'The rule requires that if counsel intends to challenge a witness testimony, they must put their version to the witness during cross-examination. Failure may be treated as acceptance of the evidence.' },
    { prompt: 'You failed to cross-examine a prosecution witness on a critical point. Your opponent invokes Browne v Dunn. How do you respond?', keyPoints: ['Application to recall witness', 'Oversight argument', 'Prejudice assessment'] },
    { prompt: 'Multiple choice: Under Browne v Dunn, failure to cross-examine on a point means: (A) The point is automatically proved, (B) Counsel may be deemed to accept the evidence, (C) The witness must be recalled, (D) A mistrial', keyPoints: ['Deemed acceptance'] },
    { prompt: 'Draft a mock cross-examination demonstrating compliance with Browne v Dunn by putting your case theory to the witness.', keyPoints: ['Put your version', 'Allow response', 'Challenge specific facts'] },
    { prompt: 'Discuss three Kenyan cases that have applied or discussed Browne v Dunn.', keyPoints: ['Kenyan application', 'Modifications', 'Practical impact'] },
  ],

  // ── ATP105 PROFESSIONAL ETHICS ──
  'pe-conflict-interest': [
    { prompt: 'Your firm acted for both vendor and purchaser in a land transaction. The purchaser discovers defects. Analyze the conflict of interest under SOPPEC.', keyPoints: ['SOPPEC-6', 'Dual representation', 'Disqualification', 'Informed consent limitations'] },
    { prompt: 'An advocate who previously acted for a bank in debt recovery is now instructed by a borrower to sue the same bank. Advise under Rule 8.', keyPoints: ['Former client rule', 'Confidential information', 'Chinese wall inadequacy'] },
    { prompt: 'Draft an informed consent letter for a potential conflict of interest where you seek to act for co-defendants with divergent interests.', keyPoints: ['Full disclosure', 'Independent legal advice', 'Right to decline', 'Consequences explained'] },
    { prompt: 'Multiple choice: An advocate may act for both parties if: (A) They both consent, (B) No conflict and both give informed consent, (C) The LSK approves, (D) Never', keyPoints: ['Informed consent + no actual conflict'] },
    { prompt: 'A judicial officer discovers their spouse has shares in a company appearing before them. Analyze the recusal obligation.', keyPoints: ['Objective test for bias', 'Voluntary recusal', 'Application for disqualification'] },
  ],
  'pe-fees-retainer': [
    { prompt: 'Draft a retainer agreement for complex commercial litigation, including fee structure, disbursements, and termination.', keyPoints: ['Scope of work', 'Fee basis', 'Billing frequency', 'Disbursement handling', 'Termination clause', 'SOPPEC-4 compliance'] },
    { prompt: 'Your client refuses to pay after you won their case. Explain your options under the Advocates Act, including the advocate lien.', keyPoints: ['S.47-48 Advocates Act', 'Retaining lien', 'Specific lien', 'Statutory charge', 'Taxation of bill'] },
    { prompt: 'Draft a bill of costs for taxation after successful representation in a High Court civil trial lasting 5 days.', keyPoints: ['Instruction fees', 'Getting up fees', 'Attendance', 'Disbursements', 'Advocates Remuneration Order'] },
    { prompt: 'Explain the prohibition against undercutting and its rationale in the Kenyan legal profession.', keyPoints: ['SOPPEC-4', 'Advocates Remuneration Order', 'Professional standards', 'Quality of service'] },
    { prompt: 'A fellow advocate offers to share fees with a non-advocate referral source. Is this permissible? Analyze.', keyPoints: ['Fee sharing prohibition', 'Touting', 'SOPPEC-2', 'Exceptions for employed advocates'] },
  ],

  // ── ATP107 CONVEYANCING ──
  'cv-sale-agreement': [
    { prompt: 'Draft a sale agreement for a residential property in Nairobi (LR No. 209/1234), price KES 15M, with 10% deposit and 90-day completion.', keyPoints: ['Parties', 'Property description', 'Purchase price', 'Deposit', 'Completion date', 'LSK conditions of sale'] },
    { prompt: 'Draft vendor warranties and representations for commercial property sale.', keyPoints: ['Title warranty', 'No encumbrances', 'Planning compliance', 'Environmental compliance', 'Tenancy disclosures'] },
    { prompt: 'The buyer discovers a caution on the property after signing. Advise on remedies.', keyPoints: ['Vendor obligation to clear', 'Rescission rights', 'Extension of time', 'Damages'] },
    { prompt: 'Compare an open contract with a formal contract of sale under Kenyan conveyancing practice.', keyPoints: ['Implied terms', 'Express conditions', 'LSK standard form', 'Risk allocation'] },
    { prompt: 'Draft a completion notice from vendor advocates including checklist of completion requirements.', keyPoints: ['Outstanding documents', 'Balance payment', 'Clearance certificates', 'LCB consent'] },
  ],
  'cv-charges': [
    { prompt: 'Draft a charge instrument over leasehold property (LR No. Nairobi/Block 82/1500) securing KES 25M from ABC Bank.', keyPoints: ['Parties', 'Property description', 'Principal sum', 'Interest rate', 'Repayment terms', 'Events of default', 'Power of sale'] },
    { prompt: 'Advise a chargor whose bank threatens power of sale. What protections exist under the Land Act?', keyPoints: ['Notice requirements', 'S.90-96 Land Act', 'Equity of redemption', 'Court intervention'] },
    { prompt: 'Explain priority of charges where property is subject to first and second charges.', keyPoints: ['First in time', 'Registration date', 'Notice provisions', 'Tacking'] },
    { prompt: 'Draft a discharge of charge after full repayment.', keyPoints: ['Discharge form', 'Registry requirements', 'Chargee obligation to discharge'] },
    { prompt: 'Multiple choice: A chargee right of sale arises if: (A) Any instalment is overdue, (B) Principal or interest unpaid for 3 months after demand, (C) The chargor leaves the country, (D) Property value decreases', keyPoints: ['S.90 Land Act conditions'] },
  ],
  'cv-case-macharia': [
    { prompt: 'Explain the significance of Macharia v Kiome [2009] eKLR regarding spousal interest in matrimonial property and conveyancing.', keyPoints: ['Spousal consent', 'Constructive trust', 'Contribution doctrine', 'Conveyancer due diligence'], modelAnswer: 'A spouse who has made contributions (monetary or non-monetary) acquires a beneficial interest. Conveyancers must verify marital status and obtain spousal consent.' },
    { prompt: 'As a conveyancer, what steps must you take in light of Macharia v Kiome to protect a purchaser?', keyPoints: ['Verify marital status', 'Obtain spousal consent', 'Marriage certificate', 'Statutory declaration'] },
    { prompt: 'Has the Matrimonial Property Act 2013 codified the Macharia principles? Analyze.', keyPoints: ['S.6 Matrimonial Property Act', 'Constructive trust codified', 'Non-monetary contribution', 'Equal rights'] },
    { prompt: 'Multiple choice: Under Macharia v Kiome, a spouse contribution to property can be: (A) Only monetary, (B) Only if named on title, (C) Monetary or non-monetary, (D) Only if documented', keyPoints: ['Monetary or non-monetary'] },
    { prompt: 'Draft a vendor statutory declaration on marital status and spousal consent, applying Macharia principles.', keyPoints: ['Declaration of marital status', 'Consent attached', 'No other beneficial interests'] },
  ],

  // ── ATP108 COMMERCIAL TRANSACTIONS ──
  'ct-shareholder-agreements': [
    { prompt: 'Draft deadlock resolution and tag-along/drag-along provisions for a 50-50 JV company.', keyPoints: ['Escalation procedure', 'Mediation/arbitration', 'Tag-along rights', 'Drag-along mechanism', 'Valuation method'] },
    { prompt: 'Draft a comprehensive shareholders agreement for a startup with three founders (40%, 35%, 25%).', keyPoints: ['Board composition', 'Reserved matters', 'Transfer restrictions', 'Pre-emption rights', 'Vesting schedule'] },
    { prompt: 'Explain the legal effect of a shareholders agreement versus company articles under the Companies Act 2015.', keyPoints: ['Contractual vs constitutional', 'Binding effect', 'Third parties', 'Amendment procedures'] },
    { prompt: 'Draft a resolution for an EGM to approve a rights issue.', keyPoints: ['Notice requirements', 'Special resolution', 'Pro-rata entitlement', 'Renunciation rights'] },
    { prompt: 'A minority shareholder alleges oppression. Advise on remedies under the Companies Act 2015.', keyPoints: ['S.775-776', 'Unfairly prejudicial conduct', 'Winding up', 'Purchase order'] },
  ],
  'ct-case-salomon': [
    { prompt: 'Explain the Salomon v A Salomon & Co Ltd [1897] AC 22 principle and its significance in Kenyan company law.', keyPoints: ['Separate legal personality', 'Corporate veil', 'One-man company validity', 'Limited liability'], modelAnswer: 'The House of Lords held that a company is a separate legal entity distinct from its members, even if one person holds virtually all shares. Mr. Salomon was not personally liable for the company debts.' },
    { prompt: 'When will Kenyan courts lift the corporate veil? Discuss exceptions to Salomon with Kenyan examples.', keyPoints: ['Fraud', 'Agency', 'Sham company', 'Group enterprises', 'Statutory provisions'] },
    { prompt: 'Draft an opinion on whether a creditor can pursue a sole director personally for company debts, applying Salomon.', keyPoints: ['Separate personality', 'Personal guarantees', 'Lifting the veil exceptions', 'Evidence required'] },
    { prompt: 'Multiple choice: Under Salomon, a company with one shareholder: (A) Cannot exist, (B) Has no separate personality, (C) Is a separate legal entity, (D) Must have 2+ directors', keyPoints: ['Separate legal entity'] },
    { prompt: 'Compare Salomon with modern Kenyan Companies Act 2015 provisions on single-member companies.', keyPoints: ['S.3(1) Companies Act 2015', 'Registration by one person', 'Modern codification'] },
  ],
  'ct-mergers': [
    { prompt: 'Draft a due diligence request list for acquisition of a Kenyan logistics company covering corporate, employment, tax, and regulatory.', keyPoints: ['Corporate documents', 'Financial statements', 'Employment contracts', 'Tax returns', 'Regulatory licenses', 'Litigation register'] },
    { prompt: 'Explain when a merger is notifiable to the CAK and consequences of failure to notify.', keyPoints: ['Turnover thresholds', 'Asset thresholds', 'S.41-42 Competition Act', 'Penalties'] },
    { prompt: 'Draft key commercial terms of a share purchase agreement including conditions precedent and warranties.', keyPoints: ['Purchase price', 'Conditions precedent', 'Seller warranties', 'Indemnities', 'Completion mechanism'] },
    { prompt: 'Distinguish share purchase from asset purchase. When is each preferable?', keyPoints: ['Tax implications', 'Liability assumption', 'Employee transfer', 'Regulatory approvals'] },
    { prompt: 'A proposed merger is rejected by CAK. What options does the acquirer have?', keyPoints: ['Appeal to CAT', 'Restructure transaction', 'Behavioural remedies', 'Judicial review'] },
  ],
};

// ========================================================================
// AUTO-GENERATE items for skills without explicit prompts
// ========================================================================
function autoGenerateItems(skill: SkillDef, unitId: string): ItemSeed[] {
  const items: ItemSeed[] = [];
  const skillName = skill.name;
  const isCL = skill.isCaseLaw;

  if (isCL) {
    const caseName = skillName.replace('Case: ', '').split('(')[0].trim();
    items.push(
      { prompt: `State the key principles established in ${caseName} and their significance in Kenyan legal practice.`, keyPoints: ['Key holding', 'Ratio decidendi', 'Application in Kenya'] },
      { prompt: `How has ${caseName} been applied or distinguished in subsequent Kenyan decisions?`, keyPoints: ['Subsequent application', 'Distinguishing factors', 'Current status'] },
      { prompt: `Draft a submission relying on the principles from ${caseName} in a hypothetical scenario.`, keyPoints: ['Fact application', 'Legal reasoning', 'Analogical argument'] },
      { prompt: `Identify and explain the core principle established in ${caseName}.`, keyPoints: ['Core principle identification', 'Contextual significance'] },
      { prompt: `Is ${caseName} still good law? Critically evaluate with reference to statutory developments and later case law.`, keyPoints: ['Current validity', 'Legislative changes', 'Judicial reconsideration'] },
    );
  } else {
    const formats = skill.formats;
    for (let i = 0; i < 5; i++) {
      const fmt = formats[i % formats.length];
      switch (fmt) {
        case 'mcq':
          items.push({ prompt: `Formulate a challenging MCQ testing a key concept in ${skillName} under Kenyan law. Provide four options and explain the correct answer.`, keyPoints: [`${skillName} core concept`, 'Application of rules'] });
          break;
        case 'written':
          items.push({ prompt: `Analyze and discuss the key principles governing ${skillName} in Kenyan legal practice. Include relevant statutory provisions and case law.`, keyPoints: [`${skillName} principles`, 'Statutory framework', 'Practical application'] });
          break;
        case 'oral':
          items.push({ prompt: `Present oral arguments on a contested issue in ${skillName}. You have 5 minutes to address the court.`, keyPoints: [`${skillName} advocacy`, 'Oral presentation', 'Authority citation'] });
          break;
        case 'drafting':
          items.push({ prompt: `Draft the key document(s) required for ${skillName} in a typical scenario involving a ${unitId} matter.`, keyPoints: [`${skillName} drafting`, 'Format compliance', 'Substantive accuracy'] });
          break;
      }
    }
  }
  return items;
}

// ========================================================================
// MAIN SEED FUNCTION
// ========================================================================
async function seedCurriculum() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sqlClient = neon(dbUrl);
  const db = drizzle(sqlClient);

  console.log('YNAI Curriculum Seed — All 9 ATP Units\n');
  console.log('============================================\n');

  let totalSkills = 0;
  let totalItems = 0;
  let totalEdges = 0;
  let totalMappings = 0;

  try {
    for (const domain of DOMAINS) {
      console.log(`\n  ${domain.name} (${domain.unitId})`);
      console.log('-'.repeat(50));

      // 1. Create/upsert domain
      const domainResult = await db.execute(sql`
        INSERT INTO domains (name, code, description)
        VALUES (${domain.name}, ${domain.code}, ${domain.description})
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
        RETURNING id
      `);
      const domainId = (domainResult.rows[0] as { id: string }).id;

      // 2. Create micro-skills
      const skillIdMap: Map<string, string> = new Map();
      let caseLawCount = 0;

      for (const skill of domain.skills) {
        const fmtArray = `{${skill.formats.join(',')}}`;
        const result = await db.execute(sql`
          INSERT INTO micro_skills (name, code, domain_id, unit_id, format_tags, exam_weight, difficulty, is_core, is_active)
          VALUES (
            ${skill.name},
            ${skill.code},
            ${domainId}::uuid,
            ${domain.unitId},
            ${fmtArray}::format_tag[],
            ${skill.weight},
            ${skill.difficulty}::difficulty_level,
            ${skill.isCore},
            true
          )
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            domain_id = EXCLUDED.domain_id,
            exam_weight = EXCLUDED.exam_weight,
            is_core = EXCLUDED.is_core
          RETURNING id
        `);
        skillIdMap.set(skill.code, (result.rows[0] as { id: string }).id);
        if (skill.isCaseLaw) caseLawCount++;
        totalSkills++;
      }
      console.log(`   Skills: ${skillIdMap.size} (${caseLawCount} case law)`);

      // 3. Prerequisite edges
      let edgeCount = 0;
      for (const skill of domain.skills) {
        if (skill.prereqs) {
          const toId = skillIdMap.get(skill.code);
          for (const preCode of skill.prereqs) {
            const fromId = skillIdMap.get(preCode);
            if (fromId && toId) {
              await db.execute(sql`
                INSERT INTO skill_edges (from_skill_id, to_skill_id, edge_type, strength)
                VALUES (${fromId}::uuid, ${toId}::uuid, 'prerequisite', 1.0)
                ON CONFLICT (from_skill_id, to_skill_id) DO NOTHING
              `);
              edgeCount++;
              totalEdges++;
            }
          }
        }
      }
      console.log(`   Edges: ${edgeCount}`);

      // 4. Items and mappings
      let itemCount = 0;
      let mapCount = 0;

      for (const skill of domain.skills) {
        const skillId = skillIdMap.get(skill.code);
        if (!skillId) continue;

        const prompts = SKILL_PROMPTS[skill.code] || autoGenerateItems(skill, domain.unitId);

        for (let i = 0; i < prompts.length; i++) {
          const item = prompts[i];
          const fmt = skill.formats[i % skill.formats.length];
          const diff = skill.difficulty === 'beginner' ? 2 : skill.difficulty === 'intermediate' ? 3 : 4;

          const kpArray = item.keyPoints.length > 0
            ? `{${item.keyPoints.map(k => `"${k.replace(/"/g, '\\"')}"`).join(',')}}`
            : '{}';

          try {
            const itemResult = await db.execute(sql`
              INSERT INTO items (item_type, format, unit_id, prompt, context, model_answer, key_points, difficulty, estimated_minutes, is_active)
              VALUES (
                ${fmtToItemType(fmt)}::item_type,
                ${fmt}::format_tag,
                ${domain.unitId},
                ${item.prompt},
                ${item.context || null},
                ${item.modelAnswer || null},
                ${kpArray}::text[],
                ${diff},
                ${fmtToMinutes(fmt)},
                true
              )
              RETURNING id
            `);
            const itemId = (itemResult.rows[0] as { id: string }).id;
            itemCount++;
            totalItems++;

            await db.execute(sql`
              INSERT INTO item_skill_map (item_id, skill_id, strength, coverage_weight)
              VALUES (${itemId}::uuid, ${skillId}::uuid, 'primary'::mapping_strength, 1.0)
              ON CONFLICT (item_id, skill_id) DO NOTHING
            `);
            mapCount++;
            totalMappings++;
          } catch (itemErr: any) {
            console.error(`   !! FAILED item for skill ${skill.code} (item ${i}): ${itemErr?.cause?.message || itemErr.message}`);
            console.error(`      fmt=${fmt}, kpArray=${kpArray.substring(0,80)}...`);
          }
        }
      }
      console.log(`   Items: ${itemCount}, Mappings: ${mapCount}`);
    }

    // Final summary
    console.log('\n============================================');
    console.log('COMPREHENSIVE CURRICULUM SEED COMPLETE');
    console.log('============================================');
    console.log(`   Domains:      ${DOMAINS.length}`);
    console.log(`   Skills:       ${totalSkills}`);
    console.log(`   Prereq Edges: ${totalEdges}`);
    console.log(`   Items:        ${totalItems}`);
    console.log(`   Mappings:     ${totalMappings}`);
    console.log(`   Coverage:     ALL 9 ATP units\n`);

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

seedCurriculum()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { seedCurriculum, DOMAINS };
