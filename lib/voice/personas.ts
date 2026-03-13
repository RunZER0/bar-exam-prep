/**
 * Voice Personas for Oral Exam TTS
 * 
 * Each examiner persona maps to a specific built-in voice and
 * a set of TTS instructions that shape tone, pace, and delivery.
 * 
 * The `instructions` field is only supported by gpt-4o-mini-tts.
 * When using legacy tts-1, instructions are ignored and only the
 * voice ID is used.
 */

export interface VoicePersona {
  /** Matches panelist ID in oral-exams route */
  panelistId: string;
  /** OpenAI built-in voice ID */
  voice: string;
  /** Optional additional voices to rotate for richer variety */
  voiceVariants?: string[];
  /** TTS instructions for gpt-4o-mini-tts (ignored by tts-1) */
  instructions: string;
}

/**
 * Examiner panel personas — tone instructions for gpt-4o-mini-tts.
 * These instructions shape HOW the voice sounds, not WHAT it says.
 */
export const EXAMINER_PERSONAS: VoicePersona[] = [
  {
    panelistId: 'justice-mwangi',
    voice: 'cedar',
    voiceVariants: ['onyx', 'cedar', 'ash'],
    instructions:
      'Speak in a deep, commanding, judicial tone with polished courtroom authority. ' +
      'Adopt a subtle Kenyan English accent with measured, deliberate pacing — like a High Court judge who weighs every word. ' +
      'Use dramatic pauses before delivering key rulings or corrections. ' +
      'When citing statutory sections or case names, slow down slightly and add weight — these are the most important words. ' +
      'Shift from warm patience when guiding to sharp authority when correcting. ' +
      'Occasionally lower your voice almost to a whisper for emphasis on critical legal points before returning to full volume. ' +
      'Sound like a respected senior judge who has presided over landmark constitutional cases.',
  },
  {
    panelistId: 'advocate-amara',
    voice: 'coral',
    voiceVariants: ['coral', 'nova', 'verse'],
    instructions:
      'Speak in a sharp, fast-paced, high-energy litigation style — like a top trial advocate in cross-examination. ' +
      'Punch key legal terms with strong emphasis and use rapid-fire delivery for pointed challenges. ' +
      'Create dramatic contrast: quick aggressive questioning followed by a deliberate pause to let the challenge land. ' +
      'Sound impatient with vague answers — increase pace and intensity when pressing for specifics. ' +
      'When citing a case or section, deliver it with confident precision like you know it by heart. ' +
      'Use subtle emotional range: skeptical disbelief, sharp challenge, and occasional grudging respect when the student makes a strong point. ' +
      'Sound like the opposing counsel everyone fears in a Nairobi courtroom.',
  },
  {
    panelistId: 'prof-otieno',
    voice: 'sage',
    voiceVariants: ['sage', 'echo', 'marin'],
    instructions:
      'Speak in a warm, articulate, professorly tone with rich academic depth — like a distinguished law professor in a tutorial. ' +
      'Use natural Socratic rhythm: pose a question thoughtfully, pause to let the student think, then probe with gentle intensity. ' +
      'Vary between warmth when the student is on the right track and measured disappointment when they miss a key principle. ' +
      'Sound intellectually curious — genuinely interested in HOW the student reasons, not just WHAT they know. ' +
      'When introducing a new concept or policy rationale, slow down as if savoring the idea. ' +
      'Use light emphasis and rising intonation on follow-up questions to signal that the answer matters. ' +
      'Sound like the professor whose tutorials students never skip.',
  },
];

/**
 * Devil's Advocate persona — sharper, more confrontational.
 */
export const DEVILS_ADVOCATE_PERSONA: VoicePersona = {
  panelistId: 'devils-advocate',
  voice: 'onyx',
  voiceVariants: ['onyx', 'ash', 'cedar'],
  instructions:
    'Speak in a cold, incisive, combative debate tone — like an adversarial opposing counsel who never concedes a point. ' +
    'Use controlled intensity with sharp emphasis on contradictions and weak arguments. ' +
    'Vary pace dramatically: clipped, rapid-fire challenges when pressing hard, then slow, deliberate delivery when dismantling an argument. ' +
    'Sound relentless and slightly intimidating — but never robotic. This is a real legal debate, not a quiz. ' +
    'When quoting what the student said back at them, adopt a slightly mocking intonation. ' +
    'When citing counter-authority, deliver it with absolute confidence — slow down on the case name as if landing a decisive blow. ' +
    'Use brief pauses after devastating challenges to let the silence pressure the student. ' +
    'Occasionally whisper a key phrase for dramatic emphasis before returning to full combative volume.',
};

/**
 * Lookup a persona by panelist ID.
 * Falls back to Devil's Advocate for unknown IDs.
 */
export function getPersona(panelistId: string): VoicePersona {
  return (
    EXAMINER_PERSONAS.find(p => p.panelistId === panelistId) ??
    DEVILS_ADVOCATE_PERSONA
  );
}
