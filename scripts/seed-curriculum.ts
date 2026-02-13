/**
 * YNAI Mastery Engine v3 - Seed Script
 * 
 * Seeds a complete demo curriculum for Civil Procedure unit:
 * - 1 Domain
 * - 20 Micro-skills with prerequisites
 * - 100 Items (mix of MCQ, written, oral, drafting)
 * - Item-skill mappings
 * 
 * Run with: npx tsx scripts/seed-curriculum.ts
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

// ============================================
// CONFIGURATION
// ============================================

const DOMAIN = {
  name: 'Civil Procedure',
  code: 'civil-proc',
  description: 'Civil Procedure and Practice under Kenyan law',
};

const UNIT_ID = 'atp-100'; // Civil Procedure ATP unit

// 20 Micro-skills with hierarchy
const SKILLS = [
  // Foundation skills (no prerequisites)
  { code: 'cp-jurisdiction', name: 'Jurisdiction Analysis', difficulty: 'foundation', weight: 0.08, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-parties', name: 'Parties to Civil Proceedings', difficulty: 'foundation', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-cause-action', name: 'Cause of Action Elements', difficulty: 'foundation', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-limitation', name: 'Limitation Periods', difficulty: 'foundation', weight: 0.05, formats: ['mcq'], isCore: false },
  { code: 'cp-service', name: 'Service of Process', difficulty: 'foundation', weight: 0.04, formats: ['mcq', 'drafting'], isCore: false },
  
  // Core skills (require foundation)
  { code: 'cp-plaint-draft', name: 'Plaint Drafting', difficulty: 'core', weight: 0.08, formats: ['drafting'], isCore: true, prereqs: ['cp-jurisdiction', 'cp-parties', 'cp-cause-action'] },
  { code: 'cp-defence-draft', name: 'Defence Drafting', difficulty: 'core', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-counterclaim', name: 'Counterclaim Procedure', difficulty: 'core', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-defence-draft'] },
  { code: 'cp-interlocutory', name: 'Interlocutory Applications', difficulty: 'core', weight: 0.07, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-injunction', name: 'Injunction Applications', difficulty: 'core', weight: 0.08, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-interlocutory'] },
  { code: 'cp-summary-judg', name: 'Summary Judgment', difficulty: 'core', weight: 0.05, formats: ['written', 'oral'], isCore: false, prereqs: ['cp-plaint-draft', 'cp-defence-draft'] },
  { code: 'cp-discovery', name: 'Discovery & Interrogatories', difficulty: 'core', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-joinder', name: 'Joinder of Parties', difficulty: 'core', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['cp-parties'] },
  { code: 'cp-amendment', name: 'Amendment of Pleadings', difficulty: 'core', weight: 0.04, formats: ['written', 'oral'], isCore: false, prereqs: ['cp-plaint-draft'] },
  
  // Advanced skills (require core)
  { code: 'cp-trial-conduct', name: 'Trial Conduct & Evidence', difficulty: 'advanced', weight: 0.08, formats: ['oral', 'written'], isCore: true, prereqs: ['cp-interlocutory', 'cp-discovery'] },
  { code: 'cp-examination', name: 'Witness Examination', difficulty: 'advanced', weight: 0.06, formats: ['oral'], isCore: true, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-judgment-draft', name: 'Judgment Analysis & Drafts', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-costs', name: 'Costs in Civil Proceedings', difficulty: 'advanced', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-execution', name: 'Execution of Judgments', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-appeals', name: 'Appeals & Review', difficulty: 'advanced', weight: 0.06, formats: ['written', 'oral'], isCore: true, prereqs: ['cp-judgment-draft'] },
];

// Item templates for each skill (5 items per skill = 100 items)
function generateItemsForSkill(skill: typeof SKILLS[0], skillId: string): any[] {
  const items: any[] = [];
  const basePrompts = SKILL_PROMPTS[skill.code] || [];
  
  // Ensure at least 5 items per skill
  for (let i = 0; i < 5; i++) {
    const prompt = basePrompts[i] || `Practice question ${i + 1} for ${skill.name}`;
    const format = skill.formats[i % skill.formats.length] as 'mcq' | 'written' | 'oral' | 'drafting';
    
    items.push({
      skillCode: skill.code,
      skillId,
      itemType: formatToItemType(format),
      format,
      prompt: prompt.prompt || prompt,
      context: prompt.context || null,
      modelAnswer: prompt.modelAnswer || null,
      keyPoints: prompt.keyPoints || [],
      difficulty: skill.difficulty === 'foundation' ? 2 : skill.difficulty === 'core' ? 3 : 4,
      estimatedMinutes: formatToMinutes(format),
    });
  }
  
  return items;
}

function formatToItemType(format: string): string {
  switch (format) {
    case 'mcq': return 'mcq';
    case 'written': return 'issue_spot';
    case 'oral': return 'oral_prompt';
    case 'drafting': return 'drafting_task';
    default: return 'issue_spot';
  }
}

function formatToMinutes(format: string): number {
  switch (format) {
    case 'mcq': return 5;
    case 'flashcard': return 2;
    case 'written': return 20;
    case 'oral': return 15;
    case 'drafting': return 30;
    default: return 15;
  }
}

// Detailed prompts for each skill
const SKILL_PROMPTS: Record<string, any[]> = {
  'cp-jurisdiction': [
    { prompt: 'A dispute arises between two parties over a commercial contract worth KES 2 million. The contract was executed in Nairobi but the defendant resides in Mombasa. Analyze which court has jurisdiction and explain the legal basis.', keyPoints: ['Subject matter jurisdiction', 'Territorial jurisdiction', 'CPC provisions'], modelAnswer: 'The High Court has jurisdiction over civil matters exceeding KES 500,000...' },
    { prompt: 'Explain the distinction between original and appellate jurisdiction in the Kenyan court system with specific reference to civil matters.', keyPoints: ['Original jurisdiction', 'Appellate jurisdiction', 'Constitutional provisions'] },
    { prompt: 'Which court has jurisdiction: A claim for recovery of land valued at KES 300,000?', keyPoints: ['Land disputes', 'Environment and Land Court', 'Valuation'] },
    { prompt: 'Multiple choice: Under the CPC, the court of competent jurisdiction for a contract dispute worth KES 50,000 is: (A) High Court, (B) Magistrate Court, (C) Supreme Court, (D) Tribunal', keyPoints: ['Pecuniary jurisdiction'] },
    { prompt: 'A party challenges jurisdiction after filing a defence. Is this valid? Analyze the timing requirements for jurisdictional objections.', keyPoints: ['Waiver', 'Timing', 'Order 6 CPC'] },
  ],
  'cp-parties': [
    { prompt: 'Explain who can be a proper party to civil proceedings and the test for determining necessary vs proper parties.', keyPoints: ['Necessary party', 'Proper party', 'Joinder rules'] },
    { prompt: 'A minor wishes to sue for damages from a road accident. Draft a note explaining the procedure for representation.', keyPoints: ['Next friend', 'Guardian ad litem', 'Capacity'] },
    { prompt: 'A company director is sued in personal capacity for company debts. Analyze whether they are a proper party.', keyPoints: ['Corporate veil', 'Personal liability', 'Separate legal entity'] },
    { prompt: 'Distinguish between representative suits and class actions under Kenyan civil procedure.', keyPoints: ['Order 1 Rule 8', 'Common interest', 'Representative capacity'] },
    { prompt: 'Multiple choice: A deceased person\'s estate can sue through: (A) Next of kin, (B) Personal representative, (C) Any family member, (D) The court directly', keyPoints: ['Estate representation'] },
  ],
  'cp-cause-action': [
    { prompt: 'Draft a legal opinion identifying all causes of action available to a client who was sold defective machinery that caused injury to an employee.', context: 'Client purchased industrial machinery that malfunctioned on first use, injuring an employee. Seller provided express warranty.', keyPoints: ['Breach of contract', 'Negligence', 'Product liability', 'Breach of warranty'] },
    { prompt: 'Explain the elements required to establish a cause of action in tort for professional negligence.', keyPoints: ['Duty', 'Breach', 'Causation', 'Damage'] },
    { prompt: 'When does a cause of action accrue in contract vs tort? Analyze with reference to limitation.', keyPoints: ['Accrual', 'Discoverability', 'Limitation Act'] },
    { prompt: 'Multiple choice: A cause of action for breach of contract accrues: (A) When damage is discovered, (B) When breach occurs, (C) When contract is signed, (D) When action is filed', keyPoints: ['Accrual time'] },
    { prompt: 'Identify the causes of action and essential elements in this scenario: A landlord locked out a tenant mid-lease without notice.', keyPoints: ['Breach of lease', 'Wrongful eviction', 'Trespass'] },
  ],
  'cp-limitation': [
    { prompt: 'What is the limitation period for a claim arising from a road traffic accident? When does time begin to run?', keyPoints: ['3 years', 'Personal injury', 'Date of accident'] },
    { prompt: 'Multiple choice: The limitation period for breach of a simple contract is: (A) 3 years, (B) 6 years, (C) 12 years, (D) No limit', keyPoints: ['Contract limitation'] },
    { prompt: 'A client discovers fraud 5 years after it occurred. Analyze whether they can still bring a claim.', keyPoints: ['Fraud extension', 'Concealment', 'Discovery rule'] },
    { prompt: 'Explain how acknowledgment of debt affects the limitation period.', keyPoints: ['Acknowledgment', 'Fresh accrual', 'Part payment'] },
    { prompt: 'Multiple choice: Under the Limitation of Actions Act, written acknowledgment of debt: (A) Has no effect, (B) Restarts limitation, (C) Pauses limitation, (D) Requires court approval', keyPoints: ['Acknowledgment effect'] },
  ],
  'cp-service': [
    { prompt: 'Draft a memorandum explaining the methods of service available under the CPC and when each is appropriate.', keyPoints: ['Personal service', 'Substituted service', 'Service by post'] },
    { prompt: 'A defendant is evading service. What options does the plaintiff have? Draft an application for substituted service.', keyPoints: ['Substituted service', 'Affidavit', 'Court order'] },
    { prompt: 'Multiple choice: Personal service on a company is effected by: (A) Serving any employee, (B) Serving a director or company secretary, (C) Posting to registered office, (D) Email to info@company', keyPoints: ['Corporate service'] },
    { prompt: 'Explain the consequences of defective service and how it may be cured.', keyPoints: ['Irregular service', 'Waiver', 'Amended service'] },
    { prompt: 'Draft an affidavit of service for personal service of a plaint on an individual defendant.', keyPoints: ['Affidavit format', 'Date/time/manner', 'Server identity'] },
  ],
  'cp-plaint-draft': [
    { prompt: 'Draft a plaint for recovery of KES 5 million being money lent and not repaid.', context: 'Client lent money on 1 January 2025, repayment due 1 July 2025. Written agreement exists. Defendant has not responded to demands.', keyPoints: ['Parties', 'Jurisdiction', 'Cause of action', 'Relief sought', 'Verification'] },
    { prompt: 'Review this plaint and identify all defects: [Sample defective plaint provided]', keyPoints: ['Format errors', 'Missing averments', 'Verification issues'] },
    { prompt: 'Draft the averments section of a plaint for breach of employment contract resulting in wrongful dismissal.', keyPoints: ['Employment relationship', 'Contract terms', 'Breach particulars', 'Damages claimed'] },
    { prompt: 'A plaint has been rejected by the registry. Common reasons include: analyze and correct the following plaint.', keyPoints: ['Registry requirements', 'Court fees', 'Format compliance'] },
    { prompt: 'Draft a plaint claiming specific performance of a land sale agreement.', keyPoints: ['Land description', 'Agreement particulars', 'Specific performance elements', 'Alternative damages'] },
  ],
  'cp-defence-draft': [
    { prompt: 'Draft a defence to a claim for recovery of KES 5 million where the defendant admits the loan but claims it was a gift.', keyPoints: ['Admission', 'Affirmative defence', 'Burden shift'] },
    { prompt: 'The plaintiff\'s claim is time-barred. Draft a defence raising limitation as a complete defence.', keyPoints: ['Limitation defence', 'Pleading specificity', 'Burden of proof'] },
    { prompt: 'Draft a defence denying liability in a road traffic accident claim.', keyPoints: ['Denial', 'Contributory negligence', 'Quantum challenge'] },
    { prompt: 'When must a defence be filed? What are the consequences of late filing?', keyPoints: ['Filing timelines', 'Default judgment', 'Extension applications'] },
    { prompt: 'Draft a defence that includes a set-off claim.', keyPoints: ['Set-off', 'Mutual debts', 'Pleading requirements'] },
  ],
  'cp-counterclaim': [
    { prompt: 'Draft a counterclaim in a commercial dispute where the defendant claims the plaintiff actually owes them money.', keyPoints: ['Counterclaim format', 'Separate cause of action', 'Relief sought'] },
    { prompt: 'When can a counterclaim be filed separately from the defence? Analyze procedural requirements.', keyPoints: ['Timing', 'Leave requirements', 'Consolidation'] },
    { prompt: 'The plaintiff wishes to discontinue after a strong counterclaim is filed. What happens to the counterclaim?', keyPoints: ['Discontinuance effect', 'Independent prosecution', 'Costs'] },
    { prompt: 'Multiple choice: A counterclaim may be struck out if: (A) It arises from different facts, (B) It exceeds the original claim, (C) It names additional parties, (D) Never', keyPoints: ['Strike out grounds'] },
    { prompt: 'Draft a reply and defence to counterclaim.', keyPoints: ['Reply format', 'Defence to counterclaim', 'New matters'] },
  ],
  'cp-interlocutory': [
    { prompt: 'Draft a notice of motion for an interlocutory injunction to restrain the defendant from selling disputed property.', keyPoints: ['Notice of motion', 'Supporting affidavit', 'Grounds', 'Prayer'] },
    { prompt: 'Explain the Giella v Cassman Brown principles for granting interlocutory injunctions.', keyPoints: ['Prima facie case', 'Irreparable harm', 'Balance of convenience'] },
    { prompt: 'Your client needs urgent orders before the defendant can dissipate assets. What procedure would you use?', keyPoints: ['Ex parte', 'Certificate of urgency', 'Return date'] },
    { prompt: 'Draft submissions opposing an application for interlocutory injunction.', keyPoints: ['Challenge prima facie case', 'Adequate damages', 'Balance of convenience'] },
    { prompt: 'An interlocutory order has been granted ex parte. How do you set it aside?', keyPoints: ['Setting aside', 'Material non-disclosure', 'Inter partes hearing'] },
  ],
  'cp-injunction': [
    { prompt: 'Draft a complete application for a prohibitory injunction against ongoing trespass.', keyPoints: ['Prohibitory injunction', 'Continuing wrong', 'Affidavit evidence'] },
    { prompt: 'Your opponent seeks a mandatory injunction. Present oral arguments against it.', keyPoints: ['Higher threshold', 'Status quo', 'Supervisory problems'] },
    { prompt: 'Explain the doctrine of undertaking as to damages in injunction applications.', keyPoints: ['Undertaking requirement', 'Inquiry as to damages', 'Enforcement'] },
    { prompt: 'Draft an application for Mareva injunction to freeze defendant\'s bank accounts.', keyPoints: ['Asset preservation', 'Worldwide Mareva', 'Disclosure orders'] },
    { prompt: 'Compare the requirements for interim, interlocutory, and permanent injunctions.', keyPoints: ['Timing', 'Evidentiary standard', 'Final determination'] },
  ],
  'cp-summary-judg': [
    { prompt: 'Prepare an application for summary judgment in a dishonored cheque case. Include all supporting documents.', keyPoints: ['Order 36', 'Clear liability', 'Affidavit requirements'] },
    { prompt: 'Present oral arguments opposing a summary judgment application.', keyPoints: ['Triable issue', 'Bona fide defence', 'Leave to defend'] },
    { prompt: 'When is summary judgment available? Analyze the types of claims suitable for this procedure.', keyPoints: ['Liquidated claims', 'Contract and tort', 'Exceptions'] },
    { prompt: 'The defendant has filed a defence to summary judgment. Assess whether it raises a triable issue.', keyPoints: ['Triable issue test', 'Shadowy defence', 'Conditional leave'] },
    { prompt: 'Draft an affidavit in support of summary judgment for recovery of a commercial debt.', keyPoints: ['Debt particulars', 'Documentation', 'No defence'] },
  ],
  'cp-discovery': [
    { prompt: 'Draft interrogatories to be served on the defendant in a personal injury claim.', keyPoints: ['Relevant questions', 'Not oppressive', 'Verification required'] },
    { prompt: 'The opponent has failed to comply with discovery orders. What remedies are available?', keyPoints: ['Contempt', 'Unless order', 'Adverse inference'] },
    { prompt: 'Prepare a list of documents for disclosure in a commercial contract dispute.', keyPoints: ['Relevant documents', 'Privileged documents', 'Format requirements'] },
    { prompt: 'Your client possesses privileged documents. Draft a notice of privilege.', keyPoints: ['Legal professional privilege', 'Litigation privilege', 'Claiming privilege'] },
    { prompt: 'Analyze when the court may order specific discovery and the grounds for such an order.', keyPoints: ['Specific discovery', 'Fishing expeditions', 'Proportionality'] },
  ],
  'cp-joinder': [
    { prompt: 'Draft an application to join a third party to ongoing proceedings.', keyPoints: ['Third party notice', 'Indemnity/contribution', 'Leave requirements'] },
    { prompt: 'Explain the distinction between misjoinder and non-joinder of parties and the remedies available.', keyPoints: ['Misjoinder', 'Non-joinder', 'Amendment'] },
    { prompt: 'Multiple choice: A party may be joined to proceedings if: (A) They are connected to the defendant, (B) Their presence is necessary for effectual adjudication, (C) They may have relevant evidence, (D) The plaintiff requests it', keyPoints: ['Joinder test'] },
    { prompt: 'The court has ordered joinder of a party who claims they have no interest in the dispute. Advise.', keyPoints: ['Challenge joinder', 'Strike out', 'Protective costs'] },
    { prompt: 'Draft submissions on why the proposed additional party is necessary for determination of the dispute.', keyPoints: ['Necessity test', 'Common questions', 'Same transaction'] },
  ],
  'cp-amendment': [
    { prompt: 'Draft an application to amend the plaint to add a new cause of action.', keyPoints: ['Amendment principles', 'New cause of action', 'Limitation concerns'] },
    { prompt: 'The defendant opposes your amendment application. Present oral arguments in response.', keyPoints: ['Prejudice', 'Justice vs finality', 'Costs'] },
    { prompt: 'Multiple choice: Amendment of pleadings after close of pleadings requires: (A) Notice to opponent, (B) Leave of court, (C) Payment of costs, (D) All of the above', keyPoints: ['Leave requirements'] },
    { prompt: 'When can an amendment be allowed even if it introduces a time-barred claim?', keyPoints: ['Same facts', 'Mistake correction', 'No new cause'] },
    { prompt: 'Draft a supplemental pleading rather than an amendment. Explain when this is appropriate.', keyPoints: ['Supplemental vs amendment', 'New matters', 'Court permission'] },
  ],
  'cp-trial-conduct': [
    { prompt: 'Draft a trial memorandum for a breach of contract case scheduled for hearing.', keyPoints: ['Issues', 'Legal arguments', 'Evidence list', 'Authorities'] },
    { prompt: 'Present an opening statement for a civil trial before a High Court judge.', keyPoints: ['Case theory', 'Key facts', 'Relief sought'] },
    { prompt: 'Your witness has given evidence inconsistent with their statement. How do you handle this?', keyPoints: ['Hostile witness', 'Prior inconsistent statement', 'Explanation'] },
    { prompt: 'The opponent seeks to introduce evidence not in their list of documents. Object.', keyPoints: ['Evidence objection', 'Late evidence', 'Prejudice'] },
    { prompt: 'Draft a closing submission highlighting the evidence that supports your case.', keyPoints: ['Evidence analysis', 'Credibility', 'Legal application'] },
  ],
  'cp-examination': [
    { prompt: 'Conduct examination-in-chief of your key witness in a land dispute.', keyPoints: ['Non-leading questions', 'Narrative flow', 'Document handling'] },
    { prompt: 'Cross-examine an expert witness who has given an opinion favorable to the opponent.', keyPoints: ['Challenge expertise', 'Test foundations', 'Contrary materials'] },
    { prompt: 'The witness has become hostile during examination. Apply to treat them as hostile.', keyPoints: ['Hostile witness', 'Application procedure', 'Consequences'] },
    { prompt: 'Prepare a list of cross-examination questions for the defendant in a fraud case.', keyPoints: ['Leading questions', 'Prior inconsistencies', 'Document confrontation'] },
    { prompt: 'Re-examine your witness after damaging cross-examination. What areas can you cover?', keyPoints: ['Re-examination scope', 'Clarification', 'Rehabilitation'] },
  ],
  'cp-judgment-draft': [
    { prompt: 'Analyze this judgment and identify grounds for appeal.', context: 'Sample judgment provided with procedural errors and misdirection on law.', keyPoints: ['Grounds of appeal', 'Misdirection', 'Procedural irregularity'] },
    { prompt: 'Draft a decree following a successful breach of contract claim.', keyPoints: ['Decree format', 'Operative orders', 'Costs', 'Interest'] },
    { prompt: 'The judgment is unclear on certain matters. Draft an application for clarification.', keyPoints: ['Slip rule', 'Clarification application', 'Variation limits'] },
    { prompt: 'Analyze whether this judgment is interlocutory or final and the appeal implications.', keyPoints: ['Final order', 'Interlocutory order', 'Leave requirements'] },
    { prompt: 'Draft a notice of satisfaction of judgment after full payment by the defendant.', keyPoints: ['Satisfaction notice', 'Registry filing', 'Effect'] },
  ],
  'cp-costs': [
    { prompt: 'Draft a bill of costs for taxation after a successful civil trial.', keyPoints: ['Instruction fees', 'Getting up fees', 'Disbursements', 'Schedule format'] },
    { prompt: 'Present oral arguments on why costs should follow the event in your favor.', keyPoints: ['General rule', 'Discretion', 'Conduct'] },
    { prompt: 'The court has ordered costs on advocate-client scale. Explain what this means.', keyPoints: ['Scale B', 'Full indemnity', 'Taxation standard'] },
    { prompt: 'Multiple choice: Security for costs may be ordered against: (A) Any plaintiff, (B) Plaintiff ordinarily resident outside jurisdiction, (C) Only corporate plaintiffs, (D) Never', keyPoints: ['Security for costs'] },
    { prompt: 'Draft an application for taxation of a bill of costs you consider excessive.', keyPoints: ['Taxation application', 'Grounds', 'Time limits'] },
  ],
  'cp-execution': [
    { prompt: 'Draft a request for attachment and sale of the judgment debtor\'s motor vehicle.', keyPoints: ['Attachment warrant', 'Movable property', 'Sale procedure'] },
    { prompt: 'The judgment debtor claims the property attached belongs to a third party. Advise.', keyPoints: ['Third party claims', 'Interpleader', 'Attachment validity'] },
    { prompt: 'Prepare an application for examination of the judgment debtor to discover assets.', keyPoints: ['Oral examination', 'Discovery', 'Enforcement strategy'] },
    { prompt: 'The judgment debtor has no attachable assets. What alternative enforcement methods exist?', keyPoints: ['Garnishee', 'Charging order', 'Receiver'] },
    { prompt: 'Draft a garnishee order nisi against the judgment debtor\'s bank.', keyPoints: ['Garnishee procedure', 'Bank accounts', 'Order absolute'] },
  ],
  'cp-appeals': [
    { prompt: 'Draft a memorandum of appeal against a High Court judgment dismissing your client\'s claim.', keyPoints: ['Grounds of appeal', 'Format', 'Time limits'] },
    { prompt: 'Present oral arguments against an application for stay of execution pending appeal.', keyPoints: ['No automatic stay', 'Nugatory', 'Security'] },
    { prompt: 'Analyze whether appeal lies as of right or requires leave in this situation.', keyPoints: ['Appeals as of right', 'Leave requirements', 'Interlocutory orders'] },
    { prompt: 'The appeal period has expired. Draft an application for extension of time.', keyPoints: ['Extension grounds', 'Good cause', 'Merits'] },
    { prompt: 'Draft submissions on a cross-appeal in response to the opponent\'s appeal.', keyPoints: ['Cross-appeal', 'Respondent\'s notice', 'Scope'] },
  ],
};

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedCurriculum() {
  console.log('🌱 Starting curriculum seed...\n');
  
  try {
    // 1. Create domain
    console.log('📁 Creating domain...');
    const domainResult = await db.execute(sql`
      INSERT INTO domains (name, code, description)
      VALUES (${DOMAIN.name}, ${DOMAIN.code}, ${DOMAIN.description})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const domainId = (domainResult.rows[0] as { id: string }).id;
    console.log(`   ✓ Domain created: ${domainId}\n`);
    
    // 2. Create micro-skills
    console.log('🎯 Creating micro-skills...');
    const skillIdMap: Map<string, string> = new Map();
    
    for (const skill of SKILLS) {
      const result = await db.execute(sql`
        INSERT INTO micro_skills (name, code, domain_id, unit_id, format_tags, exam_weight, difficulty, is_core, is_active)
        VALUES (
          ${skill.name}, 
          ${skill.code}, 
          ${domainId}::uuid, 
          ${UNIT_ID},
          ${sql.raw(`ARRAY[${skill.formats.map(f => `'${f}'`).join(',')}]::format_tag[]`)},
          ${skill.weight},
          ${skill.difficulty}::difficulty_level,
          ${skill.isCore},
          true
        )
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `);
      skillIdMap.set(skill.code, (result.rows[0] as { id: string }).id);
      console.log(`   ✓ ${skill.name}`);
    }
    console.log(`   Total: ${skillIdMap.size} skills\n`);
    
    // 3. Create skill prerequisites (edges)
    console.log('🔗 Creating skill prerequisites...');
    let edgeCount = 0;
    for (const skill of SKILLS) {
      if (skill.prereqs) {
        const toSkillId = skillIdMap.get(skill.code);
        for (const prereqCode of skill.prereqs) {
          const fromSkillId = skillIdMap.get(prereqCode);
          if (fromSkillId && toSkillId) {
            await db.execute(sql`
              INSERT INTO skill_edges (from_skill_id, to_skill_id, edge_type, strength)
              VALUES (${fromSkillId}::uuid, ${toSkillId}::uuid, 'prerequisite', 1.0)
              ON CONFLICT (from_skill_id, to_skill_id) DO NOTHING
            `);
            edgeCount++;
          }
        }
      }
    }
    console.log(`   ✓ ${edgeCount} prerequisite edges created\n`);
    
    // 4. Create items and mappings
    console.log('📝 Creating items and mappings...');
    let itemCount = 0;
    let mappingCount = 0;
    
    for (const skill of SKILLS) {
      const skillId = skillIdMap.get(skill.code);
      if (!skillId) continue;
      
      const items = generateItemsForSkill(skill, skillId);
      
      for (const item of items) {
        // Insert item
        const itemResult = await db.execute(sql`
          INSERT INTO items (item_type, format, unit_id, prompt, context, model_answer, key_points, difficulty, estimated_minutes, is_active)
          VALUES (
            ${item.itemType}::item_type,
            ${item.format}::format_tag,
            ${UNIT_ID},
            ${item.prompt},
            ${item.context},
            ${item.modelAnswer},
            ${sql.raw(`ARRAY[${item.keyPoints.map((k: string) => `'${k.replace(/'/g, "''")}'`).join(',') || 'NULL'}]::text[]`)},
            ${item.difficulty},
            ${item.estimatedMinutes},
            true
          )
          RETURNING id
        `);
        const itemId = (itemResult.rows[0] as { id: string }).id;
        itemCount++;
        
        // Create item-skill mapping
        await db.execute(sql`
          INSERT INTO item_skill_map (item_id, skill_id, strength, coverage_weight)
          VALUES (${itemId}::uuid, ${skillId}::uuid, 'primary'::mapping_strength, 1.0)
          ON CONFLICT (item_id, skill_id) DO NOTHING
        `);
        mappingCount++;
      }
      console.log(`   ✓ ${skill.name}: 5 items`);
    }
    console.log(`   Total: ${itemCount} items, ${mappingCount} mappings\n`);
    
    // 5. Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Curriculum seed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Domain:     1 (${DOMAIN.name})`);
    console.log(`   Skills:     ${skillIdMap.size}`);
    console.log(`   Prereqs:    ${edgeCount} edges`);
    console.log(`   Items:      ${itemCount}`);
    console.log(`   Mappings:   ${mappingCount}`);
    console.log(`   Unit:       ${UNIT_ID}\n`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run if executed directly
seedCurriculum()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export { seedCurriculum };
