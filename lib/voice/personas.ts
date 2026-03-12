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
    voice: 'onyx',
    instructions:
      'Speak in a deep, measured, authoritative tone. You are a retired High Court judge. ' +
      'Pace yourself deliberately — pause briefly before key legal terms. ' +
      'Sound grave and formal, as if presiding over a courtroom. ' +
      'Pronounce Kenyan legal terms and case names clearly.',
  },
  {
    panelistId: 'advocate-amara',
    voice: 'nova',
    instructions:
      'Speak in a sharp, confident, rapid tone. You are a senior litigation counsel. ' +
      'Deliver questions with intensity and urgency — you want answers NOW. ' +
      'Slightly raise your voice when challenging a point. ' +
      'Sound like a tough cross-examiner in a Nairobi courtroom.',
  },
  {
    panelistId: 'prof-otieno',
    voice: 'echo',
    instructions:
      'Speak in a warm, thoughtful, academic tone. You are a professor of law. ' +
      'Use a Socratic delivery — pause after asking questions to invite reflection. ' +
      'Sound intellectual but approachable, like a favourite lecturer. ' +
      'Emphasize key concepts by slowing down slightly.',
  },
];

/**
 * Devil's Advocate persona — sharper, more confrontational.
 */
export const DEVILS_ADVOCATE_PERSONA: VoicePersona = {
  panelistId: 'devils-advocate',
  voice: 'onyx',
  instructions:
    'Speak in a cold, incisive, combative tone. You are a legal debate opponent. ' +
    'Challenge every statement with authority and conviction. ' +
    'Sound relentless — never concede a point easily. ' +
    'Slightly sarcastic when the student gives a weak argument. ' +
    'Pronounce Kenyan legal terms and statutory references precisely.',
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
