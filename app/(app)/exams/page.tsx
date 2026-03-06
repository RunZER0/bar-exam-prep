'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
          relative bg-background rounded-2xl shadow-2xl shadow-black/20 w-full ${sizeClasses[size]}
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
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Examinations</h1>
          <p className="text-muted-foreground mt-1">
            Test your mastery under timed conditions
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Start New Exam
        </button>
      </div>

      {/* Quick Stats — borderless gradient tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Target, value: '60', label: 'Max Marks', gradient: 'from-emerald-500/8 to-transparent', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-600' },
          { icon: Timer, value: '3h', label: 'CLE Time', gradient: 'from-sky-500/8 to-transparent', iconBg: 'bg-sky-500/15', iconColor: 'text-sky-600' },
          { icon: FileQuestion, value: '2', label: 'Exam Types', gradient: 'from-violet-500/8 to-transparent', iconBg: 'bg-violet-500/15', iconColor: 'text-violet-600' },
          { icon: GraduationCap, value: '12', label: 'ATP Units', gradient: 'from-amber-500/8 to-transparent', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-600' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.gradient} p-5`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exam Type Sections — gradient zones, no card borders */}
      <div className="grid md:grid-cols-2 gap-6">
        {EXAM_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              setStep('paper');
              setModalOpen(true);
            }}
            className={`group text-left rounded-2xl p-6 transition-all duration-300 ${
              type.color === 'emerald'
                ? 'bg-gradient-to-br from-emerald-500/8 via-emerald-500/4 to-transparent hover:from-emerald-500/14 hover:shadow-lg hover:shadow-emerald-500/5'
                : 'bg-gradient-to-br from-stone-500/8 via-stone-400/4 to-transparent hover:from-stone-500/14 hover:shadow-lg hover:shadow-stone-500/5 dark:from-stone-400/8 dark:via-stone-400/4'
            }`}
          >
            <div className={`p-3 rounded-xl w-fit mb-4 ${
              type.color === 'emerald' ? 'bg-emerald-500/12' : 'bg-stone-500/12 dark:bg-stone-400/12'
            }`}>
              <type.icon className={`h-6 w-6 ${
                type.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-400'
              }`} />
            </div>
            <h3 className="text-lg font-semibold mb-1">{type.name}</h3>
            <p className="text-sm text-muted-foreground mb-5">{type.description}</p>
            <div className="space-y-2.5">
              {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                const cfg = PAPER_SIZES[type.id][size];
                return (
                  <div key={size} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                    <span className="font-medium">{cfg.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {cfg.marks} marks · {cfg.time} min
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary opacity-60 group-hover:opacity-100 transition-opacity">
              Select
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>

      {/* ATP Units Grid — minimal tiles */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Units</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ATP_UNITS.map((unit) => {
            const Icon = ICON_MAP[unit.icon] || BookOpen;
            return (
              <button
                key={unit.id}
                className="group text-left rounded-xl p-4 bg-gradient-to-br from-muted/40 to-transparent hover:from-primary/6 hover:to-transparent transition-all duration-300"
                onClick={() => {
                  setSelectedUnit(unit);
                  setStep('type');
                  setModalOpen(true);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/8 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{(unit as any).code}</p>
                    <p className="font-medium text-sm truncate">{unit.name}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTION MODAL — soft glow, no harsh outlines */}
      <AnimatedModal isOpen={modalOpen} onClose={closeModal} size="lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/30">
          <div className="flex items-center gap-3">
            {step !== 'type' && (
              <button
                onClick={goBack}
                className="p-2 -ml-2 rounded-lg hover:bg-muted/60 transition-colors"
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
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => {
              const stepIndex = step === 'type' ? 1 : step === 'paper' ? 2 : step === 'unit' ? 3 : 4;
              return (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    s <= stepIndex ? 'bg-primary' : 'bg-muted/60'
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
                Choose your exam format to get started.
              </p>
              <div className="grid gap-3">
                {EXAM_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className={`w-full p-5 rounded-2xl text-left transition-all duration-200 flex items-center gap-4 ${
                      type.color === 'emerald'
                        ? 'bg-gradient-to-r from-emerald-500/8 to-transparent hover:from-emerald-500/15 hover:shadow-md hover:shadow-emerald-500/5'
                        : 'bg-gradient-to-r from-stone-500/8 to-transparent hover:from-stone-500/15 hover:shadow-md hover:shadow-stone-500/5 dark:from-stone-400/8'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${
                      type.color === 'emerald' ? 'bg-emerald-500/15' : 'bg-stone-500/15 dark:bg-stone-400/15'
                    }`}>
                      <type.icon className={`h-5 w-5 ${
                        type.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
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
                  selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400'
                }`}>
                  {selectedType === 'abcd' ? 'Multiple Choice' : 'CLE Standard'}
                </span>
                <span>Select your paper size</span>
              </div>
              <div className="grid gap-3">
                {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                  const cfg = PAPER_SIZES[selectedType][size];
                  const gradients = {
                    mini: 'from-amber-500/8 to-transparent hover:from-amber-500/14 hover:shadow-amber-500/5',
                    semi: 'from-sky-500/8 to-transparent hover:from-sky-500/14 hover:shadow-sky-500/5',
                    full: 'from-rose-500/8 to-transparent hover:from-rose-500/14 hover:shadow-rose-500/5',
                  };
                  const iconColors = {
                    mini: 'bg-amber-500/15 text-amber-600',
                    semi: 'bg-sky-500/15 text-sky-600',
                    full: 'bg-rose-500/15 text-rose-600',
                  };
                  return (
                    <button
                      key={size}
                      onClick={() => handlePaperSelect(size)}
                      className={`w-full p-4 rounded-2xl bg-gradient-to-r ${gradients[size]} text-left transition-all duration-200 hover:shadow-md`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl ${iconColors[size]}`}>
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
                          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <Clock className="h-4 w-4" />
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
                  selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400'
                }`}>
                  {selectedType === 'abcd' ? 'ABCD' : 'CLE'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60">
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
                      className="p-3 rounded-xl bg-gradient-to-r from-muted/30 to-transparent hover:from-primary/8 text-left transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{(unit as any).code}</p>
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
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">Ready to Start?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Review your exam settings below
                </p>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-muted/40 to-transparent p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exam Type</span>
                  <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                    selectedType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400'
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
                <div className="border-t border-border/20 pt-3 mt-3">
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
                <button onClick={goBack} className="flex-1 py-2.5 rounded-xl border border-border/30 hover:bg-muted/40 transition-colors font-medium text-sm">
                  Back
                </button>
                <button onClick={handleStartExam} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm flex items-center justify-center gap-2">
                  Start Exam
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AnimatedModal>
    </div>
  );
}
