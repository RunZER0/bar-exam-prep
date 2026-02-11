'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ATP_UNITS, DIFFICULTY_LEVELS } from '@/lib/constants/legal-content';
import {
  Gavel,
  Scale,
  FileText,
  Shield,
  Building,
  Briefcase,
  Users,
  BookOpen,
  Building2,
  Handshake,
  Calculator,
  ClipboardCheck,
  Clock,
  ArrowRight,
  X,
  PenTool,
  Mic,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users, BookOpen, Building2, Handshake, Calculator, PenTool, Mic, TrendingUp,
};

const EXAM_CONFIG = {
  beginner: { questions: 15, time: 30, label: '15 questions', sublabel: '30 min' },
  intermediate: { questions: 25, time: 60, label: '25 questions', sublabel: '60 min' },
  advanced: { questions: 40, time: 90, label: '40 questions', sublabel: '90 min (CLE standard)' },
};

export default function ExamsPage() {
  const router = useRouter();
  const [selectedUnit, setSelectedUnit] = useState<typeof ATP_UNITS[number] | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [step, setStep] = useState<'difficulty' | 'confirm'>('difficulty');

  // Reset step when unit changes
  useEffect(() => {
    if (selectedUnit) {
      setStep('difficulty');
      setSelectedDifficulty(null);
    }
  }, [selectedUnit]);

  const handleDifficultySelect = (difficultyId: string) => {
    setSelectedDifficulty(difficultyId);
    setStep('confirm');
  };

  const handleStartExam = () => {
    if (selectedUnit && selectedDifficulty) {
      router.push(`/exams/${selectedUnit.id}?difficulty=${selectedDifficulty}`);
    }
  };

  const closeModal = () => {
    setSelectedUnit(null);
    setSelectedDifficulty(null);
    setStep('difficulty');
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Examinations</h1>
        <p className="text-muted-foreground mt-1">
          Select an ATP unit to start your examination.
        </p>
      </div>

      {/* Unit cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATP_UNITS.map((unit) => {
          const Icon = ICON_MAP[unit.icon] || BookOpen;
          return (
            <Card
              key={unit.id}
              className="group cursor-pointer border-2 border-transparent hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              onClick={() => setSelectedUnit(unit)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {(unit as any).code}
                  </span>
                </div>
                <CardTitle className="text-base mt-3">{unit.name}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {unit.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  <span>Exam available</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal overlay */}
      {selectedUnit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Modal */}
          <div 
            className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = ICON_MAP[selectedUnit.icon] || BookOpen;
                  return (
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  );
                })()}
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{(selectedUnit as any).code}</p>
                  <h3 className="font-semibold">{selectedUnit.name}</h3>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {step === 'difficulty' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Select Difficulty</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose the exam level that matches your preparation.
                    </p>
                  </div>
                  
                  <div className="grid gap-3">
                    {DIFFICULTY_LEVELS.map((d) => {
                      const config = EXAM_CONFIG[d.id as keyof typeof EXAM_CONFIG];
                      const colorMap: Record<string, string> = {
                        emerald: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50',
                        amber: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50',
                        rose: 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50',
                      };
                      const dotColor: Record<string, string> = {
                        emerald: 'bg-emerald-500',
                        amber: 'bg-amber-500',
                        rose: 'bg-rose-500',
                      };
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleDifficultySelect(d.id)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${colorMap[d.color]}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full ${dotColor[d.color]}`} />
                              <div>
                                <p className="font-medium">{d.name}</p>
                                <p className="text-xs text-muted-foreground">{d.description}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{config?.label}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {config?.sublabel}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 'confirm' && selectedDifficulty && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <h4 className="font-semibold text-lg">Ready to Start?</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You are about to start a {selectedDifficulty} level exam on {selectedUnit.name}.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unit</span>
                      <span className="font-medium">{selectedUnit.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Difficulty</span>
                      <span className="font-medium capitalize">{selectedDifficulty}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Questions</span>
                      <span className="font-medium">{EXAM_CONFIG[selectedDifficulty as keyof typeof EXAM_CONFIG]?.label}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time Limit</span>
                      <span className="font-medium">{EXAM_CONFIG[selectedDifficulty as keyof typeof EXAM_CONFIG]?.sublabel}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setStep('difficulty')}
                    >
                      Back
                    </Button>
                    <Button 
                      className="flex-1 gap-2"
                      onClick={handleStartExam}
                    >
                      Start Exam
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
