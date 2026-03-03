/**
 * YNAI Knowledge Base Seed + Embedding Generator
 * 
 * Seeds the knowledge_base table with legal provisions, case law, and principles
 * for ALL 9 ATP units, then generates pgvector embeddings for:
 *   - knowledge_base entries
 *   - micro_skills
 *   - items
 * 
 * Usage: npx tsx scripts/seed-knowledge-and-embeddings.ts
 * 
 * Requires: OPENAI_API_KEY and DATABASE_URL
 */

import { neon } from '@neondatabase/serverless';

// Load env
try { require('dotenv').config(); } catch {}

const DB_URL = process.env.DATABASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const pgSql = neon(DB_URL);

// ============================================
// KNOWLEDGE BASE ENTRIES — ALL 9 ATP UNITS
// ============================================

interface KBEntry {
  unitId: string;
  entryType: 'provision' | 'case_law' | 'regulation' | 'principle' | 'procedure' | 'definition';
  source: string;
  section?: string;
  citation?: string;
  title: string;
  content: string;
  keywords: string[];
  practicalApplication?: string;
  examTips?: string;
  court?: string;
  year?: number;
  importance: number;
}

const KNOWLEDGE_BASE: KBEntry[] = [
  // ===== ATP-100: CIVIL LITIGATION =====
  {
    unitId: 'atp-100', entryType: 'provision', source: 'Civil Procedure Act, Cap 21', section: 'Section 3A',
    title: 'Overriding Objective',
    content: 'The overriding objective of this Act is to facilitate the just, expeditious, proportionate and affordable resolution of civil disputes. Courts must give effect to this; parties and advocates have a duty to assist.',
    keywords: ['overriding objective', 'just resolution', 'expeditious', 'proportionate'],
    practicalApplication: 'Courts invoke this to deny adjournments, refuse technical objections, and promote substantive justice.',
    examTips: 'Section 3A is one of the most cited — always reference it when discussing procedure.',
    importance: 3,
  },
  {
    unitId: 'atp-100', entryType: 'provision', source: 'Civil Procedure Act, Cap 21', section: 'Section 7',
    title: 'Res Judicata',
    content: 'No court shall try any suit in which the matter directly and substantially in issue was already decided between the same parties by a competent court. Five elements: same parties, same issue, competent court, final decision, same title.',
    keywords: ['res judicata', 'estoppel', 'former suit', 'same parties'],
    examTips: 'Master the 5 elements and distinguish from constructive res judicata under Section 8.',
    importance: 3,
  },
  {
    unitId: 'atp-100', entryType: 'provision', source: 'Civil Procedure Rules', section: 'Order 39 Rule 1-3',
    title: 'Temporary Injunctions',
    content: 'Court may grant temporary injunction to restrain breach of contract, waste, alienation of property. Applicant must show prima facie case, irreparable injury if injunction not granted, and balance of convenience in their favour.',
    keywords: ['temporary injunction', 'interlocutory', 'prima facie', 'irreparable injury', 'balance of convenience'],
    practicalApplication: 'Giella v Cassman Brown test. Must file supporting affidavit and serve notice to opposing party unless ex parte.',
    examTips: 'Know the Giella v Cassman Brown 3-pronged test inside out.',
    importance: 3,
  },
  {
    unitId: 'atp-100', entryType: 'case_law', source: 'Giella v Cassman Brown & Co Ltd',
    citation: '[1973] EA 358', title: 'Giella v Cassman Brown — Injunction Test',
    content: 'Established the 3-pronged test for interlocutory injunctions: (1) Prima facie case with probability of success, (2) Irreparable injury not adequately compensable by damages, (3) Balance of convenience favours granting the injunction.',
    keywords: ['injunction test', 'prima facie', 'irreparable injury', 'balance of convenience'],
    court: 'East Africa Court of Appeal', year: 1973, importance: 3,
  },
  {
    unitId: 'atp-100', entryType: 'procedure', source: 'Civil Procedure Rules', section: 'Order 5',
    title: 'Service of Summons',
    content: 'Summons must be served personally unless court orders substituted service. Personal service means delivery of duplicate to defendant. If defendant refuses, it is deemed served.',
    keywords: ['service', 'summons', 'personal service', 'substituted service'],
    importance: 2,
  },

  // ===== ATP-200: CRIMINAL LITIGATION =====
  {
    unitId: 'atp-200', entryType: 'provision', source: 'Criminal Procedure Code, Cap 75', section: 'Section 211',
    title: 'Charge Sheet Requirements',
    content: 'A charge sheet must contain: (1) a statement of the specific offence charged, (2) particulars of the offence with sufficient detail, (3) the section of the law contravened.',
    keywords: ['charge sheet', 'charge', 'particulars', 'criminal offence'],
    practicalApplication: 'A defective charge sheet can be challenged by way of preliminary objection or application to quash.',
    examTips: 'Always check the charge sheet for sufficiency of particulars — a favourite bar exam question.',
    importance: 3,
  },
  {
    unitId: 'atp-200', entryType: 'provision', source: 'Constitution of Kenya 2010', section: 'Article 49',
    title: 'Rights of Arrested Persons',
    content: 'Article 49: Arrested person has the right to (a) be informed promptly of reason for arrest, (b) remain silent, (c) communicate with advocate, (d) not be compelled to confess, (e) be brought before court within 24 hours (or next court day). Article 49(1)(h): be released on bond or bail on reasonable conditions.',
    keywords: ['arrest', 'rights', 'bail', 'bond', '24 hours', 'silence', 'advocate'],
    examTips: 'Article 49 rights are testable verbatim. Know each sub-article.',
    importance: 3,
  },
  {
    unitId: 'atp-200', entryType: 'provision', source: 'Constitution of Kenya 2010', section: 'Article 50',
    title: 'Right to Fair Trial',
    content: 'Article 50(2): Every accused person has the right to (a) be presumed innocent, (b) be informed of the charge sufficiently, (c) have adequate time to prepare defence, (e) be present when tried, (f) choose and be represented by advocate, (j) have advocate assigned at State expense if substantial injustice would result.',
    keywords: ['fair trial', 'presumption of innocence', 'right to counsel', 'Article 50'],
    importance: 3,
  },
  {
    unitId: 'atp-200', entryType: 'case_law', source: 'Republic v Ahmed Abolfathi Mohamed & another',
    citation: '[2019] eKLR', title: 'Burden and Standard of Proof in Criminal Cases',
    content: 'The prosecution bears the burden of proof beyond reasonable doubt. Any doubt must be resolved in favour of the accused. Circumstantial evidence must irresistibly point to guilt.',
    keywords: ['burden of proof', 'beyond reasonable doubt', 'circumstantial evidence'],
    court: 'High Court of Kenya', year: 2019, importance: 3,
  },
  {
    unitId: 'atp-200', entryType: 'provision', source: 'Evidence Act, Cap 80', section: 'Section 107',
    title: 'Burden of Proof',
    content: 'Section 107(1): Whoever desires any court to give judgment as to any legal right or liability dependent on the existence of facts which he asserts must prove those facts exist. Section 107(2): The burden of proof lies on the party who would fail if no evidence were given on either side.',
    keywords: ['burden of proof', 'evidence', 'legal right', 'liability'],
    importance: 3,
  },

  // ===== ATP-300: PROPERTY LAW =====
  {
    unitId: 'atp-300', entryType: 'provision', source: 'Land Registration Act, 2012', section: 'Section 24',
    title: 'Indefeasibility of Title',
    content: 'Section 24: The registration of a person as proprietor vests in that person the absolute ownership of that land together with all rights and privileges belonging thereto. The title is subject only to encumbrances noted on the register and overriding interests under Section 28.',
    keywords: ['indefeasibility', 'title', 'absolute ownership', 'registration', 'overriding interests'],
    examTips: 'Indefeasibility is NOT absolute — know the exceptions under Section 26 (fraud, misrepresentation, illegality).',
    importance: 3,
  },
  {
    unitId: 'atp-300', entryType: 'provision', source: 'Land Registration Act, 2012', section: 'Section 26',
    title: 'Exceptions to Indefeasibility',
    content: 'Section 26: Registration may be challenged on grounds of fraud, misrepresentation, or where the certificate was obtained illegally, unprocedurally, or through a corrupt scheme. The rights of a bona fide purchaser for value are protected.',
    keywords: ['fraud', 'misrepresentation', 'illegality', 'bona fide purchaser'],
    importance: 3,
  },
  {
    unitId: 'atp-300', entryType: 'provision', source: 'Land Act, 2012', section: 'Section 56',
    title: 'Charges Over Land (Mortgages)',
    content: 'A charge over land must be in prescribed form and registered. The chargor retains possession unless otherwise agreed. The chargee has statutory power of sale upon default, subject to notice requirements under Section 90.',
    keywords: ['charge', 'mortgage', 'power of sale', 'registration', 'default'],
    practicalApplication: 'Know the whole lifecycle: creation, registration, default, statutory notice (3 months), power of sale.',
    importance: 3,
  },
  {
    unitId: 'atp-300', entryType: 'case_law', source: 'Arthi Highway Developers v West End Butchery',
    citation: '[2015] eKLR', title: 'Bona Fide Purchaser for Value',
    content: 'A registrant who acquired title through a fraudulent chain of transactions cannot claim protection as a bona fide purchaser. The court must trace the root of title to determine if fraud tainted the acquisition.',
    keywords: ['bona fide purchaser', 'fraud', 'chain of title', 'registration'],
    court: 'Supreme Court of Kenya', year: 2015, importance: 3,
  },

  // ===== ATP-400: COMMERCIAL LAW =====
  {
    unitId: 'atp-400', entryType: 'provision', source: 'Companies Act, 2015', section: 'Section 9-12',
    title: 'Incorporation of Companies',
    content: 'A company is formed by registration under this Act. Minimum 1 director for private, 2 for public. Incorporation documents include memorandum, articles, compliance statement, and particulars of directors. Upon registration, the Registrar issues a certificate of incorporation.',
    keywords: ['incorporation', 'company', 'registration', 'certificate', 'memorandum', 'articles'],
    practicalApplication: 'Know the difference between private and public company requirements.',
    importance: 3,
  },
  {
    unitId: 'atp-400', entryType: 'provision', source: 'Companies Act, 2015', section: 'Section 17',
    title: 'Separate Legal Personality',
    content: 'A company has a separate legal personality from its members and directors. It can sue and be sued, own property, and enter contracts in its own name. This principle was established in Salomon v Salomon & Co [1897] and is codified in Section 17.',
    keywords: ['separate legal personality', 'corporate veil', 'Salomon', 'limited liability'],
    examTips: 'Know when the veil can be pierced — fraud, sham, agency, group enterprises.',
    importance: 3,
  },
  {
    unitId: 'atp-400', entryType: 'provision', source: 'Sale of Goods Act, Cap 31', section: 'Section 12-15',
    title: 'Implied Terms in Sale of Goods',
    content: 'Section 12: Implied condition of right to sell. Section 13: Goods must match description. Section 14: Implied condition of fitness for purpose and merchantable quality (where sold by description by dealer). Section 15: Sale by sample — bulk must match sample.',
    keywords: ['implied terms', 'sale of goods', 'fitness for purpose', 'merchantable quality', 'description'],
    importance: 2,
  },

  // ===== ATP-500: FAMILY & SUCCESSION LAW =====
  {
    unitId: 'atp-500', entryType: 'provision', source: 'Law of Succession Act, Cap 160', section: 'Section 26',
    title: 'Distribution on Intestacy',
    content: 'Section 26: Where an intestate leaves a surviving spouse and children, the net estate devolves to the surviving spouse absolutely together with the personal and household effects. The residue is divided among children equally.',
    keywords: ['intestacy', 'distribution', 'surviving spouse', 'children', 'net estate'],
    practicalApplication: 'Intestacy rules apply ONLY where there is NO valid will. Always check will validity first.',
    examTips: 'Know the priority order: spouse + children > parents > siblings > half-blood > state.',
    importance: 3,
  },
  {
    unitId: 'atp-500', entryType: 'provision', source: 'Marriage Act, 2014', section: 'Section 4',
    title: 'Types of Marriage Recognized',
    content: 'The Marriage Act recognizes 5 types: (1) Civil marriage, (2) Christian marriage, (3) Customary marriage, (4) Hindu marriage, (5) Islamic marriage. All must be registered. Polygamous marriages are recognized under customary and Islamic law.',
    keywords: ['marriage', 'types of marriage', 'civil', 'customary', 'Islamic', 'registration'],
    importance: 2,
  },
  {
    unitId: 'atp-500', entryType: 'provision', source: 'Law of Succession Act, Cap 160', section: 'Section 5',
    title: 'Formal Requirements of a Will',
    content: 'Section 5: A will must be in writing, signed by testator (or by someone in their presence and direction), and attested by 2 or more witnesses who must sign in testator\'s presence. Witnesses must not be beneficiaries.',
    keywords: ['will', 'formal requirements', 'testator', 'witnesses', 'attestation'],
    importance: 3,
  },

  // ===== ATP-600: PROFESSIONAL ETHICS =====
  {
    unitId: 'atp-600', entryType: 'provision', source: 'Advocates Act, Cap 16', section: 'Section 2',
    title: 'Qualification to Practice',
    content: 'Only admitted advocates may practise law in Kenya. Requirements: (1) Kenyan citizen or person prescribed, (2) holds LLB degree, (3) completed ATP course, (4) passed bar examinations, (5) admitted by Chief Justice. Section 9: Roll of Advocates.',
    keywords: ['advocate', 'admission', 'qualification', 'bar examination', 'roll of advocates'],
    importance: 3,
  },
  {
    unitId: 'atp-600', entryType: 'provision', source: 'Advocates Act, Cap 16', section: 'Section 57',
    title: 'Advocate-Client Privilege',
    content: 'Communications between advocate and client are privileged. No advocate shall disclose any communication made in the course of professional engagement without client consent. The privilege belongs to the client, not the advocate. Exceptions: furtherance of crime/fraud.',
    keywords: ['privilege', 'confidentiality', 'advocate-client', 'professional secret', 'disclosure'],
    examTips: 'Know the exceptions — privilege does NOT protect communications in furtherance of crime or fraud.',
    importance: 3,
  },
  {
    unitId: 'atp-600', entryType: 'principle', source: 'Professional Conduct Standards',
    title: 'Conflict of Interest',
    content: 'An advocate must not act for two or more clients whose interests conflict. If a conflict arises during engagement, the advocate must cease acting for one or both parties. The advocate must maintain independence and avoid situations where personal interest conflicts with client interest.',
    keywords: ['conflict of interest', 'independence', 'dual representation', 'professional conduct'],
    importance: 3,
  },

  // ===== ATP-700: EMPLOYMENT LAW =====
  {
    unitId: 'atp-700', entryType: 'provision', source: 'Employment Act, 2007', section: 'Section 35',
    title: 'Termination of Employment',
    content: 'Section 35: Employment may be terminated by notice (or payment in lieu), by agreement, or summarily for cause. Notice period: at least 28 days (or as agreed by contract). Written reasons must be provided on request.',
    keywords: ['termination', 'notice', 'summary dismissal', 'employment'],
    practicalApplication: 'Always check if proper procedure was followed — procedural unfairness is separate from substantive unfairness.',
    importance: 3,
  },
  {
    unitId: 'atp-700', entryType: 'provision', source: 'Employment Act, 2007', section: 'Section 45',
    title: 'Unfair Termination',
    content: 'Section 45: Termination is unfair if employer fails to prove valid and fair reason and fair procedure. Valid reasons: misconduct, incapacity, operational requirements. Employee must be heard before termination.',
    keywords: ['unfair termination', 'wrongful dismissal', 'fair procedure', 'right to be heard'],
    examTips: 'Two-limbed test: (1) valid reason, (2) fair procedure. Both must be satisfied.',
    importance: 3,
  },
  {
    unitId: 'atp-700', entryType: 'case_law', source: 'Walter Ogal Anuro v Teachers Service Commission',
    citation: '[2013] eKLR', title: 'Right to Fair Administrative Action in Employment',
    content: 'An employer, being a public body, must comply with Article 47 of the Constitution (fair administrative action). The affected person must be given adequate notice, right to be heard, and written reasons for any adverse decision.',
    keywords: ['fair administrative action', 'Article 47', 'right to be heard', 'employment'],
    court: 'Employment and Labour Relations Court', year: 2013, importance: 2,
  },

  // ===== ATP-800: ALTERNATIVE DISPUTE RESOLUTION =====
  {
    unitId: 'atp-800', entryType: 'provision', source: 'Arbitration Act, 1995', section: 'Section 6',
    title: 'Stay of Court Proceedings',
    content: 'Section 6: Where parties have an arbitration agreement and proceedings are brought in court, any party may apply for stay of proceedings. The court shall stay proceedings unless the arbitration agreement is null and void, inoperative, or incapable of being performed.',
    keywords: ['arbitration', 'stay of proceedings', 'arbitration clause', 'mandatory stay'],
    practicalApplication: 'Application must be made BEFORE filing defence or taking any step in the proceedings.',
    importance: 3,
  },
  {
    unitId: 'atp-800', entryType: 'provision', source: 'Constitution of Kenya 2010', section: 'Article 159(2)(c)',
    title: 'Alternative Dispute Resolution in the Constitution',
    content: 'Article 159(2)(c): In exercising judicial authority, courts shall promote alternative forms of dispute resolution including reconciliation, mediation, arbitration and traditional dispute resolution mechanisms.',
    keywords: ['ADR', 'mediation', 'arbitration', 'reconciliation', 'Article 159'],
    examTips: 'Article 159(2)(c) is the constitutional foundation for ADR — always cite it when discussing ADR.',
    importance: 3,
  },
  {
    unitId: 'atp-800', entryType: 'principle', source: 'Mediation Practice Standards',
    title: 'Principles of Mediation',
    content: 'Key principles: (1) Voluntariness — parties participate willingly, (2) Confidentiality — proceedings are private, (3) Neutrality — mediator has no interest in outcome, (4) Self-determination — parties craft their own solution, (5) Good faith participation.',
    keywords: ['mediation', 'voluntariness', 'confidentiality', 'neutrality', 'self-determination'],
    importance: 2,
  },

  // ===== ATP-900: PUBLIC LAW =====
  {
    unitId: 'atp-900', entryType: 'provision', source: 'Constitution of Kenya 2010', section: 'Article 22',
    title: 'Enforcement of Bill of Rights',
    content: 'Article 22: Every person has the right to institute court proceedings claiming a right or fundamental freedom has been denied, violated, infringed, or threatened. No formalities are required; the Chief Justice must make rules for informal proceedings.',
    keywords: ['bill of rights', 'fundamental rights', 'enforcement', 'constitutional petition'],
    importance: 3,
  },
  {
    unitId: 'atp-900', entryType: 'provision', source: 'Fair Administrative Action Act, 2015', section: 'Section 4',
    title: 'Right to Fair Administrative Action',
    content: 'Section 4: Every person has the right to administrative action that is expeditious, efficient, lawful, reasonable, and procedurally fair. The administrator must give adequate notice, opportunity to be heard, and written reasons within 30 days of request.',
    keywords: ['fair administrative action', 'administrative law', 'judicial review', 'natural justice'],
    practicalApplication: 'This Act codifies Article 47 of the Constitution. Always cite both the Act and the Article.',
    importance: 3,
  },
  {
    unitId: 'atp-900', entryType: 'provision', source: 'Constitution of Kenya 2010', section: 'Article 47',
    title: 'Fair Administrative Action (Constitutional)',
    content: 'Article 47(1): Every person has the right to administrative action that is expeditious, efficient, lawful, reasonable, and procedurally fair. Article 47(2): If adversely affected, person has right to written reasons. Article 47(3): Parliament to enact legislation to give effect — the Fair Administrative Action Act, 2015.',
    keywords: ['Article 47', 'administrative action', 'judicial review', 'written reasons'],
    importance: 3,
  },
  {
    unitId: 'atp-900', entryType: 'case_law', source: 'Mumo Matemu v Trusted Society & 5 Others',
    citation: '[2013] eKLR', title: 'Threshold for Judicial Review of Public Appointments',
    content: 'The Supreme Court held that the vetting process for constitutional office holders must comply with Article 73 (leadership and integrity). The threshold for challenging appointments is reasonable grounds to believe the candidate lacks integrity, not proof beyond reasonable doubt.',
    keywords: ['judicial review', 'public appointments', 'integrity', 'Article 73'],
    court: 'Supreme Court of Kenya', year: 2013, importance: 3,
  },
];

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_KEY) {
    console.log('⚠ OPENAI_API_KEY not set — skipping embeddings');
    return [];
  }

  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, 8000 * 4)); // ~8k tokens max
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: batch,
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Embedding API error: ${response.status} ${err}`);
      return allEmbeddings;
    }

    const data = await response.json();
    const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
    allEmbeddings.push(...sorted.map((d: any) => d.embedding));

    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`);
    
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('=== YNAI Knowledge Base Seed + Embeddings ===\n');

  // 1. Verify pgvector
  const extCheck = await pgSql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
  if (extCheck.length === 0) {
    console.error('pgvector extension not enabled. Run apply-pgvector-migration.ts first.');
    process.exit(1);
  }
  console.log('✓ pgvector active\n');

  // 2. Seed knowledge_base entries
  console.log(`Seeding ${KNOWLEDGE_BASE.length} knowledge base entries...`);
  let insertedKB = 0;

  for (const entry of KNOWLEDGE_BASE) {
    try {
      // Upsert by title + unitId
      const existing = await pgSql`
        SELECT id FROM knowledge_base WHERE title = ${entry.title} AND unit_id = ${entry.unitId} LIMIT 1
      `;
      
      if (existing.length > 0) {
        // Update
        await pgSql`
          UPDATE knowledge_base SET
            content = ${entry.content},
            source = ${entry.source},
            section = ${entry.section || null},
            citation = ${entry.citation || null},
            entry_type = ${entry.entryType},
            keywords = ${entry.keywords},
            practical_application = ${entry.practicalApplication || null},
            exam_tips = ${entry.examTips || null},
            court = ${entry.court || null},
            year = ${entry.year || null},
            importance = ${entry.importance},
            updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await pgSql`
          INSERT INTO knowledge_base (
            unit_id, entry_type, source, section, citation, title, content,
            keywords, practical_application, exam_tips, court, year, importance
          ) VALUES (
            ${entry.unitId}, ${entry.entryType}, ${entry.source}, ${entry.section || null},
            ${entry.citation || null}, ${entry.title}, ${entry.content},
            ${entry.keywords}, ${entry.practicalApplication || null}, ${entry.examTips || null},
            ${entry.court || null}, ${entry.year || null}, ${entry.importance}
          )
        `;
        insertedKB++;
      }
    } catch (error: any) {
      console.error(`  KB entry "${entry.title}": ${error.message}`);
    }
  }
  console.log(`✓ Knowledge base: ${insertedKB} new entries, ${KNOWLEDGE_BASE.length - insertedKB} updated\n`);

  // 3. Generate embeddings for knowledge_base
  if (OPENAI_KEY) {
    console.log('Generating embeddings for knowledge_base...');
    const kbRows = await pgSql`
      SELECT id, title, content, source, section FROM knowledge_base WHERE embedding IS NULL
    `;

    if (kbRows.length > 0) {
      const texts = kbRows.map((r: any) => 
        `${r.source}${r.section ? ' ' + r.section : ''}: ${r.title}\n${r.content}`
      );
      const embeddings = await generateEmbeddings(texts);

      for (let i = 0; i < embeddings.length && i < kbRows.length; i++) {
        const vecStr = `[${embeddings[i].join(',')}]`;
        await pgSql`UPDATE knowledge_base SET embedding = ${vecStr}::vector WHERE id = ${kbRows[i].id}`;
      }
      console.log(`✓ Embedded ${embeddings.length} knowledge base entries\n`);
    } else {
      console.log('✓ All knowledge base entries already have embeddings\n');
    }

    // 4. Generate embeddings for micro_skills
    console.log('Generating embeddings for micro_skills...');
    const skillRows = await pgSql`
      SELECT id, name, description, unit_id FROM micro_skills WHERE embedding IS NULL AND is_active = true
    `;

    if (skillRows.length > 0) {
      const texts = skillRows.map((r: any) => 
        `${r.name}${r.description ? ': ' + r.description : ''}`
      );
      const embeddings = await generateEmbeddings(texts);

      for (let i = 0; i < embeddings.length && i < skillRows.length; i++) {
        const vecStr = `[${embeddings[i].join(',')}]`;
        await pgSql`UPDATE micro_skills SET embedding = ${vecStr}::vector WHERE id = ${skillRows[i].id}`;
      }
      console.log(`✓ Embedded ${embeddings.length} micro_skills\n`);
    } else {
      console.log('✓ All micro_skills already have embeddings\n');
    }

    // 5. Generate embeddings for items
    console.log('Generating embeddings for items...');
    const itemRows = await pgSql`
      SELECT id, prompt, unit_id FROM items WHERE embedding IS NULL AND is_active = true
    `;

    if (itemRows.length > 0) {
      const texts = itemRows.map((r: any) => r.prompt.slice(0, 2000));
      const embeddings = await generateEmbeddings(texts);

      for (let i = 0; i < embeddings.length && i < itemRows.length; i++) {
        const vecStr = `[${embeddings[i].join(',')}]`;
        await pgSql`UPDATE items SET embedding = ${vecStr}::vector WHERE id = ${itemRows[i].id}`;
      }
      console.log(`✓ Embedded ${embeddings.length} items\n`);
    } else {
      console.log('✓ All items already have embeddings\n');
    }
  } else {
    console.log('⚠ OPENAI_API_KEY not set — skipping embedding generation');
    console.log('  Run this script again with OPENAI_API_KEY to generate embeddings.\n');
  }

  // 6. Final stats
  console.log('=== Final Statistics ===');
  const stats = await pgSql`
    SELECT
      (SELECT COUNT(*) FROM knowledge_base) as kb_total,
      (SELECT COUNT(*) FROM knowledge_base WHERE embedding IS NOT NULL) as kb_embedded,
      (SELECT COUNT(DISTINCT unit_id) FROM knowledge_base) as kb_units,
      (SELECT COUNT(*) FROM micro_skills WHERE is_active = true) as skills_total,
      (SELECT COUNT(*) FROM micro_skills WHERE embedding IS NOT NULL AND is_active = true) as skills_embedded,
      (SELECT COUNT(*) FROM items WHERE is_active = true) as items_total,
      (SELECT COUNT(*) FROM items WHERE embedding IS NOT NULL AND is_active = true) as items_embedded
  `;

  const s = stats[0];
  console.log(`  Knowledge Base: ${s.kb_embedded}/${s.kb_total} embedded (${s.kb_units} units)`);
  console.log(`  Micro-Skills:   ${s.skills_embedded}/${s.skills_total} embedded`);
  console.log(`  Items:          ${s.items_embedded}/${s.items_total} embedded`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
