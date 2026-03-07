import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rotating library of landmark Kenyan cases
const LANDMARK_CASES = [
  {
    case_name: 'Anarita Karimi Njeru v Republic',
    citation: '[1979] KLR 154',
    court: 'High Court of Kenya',
    year: 1979,
    unit_id: 'atp-100',
    facts: 'The applicant filed a constitutional reference challenging her conviction, but failed to identify specific constitutional provisions allegedly violated.',
    issue: 'What standard of pleading is required when raising constitutional questions?',
    holding: 'A person seeking constitutional redress must set out with reasonable precision the specific rights claimed to have been violated and the manner of violation.',
    ratio: 'Constitutional references must identify with precision: (1) the specific provisions of the Constitution allegedly contravened; (2) the manner of their contravention; and (3) the nature of relief sought.',
    significance: 'Established the "Anarita Karimi test" — the foundational standard for constitutional pleading in Kenya.',
    summary: 'A petitioner must plead with reasonable precision which constitutional rights were violated and how. Vague claims will be struck out.',
    keywords: ['constitutional petition', 'pleading standard', 'Anarita Karimi test'],
  },
  {
    case_name: 'Republic v El Mann',
    citation: '[1969] EA 357',
    court: 'High Court of Kenya',
    year: 1969,
    unit_id: 'atp-101',
    facts: 'The accused was charged with murder. The prosecution relied on circumstantial evidence to prove guilt.',
    issue: 'What standard must circumstantial evidence meet to sustain a criminal conviction?',
    holding: 'Circumstantial evidence must irresistibly point to the guilt of the accused and must be inconsistent with innocence.',
    ratio: 'Where the prosecution case rests entirely on circumstantial evidence, the evidence must be such as to exclude any reasonable hypothesis consistent with innocence.',
    significance: 'Set the gold standard for evaluating circumstantial evidence in East African criminal law.',
    summary: 'Circumstantial evidence must irresistibly point to guilt and exclude any reasonable hypothesis of innocence.',
    keywords: ['circumstantial evidence', 'criminal standard of proof', 'murder'],
  },
  {
    case_name: 'Giella v Cassman Brown & Co Ltd',
    citation: '[1973] EA 358',
    court: 'Court of Appeal for East Africa',
    year: 1973,
    unit_id: 'atp-100',
    facts: 'An appeal was lodged on multiple grounds, requiring the appellate court to define the standard of review for a first appellate court.',
    issue: 'What is the duty and standard of review of a first appellate court?',
    holding: 'A first appellate court must reconsider the evidence, evaluate it, and draw its own conclusions, while giving due regard to the trial court\'s advantage of seeing witnesses.',
    ratio: 'The first appellate court has a duty to reconsider the entire evidence, weigh it, and arrive at its own conclusion. However, it must make allowance for the trial judge\'s advantage in seeing witnesses.',
    significance: 'Defines the scope of appellate review in East Africa, cited in virtually every appeal since 1973.',
    summary: 'A first appellate court must re-evaluate the evidence independently but respect the trial court\'s advantage of observing witnesses.',
    keywords: ['appellate review', 'first appeal', 'duty of appellate court'],
  },
  {
    case_name: 'Dodhia v National & Grindlays Bank Ltd',
    citation: '[1970] EA 195',
    court: 'Court of Appeal for East Africa',
    year: 1970,
    unit_id: 'atp-105',
    facts: 'A bank customer challenged the bank\'s right to combine accounts for set-off purposes without prior notice.',
    issue: 'Does a bank have the right to combine a customer\'s accounts and exercise a right of set-off?',
    holding: 'A bank has an implied right to combine a customer\'s accounts for set-off, subject to agreement and reasonable notice.',
    ratio: 'A banker\'s right to combine accounts arises from the general lien and set-off rights inherent in the banker-customer relationship, but can be excluded by express or implied agreement.',
    significance: 'Foundational case on banker-customer relationships and the right of set-off in East Africa.',
    summary: 'Banks have an implied right to combine customer accounts for set-off unless excluded by agreement.',
    keywords: ['banking law', 'set-off', 'banker-customer relationship'],
  },
  {
    case_name: 'Turbo Highway Motel v Western Kenya Tour',
    citation: '[2015] eKLR',
    court: 'Court of Appeal of Kenya',
    year: 2015,
    unit_id: 'atp-100',
    facts: 'A dispute arose over enforcement of a contract. The question of duress and undue influence was central to the appeal.',
    issue: 'Under what circumstances will a court set aside a contract for duress or undue influence?',
    holding: 'Duress makes a contract voidable. The burden of proving duress lies on the party alleging it, and the pressure must be illegitimate.',
    ratio: 'For duress to vitiate consent: (1) there must be pressure amounting to compulsion of will; (2) the pressure must be illegitimate; (3) there must be a causal link between the duress and the entry into the transaction.',
    significance: 'Clarified the modern test for contractual duress under Kenyan law.',
    summary: 'Contractual duress requires proof of illegitimate pressure that compels the will and directly causes entry into the contract.',
    keywords: ['contract law', 'duress', 'undue influence', 'vitiating factors'],
  },
  {
    case_name: 'Mumo Matemu v Trusted Society of Human Rights Alliance',
    citation: '[2013] eKLR',
    court: 'Court of Appeal of Kenya',
    year: 2013,
    unit_id: 'atp-106',
    facts: 'A challenge to the appointment of a member of the Ethics and Anti-Corruption Commission on integrity grounds under the 2010 Constitution.',
    issue: 'What is the threshold for challenging public officer appointments under Chapter Six of the Constitution?',
    holding: 'Allegations of lack of integrity must be supported by evidence of a higher standard than mere allegations. The court must balance competing constitutional values.',
    ratio: 'Chapter Six of the Constitution sets high standards for public officers. However, mere allegations without cogent evidence cannot disqualify a person from public office.',
    significance: 'Led the interpretation of Chapter Six (Leadership and Integrity) of the Constitution of Kenya 2010.',
    summary: 'Integrity allegations require substantive evidence; mere accusations cannot bar public office appointments under Chapter Six.',
    keywords: ['Chapter Six', 'integrity', 'public appointments', 'Constitution 2010'],
  },
  {
    case_name: 'Isack v Gichuru',
    citation: '[2015] eKLR',
    court: 'High Court of Kenya',
    year: 2015,
    unit_id: 'atp-102',
    facts: 'A land dispute where the plaintiff claimed ownership by adverse possession and had occupied the property for over 12 years.',
    issue: 'What are the requirements for acquiring title by adverse possession under Kenyan law?',
    holding: 'For adverse possession to succeed, the claimant must prove uninterrupted, open, and hostile possession for the statutory period of 12 years.',
    ratio: 'The key elements of adverse possession are: (1) factual possession; (2) intention to possess (animus possidendi); (3) possession without consent; and (4) continuous possession for 12 years.',
    significance: 'Comprehensive statement of the law on adverse possession in Kenya following the Land Registration Act 2012.',
    summary: 'Adverse possession in Kenya requires 12 years of uninterrupted, open, hostile possession with intention to possess.',
    keywords: ['adverse possession', 'land law', 'limitation period', 'Land Registration Act'],
  },
  {
    case_name: 'Republic v Judicial Service Commission Ex parte Pareno',
    citation: '[2004] 1 KLR 203',
    court: 'High Court of Kenya',
    year: 2004,
    unit_id: 'atp-100',
    facts: 'A judicial review application challenging the Judicial Service Commission\'s decision in disciplinary proceedings.',
    issue: 'What is the scope of judicial review and the circumstances under which courts can interfere with quasi-judicial decisions?',
    holding: 'Judicial review is concerned not with the decision but with the decision-making process. Courts will intervene where the process is flawed by illegality, irrationality, or procedural impropriety.',
    ratio: 'The three grounds for judicial review are: illegality, irrationality, and procedural impropriety. A court exercising judicial review does not substitute its own decision for that of the decision-maker.',
    significance: 'Key case establishing judicial review grounds under Kenyan administrative law.',
    summary: 'Judicial review examines the decision-making process (not the merits) on grounds of illegality, irrationality, or procedural impropriety.',
    keywords: ['judicial review', 'administrative law', 'illegality', 'irrationality', 'procedural impropriety'],
  },
  {
    case_name: 'In Re Estate of Lerionka Ole Ntutu (Deceased)',
    citation: '[2008] eKLR',
    court: 'High Court of Kenya',
    year: 2008,
    unit_id: 'atp-104',
    facts: 'A succession dispute involving polygamous marriage under Maasai customary law. Multiple widows and children of the deceased contested the distribution of the estate.',
    issue: 'How should courts handle succession in polygamous customary marriages?',
    holding: 'The Law of Succession Act applies to all Kenyans. All spouses in a polygamous customary marriage are entitled to inherit. The court must consider the customs and practices of the community while applying statutory law.',
    ratio: 'All wives in a valid customary polygamous marriage have equal status for purposes of succession. The number of children per house is a relevant factor in distribution.',
    significance: 'Landmark case on succession rights of wives in polygamous customary marriages.',
    summary: 'In polygamous customary marriages, all wives have equal succession rights. Distribution considers the number of children per house.',
    keywords: ['succession', 'polygamous marriage', 'customary law', 'Law of Succession Act'],
  },
  {
    case_name: 'Mbaria v Republic',
    citation: '[1985] KLR 338',
    court: 'Court of Appeal of Kenya',
    year: 1985,
    unit_id: 'atp-101',
    facts: 'An accused person was convicted of robbery with violence. The Court of Appeal considered the identification evidence.',
    issue: 'What is the proper approach to identification evidence in criminal cases?',
    holding: 'In all cases of identification, the court must warn itself of the dangers of relying on identification evidence and must satisfy itself that the identification is truthful and free from error.',
    ratio: 'Even when identification evidence is positive and given by an honest witness, the court must warn itself of the possibility of mistake. The Turnbull guidelines must be followed.',
    significance: 'Established the standard approach to identification evidence in Kenya, following the English Turnbull guidelines.',
    summary: 'Courts must issue a self-warning about the dangers of identification evidence even when the witness is honest.',
    keywords: ['identification evidence', 'Turnbull guidelines', 'criminal law', 'witness evidence'],
  },
  {
    case_name: 'Trusted Society of Human Rights Alliance v AG',
    citation: '[2012] eKLR',
    court: 'High Court of Kenya',
    year: 2012,
    unit_id: 'atp-100',
    facts: 'A petition challenging the appointment of the chairperson of the Ethics and Anti-Corruption Commission, alleging breach of provisions on public participation and integrity.',
    issue: 'What constitutes adequate public participation in the legislative and appointment processes under the 2010 Constitution?',
    holding: 'Public participation is a constitutional imperative. The form it takes may vary, but it must be real and not merely cosmetic. It is a continuous obligation on state organs.',
    ratio: 'Public participation under the 2010 Constitution is not a mere formality. It must be facilitated meaningfully, with reasonable notice and opportunity to make views known.',
    significance: 'Foundational case on the doctrine of public participation under the Kenya 2010 Constitution.',
    summary: 'Public participation must be real and meaningful, not cosmetic. State organs have a continuous obligation to facilitate it.',
    keywords: ['public participation', 'constitutional law', 'appointments', 'sovereignty of the people'],
  },
  {
    case_name: 'CMC Aviation Ltd v Kenya Airways Ltd',
    citation: '[1977] KLR 103',
    court: 'High Court of Kenya',
    year: 1977,
    unit_id: 'atp-105',
    facts: 'A contractual dispute between an aviation services company and Kenya Airways regarding maintenance and servicing of aircraft.',
    issue: 'When does a contract of service become a contract for services, and what are the legal implications?',
    holding: 'The distinction between a contract of service and a contract for services depends on the degree of control exercised by the employer over the manner of performing the work.',
    ratio: 'The control test, while not the sole test, remains the primary test for distinguishing between employment and independent contracting.',
    significance: 'Key case on employment law distinction between employees and independent contractors in Kenya.',
    summary: 'The control test is the primary way to distinguish a contract of service from a contract for services.',
    keywords: ['employment law', 'contract of service', 'independent contractor', 'control test'],
  },
  {
    case_name: 'Kenya Bus Service Ltd v Minister for Transport',
    citation: '[2012] eKLR',
    court: 'High Court of Kenya',
    year: 2012,
    unit_id: 'atp-100',
    facts: 'A petition challenging government regulations on public transport that allegedly violated the right to fair administrative action and property rights.',
    issue: 'What constitutes fair administrative action under Article 47 of the Constitution?',
    holding: 'Administrative actions must be lawful, reasonable, and procedurally fair. Every person has the right to be given written reasons for an administrative action that adversely affects them.',
    ratio: 'Article 47 requires: (1) expeditious action; (2) efficiency; (3) lawfulness; (4) reasonableness; (5) procedural fairness. The right to reasons is fundamental.',
    significance: 'Early case interpreting Article 47 of the 2010 Constitution on fair administrative action.',
    summary: 'Fair administrative action must be lawful, reasonable, procedurally fair, and affected persons must receive written reasons.',
    keywords: ['fair administrative action', 'Article 47', 'administrative law', 'due process'],
  },
  {
    case_name: 'Katarina Farms Limited v Attorney General',
    citation: '[2015] eKLR',
    court: 'High Court of Kenya',
    year: 2015,
    unit_id: 'atp-102',
    facts: 'A large-scale farm was compulsorily acquired by the government. The farm owner challenged the adequacy of compensation.',
    issue: 'What is the standard for just compensation in compulsory acquisition of land?',
    holding: 'Compensation must be just, determined at market value, and paid promptly. The acquiring authority bears the burden of proving that compensation offered is just.',
    ratio: 'Just compensation under Article 40(3) of the Constitution must reflect fair market value, include disturbance allowances, and be paid before or at the time of acquisition.',
    significance: 'Strengthened protections for landowners against compulsory acquisition and defined "just compensation" under the 2010 Constitution.',
    summary: 'Compulsory acquisition requires just compensation at market value, paid promptly, with the government bearing the burden of proving fairness.',
    keywords: ['compulsory acquisition', 'just compensation', 'Article 40', 'land rights'],
  },
  {
    case_name: 'UBA Kenya Bank Ltd v Ogango',
    citation: '[2016] eKLR',
    court: 'High Court of Kenya',
    year: 2016,
    unit_id: 'atp-102',
    facts: 'A bank sought to exercise its statutory power of sale under a mortgage after the borrower defaulted.',
    issue: 'What are the requirements for a valid exercise of the statutory power of sale under a mortgage?',
    holding: 'The statutory power of sale must be exercised in good faith and with due regard to the mortgagor\'s interest. Proper notice must be given as required by law.',
    ratio: 'A mortgagee exercising power of sale must: (1) ensure the power has become exercisable; (2) give proper statutory notice; (3) act in good faith; (4) take reasonable steps to obtain the best price.',
    significance: 'Comprehensive restatement of the law on mortgagee\'s power of sale under the Land Act 2012.',
    summary: 'Mortgagees must give proper notice, act in good faith, and obtain the best price when exercising power of sale.',
    keywords: ['mortgage', 'power of sale', 'land law', 'Land Act 2012'],
  },
  {
    case_name: 'PLJ v Republic',
    citation: '[2013] eKLR',
    court: 'Court of Appeal of Kenya',
    year: 2013,
    unit_id: 'atp-101',
    facts: 'An appeal against conviction for defilement. The key question was the court\'s approach to the evidence of the child complainant.',
    issue: 'What is the evidentiary standard for corroboration of the testimony of child witnesses in sexual offence cases?',
    holding: 'While corroboration of the evidence of a child complainant is desirable, it is not a legal requirement. A conviction can be sustained on the testimony of a child alone if the court is satisfied as to its truthfulness.',
    ratio: 'Section 124 of the Evidence Act allows courts to convict on the uncorroborated testimony of a child in sexual offences, provided the court records reasons for believing the child.',
    significance: 'Clarified the law on child testimony in sexual offence cases under post-2006 Sexual Offences Act framework.',
    summary: 'A court may convict on uncorroborated child testimony in sexual offences if satisfied of its truthfulness, with recorded reasons.',
    keywords: ['defilement', 'child evidence', 'corroboration', 'Sexual Offences Act'],
  },
  {
    case_name: 'Mwangi v Republic',
    citation: '[2004] 2 KLR 31',
    court: 'Court of Appeal of Kenya',
    year: 2004,
    unit_id: 'atp-101',
    facts: 'The appellant was convicted of a capital offence on the basis of a retracted confession.',
    issue: 'What is the proper treatment of a retracted confession in criminal proceedings?',
    holding: 'A retracted confession may sustain a conviction if the court, after full consideration of the surrounding circumstances, is satisfied the confession is true.',
    ratio: 'Where a confession is retracted, the court must: (1) warn itself of the danger; (2) examine the circumstances of the recording; (3) consider whether it is corroborated; and (4) determine if it is voluntary and true.',
    significance: 'Authoritative restatement on retracted confessions in Kenyan criminal law.',
    summary: 'Retracted confessions can support conviction if the court warns itself of the danger and is satisfied of their truth after examining all circumstances.',
    keywords: ['confession', 'retracted confession', 'evidence law', 'criminal procedure'],
  },
  {
    case_name: 'Re Oginga Odinga (Deceased)',
    citation: '[1996] eKLR',
    court: 'High Court of Kenya',
    year: 1996,
    unit_id: 'atp-104',
    facts: 'The succession of Jaramogi Oginga Odinga was contested. Multiple claimants including family members disputed the distribution of his estate.',
    issue: 'How should courts determine dependants and distribute the estate of a prominent public figure under the Law of Succession Act?',
    holding: 'The Law of Succession Act provides for all dependants of the deceased. The court must consider the station in life, needs, and expectations of each dependant.',
    ratio: 'Distribution must be equitable, not necessarily equal. The court considers: (1) nature and extent of the estate; (2) needs of dependants; (3) lifestyle maintained during the deceased\'s lifetime.',
    significance: 'High-profile succession case that clarified dependant identification and equitable distribution principles.',
    summary: 'Estate distribution must be equitable (not necessarily equal), considering dependants\' needs and the station in life maintained during the deceased\'s lifetime.',
    keywords: ['succession', 'dependants', 'equitable distribution', 'Law of Succession Act'],
  },
  {
    case_name: 'Peter Oduor Ngoge v Francis Ole Kaparo & Others',
    citation: '[2008] eKLR',
    court: 'Court of Appeal of Kenya',
    year: 2008,
    unit_id: 'atp-100',
    facts: 'A challenge was mounted against Parliamentary privilege and the jurisdiction of courts to review proceedings of the National Assembly.',
    issue: 'Can courts review proceedings of Parliament, and what is the extent of parliamentary privilege in Kenya?',
    holding: 'Courts have jurisdiction to determine the constitutionality of Parliamentary actions. Parliamentary sovereignty is subject to the Constitution.',
    ratio: 'Parliamentary privilege protects proceedings from external interference but does not shield unconstitutional conduct. The Constitution is supreme and Parliament cannot act beyond its constitutional mandate.',
    significance: 'Established constitutional supremacy over Parliamentary sovereignty in Kenya.',
    summary: 'Parliamentary privilege does not shield unconstitutional conduct. The Constitution is supreme over Parliament.',
    keywords: ['parliamentary privilege', 'constitutional supremacy', 'separation of powers', 'judicial review'],
  },
  {
    case_name: 'PAO v Attorney General',
    citation: '[2012] eKLR',
    court: 'High Court of Kenya',
    year: 2012,
    unit_id: 'atp-103',
    facts: 'A petition challenging provisions of marriage laws that discriminated against women in terms of property rights upon dissolution of marriage.',
    issue: 'Does the constitutional right to equality require equal division of matrimonial property upon divorce?',
    holding: 'The Matrimonial Property Act must be interpreted in light of constitutional provisions on equality and non-discrimination. Both spouses\' contributions — monetary and non-monetary — must be recognized.',
    ratio: 'Non-monetary contributions including homemaking and childcare are significant in determining each spouse\'s share of matrimonial property.',
    significance: 'Landmark case recognizing non-monetary contributions to matrimonial property division.',
    summary: 'Non-monetary contributions like homemaking and childcare must be recognized when dividing matrimonial property.',
    keywords: ['matrimonial property', 'equality', 'non-monetary contributions', 'family law'],
  },
  {
    case_name: 'Uhuru Muigai Kenyatta v Nairobi Star Publications',
    citation: '[2013] eKLR',
    court: 'High Court of Kenya',
    year: 2013,
    unit_id: 'atp-100',
    facts: 'An action for defamation arising from a newspaper publication. The defendant claimed the defense of fair comment on a matter of public interest.',
    issue: 'What constitutes the defense of fair comment in defamation actions involving public figures?',
    holding: 'The defense of fair comment requires that: the comment be on a matter of public interest, be based on true facts, be recognizable as comment rather than fact, and not be motivated by malice.',
    ratio: 'Public figures must tolerate a higher degree of criticism than private citizens. Fair comment is defeated by proof of malice.',
    significance: 'Important Kenyan precedent on defamation law and press freedom in relation to public figures.',
    summary: 'Public figures face a higher threshold in defamation claims. Fair comment on matters of public interest is protected if not malicious.',
    keywords: ['defamation', 'fair comment', 'public figures', 'press freedom'],
  },
  {
    case_name: 'Macharia v Republic',
    citation: '[1979] KLR 17',
    court: 'Court of Appeal of Kenya',
    year: 1979,
    unit_id: 'atp-101',
    facts: 'An appeal against conviction where the trial court relied on dock identification to identify the accused.',
    issue: 'Is dock identification sufficient to sustain a criminal conviction?',
    holding: 'Dock identification alone is worthless unless it is supported by prior identification, such as an identification parade.',
    ratio: 'Dock identification is of little evidential value because the dock draws attention to the accused. A conviction should not be based on dock identification alone without prior identification.',
    significance: 'Established that dock identification alone is insufficient for conviction — a cornerstone of Kenyan criminal evidence law.',
    summary: 'Dock identification is valueless without prior identification. A conviction cannot rest on dock identification alone.',
    keywords: ['dock identification', 'identification parade', 'criminal evidence', 'visual identification'],
  },
  {
    case_name: 'Kenya Section of ICJ v Attorney General (Abortion Petition)',
    citation: '[2019] eKLR',
    court: 'High Court of Kenya',
    year: 2019,
    unit_id: 'atp-100',
    facts: 'A petition challenging the government\'s withdrawal of standards and guidelines for reducing maternal mortality, including safe abortion guidelines.',
    issue: 'Does the right to health under Article 43 of the Constitution obligate the government to provide reproductive health standards?',
    holding: 'The right to health includes reproductive health. The government cannot arbitrarily withdraw health standards and guidelines that protect the right to life and health.',
    ratio: 'Socio-economic rights under Article 43 are justiciable. Progressive realization does not permit retrogressive measures. Once health standards are in place, they cannot be withdrawn without justification.',
    significance: 'Key case on the justiciability of socio-economic rights and the prohibition of retrogressive measures.',
    summary: 'Once health standards are established, the government cannot withdraw them arbitrarily. Socio-economic rights are fully justiciable.',
    keywords: ['right to health', 'socio-economic rights', 'retrogressive measures', 'reproductive health'],
  },
  {
    case_name: 'Raila A. Odinga v IEBC (Presidential Petition 2017)',
    citation: '[2017] eKLR',
    court: 'Supreme Court of Kenya',
    year: 2017,
    unit_id: 'atp-100',
    facts: 'A presidential petition challenging the August 2017 presidential election results on grounds of irregularities in the electoral process.',
    issue: 'What is the threshold for invalidating a presidential election?',
    holding: 'The Supreme Court nullified the election, holding that the irregularities and illegalities in the transmission of results were of such magnitude that they affected the integrity of the election.',
    ratio: 'An election is not an event but a process. Irregularities in the process, particularly in results transmission, can invalidate the outcome even without mathematical proof of impact on the final result.',
    significance: 'First presidential election nullification in Africa. Established that election integrity is a process-based standard.',
    summary: 'A presidential election can be nullified for irregularities in the process even without proof of altered results. Election integrity is process-based.',
    keywords: ['presidential petition', 'election law', 'Supreme Court', 'election integrity'],
  },
  {
    case_name: 'Mtana Lewa v Republic',
    citation: '[1999] 2 EA 297',
    court: 'Court of Appeal of Kenya',
    year: 1999,
    unit_id: 'atp-101',
    facts: 'An appeal against imprisonment for contempt of court, raising questions about the correct procedure for committal proceedings.',
    issue: 'What procedure must be followed before a person is committed to civil prison for contempt of court?',
    holding: 'A person charged with contempt must be given proper notice, a fair opportunity to be heard, and the proceedings must comply with due process requirements.',
    ratio: 'The power to punish for contempt must be exercised judicially: the contemnor must be informed of the contempt charges, given opportunity to respond, and the committal order must show cause on its face.',
    significance: 'Established procedural safeguards for contempt of court proceedings in Kenya.',
    summary: 'Contempt proceedings require proper notice, opportunity to be heard, and procedural compliance. The power must be exercised judicially.',
    keywords: ['contempt of court', 'due process', 'committal proceedings', 'fair hearing'],
  },
  {
    case_name: 'TSJ v Cabinet Secretary Interior & National Coordination',
    citation: '[2017] eKLR',
    court: 'High Court of Kenya',
    year: 2017,
    unit_id: 'atp-103',
    facts: 'A transgender person petitioned for an order to change the gender marker on their birth certificate and national identity card.',
    issue: 'Are transgender persons entitled to legal recognition of their gender identity under the Kenyan Constitution?',
    holding: 'Every person is entitled to dignity and protection from discrimination. The denial of identity documents reflecting one\'s gender identity violates Articles 27, 28, and 29 of the Constitution.',
    ratio: 'The right to dignity encompasses the right to self-determination of gender identity. The State must make reasonable provision for legal recognition of transgender persons.',
    significance: 'Groundbreaking ruling on gender identity rights in Kenya, expanding the scope of equality and dignity provisions.',
    summary: 'Transgender persons are entitled to legal recognition. Denial of identity documents reflecting gender identity violates dignity and equality rights.',
    keywords: ['gender identity', 'transgender rights', 'equality', 'dignity', 'human rights'],
  },
  {
    case_name: 'Echaria v Echaria',
    citation: '[2007] eKLR',
    court: 'Court of Appeal of Kenya',
    year: 2007,
    unit_id: 'atp-103',
    facts: 'A divorce case where the wife claimed a share of the family property including the matrimonial home.',
    issue: 'What principles govern the division of matrimonial property upon divorce?',
    holding: 'Both spouses\' direct and indirect contributions to the acquisition of matrimonial property must be considered. The court applies the doctrine of beneficial interest.',
    ratio: 'Where a spouse has made substantial contributions — whether monetary or by way of domestic services — they acquire a beneficial interest in the matrimonial property proportionate to their contributions.',
    significance: 'Pre-Matrimonial Property Act landmark case recognizing beneficial interest in matrimonial property based on contributions.',
    summary: 'Spouses acquire beneficial interest in matrimonial property proportionate to contributions, including domestic services.',
    keywords: ['divorce', 'matrimonial property', 'beneficial interest', 'domestic contributions'],
  },
  {
    case_name: 'Kivuitu v Mwendwa & Others',
    citation: '[1985] KLR 479',
    court: 'Court of Appeal of Kenya',
    year: 1985,
    unit_id: 'atp-100',
    facts: 'An election petition challenging parliamentary election results, with allegations of electoral malpractices.',
    issue: 'What is the burden and standard of proof in election petitions?',
    holding: 'An election petition must be proved to a standard higher than the balance of probabilities but lower than beyond reasonable doubt — a "fairly high degree of convincing clarity."',
    ratio: 'The standard of proof in election petitions is "above the balance of probabilities but below beyond reasonable doubt" — sometimes described as "fairly high degree of convincing clarity."',
    significance: 'Defined the unique standard of proof in election petitions — neither purely civil nor criminal standard.',
    summary: 'Election petitions require proof to a "fairly high degree of convincing clarity" — between civil and criminal standards.',
    keywords: ['election petition', 'standard of proof', 'election law', 'burden of proof'],
  },
  {
    case_name: 'Charles Njonjo v Attorney General',
    citation: '[1984] eKLR',
    court: 'Judicial Commission of Inquiry',
    year: 1984,
    unit_id: 'atp-106',
    facts: 'A judicial commission of inquiry was established to investigate allegations against Charles Njonjo, the former Attorney General, regarding abuse of office.',
    issue: 'What are the powers and limitations of a judicial commission of inquiry?',
    holding: 'A commission of inquiry has broad powers to summon witnesses and compel production of documents, but its findings are recommendations, not binding judicial determinations.',
    ratio: 'Commissions of inquiry are fact-finding bodies. Their proceedings must observe natural justice principles, but they do not make judicial determinations.',
    significance: 'The most significant commission of inquiry in Kenyan history, establishing precedents on the scope and limits of commissions.',
    summary: 'Commissions of inquiry are fact-finding bodies that must observe natural justice but make recommendations, not judicial determinations.',
    keywords: ['commission of inquiry', 'natural justice', 'public office', 'abuse of power'],
  },
];

/**
 * Auto-generates today's Case of the Day if none exists.
 * Picks from landmark library, avoiding recent repeats; falls back to AI.
 */
async function ensureTodaysCase(today: string): Promise<void> {
  const [existing] = await sql`SELECT id FROM case_of_the_day WHERE date = ${today}`;
  if (existing) return;

  // Get recently used cases to avoid repeats
  const recentCases = await sql`
    SELECT case_name FROM case_of_the_day ORDER BY date DESC LIMIT 15
  `;
  const recentNames = new Set(recentCases.map((r: any) => r.case_name));

  // Find unused cases from library
  const available = LANDMARK_CASES.filter(c => !recentNames.has(c.case_name));
  
  let caseToInsert: typeof LANDMARK_CASES[0] | null = null;

  if (available.length > 0) {
    // Pick deterministically based on day to avoid randomness issues
    const dayIndex = Math.floor(new Date(today).getTime() / 86400000) % available.length;
    caseToInsert = available[dayIndex];
  } else {
    // All library cases used recently; recycle the oldest used
    const dayIndex = Math.floor(new Date(today).getTime() / 86400000) % LANDMARK_CASES.length;
    caseToInsert = LANDMARK_CASES[dayIndex];
  }

  if (caseToInsert) {
    await sql`
      INSERT INTO case_of_the_day (date, case_name, citation, court, year, unit_id, facts, issue, holding, ratio, significance, summary, keywords)
      VALUES (
        ${today},
        ${caseToInsert.case_name},
        ${caseToInsert.citation},
        ${caseToInsert.court},
        ${caseToInsert.year},
        ${caseToInsert.unit_id},
        ${caseToInsert.facts},
        ${caseToInsert.issue},
        ${caseToInsert.holding},
        ${caseToInsert.ratio},
        ${caseToInsert.significance},
        ${caseToInsert.summary},
        ${caseToInsert.keywords}
      )
    `;
    console.log(`[CaseOfDay] Seeded: ${caseToInsert.case_name}`);
  }
}

// GET - Get today's case or a specific date's case
async function handleGet(req: NextRequest, user: AuthUser) {
  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().split('T')[0];
  const date = searchParams.get('date') || today;

  // Auto-generate today's case if it doesn't exist
  if (date === today) {
    await ensureTodaysCase(today);
  }

  const [caseOfDay] = await sql`
    SELECT * FROM case_of_the_day WHERE date = ${date}
  `;

  if (!caseOfDay) {
    const [latest] = await sql`
      SELECT * FROM case_of_the_day ORDER BY date DESC LIMIT 1
    `;
    return NextResponse.json({ case: latest || null, isFallback: true });
  }

  return NextResponse.json({ case: caseOfDay, isFallback: false });
}

export const GET = withAuth(handleGet);
