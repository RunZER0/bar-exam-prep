"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import InteractiveStudyNotes, { StudySection } from "@/components/InteractiveStudyNotes";
import {
  Loader2,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  Lightbulb,
  BookOpen,
  RotateCcw,
  Sparkles,
  X,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
} from "lucide-react";

export interface PracticeTask {
  id: string;
  skillId: string;
  skillName: string;
  unitId: string;
  unitName: string;
  itemType: "written";
  mode: "practice" | "timed" | "exam_sim";
  reason?: string;
  itemId?: string;
}

interface ItemData {
  id: string;
  prompt: string;
  context?: string;
  keyPoints?: string[];
  modelAnswer?: string;
  skillId: string;
  skillName?: string;
  coverageWeight: number;
  unitId: string;
  difficulty?: string;
  estimatedMinutes?: number;
}

interface AttemptResult {
  summary: { passed: boolean; scorePercent: number };
  grading: {
    rubricBreakdown: Array<{
      category: string;
      score: number;
      maxScore: number;
      feedback: string;
      missingPoints?: string[];
    }>;
    missingPoints: string[];
    modelOutline?: string;
    nextDrills: string[];
  };
  masteryUpdates: Array<{ oldPMastery: number; newPMastery: number }>;
}

interface EmbeddedPracticePanelProps {
  task: PracticeTask;
  onComplete: (taskId: string) => void;
  onClose: () => void;
}

type Phase = "loading" | "study" | "question" | "answering" | "grading" | "feedback";

export default function EmbeddedPracticePanel({ task, onComplete, onClose }: EmbeddedPracticePanelProps) {
  const { getIdToken } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [item, setItem] = useState<ItemData | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNotes, setShowNotes] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSections, setNotesSections] = useState<StudySection[]>([]);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const [showRubricDetails, setShowRubricDetails] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const loadItem = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setResult(null);
    setUserAnswer("");
    setNotesSections([]);

    try {
      const token = await getIdToken();

      const notesPromise = fetch(
        `/api/mastery/notes?skillId=${task.skillId}&skillName=${encodeURIComponent(task.skillName)}&unitId=${task.unitId}&unitName=${encodeURIComponent(task.unitName)}&mode=${task.mode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
        .then((r) => (r.ok ? r.json() : { sections: [] }))
        .catch(() => ({ sections: [] }));

      const params = new URLSearchParams({
        skillId: task.skillId,
        format: task.itemType,
      });
      if (task.itemId) params.set("itemId", task.itemId);

      const itemResponse = await fetch(`/api/mastery/item?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!itemResponse.ok) {
        throw new Error("Failed to load practice item");
      }

      const [notesData, itemData] = await Promise.all([notesPromise, itemResponse.json()]);

      setNotesSections(notesData.sections || []);
      if (notesData.sections?.length > 0) {
        setExpandedNoteId(notesData.sections[0].id);
      }

      const loadedItem: ItemData = itemData.item || itemData;
      setItem(loadedItem);

      if (notesData.sections?.length > 0) {
        setPhase("study");
      } else {
        startTimeRef.current = new Date();
        setPhase("question");
        setTimeout(() => setPhase("answering"), 300);
      }
    } catch (err) {
      console.error("Error loading practice item", err);
      setError("Failed to load practice item. Please try again.");
      setPhase("question");
    }
  }, [getIdToken, task]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const loadNotes = useCallback(async () => {
    if (notesSections.length > 0 || notesLoading) return;
    setNotesLoading(true);
    try {
      const token = await getIdToken();
      const response = await fetch(
        `/api/mastery/notes?skillId=${task.skillId}&skillName=${encodeURIComponent(task.skillName)}&unitId=${task.unitId}&unitName=${encodeURIComponent(task.unitName)}&mode=${task.mode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setNotesSections(data.sections || []);
        if (data.sections?.length > 0) setExpandedNoteId(data.sections[0].id);
      }
    } catch (err) {
      console.error("Error fetching notes", err);
    } finally {
      setNotesLoading(false);
    }
  }, [getIdToken, notesLoading, notesSections.length, task]);

  useEffect(() => {
    if (showNotes) loadNotes();
  }, [showNotes, loadNotes]);

  useEffect(() => {
    if (phase === "answering" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  const handleProceedFromNotes = () => {
    setPhase("question");
    startTimeRef.current = new Date();
    setTimeout(() => setPhase("answering"), 300);
  };

  const submitAnswer = async () => {
    if (!item || !userAnswer.trim()) return;

    setPhase("grading");
    setError(null);

    const timeTakenSec = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
      : 60;

    try {
      const token = await getIdToken();
      const submission = {
        itemId: item.id,
        format: "written" as const,
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

      const response = await fetch("/api/mastery/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submission),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to grade answer");
      }

      const attemptResult: AttemptResult = await response.json();
      setResult(attemptResult);
      setAttemptCount((prev) => prev + 1);
      setPhase("feedback");
    } catch (err) {
      console.error("Error grading answer", err);
      setError("Failed to grade your answer. Please try again.");
      setPhase("answering");
    }
  };

  const handleTryAnother = () => {
    setResult(null);
    loadItem();
  };

  const handleComplete = () => {
    onComplete(task.id);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background animate-in slide-in-from-bottom-4 duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Compass className="h-4 w-4" />
              Guided Session
            </div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {task.skillName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {task.unitName} • {formatItemType()} • {task.mode}
            </p>
            <p className="text-sm text-foreground/80">
              Hey, let's dig into this together. Read the notes first, then we'll quiz and grade you with real rubrics.
            </p>
            {task.reason && (
              <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                📊 Why now: {task.reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className={showNotes ? "bg-primary/10" : ""}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {showNotes && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg max-h-[420px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">Curated Study Notes</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-500" /> Human tone: skim essentials, highlight freely, ask follow-ups in plain English.
            </p>

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
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200 line-clamp-2">{section.title}</span>
                        {section.source && <span className="text-xs text-blue-500 dark:text-blue-400 block">{section.source}</span>}
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
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{section.examTips}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : item?.keyPoints && item.keyPoints.length > 0 ? (
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p>
                  Key points for <strong>{item.skillName}</strong>:
                </p>
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

        {phase === "loading" && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">Loading study materials and practice question...</p>
            </div>
          </div>
        )}

        {phase === "study" && (
          <InteractiveStudyNotes
            skillName={task.skillName}
            unitName={task.unitName}
            sections={notesSections}
            onProceed={handleProceedFromNotes}
          />
        )}

        {(phase === "question" || phase === "answering") && item && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{formatItemType()} Question</span>
                    <span className="text-xs text-muted-foreground">~{item.estimatedMinutes || 10} min</span>
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

            {phase === "answering" && (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Write your essay answer here..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="min-h-[180px] resize-y"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Write in your own voice; I’ll grade against the real rubric and coach you.</span>
                  <span>{userAnswer.length} characters</span>
                </div>
              </div>
            )}

            <Button onClick={submitAnswer} disabled={!userAnswer.trim()} className="w-full" size="lg">
              Submit Answer
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {phase === "grading" && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">AI is grading your response...</p>
            </div>
          </div>
        )}

        {phase === "feedback" && result && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg flex items-center gap-4 ${
                result.summary.passed
                  ? "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                  : "bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {result.summary.passed ? (
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <Lightbulb className="h-10 w-10 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={`font-bold text-lg ${
                    result.summary.passed ? "text-green-800 dark:text-green-200" : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {result.summary.passed ? "Great work!" : "Keep learning!"}
                </p>
                <p
                  className={`text-sm ${
                    result.summary.passed ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Score: {result.summary.scorePercent}% • Attempt #{attemptCount}
                </p>
              </div>

              {result.masteryUpdates.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Mastery</p>
                  <p className="text-sm font-medium">
                    {Math.round(result.masteryUpdates[0].oldPMastery * 100)}% → {Math.round(result.masteryUpdates[0].newPMastery * 100)}%
                  </p>
                </div>
              )}
            </div>

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
                          <span className="text-sm">
                            {rubricItem.score}/{rubricItem.maxScore}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              rubricItem.score / rubricItem.maxScore >= 0.7
                                ? "bg-green-500"
                                : rubricItem.score / rubricItem.maxScore >= 0.5
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${(rubricItem.score / rubricItem.maxScore) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{rubricItem.feedback}</p>
                        {rubricItem.missingPoints && rubricItem.missingPoints.length > 0 && (
                          <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                            {rubricItem.missingPoints.map((p, j) => (
                              <li key={j}>{p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

            {result.grading.nextDrills.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">🎯 Recommended Practice</p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside">
                  {result.grading.nextDrills.map((drill, i) => (
                    <li key={i}>{drill}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleTryAnother} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Another
              </Button>
              <Button onClick={handleComplete} className="flex-1">
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

function formatItemType(): string {
  return "Written";
}
