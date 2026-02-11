// ============================================================
// KENYAN LAW KNOWLEDGE BASE FOR RAG
// Key provisions from Kenyan statutes, rules, and case law
// ============================================================

export interface LegalProvision {
  id: string;
  unitId: string;
  source: string;
  section: string;
  title: string;
  content: string;
  keywords: string[];
  relatedSections?: string[];
  practicalApplication?: string;
  examTips?: string;
}

export interface CaseLaw {
  id: string;
  unitId: string;
  citation: string;
  name: string;
  court: string;
  year: number;
  facts: string;
  issue: string;
  holding: string;
  ratio: string;
  significance: string;
  keywords: string[];
}

// ============================================================
// CIVIL LITIGATION (ATP 100) - CIVIL PROCEDURE ACT & RULES
// ============================================================

export const CIVIL_PROCEDURE_ACT: LegalProvision[] = [
  {
    id: 'cpa-s3',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 3',
    title: 'Definitions',
    content: `"decree" means the formal expression of an adjudication which, so far as regards the court expressing it, conclusively determines the rights of the parties with regard to all or any of the matters in controversy in the suit and may be either preliminary or final;
    
"judgment" means the statement given by a judge of the grounds of a decree or order;

"order" means the formal expression of any decision of a civil court which is not a decree;

"plaint" means a statement in writing of a cause of action;

"pleading" includes a plaint, a written statement, a petition, or an application;`,
    keywords: ['decree', 'judgment', 'order', 'plaint', 'pleading', 'definitions'],
    practicalApplication: 'Understanding these definitions is fundamental to civil practice. A decree is appealable while an order may or may not be. The distinction affects limitation periods and appellate jurisdiction.',
    examTips: 'Bar examiners often test the distinction between decree, judgment, and order. Know that a judgment gives reasons, while a decree is the formal determination of rights.',
  },
  {
    id: 'cpa-s3a',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 3A',
    title: 'Overriding Objective',
    content: `The overriding objective of this Act and the rules made hereunder is to facilitate the just, expeditious, proportionate and affordable resolution of the civil disputes governed by the Act.

The Court shall, in the exercise of its powers under this Act or the interpretation of any of its provisions, seek to give effect to the overriding objective.

A party to civil proceedings or an advocate for such a party is under a duty to assist the court to further the overriding objective.

The Court may take into account any non-compliance with the provisions of this Act or any rules made hereunder, or any practice directions, in making any order as to costs, including disallowance of costs.`,
    keywords: ['overriding objective', 'just resolution', 'expeditious', 'proportionate', 'affordable', 'duty of parties'],
    practicalApplication: 'Courts frequently invoke the overriding objective to deny adjournments, refuse technical objections, and promote substantive justice. Practitioners should always frame applications with reference to the overriding objective.',
    examTips: 'Section 3A is one of the most cited provisions in civil practice. Be prepared to apply it in scenario questions about procedure, delays, and costs.',
  },
  {
    id: 'cpa-s7',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 7',
    title: 'Res Judicata',
    content: `No court shall try any suit or issue in which the matter directly and substantially in issue has been directly and substantially in issue in a former suit between the same parties, or between parties under whom they or any of them claim, litigating under the same title, in a court competent to try such subsequent suit or the suit in which such issue has been subsequently raised, and has been heard and finally decided by such court.

Explanation (1): The expression "former suit" means a suit which has been decided prior to the suit in question whether or not it was instituted prior thereto.

Explanation (2): For the purposes of this section, the competence of a court shall be determined irrespective of any provisions as to a right of appeal from the decision of such court.`,
    keywords: ['res judicata', 'former suit', 'same parties', 'same issue', 'final decision', 'estoppel'],
    relatedSections: ['Section 8 - Constructive Res Judicata'],
    practicalApplication: 'Res judicata bars relitigation of decided matters. The test is: (1) same parties, (2) same issue, (3) competent court, (4) final decision. Courts apply it strictly to prevent abuse of process.',
    examTips: 'This is a favorite bar exam topic. Master the five elements and distinguish from issue estoppel and constructive res judicata under Section 8.',
  },
  {
    id: 'cpa-s8',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 8',
    title: 'Constructive Res Judicata',
    content: `Where the plaintiff is under a duty to seek all the reliefs arising from the same cause of action in one suit, the plaintiff shall not afterwards maintain another suit with respect to any of such reliefs which is omitted to be sought.

Every suit shall include the whole of the claim which the plaintiff is entitled to make in respect of the cause of action; but a plaintiff may relinquish any portion of his claim in order to bring the suit within the jurisdiction of any court.`,
    keywords: ['constructive res judicata', 'splitting claims', 'cause of action', 'relief', 'joinder'],
    relatedSections: ['Section 7 - Res Judicata'],
    practicalApplication: 'This prevents claim splitting. A plaintiff cannot sue for part of a claim and later sue for the remainder. Strategic pleading requires including all available reliefs in the original suit.',
    examTips: 'Distinguish Section 7 (actual res judicata) from Section 8 (constructive res judicata). Section 8 applies even when a relief was not sought but could have been sought.',
  },
  {
    id: 'cpa-s13',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 13',
    title: 'Place of Suing',
    content: `Subject to the pecuniary or other limitations prescribed by any law, suits shall be instituted in the court within the local limits of whose jurisdiction—
(a) the defendant, or each of the defendants where there are more than one, at the time of the commencement of the suit, actually and voluntarily resides, or carries on business, or personally works for gain; or
(b) any of the defendants, where there are more than one, at the time of the commencement of the suit, actually and voluntarily resides, or carries on business, or personally works for gain, provided that in such case either the leave of the court is given, or the defendants who do not reside, or carry on business, or personally work for gain, as aforesaid, acquiesce in such institution.`,
    keywords: ['jurisdiction', 'place of suing', 'residence', 'business', 'territorial jurisdiction'],
    practicalApplication: 'Territorial jurisdiction is determined by the defendant\'s residence or place of business. Multiple defendants in different jurisdictions require court leave or acquiescence.',
    examTips: 'Jurisdiction questions are common. Remember the rule is based on the defendant\'s location, not the plaintiff\'s. Also know exceptions for immovable property (Section 15).',
  },
  {
    id: 'cpa-s26',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 26',
    title: 'Interpleader',
    content: `Where two or more persons claim adversely to one another the same debt, sum of money, or other property, movable or immovable, from another person who claims no interest therein other than for charges or costs; and who is ready to pay or deliver it to the rightful claimant, such other person may institute a suit of interpleader against all the claimants.`,
    keywords: ['interpleader', 'adverse claims', 'stakeholder', 'competing claims'],
    practicalApplication: 'Banks and other stakeholders use interpleader when multiple parties claim the same funds. The stakeholder deposits the disputed sum in court and is discharged from liability.',
    examTips: 'Know the conditions: (1) adverse claims, (2) same property/debt, (3) stakeholder claims no interest except costs, (4) ready to deliver to rightful claimant.',
  },
  {
    id: 'cpa-s63',
    unitId: 'atp-100',
    source: 'Civil Procedure Act, Cap 21',
    section: 'Section 63',
    title: 'Inherent Powers of Court',
    content: `Nothing in this Act shall be deemed to limit or otherwise affect the inherent power of the court to make such orders as may be necessary for the ends of justice or to prevent abuse of the process of the court.`,
    keywords: ['inherent powers', 'ends of justice', 'abuse of process', 'court discretion'],
    practicalApplication: 'Courts invoke Section 63 to fill procedural gaps, order remedies not expressly provided, strike out abuse claims, and do justice in novel situations. It is not a substitute for specific rules but a supplement.',
    examTips: 'Section 63 is a residual power invoked only when no specific provision applies. Courts use it sparingly. Know landmark cases like Mwaura v Republic on scope of inherent powers.',
  },
];

export const CIVIL_PROCEDURE_RULES: LegalProvision[] = [
  {
    id: 'cpr-o1r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 1 Rule 1',
    title: 'Who May Be Joined as Plaintiffs',
    content: `All persons may be joined in one suit as plaintiffs where—
(a) any right to relief in respect of, or arising out of, the same transaction or series of transactions is alleged to exist in such persons, whether jointly, severally, or in the alternative; and
(b) if such persons brought separate suits, any common question of law or fact would arise.`,
    keywords: ['joinder of plaintiffs', 'same transaction', 'common question', 'parties'],
    practicalApplication: 'Joinder reduces multiplicity of suits and ensures consistent verdicts. Courts encourage joinder where claims arise from the same transaction and share common issues.',
    examTips: 'Joinder questions test whether claims share a common transaction and common question. Misjoinder can be cured under Order 1 Rule 9 unless it causes prejudice.',
  },
  {
    id: 'cpr-o2r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 2 Rule 1',
    title: 'Form of Suit (Plaint)',
    content: `Every suit shall be instituted by presenting a plaint to the court or such officer as is appointed in this behalf.`,
    keywords: ['plaint', 'instituting suit', 'commencement'],
    practicalApplication: 'A plaint is the originating document in all ordinary civil suits. It must comply with Order 2 Rules 2-5 and be accompanied by required documents.',
    examTips: 'Know the essential contents of a plaint under Rule 2: names, addresses, cause of action, relief sought, jurisdiction, valuation, and verification.',
  },
  {
    id: 'cpr-o2r4',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 2 Rule 4',
    title: 'Particulars of Claim',
    content: `In all cases in which the plaintiff seeks recovery of money, the plaint shall state the precise amount claimed. But where the plaintiff sues for mesne profits or for an amount which will be found actually due, or for movables which cannot be estimated in money, the plaint shall state approximately the amount or value so sued for.

Where the plaintiff sues for recovery of land, the plaint shall contain a description of the property sufficient to identify it and, in case such property can be identified by its title number or by reference to any document of title, also a reference to such title number or document.`,
    keywords: ['particulars', 'amount claimed', 'description of property', 'land', 'money claims'],
    practicalApplication: 'Precise particulars prevent ambiguity and enable proper valuation for court fees. Defective particulars may lead to rejection or striking out.',
    examTips: 'Distinguish between liquidated claims (precise amount) and unliquidated claims (approximate value). This affects summary judgment availability.',
  },
  {
    id: 'cpr-o5r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 5 Rule 1',
    title: 'Summons to Defendant',
    content: `When a suit has been duly instituted, a summons may be issued to the defendant to appear and answer the claim on a day to be specified in the summons.`,
    keywords: ['summons', 'defendant', 'appearance', 'service'],
    practicalApplication: 'Service of summons is a jurisdictional requirement. Without proper service, proceedings may be set aside. Courts are strict about service requirements.',
    examTips: 'Know the modes of service under Order 5: personal service (Rule 9), substituted service (Rule 17), service outside jurisdiction (Rule 25).',
  },
  {
    id: 'cpr-o5r17',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 5 Rule 17',
    title: 'Substituted Service',
    content: `Where the court is satisfied that for any reason the summons cannot be served in the ordinary way, the court may order the summons to be served by affixing a copy thereof in some conspicuous place in the courthouse and also upon some conspicuous part of the house (if any) in which the defendant is known to have last resided or carried on business or personally worked for gain or in such other manner as the court thinks fit.`,
    keywords: ['substituted service', 'newspaper', 'affixing', 'alternative service'],
    practicalApplication: 'Substituted service requires proof that normal service failed. An affidavit explaining service attempts is required. Common methods: courthouse notice, newspaper publication, email.',
    examTips: 'Substituted service is granted only after normal service fails. Know Nyamweya v Nyamweya principles on when substituted service is appropriate.',
  },
  {
    id: 'cpr-o8r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 8 Rule 1',
    title: 'Written Statement of Defence',
    content: `The defendant shall, at or before the first hearing or within such time as the court may permit, present a written statement of his defence.`,
    keywords: ['defence', 'written statement', 'first hearing', 'time limits'],
    practicalApplication: 'A defence must be filed within 14 days of service or as extended. Failure to file leads to ex parte proof or judgment. A proper defence admits, denies, or pleads to each paragraph.',
    examTips: 'Know that a general denial is insufficient. Each allegation must be specifically traversed. New matter (like limitation) must be specifically pleaded.',
  },
  {
    id: 'cpr-o9r5',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 9 Rule 5',
    title: 'Ex-parte Proceedings',
    content: `Where the defendant has appeared but the defendant fails to appear on the day fixed for hearing the suit, the court may proceed ex parte.`,
    keywords: ['ex parte', 'default', 'non-appearance', 'hearing'],
    practicalApplication: 'Ex parte judgments can be set aside under Order 9 Rule 9 if the defendant shows reasonable cause for non-appearance. Courts balance finality against fair hearing.',
    examTips: 'Know the difference between Order 9 Rule 4 (plaintiff fails to appear) and Rule 5 (defendant fails). Different consequences apply.',
  },
  {
    id: 'cpr-o12r6',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 12 Rule 6',
    title: 'Amendment of Pleadings',
    content: `The court may, at any stage of the proceedings, allow either party to amend or alter his pleadings in such manner and on such terms as may be just and all such amendments shall be made as may be necessary for the purpose of determining the real questions in controversy between the parties.`,
    keywords: ['amendment', 'pleadings', 'alter', 'court discretion', 'just terms'],
    practicalApplication: 'Amendments are generally liberally allowed before trial to ensure real issues are determined. Late amendments may attract costs or be refused if they cause incurable prejudice.',
    examTips: 'Know the principles from Eastern Bakery Ltd v Castelino: amendments should be allowed unless they cause prejudice that cannot be compensated by costs.',
  },
  {
    id: 'cpr-o35r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 35 Rule 1',
    title: 'Summary Judgment',
    content: `Where the plaintiff has served on the defendant a summons to enter appearance in a suit and the defendant has entered appearance, if the plaintiff can satisfy the court that the defendant has no defence to the suit or a particular part thereof, or that the defendant has no defence except as to the amount of a liquidated claim, the plaintiff shall be entitled to judgment forthwith.

A plaintiff shall not be entitled to judgment under this Order if the suit against the defendant includes a claim for defamation, malicious prosecution, false imprisonment, or any matter founded upon allegations of fraud.`,
    keywords: ['summary judgment', 'no defence', 'liquidated claim', 'appearance'],
    practicalApplication: 'Summary judgment is an efficient remedy for clear cases. The defendant must show a real prospect of success or arguable defence. Conclusory defences are insufficient.',
    examTips: 'Know the excluded claims (defamation, fraud, etc.) and the test: defendant must show a triable issue. References like Eng Beverages Ltd v Kenya Breweries Ltd are essential.',
  },
  {
    id: 'cpr-o39r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 39 Rule 1',
    title: 'Temporary Injunctions',
    content: `Where in any suit it is proved by affidavit or otherwise—
(a) that any property in dispute in a suit is in danger of being wasted, damaged, or alienated by any party to the suit, or wrongfully sold in execution of a decree; or
(b) that the defendant threatens, or intends, to remove or dispose of his property with a view to defrauding his creditors; or
(c) that the defendant threatens to dispossess the plaintiff or otherwise cause injury to the plaintiff in relation to any property in dispute in the suit,
the court may by order grant a temporary injunction to restrain such act, or make such other order for the purpose of staying and preventing the wasting, damaging, alienation, sale, removal, or disposition of the property or dispossession of the plaintiff, or otherwise causing injury to the plaintiff in relation to any property in dispute in the suit as the court thinks fit, until the disposal of the suit or until further orders.`,
    keywords: ['temporary injunction', 'interlocutory', 'restraint', 'property', 'pending suit'],
    practicalApplication: 'Giella v Cassman Brown principles apply: (1) prima facie case, (2) irreparable injury if refused, (3) balance of convenience. Courts are reluctant to grant mandatory injunctions.',
    examTips: 'Master the Giella v Cassman Brown test—it appears in virtually every injunction question. Know that status quo is the position before the complained act.',
  },
  {
    id: 'cpr-o39r3',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 39 Rule 3',
    title: 'Ex-parte Injunction',
    content: `The court shall in all cases, except where it appears that the object of granting the injunction would be defeated by the delay, before granting an injunction, direct notice of the application for the same to be given to the opposite party.`,
    keywords: ['ex parte injunction', 'notice', 'urgency', 'delay'],
    practicalApplication: 'Ex parte injunctions are exceptional and only granted where notice would defeat the purpose. The applicant must disclose all material facts, including those unfavorable.',
    examTips: 'Non-disclosure of material facts on an ex parte application leads to discharge. Courts emphasize the duty of utmost good faith (uberrima fides) in ex parte applications.',
  },
  {
    id: 'cpr-o40r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 40 Rule 1',
    title: 'Appointment of Receivers',
    content: `Where it appears to the court to be just and convenient, the court may by order—
(a) appoint a receiver of any property, whether before or after decree;
(b) remove any person from the possession or custody of the property;
(c) commit the same to the possession, custody, or management of the receiver;
(d) confer upon the receiver all such powers, as to bringing and defending suits and for the realization, management, protection, preservation, and improvement of the property, the collection of rents and profits thereof, the application and disposal of such rents and profits, and the execution of documents as the owner himself has, or such of those powers as the court thinks fit.`,
    keywords: ['receiver', 'appointment', 'property management', 'court order'],
    practicalApplication: 'Receivers preserve property during litigation or pending distribution. They are neutral officers of court with defined powers. Common in disputes over business assets, estates, and land.',
    examTips: 'Receivership is a drastic remedy granted sparingly. Know when courts appoint receivers: dissipation risk, partnership disputes, execution difficulties.',
  },
  {
    id: 'cpr-o42r6',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 42 Rule 6',
    title: 'Stay of Execution',
    content: `No order for stay of execution shall be made under subrule (1) unless—
(a) the court is satisfied that substantial loss may result to the party applying for stay of execution unless the order is made and that the application has been made without unreasonable delay; and
(b) such security as the court orders for the due performance of such decree or order as may ultimately be binding on him has been given by the applicant.`,
    keywords: ['stay of execution', 'substantial loss', 'security', 'appeal pending'],
    practicalApplication: 'Stay preserves the subject matter of appeal. The applicant must show substantial loss if execution proceeds and provide security for the decretal sum.',
    examTips: 'Stay is not automatic upon appeal. Know the Kenya Shell Ltd v Kibiru test: substantial loss, prompt application, willingness to give security.',
  },
  {
    id: 'cpr-o43r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 43 Rule 1',
    title: 'Appeals from Original Decrees',
    content: `An appeal shall lie from every original decree passed by any court exercising civil jurisdiction to the court authorized to hear such appeals.`,
    keywords: ['appeal', 'original decree', 'appellate jurisdiction', 'right of appeal'],
    practicalApplication: 'Appeals from Magistrate courts go to High Court; from High Court to Court of Appeal; from Court of Appeal to Supreme Court (on certification). Time limits are strict.',
    examTips: 'Know limitation periods: 30 days for High Court appeals, 14 days for Court of Appeal. Extension requires special leave and good cause.',
  },
  {
    id: 'cpr-o50r1',
    unitId: 'atp-100',
    source: 'Civil Procedure Rules, 2010',
    section: 'Order 50 Rule 1',
    title: 'Reference to Arbitration',
    content: `Where in any suit all the parties interested agree that any matter in difference between them shall be referred to arbitration, and that such reference shall be made a rule of court, the court may make an order of reference accordingly.`,
    keywords: ['arbitration', 'reference', 'consent', 'alternative dispute resolution'],
    practicalApplication: 'Court-annexed arbitration is by consent. Arbitration awards become decrees of court. The Arbitration Act applies to commercial arbitration.',
    examTips: 'Distinguish court-annexed arbitration from contractual arbitration under the Arbitration Act. Know stay of proceedings under Section 6 of the Arbitration Act.',
  },
];

// ============================================================
// LANDMARK KENYAN CASES - CIVIL LITIGATION
// ============================================================

export const CIVIL_LITIGATION_CASES: CaseLaw[] = [
  {
    id: 'giella-cassman',
    unitId: 'atp-100',
    citation: '[1973] EA 358',
    name: 'Giella v Cassman Brown & Co Ltd',
    court: 'Court of Appeal for East Africa',
    year: 1973,
    facts: 'The appellant sought an interlocutory injunction to restrain interference with his property pending determination of the main suit.',
    issue: 'What are the principles governing the grant of interlocutory injunctions?',
    holding: 'The Court of Appeal established the three-stage test for interlocutory injunctions.',
    ratio: 'An applicant for an interlocutory injunction must show: (1) a prima facie case with a probability of success (need not amount to certainty); (2) that he will suffer irreparable injury which cannot be adequately compensated by damages; (3) if the court is in doubt, it will decide on a balance of convenience.',
    significance: 'This is the seminal East African case on interlocutory injunctions. The test has been consistently applied in Kenya and across the region for over 50 years.',
    keywords: ['injunction', 'interlocutory', 'prima facie case', 'irreparable injury', 'balance of convenience'],
  },
  {
    id: 'eastern-bakery',
    unitId: 'atp-100',
    citation: '[1958] EA 461',
    name: 'Eastern Bakery v Castelino',
    court: 'Court of Appeal for East Africa',
    year: 1958,
    facts: 'The plaintiff sought to amend its plaint after substantial proceedings had taken place.',
    issue: 'When should courts allow amendment of pleadings?',
    holding: 'The court held that amendments should be liberally allowed to enable determination of real issues.',
    ratio: 'Amendment of pleadings should be allowed at any stage of the proceedings unless it would cause irremediable prejudice to the other party that cannot be compensated by costs or other terms. The court\'s primary duty is to determine the real questions in controversy.',
    significance: 'This case establishes the liberal approach to amendment of pleadings that promotes substantive justice over procedural technicalities.',
    keywords: ['amendment', 'pleadings', 'prejudice', 'costs', 'real issues'],
  },
  {
    id: 'kenya-shell-kibiru',
    unitId: 'atp-100',
    citation: '[1986] KLR 410',
    name: 'Kenya Shell Ltd v Kibiru',
    court: 'Court of Appeal of Kenya',
    year: 1986,
    facts: 'The applicant sought stay of execution pending appeal after judgment was entered against it.',
    issue: 'What must an applicant demonstrate to obtain stay of execution pending appeal?',
    holding: 'The court set out the principles for grant of stay of execution.',
    ratio: 'Stay of execution pending appeal will be granted where: (1) the applicant shows that substantial loss will result unless stay is granted; (2) the application is made without unreasonable delay; (3) the applicant gives adequate security for due performance of the decree.',
    significance: 'This case is the leading authority on stay of execution pending appeal and is routinely cited in stay applications.',
    keywords: ['stay of execution', 'pending appeal', 'substantial loss', 'security', 'delay'],
  },
  {
    id: 'kariuki-ag',
    unitId: 'atp-100',
    citation: '[2016] eKLR',
    name: 'Trusted Society of Human Rights Alliance v Attorney General & Others',
    court: 'High Court of Kenya at Nairobi',
    year: 2012,
    facts: 'A civil society organization sought to challenge appointment of judges in a public interest litigation.',
    issue: 'What is the scope of public interest litigation and locus standi in constitutional matters?',
    holding: 'The court adopted an expansive approach to standing in constitutional and public interest matters.',
    ratio: 'Under Article 22 of the Constitution 2010, a person may bring court proceedings claiming a right or fundamental freedom has been denied, violated, infringed or threatened. The person need not demonstrate personal injury or special damage.',
    significance: 'This case affirms the broad standing rules under the 2010 Constitution, enabling public interest litigation.',
    keywords: ['locus standi', 'public interest litigation', 'constitutional petition', 'Article 22', 'fundamental rights'],
  },
  {
    id: 'owners-mv-lillian',
    unitId: 'atp-100',
    citation: '[2006] eKLR',
    name: 'Owners of Motor Vessel Lillian S v Caltex',
    court: 'Court of Appeal of Kenya',
    year: 2006,
    facts: 'The issue arose whether the doctrine of res judicata applied to bar fresh proceedings on the same matter.',
    issue: 'What are the essential elements of res judicata under Section 7 of the Civil Procedure Act?',
    holding: 'The Court of Appeal restated the elements of res judicata.',
    ratio: 'For res judicata to apply: (1) the matter must have been directly and substantially in issue; (2) in a former suit between the same parties or their privies; (3) in a court competent to try the matter; (4) and finally decided. Constructive res judicata bars matters that ought to have been raised.',
    significance: 'Authoritative restatement of res judicata principles in Kenya, frequently cited in limitation and estoppel arguments.',
    keywords: ['res judicata', 'former suit', 'same parties', 'competent court', 'final decision'],
  },
  {
    id: 'mrao-freehold',
    unitId: 'atp-100',
    citation: '[2010] eKLR',
    name: 'MRAO Ltd v First American Bank',
    court: 'Court of Appeal of Kenya',
    year: 2003,
    facts: 'A party sought to set aside a decree obtained by fraud after limitation period had expired.',
    issue: 'When and how may a court exercise its inherent powers under Section 3A and 63 of the Civil Procedure Act?',
    holding: 'Inherent powers should be exercised sparingly and only to advance justice or prevent abuse.',
    ratio: 'Section 63 provides residual powers to be invoked only when no specific provision covers the situation. Inherent powers cannot override express statutory provisions or limitation periods except in cases of fraud or where the interests of justice clearly demand it.',
    significance: 'Defines the boundaries of inherent jurisdiction and prevents its abuse as a procedural shortcut.',
    keywords: ['inherent powers', 'Section 63', 'fraud', 'limitation', 'justice'],
  },
  {
    id: 'machira-v-mwangi',
    unitId: 'atp-100',
    citation: '[2000] 2 EA 65',
    name: 'Machira v Mwangi',
    court: 'Court of Appeal of Kenya',
    year: 2000,
    facts: 'The respondent challenged an ex parte order on grounds of non-disclosure of material facts.',
    issue: 'What is the duty of disclosure when seeking ex parte orders?',
    holding: 'A party seeking ex parte relief must disclose all material facts, including those adverse to their case.',
    ratio: 'An applicant for an ex parte order is under a duty to make full and frank disclosure of all material facts. Non-disclosure of material facts, whether deliberate or innocent, is a sufficient ground to discharge the ex parte order.',
    significance: 'Establishes the uberrima fides (utmost good faith) duty in ex parte applications.',
    keywords: ['ex parte', 'disclosure', 'material facts', 'good faith', 'uberrima fides'],
  },
];

// ============================================================
// RETRIEVAL FUNCTIONS FOR RAG
// ============================================================

export function searchLegalProvisions(query: string, unitId?: string): LegalProvision[] {
  const queryLower = query.toLowerCase();
  const allProvisions = [...CIVIL_PROCEDURE_ACT, ...CIVIL_PROCEDURE_RULES];
  
  return allProvisions
    .filter(p => {
      if (unitId && p.unitId !== unitId) return false;
      const searchText = `${p.title} ${p.content} ${p.keywords.join(' ')} ${p.section}`.toLowerCase();
      return searchText.includes(queryLower) || p.keywords.some(k => queryLower.includes(k.toLowerCase()));
    })
    .slice(0, 5);
}

export function searchCases(query: string, unitId?: string): CaseLaw[] {
  const queryLower = query.toLowerCase();
  
  return CIVIL_LITIGATION_CASES
    .filter(c => {
      if (unitId && c.unitId !== unitId) return false;
      const searchText = `${c.name} ${c.issue} ${c.holding} ${c.ratio} ${c.keywords.join(' ')}`.toLowerCase();
      return searchText.includes(queryLower) || c.keywords.some(k => queryLower.includes(k.toLowerCase()));
    })
    .slice(0, 3);
}

export function getRelevantContext(query: string, unitId: string): { provisions: LegalProvision[]; cases: CaseLaw[] } {
  // Extract key legal terms from query
  const legalTerms = [
    'injunction', 'res judicata', 'pleading', 'amendment', 'service', 'summons',
    'stay', 'execution', 'appeal', 'jurisdiction', 'receiver', 'interpleader',
    'summary judgment', 'defence', 'plaint', 'decree', 'order', 'judgment',
    'inherent powers', 'overriding objective', 'ex parte', 'parties', 'joinder'
  ];
  
  const matchedTerms = legalTerms.filter(term => query.toLowerCase().includes(term));
  const searchQuery = matchedTerms.length > 0 ? matchedTerms.join(' ') : query;
  
  return {
    provisions: searchLegalProvisions(searchQuery, unitId),
    cases: searchCases(searchQuery, unitId),
  };
}

export function formatProvisionForContext(p: LegalProvision): string {
  return `**${p.source} - ${p.section}: ${p.title}**
${p.content}
${p.practicalApplication ? `\n*Practical Application:* ${p.practicalApplication}` : ''}
${p.examTips ? `\n*Exam Tips:* ${p.examTips}` : ''}`;
}

export function formatCaseForContext(c: CaseLaw): string {
  return `**${c.name} ${c.citation}**
*Court:* ${c.court} (${c.year})
*Issue:* ${c.issue}
*Ratio:* ${c.ratio}
*Significance:* ${c.significance}`;
}
