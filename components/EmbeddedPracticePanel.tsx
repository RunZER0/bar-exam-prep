'use client';

/**
 * YNAI Mastery Hub - Embedded Practice Panel
 * 
 * Complete inline training experience within Mastery Hub.
 * Uses the real grading service for evidence-based feedback.
 * 
 * WRITTEN EXAMS ONLY - No MCQ, oral, or drafting.
 * 
 * Flow:
 * 1. Fetch written item from DB (or AI-generate if none)
 * 2. Display question with study notes option
 * 3. Accept written essay answer
 * 4. Submit to /api/mastery/attempt for structured grading
 * 5. Display rubric breakdown, missing points, model answer
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import InteractiveStudyNotes from '@/components/InteractiveStudyNotes';
import { 
  Loader2, CheckCircle, XCircle, ArrowRight, 
  MessageSquare, Lightbulb, BookOpen, RotateCcw,
  Sparkles, X, FileText, AlertTriangle, ChevronDown, ChevronUp
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
  itemType: 'written'; // Mastery Hub is WRITTEN EXAMS ONLY
  mode: 'practice' | 'timed' | 'exam_sim';
  reason: string;
  itemId?: string; // If we already have a specific item
}

interface ItemData {
  id: string;
  itemType: 'written'; // Mastery Hub is WRITTEN EXAMS ONLY
  format: 'written';
  prompt: string;
  context: string | null;
  modelAnswer: string | null;
  keyPoints: string[];
  difficulty: number;
  estimatedMinutes: number;
  skillId: string;
  skillName: string;
  unitId: string;
  coverageWeight: number;
}

interface RubricItem {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
  missingPoints?: string[];
}

interface GradingOutput {
  scoreNorm: number;
  scoreRaw: number;
  maxScore: number;
  rubricBreakdown: RubricItem[];
  missingPoints: string[];
  errorTags: string[];
  nextDrills: string[];
  modelOutline: string;
  evidenceRequests: string[];
}

interface AttemptResult {
  attemptId: string;
  grading: GradingOutput;
  masteryUpdates: { skillId: string; oldPMastery: number; newPMastery: number }[];
  summary: {
    passed: boolean;
    scorePercent: number;
    improvementAreas: string[];
    nextRecommendedSkills: string[];
  };
}

type Phase = 'loading' | 'study' | 'question' | 'answering' | 'grading' | 'feedback';

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
  const startTimeRef = useRef<Date | null>(null);
  
  // Core state
  const [phase, setPhase] = useState<Phase>('loading');
  const [item, setItem] = useState<ItemData | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  
  // Grading result
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [showRubricDetails, setShowRubricDetails] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSections, setNotesSections] = useState<{ id: string; title: string; content: string; source?: string; examTips?: string }[]>([]);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Load item AND notes when task changes (study-first approach)
  const loadItem = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setUserAnswer('');
    setNotesSections([]);
    
    try {
      const token = await getIdToken();
      
      // Fetch notes and item in parallel for study-first flow
      const notesPromise = fetch(`/api/mastery/notes?skillId=${task.skillId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : { sections: [] }).catch(() => ({ sections: [] }));
      
      const params = new URLSearchParams({
        skillId: task.skillId,
        format: task.itemType,
      });
      if (task.itemId) {
        params.set('itemId', task.itemId);
      }
      
      const response = await fetch(`/api/mastery/item?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load practice item');
      }

      // Wait for both notes and item
      const [notesData, itemData] = await Promise.all([
        notesPromise,
        response.json(),
      ]);
      
      setNotesSections(notesData.sections || []);
      if (notesData.sections?.length > 0) {
        setExpandedNoteId(notesData.sections[0].id);
      }
      setItem(itemData.item);
      
      // STUDY-FIRST: Show notes before question
      // If notes exist, go to study phase first, else go straight to question
      if (notesData.sections?.length > 0) {
        setPhase('study');
      } else {
        setPhase('question');
        startTimeRef.current = new Date();
        setTimeout(() => setPhase('answering'), 500);
      }
    } catch (err) {
      console.error('Error loading item:', err);
      setError('Failed to load practice item. Please try again.');
      setPhase('question');
    }
  }, [task, getIdToken]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // Fetch curated notes when notes panel is opened
  const loadNotes = useCallback(async () => {
    if (notesSections.length > 0 || notesLoading) return; // Already loaded or loading
    
    setNotesLoading(true);
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/mastery/notes?skillId=${task.skillId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotesSections(data.sections || []);
        // Auto-expand first note
        if (data.sections?.length > 0) {
          setExpandedNoteId(data.sections[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setNotesLoading(false);
    }
  }, [task.skillId, getIdToken, notesSections.length, notesLoading]);

  // Load notes when panel is opened
  useEffect(() => {
    if (showNotes) {
      loadNotes();
    }
  }, [showNotes, loadNotes]);

  // Auto-focus textarea
  useEffect(() => {
    if (phase === 'answering' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  // Submit answer for grading
  const submitAnswer = async () => {
    if (!item) return;
    if (!userAnswer.trim()) return;
    
    setPhase('grading');
    setError(null);
    
    const timeTakenSec = startTimeRef.current 
      ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
      : 60;
    
    try {
      const token = await getIdToken();
      
      // Build AttemptSubmission for written answer
      const submission = {
        itemId: item.id,
        format: 'written' as const,
        mode: task.mode,
        response: userAnswer,
        startedAt: startTimeRef.current?.toISOString() || new Date().toISOString(),
        timeTakenSec,
        prompt: item.prompt,
        context: item.context,
        keyPoints: item.keyPoints,
        modelAnswer: item.modelAnswer,
        skillIds: [item.skillId],
        coverageWeights: { [item.skillId]: item.coverageWeight },
        unitId: item.unitId,
        difficulty: item.difficulty,
      };
      
      const response = await fetch('/api/mastery/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submission),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to grade answer');
      }

      const attemptResult: AttemptResult = await response.json();
      setResult(attemptResult);
      setAttemptCount(prev => prev + 1);
      setPhase('feedback');
      
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError('Failed to grade your answer. Please try again.');
      setPhase('answering');
    }
  };

  const handleTryAnother = () => {
    setResult(null);
    loadItem();
  };

  const handleComplete = () => {
    onComplete(task.id);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {task.skillName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {task.unitName} • {formatItemType()} • {task.mode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Notes toggle */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className={showNotes ? 'bg-primary/10' : ''}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Why this skill - algorithm transparency */}
        {task.reason && (
          <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
            📊 {task.reason}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* Study Notes Panel (collapsible) */}
        {showNotes && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg max-h-[400px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">Curated Study Notes</span>
            </div>
            
            {notesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-blue-600">Loading notes...</span>
              </div>
            ) : notesSections.length > 0 ? (
              <div className="space-y-2">
                {notesSections.map((section) => (
                  <div 
                    key={section.id}
                    className="border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden bg-white dark:bg-blue-900/20"
                  >
                    <button
                      onClick={() => setExpandedNoteId(expandedNoteId === section.id ? null : section.id)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-800/30"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200 line-clamp-2">
                          {section.title}
                        </span>
                        {section.source && (
                          <span className="text-xs text-blue-500 dark:text-blue-400 block">
                            {section.source}
                          </span>
                        )}
                      </div>
                      {expandedNoteId === section.id ? (
                        <ChevronUp className="h-4 w-4 text-blue-500 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-500 flex-shrink-0 ml-2" />
                      )}
                    </button>
                    
                    {expandedNoteId === section.id && (
                      <div className="px-3 py-3 border-t border-blue-200 dark:border-blue-700">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-blue-900 dark:text-blue-100">
                          <MarkdownRenderer content={section.content} />
                        </div>
                        {section.examTips && (
                          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-700">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Exam Tip
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              {section.examTips}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : item?.keyPoints && item.keyPoints.length > 0 ? (
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p>Key points for <strong>{item.skillName}</strong>:</p>
                <ul className="list-disc list-inside space-y-1">
                  {item.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                No curated notes available for this skill yet. Focus on relevant statutory provisions and case law.
              </p>
            )}
          </div>
        )}

        {/* LOADING STATE */}
        {phase === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading study materials and practice question...
              </p>
            </div>
          </div>
        )}

        {/* STUDY PHASE - Interactive Study Notes with Ask AI */}
        {phase === 'study' && (
          <InteractiveStudyNotes
            skillName={task.skillName}
            unitName={task.unitName}
            sections={notesSections}
            onProceed={() => {
              setPhase('question');
              startTimeRef.current = new Date();
              setTimeout(() => setPhase('answering'), 500);
            }}
          />
        )}

        {/* QUESTION & ANSWERING */}
        {(phase === 'question' || phase === 'answering') && item && (
          <div className="space-y-4">
            {/* Question Card */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {formatItemType()} Question
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ~{item.estimatedMinutes} min
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={item.prompt} />
                  </div>
                  {item.context && (
                    <div className="mt-3 p-3 bg-background/50 rounded border-l-2 border-primary/30">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Context</p>
                      <p className="text-sm">{item.context}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Written Answer Input */}
            {phase === 'answering' && (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Write your essay answer here..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="min-h-[180px] resize-y"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Structure your answer with a clear introduction, analysis, and conclusion</span>
                  <span>{userAnswer.length} characters</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button 
              onClick={submitAnswer}
              disabled={!userAnswer.trim()}
              className="w-full"
              size="lg"
            >
              Submit Answer
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* GRADING STATE */}
        {phase === 'grading' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">
                AI is grading your response...
              </p>
            </div>
          </div>
        )}

        {/* FEEDBACK STATE */}
        {phase === 'feedback' && result && (
          <div className="space-y-4">
            {/* Score Banner */}
            <div className={`p-4 rounded-lg flex items-center gap-4 ${
              result.summary.passed
                ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
            }`}>
              {result.summary.passed ? (
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <Lightbulb className="h-10 w-10 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-bold text-lg ${
                  result.summary.passed 
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}>
                  {result.summary.passed ? 'Great work!' : 'Keep learning!'}
                </p>
                <p className={`text-sm ${
                  result.summary.passed
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  Score: {result.summary.scorePercent}% • Attempt #{attemptCount}
                </p>
              </div>
              
              {/* Mastery change indicator */}
              {result.masteryUpdates.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Mastery</p>
                  <p className="text-sm font-medium">
                    {Math.round(result.masteryUpdates[0].oldPMastery * 100)}% → {Math.round(result.masteryUpdates[0].newPMastery * 100)}%
                  </p>
                </div>
              )}
            </div>

            {/* Rubric Breakdown (collapsible) */}
            {result.grading.rubricBreakdown.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowRubricDetails(!showRubricDetails)}
                  className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm">Rubric Breakdown</span>
                  {showRubricDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {showRubricDetails && (
                  <div className="p-3 space-y-3">
                    {result.grading.rubricBreakdown.map((rubricItem, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{rubricItem.category}</span>
                          <span className="text-sm">{rubricItem.score}/{rubricItem.maxScore}</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-2 rounded-full ${
                              rubricItem.score / rubricItem.maxScore >= 0.7 ? 'bg-green-500' :
                              rubricItem.score / rubricItem.maxScore >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${(rubricItem.score / rubricItem.maxScore) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{rubricItem.feedback}</p>
                        {rubricItem.missingPoints && rubricItem.missingPoints.length > 0 && (
                          <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                            {rubricItem.missingPoints.map((p, j) => <li key={j}>{p}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Missing Points */}
            {result.grading.missingPoints.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Points to Address
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
                  {result.grading.missingPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Model Answer (collapsible) */}
            {result.grading.modelOutline && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowModelAnswer(!showModelAnswer)}
                  className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Model Answer Outline
                  </span>
                  {showModelAnswer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {showModelAnswer && (
                  <div className="p-3 text-sm prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={result.grading.modelOutline} />
                  </div>
                )}
              </div>
            )}

            {/* Next Skills to Practice */}
            {result.grading.nextDrills.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  🎯 Recommended Practice
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside">
                  {result.grading.nextDrills.map((drill, i) => (
                    <li key={i}>{drill}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={handleTryAnother}
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

function formatItemType(): string {
  return 'Written'; // Mastery Hub is WRITTEN EXAMS ONLY
}
