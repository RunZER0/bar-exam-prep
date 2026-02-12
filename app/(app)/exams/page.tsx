'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { useAuth } from '@/contexts/AuthContext';
import { usePreloading } from '@/lib/services/preloading';
import {
  Gavel, Scale, FileText, Shield, Building, Briefcase, Users, BookOpen,
  Building2, Handshake, Calculator, ClipboardCheck, Clock, ArrowRight, X,
  PenTool, CheckCircle, Sparkles, CircleDot, GraduationCap, Timer,
  FileQuestion, Edit3, ChevronRight, Target, Zap, Award, ArrowLeft,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users, BookOpen, Building2, Handshake, Calculator, PenTool,
};

// ============================================================
// EXAM CONFIGURATION
// ============================================================

type ExamType = 'abcd' | 'cle';
type PaperSize = 'mini' | 'semi' | 'full';

interface ExamConfig {
  marks: number;
  questions: number;
  time: number; // minutes
  label: string;
}

const EXAM_TYPES = [
  {
    id: 'abcd' as ExamType,
    name: 'Multiple Choice (ABCD)',
    description: 'Standard multiple choice questions with 4 options each',
    icon: CircleDot,
    color: 'emerald',
  },
  {
    id: 'cle' as ExamType,
    name: 'CLE Standard (Typed)',
    description: 'Written exam format with AI-powered grading and feedback',
    icon: Edit3,
    color: 'gray',
  },
];

const PAPER_SIZES: Record<ExamType, Record<PaperSize, ExamConfig>> = {
  abcd: {
    mini: { marks: 15, questions: 15, time: 20, label: 'Mini Paper' },
    semi: { marks: 30, questions: 30, time: 40, label: 'Semi Paper' },
    full: { marks: 60, questions: 60, time: 90, label: 'Full Paper' },
  },
  cle: {
    mini: { marks: 15, questions: 2, time: 30, label: 'Mini Paper' },
    semi: { marks: 30, questions: 4, time: 60, label: 'Semi Paper' },
    full: { marks: 60, questions: 6, time: 180, label: 'Full Paper (CLE Standard)' },
  },
};

// ============================================================
// ANIMATED MODAL COMPONENT
// ============================================================

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

function AnimatedModal({ isOpen, onClose, children, size = 'md' }: AnimatedModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal */}
      <div
        className={`
          relative bg-card rounded-2xl border border-border shadow-2xl w-full ${sizeClasses[size]}
          overflow-hidden transition-all duration-300 ease-out origin-center
          ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ExamsPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const { setAuthToken, onExamsPageVisit } = usePreloading();
  
  // Selection flow state
  const [step, setStep] = useState<'type' | 'paper' | 'unit' | 'confirm'>('type');
  const [selectedType, setSelectedType] = useState<ExamType | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperSize | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<typeof ATP_UNITS[number] | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Trigger preloading when page loads
  useEffect(() => {
    async function initPreloading() {
      try {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
          // Start preloading likely exams in background
          onExamsPageVisit();
        }
      } catch (error) {
        console.error('Failed to init preloading:', error);
      }
    }
    initPreloading();
  }, [getIdToken, setAuthToken, onExamsPageVisit]);

  const openModal = () => {
    setStep('type');
    setSelectedType(null);
    setSelectedPaper(null);
    setSelectedUnit(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleTypeSelect = (type: ExamType) => {
    setSelectedType(type);
    setStep('paper');
  };

  const handlePaperSelect = (size: PaperSize) => {
    setSelectedPaper(size);
    setStep('unit');
  };

  const handleUnitSelect = (unit: typeof ATP_UNITS[number]) => {
    setSelectedUnit(unit);
    setStep('confirm');
  };

  const handleStartExam = () => {
    if (selectedUnit && selectedType && selectedPaper) {
      router.push(`/exams/${selectedUnit.id}?type=${selectedType}&paper=${selectedPaper}`);
    }
  };

  const goBack = () => {
    if (step === 'confirm') setStep('unit');
    else if (step === 'unit') setStep('paper');
    else if (step === 'paper') setStep('type');
    else closeModal();
  };

  const config = selectedType && selectedPaper ? PAPER_SIZES[selectedType][selectedPaper] : null;
  const examTypeInfo = EXAM_TYPES.find(t => t.id === selectedType);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Examinations</h1>
          <p className="text-muted-foreground mt-1">
            Practice with timed exams in multiple choice or CLE standard format.
          </p>
        </div>
        <Button onClick={openModal} size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Start New Exam
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Target className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">60</p>
                <p className="text-xs text-muted-foreground">Max Marks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-500/10 to-gray-500/5 border-gray-500/20 dark:from-gray-800/20 dark:to-gray-800/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/20 dark:bg-gray-700">
                <Timer className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">3h</p>
                <p className="text-xs text-muted-foreground">CLE Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-500/10 to-gray-500/5 border-gray-500/20 dark:from-gray-800/20 dark:to-gray-800/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/20 dark:bg-gray-700">
                <FileQuestion className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-xs text-muted-foreground">Exam Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <GraduationCap className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-muted-foreground">ATP Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exam Type Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {EXAM_TYPES.map((type) => (
          <Card
            key={type.id}
            className={`group cursor-pointer border-2 transition-all duration-300 hover:shadow-lg ${
              type.color === 'emerald'
                ? 'border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10'
                : 'border-gray-500/30 hover:border-gray-500/50 hover:shadow-gray-500/10'
            }`}
            onClick={() => {
              setSelectedType(type.id);
              setStep('paper');
              setModalOpen(true);
            }}
          >
            <CardHeader>
              <div className={`p-3 rounded-xl w-fit ${
                type.color === 'emerald' ? 'bg-emerald-500/10' : 'bg-gray-500/10 dark:bg-gray-800'
              }`}>
                <type.icon className={`h-6 w-6 ${
                  type.color === 'emerald' ? 'text-emerald-500' : 'text-gray-500'
                }`} />
              </div>
              <CardTitle className="text-lg mt-3">{type.name}</CardTitle>
              <CardDescription>{type.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                  const cfg = PAPER_SIZES[type.id][size];
                  return (
                    <div key={size} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                      <span className="font-medium">{cfg.label}</span>
                      <span className="text-muted-foreground">
                        {cfg.marks} marks · {cfg.time} min
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" className="w-full mt-4 gap-2 group-hover:bg-muted">
                Select Type
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ATP Units Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Units</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ATP_UNITS.map((unit) => {
            const Icon = ICON_MAP[unit.icon] || BookOpen;
            return (
              <Card
                key={unit.id}
                className="group cursor-pointer border hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5"
                onClick={() => {
                  setSelectedUnit(unit);
                  setStep('type');
                  setModalOpen(true);
                }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{(unit as any).code}</p>
                      <p className="font-medium text-sm truncate">{unit.name}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ANIMATED SELECTION MODAL */}
      {/* ============================================================ */}
      <AnimatedModal isOpen={modalOpen} onClose={closeModal} size="lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {step !== 'type' && (
              <button
                onClick={goBack}
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Step {step === 'type' ? 1 : step === 'paper' ? 2 : step === 'unit' ? 3 : 4} of 4
              </p>
              <h3 className="font-semibold">
                {step === 'type' && 'Select Exam Type'}
                {step === 'paper' && 'Select Paper Size'}
                {step === 'unit' && 'Select ATP Unit'}
                {step === 'confirm' && 'Confirm & Start'}
              </h3>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => {
              const stepIndex = step === 'type' ? 1 : step === 'paper' ? 2 : step === 'unit' ? 3 : 4;
              return (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    s <= stepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Exam Type */}
          {step === 'type' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-sm text-muted-foreground">
                Choose between multiple choice questions or CLE standard typed exams.
              </p>
              <div className="grid gap-3">
                {EXAM_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 ${
                      type.color === 'emerald'
                        ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                        : 'border-gray-500/30 bg-gray-500/5 hover:border-gray-500/50 dark:bg-gray-800/20'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${
                      type.color === 'emerald' ? 'bg-emerald-500/20' : 'bg-gray-500/20 dark:bg-gray-700'
                    }`}>
                      <type.icon className={`h-5 w-5 ${
                        type.color === 'emerald' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Paper Size */}
          {step === 'paper' && selectedType && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {selectedType === 'abcd' ? 'Multiple Choice' : 'CLE Standard'}
                </span>
                <span>Select your paper size</span>
              </div>
              <div className="grid gap-3">
                {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                  const cfg = PAPER_SIZES[selectedType][size];
                  const iconColors = {
                    mini: 'bg-amber-500/20 text-amber-600',
                    semi: 'bg-gray-500/20 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    full: 'bg-rose-500/20 text-rose-600',
                  };
                  return (
                    <button
                      key={size}
                      onClick={() => handlePaperSelect(size)}
                      className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/30 text-left transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-lg ${iconColors[size]}`}>
                            {size === 'mini' && <Zap className="h-5 w-5" />}
                            {size === 'semi' && <Target className="h-5 w-5" />}
                            {size === 'full' && <Award className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold">{cfg.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {cfg.questions} questions · {cfg.marks} marks
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {cfg.time} min
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Unit Selection */}
          {step === 'unit' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {selectedType === 'abcd' ? 'ABCD' : 'CLE'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                  {config?.label}
                </span>
                <span>Select ATP unit</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                {ATP_UNITS.map((unit) => {
                  const Icon = ICON_MAP[unit.icon] || BookOpen;
                  return (
                    <button
                      key={unit.id}
                      onClick={() => handleUnitSelect(unit)}
                      className="p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 text-left transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{(unit as any).code}</p>
                          <p className="text-sm font-medium truncate">{unit.name}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && selectedUnit && config && examTypeInfo && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">Ready to Start?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Review your exam settings below
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exam Type</span>
                  <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                    selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {examTypeInfo.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paper Size</span>
                  <span className="font-medium">{config.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{selectedUnit.name}</span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Questions</span>
                    <span className="font-medium">{config.questions}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Total Marks</span>
                    <span className="font-medium">{config.marks}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Time Limit</span>
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {config.time} minutes
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={goBack}>
                  Back
                </Button>
                <Button className="flex-1 gap-2" onClick={handleStartExam}>
                  Start Exam
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </AnimatedModal>
    </div>
  );
}
