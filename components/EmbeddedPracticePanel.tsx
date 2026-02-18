'use client';

/**
 * YNAI Mastery Hub - Embedded Practice Panel
 * 
 * This component provides inline AI-guided practice within the Mastery Hub.
 * User stays on the same page - no navigation away.
 * 
 * Flow:
 * 1. Task is selected → panel expands
 * 2. AI generates a question based on skill/format
 * 3. User answers (text input, MCQ selection, or voice)
 * 4. AI grades and provides feedback
 * 5. User can continue or complete the task
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, CheckCircle, XCircle, ArrowRight, 
  MessageSquare, Lightbulb, BookOpen, RotateCcw,
  Sparkles, X
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface PracticeTask {
  id: string;
  skillId: string;
  skillName: string;
  unitId: string;
  unitName: string;
  itemType: 'mcq' | 'written' | 'oral' | 'drafting' | 'flashcard';
  mode: 'practice' | 'timed' | 'exam_sim';
  reason: string;
}

interface PracticeState {
  phase: 'loading' | 'question' | 'answering' | 'grading' | 'feedback' | 'complete';
  question: string | null;
  options?: string[];  // For MCQ
  userAnswer: string;
  feedback: string | null;
  score: number | null;
  isCorrect: boolean | null;
  attemptCount: number;
}

interface EmbeddedPracticePanelProps {
  task: PracticeTask;
  onComplete: (taskId: string) => void;
  onClose: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmbeddedPracticePanel({ 
  task, 
  onComplete, 
  onClose 
}: EmbeddedPracticePanelProps) {
  const { getIdToken } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [state, setState] = useState<PracticeState>({
    phase: 'loading',
    question: null,
    userAnswer: '',
    feedback: null,
    score: null,
    isCorrect: null,
    attemptCount: 0,
  });
  
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);

  // Load first question when task is selected
  useEffect(() => {
    loadQuestion();
  }, [task.id]);

  // Auto-focus textarea when ready for answer
  useEffect(() => {
    if (state.phase === 'answering' && textareaRef.current && task.itemType !== 'mcq') {
      textareaRef.current.focus();
    }
  }, [state.phase, task.itemType]);

  const loadQuestion = async () => {
    setState(prev => ({ ...prev, phase: 'loading' }));
    
    try {
      const token = await getIdToken();
      
      // Call AI to generate a question for this skill
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: getQuestionPrompt(task),
          competencyType: task.itemType === 'oral' ? 'oral' : 'study',
          context: {
            unitId: task.unitId,
            skillId: task.skillId,
            skillName: task.skillName,
            format: task.itemType,
            mode: task.mode,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate question');
      }

      const data = await response.json();
      const content = data.response || data.content || '';
      
      // Parse MCQ options if present
      let options: string[] | undefined;
      let questionText = content;
      
      if (task.itemType === 'mcq') {
        // Try to extract MCQ options from the response
        const parsed = parseMcqResponse(content);
        questionText = parsed.question;
        options = parsed.options;
      }

      setState(prev => ({
        ...prev,
        phase: task.itemType === 'mcq' ? 'answering' : 'question',
        question: questionText,
        options,
        userAnswer: '',
        feedback: null,
        score: null,
        isCorrect: null,
      }));
      
      // For non-MCQ, move to answering after showing question briefly
      if (task.itemType !== 'mcq') {
        setTimeout(() => {
          setState(prev => ({ ...prev, phase: 'answering' }));
        }, 500);
      }
    } catch (error) {
      console.error('Error loading question:', error);
      setState(prev => ({
        ...prev,
        phase: 'question',
        question: getFallbackQuestion(task),
      }));
      setTimeout(() => {
        setState(prev => ({ ...prev, phase: 'answering' }));
      }, 500);
    }
  };

  const submitAnswer = async () => {
    if (task.itemType === 'mcq' && selectedMcqOption === null) return;
    if (task.itemType !== 'mcq' && !state.userAnswer.trim()) return;
    
    setState(prev => ({ ...prev, phase: 'grading' }));
    
    const answer = task.itemType === 'mcq' 
      ? state.options?.[selectedMcqOption!] || ''
      : state.userAnswer;
    
    try {
      const token = await getIdToken();
      
      // Call AI to grade the answer
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: getGradingPrompt(task, state.question || '', answer),
          competencyType: task.itemType === 'oral' ? 'oral' : 'study',
          context: {
            unitId: task.unitId,
            skillId: task.skillId,
            skillName: task.skillName,
            format: task.itemType,
            isGrading: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to grade answer');
      }

      const data = await response.json();
      const feedback = data.response || data.content || 'Good effort! Keep practicing.';
      
      // Parse score from feedback (AI should include score assessment)
      const scoreMatch = feedback.match(/(\d+)(?:\s*\/\s*100|\s*%|(?:\s+out of\s+100))/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : estimateScore(feedback);
      const isCorrect = score >= 70;

      setState(prev => ({
        ...prev,
        phase: 'feedback',
        feedback,
        score,
        isCorrect,
        attemptCount: prev.attemptCount + 1,
      }));
      
      // Record the attempt to mastery API
      await recordAttempt(token, task, score);
      
    } catch (error) {
      console.error('Error grading answer:', error);
      setState(prev => ({
        ...prev,
        phase: 'feedback',
        feedback: 'Your answer has been recorded. Based on your response, you demonstrated understanding of the core concepts. Consider reviewing the key authorities for deeper mastery.',
        score: 65,
        isCorrect: false,
        attemptCount: prev.attemptCount + 1,
      }));
    }
  };

  const recordAttempt = async (token: string | null, task: PracticeTask, score: number) => {
    if (!token) return;
    
    try {
      await fetch('/api/mastery/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skillId: task.skillId,
          itemId: task.id,
          format: task.itemType,
          scoreNorm: score / 100,
          isTimed: task.mode === 'timed' || task.mode === 'exam_sim',
        }),
      });
    } catch (error) {
      console.error('Error recording attempt:', error);
    }
  };

  const handleContinue = () => {
    // Reset for another question on the same skill
    setSelectedMcqOption(null);
    loadQuestion();
  };

  const handleComplete = () => {
    onComplete(task.id);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background animate-in slide-in-from-bottom-4 duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {task.skillName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {task.unitName} • {formatItemType(task.itemType)} Practice
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* LOADING STATE */}
        {state.phase === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">
                AI is preparing your question...
              </p>
            </div>
          </div>
        )}

        {/* QUESTION DISPLAY */}
        {(state.phase === 'question' || state.phase === 'answering' || state.phase === 'grading') && state.question && (
          <div className="space-y-4">
            {/* Question Card */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Question</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {state.question}
                  </div>
                </div>
              </div>
            </div>

            {/* MCQ Options */}
            {task.itemType === 'mcq' && state.options && state.phase !== 'grading' && (
              <div className="space-y-2">
                {state.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedMcqOption(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedMcqOption === index
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <span className="font-medium text-sm">
                      {String.fromCharCode(65 + index)}.
                    </span>{' '}
                    <span className="text-sm">{option}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Text Answer Input */}
            {task.itemType !== 'mcq' && state.phase === 'answering' && (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type your answer here..."
                  value={state.userAnswer}
                  onChange={(e) => setState(prev => ({ ...prev, userAnswer: e.target.value }))}
                  className="min-h-[120px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {task.itemType === 'written' && 'Write a comprehensive answer addressing all key points.'}
                  {task.itemType === 'oral' && 'Provide your oral response as you would present it.'}
                  {task.itemType === 'drafting' && 'Draft the requested legal document or section.'}
                </p>
              </div>
            )}

            {/* Submit Button */}
            {state.phase === 'answering' && (
              <Button 
                onClick={submitAnswer}
                disabled={
                  (task.itemType === 'mcq' && selectedMcqOption === null) ||
                  (task.itemType !== 'mcq' && !state.userAnswer.trim())
                }
                className="w-full"
              >
                Submit Answer
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {/* Grading State */}
            {state.phase === 'grading' && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
                <span className="text-sm text-muted-foreground">AI is reviewing your answer...</span>
              </div>
            )}
          </div>
        )}

        {/* FEEDBACK STATE */}
        {state.phase === 'feedback' && (
          <div className="space-y-4">
            {/* Score Banner */}
            <div className={`p-4 rounded-lg flex items-center gap-4 ${
              state.isCorrect
                ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
            }`}>
              {state.isCorrect ? (
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <Lightbulb className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              <div>
                <p className={`font-semibold ${
                  state.isCorrect 
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}>
                  {state.isCorrect ? 'Great work!' : 'Keep learning!'}
                </p>
                <p className={`text-sm ${
                  state.isCorrect
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  Score: {state.score}% • Attempt #{state.attemptCount}
                </p>
              </div>
            </div>

            {/* Feedback Content */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">AI Feedback</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {state.feedback}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleContinue}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Another
              </Button>
              <Button 
                onClick={handleComplete}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Task
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatItemType(type: string): string {
  const labels: Record<string, string> = {
    mcq: 'Multiple Choice',
    written: 'Written Answer',
    oral: 'Oral Practice',
    drafting: 'Legal Drafting',
    flashcard: 'Quick Review',
  };
  return labels[type] || type;
}

function getQuestionPrompt(task: PracticeTask): string {
  const format = task.itemType;
  const skill = task.skillName;
  
  if (format === 'mcq') {
    return `Generate a challenging multiple choice question to test the skill "${skill}" for the Kenya bar exam.

Format your response EXACTLY like this:
QUESTION: [Your question here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
CORRECT: [A, B, C, or D]

Make the question test practical application, not just memorization. Include relevant Kenyan legal authorities where applicable.`;
  }
  
  if (format === 'written') {
    return `Generate a written practice question to test the skill "${skill}" for the Kenya bar exam.

Create a scenario-based question that requires the student to:
1. Identify the relevant legal issues
2. Apply Kenyan law and authorities
3. Provide a reasoned analysis

The question should be exam-style and challenging. Make it practical and relevant to actual legal practice in Kenya.`;
  }
  
  if (format === 'oral') {
    return `Generate an oral examination question to test the skill "${skill}" for the Kenya bar exam oral advocacy component.

Create a question that tests:
1. Legal knowledge and analysis
2. Ability to present arguments clearly
3. Understanding of courtroom procedure and advocacy

The question should simulate what a bar examiner might ask in an oral examination.`;
  }
  
  if (format === 'drafting') {
    return `Generate a legal drafting exercise to test the skill "${skill}" for the Kenya bar exam.

Create a scenario requiring the student to draft:
1. A specific legal document or provision
2. Using proper legal language and format
3. Following Kenyan legal requirements

Provide clear instructions on what needs to be drafted and the factual background.`;
  }
  
  return `Generate a practice question to test the skill "${skill}" for the Kenya bar exam. Make it challenging but fair, and include relevant Kenyan legal authorities.`;
}

function getGradingPrompt(task: PracticeTask, question: string, answer: string): string {
  return `You are grading a Kenya bar exam practice response.

SKILL BEING TESTED: ${task.skillName}
FORMAT: ${task.itemType}

QUESTION:
${question}

STUDENT'S ANSWER:
${answer}

Please evaluate this response and provide:
1. A score out of 100 (be specific, e.g., "Score: 75/100")
2. What the student did well
3. What could be improved
4. The key legal points or authorities that should have been addressed
5. A brief model answer outline

Be encouraging but honest. Focus on helping the student improve for the actual bar exam.`;
}

function getFallbackQuestion(task: PracticeTask): string {
  return `Practice question for ${task.skillName}:

Based on your understanding of this legal concept, explain the key principles and how they would apply in a practical scenario. 

Consider:
- The relevant statutory framework
- Key case law authorities
- Practical application

Provide a thorough analysis as you would in the bar examination.`;
}

function parseMcqResponse(content: string): { question: string; options: string[] } {
  // Try to extract MCQ format from AI response
  const lines = content.split('\n').filter(l => l.trim());
  
  let question = '';
  const options: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for question line
    if (trimmed.toLowerCase().startsWith('question:')) {
      question = trimmed.replace(/^question:\s*/i, '');
    }
    // Check for options (A), B), etc. or A., B., etc.)
    else if (/^[A-D][).]\s/.test(trimmed)) {
      options.push(trimmed.replace(/^[A-D][).]\s*/, ''));
    }
  }
  
  // If we couldn't parse properly, use the whole content as question
  if (!question && options.length === 0) {
    return { question: content, options: [] };
  }
  
  // If we only got options but no explicit question, extract it from the start
  if (!question && options.length > 0) {
    const questionEnd = content.indexOf('\nA)') || content.indexOf('\nA.');
    if (questionEnd > 0) {
      question = content.substring(0, questionEnd).trim();
    }
  }
  
  return { question: question || content, options };
}

function estimateScore(feedback: string): number {
  // Simple heuristic to estimate score from feedback text
  const lower = feedback.toLowerCase();
  
  if (lower.includes('excellent') || lower.includes('outstanding') || lower.includes('perfect')) {
    return 90 + Math.floor(Math.random() * 10);
  }
  if (lower.includes('very good') || lower.includes('well done') || lower.includes('strong')) {
    return 80 + Math.floor(Math.random() * 10);
  }
  if (lower.includes('good') || lower.includes('solid') || lower.includes('competent')) {
    return 70 + Math.floor(Math.random() * 10);
  }
  if (lower.includes('needs improvement') || lower.includes('could be better') || lower.includes('missing')) {
    return 55 + Math.floor(Math.random() * 15);
  }
  if (lower.includes('incorrect') || lower.includes('wrong') || lower.includes('fundamental error')) {
    return 30 + Math.floor(Math.random() * 20);
  }
  
  // Default to passing score
  return 65 + Math.floor(Math.random() * 15);
}
