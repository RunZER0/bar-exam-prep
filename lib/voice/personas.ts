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
      'Vary cadence naturally: short sharp challenges followed by deliberate reflective pauses. ' +
      'Use subtle emphasis on statutory sections, constitutional articles, and case names. ' +
      'Keep delivery crisp, resonant, and realistic for a senior Kenyan judge in oral examinations.',
  },
  {
    panelistId: 'advocate-amara',
    voice: 'coral',
    voiceVariants: ['coral', 'nova', 'verse'],
    instructions:
      'Speak in a sharp, fast, high-pressure advocacy style like a top trial litigator. ' +
      'Punch key words and vary intensity to sound dynamic, not monotone. ' +
      'Use brief tactical pauses before follow-up traps and challenge points. ' +
      'Maintain confident, energetic courtroom realism throughout.',
  },
  {
    panelistId: 'prof-otieno',
    voice: 'sage',
    voiceVariants: ['sage', 'echo', 'marin'],
    instructions:
      'Speak in a warm, articulate, professorly tone with rich academic texture. ' +
      'Use Socratic rhythm: thoughtful pauses, then probing follow-up emphasis. ' +
      'Sound intellectually rigorous yet approachable, like an elite law lecturer. ' +
      'Vary pitch and cadence naturally to keep engagement high.',
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
    'Speak in a cold, incisive, combative debate tone with controlled intensity. ' +
    'Vary pace between clipped challenges and slow devastating rebuttals. ' +
    'Sound relentless but natural, never robotic. ' +
    'Emphasize legal authorities and contradictions with precision.',
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
