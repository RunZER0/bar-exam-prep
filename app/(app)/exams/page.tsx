'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  Info,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users, BookOpen, Building2, Handshake, Calculator,
};

const EXAM_CONFIG = {
  beginner: { questions: 15, time: 30, label: '15 questions · 30 min' },
  intermediate: { questions: 25, time: 60, label: '25 questions · 60 min' },
  advanced: { questions: 40, time: 90, label: '40 questions · 90 min (CLE standard)' },
};

export default function ExamsPage() {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const unit = selectedUnit ? ATP_UNITS.find((u) => u.id === selectedUnit) : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Examinations</h1>
        <p className="text-muted-foreground mt-1">
          Take CLE-style exams by unit. Select a subject, choose difficulty, and test under timed conditions.
        </p>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium">How exams work</p>
            <p className="text-blue-700 mt-1">
              Exams follow the CLE format: multiple choice and essay questions covering the unit's
              core statutes and concepts. Your answers are AI-graded with detailed feedback. Advanced
              difficulty mirrors actual bar exam conditions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Unit selection */}
      <div>
        <h2 className="text-lg font-semibold mb-1">1. Select Unit</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose the ATP unit you want to be examined on.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ATP_UNITS.map((u) => {
            const Icon = ICON_MAP[u.icon] || BookOpen;
            const isSelected = selectedUnit === u.id;
            return (
              <Card
                key={u.id}
                className={`cursor-pointer border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'hover:border-muted-foreground/30'
                }`}
                onClick={() => {
                  setSelectedUnit(u.id);
                  setSelectedDifficulty(null);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <CardTitle className="text-sm">{u.name}</CardTitle>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Step 2: Difficulty */}
      {selectedUnit && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-semibold mb-1">2. Select Difficulty</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choose exam difficulty for <span className="font-medium text-foreground">{unit?.name}</span>.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
            {DIFFICULTY_LEVELS.map((d) => {
              const config = EXAM_CONFIG[d.id as keyof typeof EXAM_CONFIG];
              const isSelected = selectedDifficulty === d.id;
              const colorMap: Record<string, string> = {
                emerald: 'border-emerald-500 bg-emerald-50',
                amber: 'border-amber-500 bg-amber-50',
                rose: 'border-rose-500 bg-rose-50',
              };
              return (
                <Card
                  key={d.id}
                  className={`cursor-pointer border-2 transition-all ${
                    isSelected
                      ? colorMap[d.color] || 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setSelectedDifficulty(d.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{d.name}</CardTitle>
                    <CardDescription className="text-xs">{d.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {config?.label}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Start */}
      {selectedUnit && selectedDifficulty && (
        <div className="animate-fade-in">
          <Link
            href={`/exams/${selectedUnit}?difficulty=${selectedDifficulty}`}
          >
            <Button size="lg" className="gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Start Exam
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
