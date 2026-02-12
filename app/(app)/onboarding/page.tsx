'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronRight, ChevronLeft, CheckCircle2, Sparkles,
  GraduationCap, BookOpen, Scale, Target, Clock, Brain,
  Flame, Calendar, Lightbulb, Trophy, Users, Briefcase,
  FileText, AlertCircle, Zap, Heart, Rocket
} from 'lucide-react';
import { ATP_UNITS } from '@/lib/constants/legal-content';

// ============================================================
// STEP CONFIGURATION - Each step is ONE focused question
// ============================================================

interface OnboardingStep {
  id: string;
  question: string;
  subtitle?: string;
  type: 'single' | 'multi' | 'input' | 'date' | 'slider' | 'info';
  field: keyof OnboardingData;
  options?: { id: string; label: string; description?: string; icon?: React.ElementType; emoji?: string; color?: string }[];
  validation?: (value: unknown, data: OnboardingData) => boolean;
  skipCondition?: (data: OnboardingData) => boolean;
  maxSelections?: number;
  inputProps?: Record<string, unknown>;
}

interface OnboardingData {
  // Welcome & Basic Info
  fullName: string;
  currentOccupation: string;
  yearsInLaw: string;
  // Experience
  hasAttemptedBar: boolean | null;
  previousAttempts: string;
  lawSchool: string;
  // Study Preferences
  preferredStudyTime: string;
  dailyStudyHours: string;
  weekendStudyHours: string;
  commitmentLevel: string;
  // Learning Style
  learningStyle: string;
  // Self Assessment
  confidenceLevel: string;
  weakUnits: string[];
  strongUnits: string[];
  biggestChallenge: string;
  // Goals & Timeline
  primaryGoal: string;
  targetExamDate: string;
  // Final
  wantsMentorship: boolean | null;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  // ===== WELCOME =====
  {
    id: 'welcome',
    question: 'Welcome to Ynai',
    subtitle: 'Your AI-powered path to the Kenyan Bar. Let us know a bit about you so we can create your perfect study plan.',
    type: 'info',
    field: 'fullName',
  },
  // ===== BASIC INFO =====
  {
    id: 'name',
    question: 'What should we call you?',
    subtitle: 'This helps us personalize your experience.',
    type: 'input',
    field: 'fullName',
    inputProps: { placeholder: 'Your first name', maxLength: 50 },
  },
  {
    id: 'occupation',
    question: 'What best describes your current role?',
    type: 'single',
    field: 'currentOccupation',
    options: [
      { id: 'law_student', label: 'Law Student', description: 'Currently pursuing LLB', icon: GraduationCap, emoji: '📚' },
      { id: 'llb_graduate', label: 'LLB Graduate', description: 'Completed LLB, preparing for bar', icon: BookOpen, emoji: '🎓' },
      { id: 'paralegal', label: 'Paralegal', description: 'Working in legal practice', icon: FileText, emoji: '📋' },
      { id: 'advocate', label: 'Advocate', description: 'Already admitted, seeking refresher', icon: Scale, emoji: '⚖️' },
      { id: 'career_change', label: 'Career Changer', description: 'New to legal field', icon: Briefcase, emoji: '🔄' },
    ],
  },
  {
    id: 'years',
    question: 'How many years have you studied or practiced law?',
    type: 'single',
    field: 'yearsInLaw',
    options: [
      { id: '0', label: 'Just starting', emoji: '🌱' },
      { id: '1-2', label: '1-2 years', emoji: '📖' },
      { id: '3-4', label: '3-4 years', emoji: '📚' },
      { id: '5+', label: '5+ years', emoji: '🏆' },
    ],
  },
  // ===== BAR EXAM EXPERIENCE =====
  {
    id: 'attempted',
    question: 'Have you attempted the Kenya Bar Exam before?',
    type: 'single',
    field: 'hasAttemptedBar',
    options: [
      { id: 'true', label: 'Yes, I have', emoji: '✋', description: 'First attempt or retake' },
      { id: 'false', label: 'No, this is my first time', emoji: '🌟', description: 'Fresh start!' },
    ],
  },
  {
    id: 'attempts',
    question: 'How many times have you attempted the bar?',
    subtitle: 'This helps us understand your journey and tailor support.',
    type: 'single',
    field: 'previousAttempts',
    skipCondition: (data) => data.hasAttemptedBar !== true,
    options: [
      { id: '1', label: 'Once', emoji: '1️⃣' },
      { id: '2', label: 'Twice', emoji: '2️⃣' },
      { id: '3+', label: 'Three or more', emoji: '🔄' },
    ],
  },
  // ===== STUDY PREFERENCES =====
  {
    id: 'studytime',
    question: 'When do you prefer to study?',
    subtitle: 'We\'ll schedule your most important tasks during peak hours.',
    type: 'single',
    field: 'preferredStudyTime',
    options: [
      { id: 'morning', label: 'Early Bird', description: '5am - 10am', emoji: '🌅' },
      { id: 'afternoon', label: 'Afternoon', description: '11am - 4pm', emoji: '☀️' },
      { id: 'evening', label: 'Evening', description: '5pm - 9pm', emoji: '🌆' },
      { id: 'night', label: 'Night Owl', description: '9pm - 1am', emoji: '🌙' },
      { id: 'flexible', label: 'Flexible', description: 'Varies day to day', emoji: '🔀' },
    ],
  },
  {
    id: 'dailyhours',
    question: 'How many hours can you dedicate daily?',
    subtitle: 'Be realistic - consistency beats intensity.',
    type: 'single',
    field: 'dailyStudyHours',
    options: [
      { id: '1', label: '1 hour', description: 'Light commitment', color: 'bg-blue-500' },
      { id: '2', label: '2 hours', description: 'Moderate pace', color: 'bg-green-500' },
      { id: '3', label: '3 hours', description: 'Dedicated study', color: 'bg-yellow-500' },
      { id: '4+', label: '4+ hours', description: 'Intensive prep', color: 'bg-orange-500' },
    ],
  },
  {
    id: 'weekendhours',
    question: 'What about weekends?',
    type: 'single',
    field: 'weekendStudyHours',
    options: [
      { id: '0', label: 'Weekends Off', description: 'Rest and recharge', emoji: '😴' },
      { id: '2-3', label: '2-3 hours/day', description: 'Light weekend study', emoji: '📖' },
      { id: '4-5', label: '4-5 hours/day', description: 'Significant weekend time', emoji: '📚' },
      { id: '6+', label: '6+ hours/day', description: 'Weekend warrior', emoji: '💪' },
    ],
  },
  {
    id: 'commitment',
    question: 'How would you describe your commitment level?',
    subtitle: 'This helps us set appropriate daily targets.',
    type: 'single',
    field: 'commitmentLevel',
    options: [
      { id: 'casual', label: 'Casual', description: 'Steady but relaxed pace', emoji: '🌊', color: 'bg-blue-500' },
      { id: 'moderate', label: 'Moderate', description: 'Balanced approach', emoji: '⚖️', color: 'bg-green-500' },
      { id: 'intensive', label: 'Intensive', description: 'Going all in', emoji: '🔥', color: 'bg-orange-500' },
    ],
  },
  // ===== LEARNING STYLE =====
  {
    id: 'learningstyle',
    question: 'How do you learn best?',
    subtitle: 'We\'ll prioritize content in your preferred format.',
    type: 'single',
    field: 'learningStyle',
    options: [
      { id: 'reading', label: 'Reading', description: 'Text-based learning', emoji: '📖', icon: BookOpen },
      { id: 'practice', label: 'Practice', description: 'Hands-on exercises & quizzes', emoji: '✍️', icon: FileText },
      { id: 'visual', label: 'Visual', description: 'Diagrams & structured notes', emoji: '👁️', icon: Lightbulb },
      { id: 'mixed', label: 'Mixed', description: 'Combination of styles', emoji: '🎯', icon: Brain },
    ],
  },
  // ===== SELF ASSESSMENT =====
  {
    id: 'confidence',
    question: 'How confident do you feel about passing?',
    subtitle: 'Be honest - we\'re here to help, not judge.',
    type: 'single',
    field: 'confidenceLevel',
    options: [
      { id: '1-3', label: 'Not very confident', description: 'I need significant preparation', emoji: '😰' },
      { id: '4-6', label: 'Somewhat confident', description: 'I have gaps to fill', emoji: '🤔' },
      { id: '7-8', label: 'Fairly confident', description: 'Just need fine-tuning', emoji: '😊' },
      { id: '9-10', label: 'Very confident', description: 'Ready to ace this', emoji: '💪' },
    ],
  },
  {
    id: 'weakareas',
    question: 'Which areas do you struggle with most?',
    subtitle: 'Select up to 3 units. We\'ll focus extra attention here.',
    type: 'multi',
    field: 'weakUnits',
    maxSelections: 3,
    options: ATP_UNITS.map(unit => ({
      id: unit.id,
      label: unit.name,
      description: unit.code,
    })),
  },
  {
    id: 'strongareas',
    question: 'Which areas are you already strong in?',
    subtitle: 'We\'ll still review these but at a lighter pace.',
    type: 'multi',
    field: 'strongUnits',
    maxSelections: 4,
    options: ATP_UNITS.map(unit => ({
      id: unit.id,
      label: unit.name,
      description: unit.code,
    })),
  },
  {
    id: 'challenge',
    question: 'What\'s your biggest challenge?',
    type: 'single',
    field: 'biggestChallenge',
    options: [
      { id: 'time', label: 'Finding time to study', emoji: '⏰', icon: Clock },
      { id: 'focus', label: 'Staying focused', emoji: '🎯', icon: Target },
      { id: 'understanding', label: 'Understanding concepts', emoji: '🤯', icon: Brain },
      { id: 'retention', label: 'Remembering what I learn', emoji: '💭', icon: Lightbulb },
      { id: 'application', label: 'Applying law to facts', emoji: '⚖️', icon: Scale },
      { id: 'motivation', label: 'Staying motivated', emoji: '😓', icon: Flame },
    ],
  },
  // ===== GOALS & TIMELINE =====
  {
    id: 'goal',
    question: 'What\'s your primary goal?',
    type: 'single',
    field: 'primaryGoal',
    options: [
      { id: 'pass_first', label: 'Pass on first attempt', emoji: '🎯', icon: Target },
      { id: 'pass_retake', label: 'Pass this retake', emoji: '🔄', icon: CheckCircle2 },
      { id: 'excel', label: 'Excel with high marks', emoji: '🌟', icon: Trophy },
      { id: 'thorough', label: 'Thorough preparation', emoji: '📚', icon: BookOpen },
    ],
  },
  {
    id: 'examdate',
    question: 'When is your target exam date?',
    subtitle: 'We\'ll work backwards to create your perfect schedule.',
    type: 'date',
    field: 'targetExamDate',
    inputProps: { min: new Date().toISOString().split('T')[0] },
  },
  // ===== FINAL =====
  {
    id: 'mentorship',
    question: 'Would you like AI mentorship?',
    subtitle: 'Our AI tutor will guide you daily with personalized tasks and motivation.',
    type: 'single',
    field: 'wantsMentorship',
    options: [
      { id: 'true', label: 'Yes, guide me!', description: 'Leave it to us - we\'ll prepare you', emoji: '🤝', icon: Heart },
      { id: 'false', label: 'Self-directed', description: 'I\'ll set my own pace', emoji: '🗺️', icon: Rocket },
    ],
  },
  {
    id: 'complete',
    question: 'You\'re all set!',
    subtitle: 'We\'re creating your personalized study plan right now.',
    type: 'info',
    field: 'fullName',
  },
];

// ============================================================
// COMPONENT
// ============================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const [formData, setFormData] = useState<OnboardingData>({
    fullName: user?.displayName?.split(' ')[0] || '',
    currentOccupation: '',
    yearsInLaw: '',
    hasAttemptedBar: null,
    previousAttempts: '',
    lawSchool: '',
    preferredStudyTime: '',
    dailyStudyHours: '',
    weekendStudyHours: '',
    commitmentLevel: '',
    learningStyle: '',
    confidenceLevel: '',
    weakUnits: [],
    strongUnits: [],
    biggestChallenge: '',
    primaryGoal: '',
    targetExamDate: '',
    wantsMentorship: null,
  });

  // Filter steps based on skip conditions
  const activeSteps = ONBOARDING_STEPS.filter(
    step => !step.skipCondition || !step.skipCondition(formData)
  );
  
  const currentStep = activeSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / activeSteps.length) * 100;
  const isLastStep = currentStepIndex === activeSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Pre-populate name from auth
  useEffect(() => {
    if (user?.displayName && !formData.fullName) {
      setFormData(prev => ({ 
        ...prev, 
        fullName: user.displayName?.split(' ')[0] || '' 
      }));
    }
  }, [user, formData.fullName]);

  const handleSingleSelect = (optionId: string) => {
    const field = currentStep.field;
    
    // Handle boolean fields
    if (field === 'hasAttemptedBar' || field === 'wantsMentorship') {
      setFormData(prev => ({ ...prev, [field]: optionId === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: optionId }));
    }
    
    // Auto-advance after selection (with slight delay for visual feedback)
    setTimeout(() => {
      if (!isLastStep) handleNext();
    }, 300);
  };

  const handleMultiSelect = (optionId: string) => {
    const field = currentStep.field as 'weakUnits' | 'strongUnits';
    const currentValues = formData[field] as string[];
    const maxSelections = currentStep.maxSelections || 5;
    
    if (currentValues.includes(optionId)) {
      setFormData(prev => ({ 
        ...prev, 
        [field]: currentValues.filter(v => v !== optionId) 
      }));
    } else if (currentValues.length < maxSelections) {
      setFormData(prev => ({ 
        ...prev, 
        [field]: [...currentValues, optionId] 
      }));
    }
  };

  const handleInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, [currentStep.field]: value }));
  };

  const handleNext = () => {
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setShowConfetti(true);
    
    try {
      const token = await getIdToken();
      
      // Transform data for API
      const apiData = {
        ...formData,
        yearsInLaw: parseInt(formData.yearsInLaw.replace('+', '')) || 0,
        dailyStudyHours: parseInt(formData.dailyStudyHours.replace('+', '')) || 2,
        weekendStudyHours: parseInt(formData.weekendStudyHours.replace('+', '').split('-')[0]) || 0,
        confidenceLevel: parseInt(formData.confidenceLevel.split('-')[0]) || 5,
        previousAttempts: parseInt(formData.previousAttempts.replace('+', '')) || 0,
      };
      
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(apiData),
      });
      
      // Navigate to tutor dashboard if they opted for mentorship
      if (formData.wantsMentorship) {
        router.push('/tutor');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setIsSubmitting(false);
      setShowConfetti(false);
    }
  };

  const canProceed = () => {
    if (currentStep.type === 'info') return true;
    
    const value = formData[currentStep.field];
    
    if (currentStep.type === 'multi') {
      return (value as string[]).length > 0;
    }
    
    if (currentStep.type === 'date') {
      // Date is optional, can skip
      return true;
    }
    
    return value !== '' && value !== null;
  };

  // ============================================================
  // RENDER
  // ============================================================

  const renderStepContent = () => {
    switch (currentStep.type) {
      case 'info':
        return (
          <div className="text-center space-y-8 animate-fade-in py-8">
            {currentStep.id === 'welcome' ? (
              <>
                <div className="relative">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center animate-pulse-slow">
                    <Scale className="w-12 h-12 text-primary" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-500 animate-bounce" style={{ left: '60%' }} />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {currentStep.question}
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {currentStep.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  {[
                    { icon: Brain, label: 'AI-Powered Learning', color: 'text-purple-500' },
                    { icon: Flame, label: 'Spaced Repetition', color: 'text-orange-500' },
                    { icon: Calendar, label: 'Smart Scheduling', color: 'text-blue-500' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {showConfetti && (
                  <div className="fixed inset-0 pointer-events-none z-50">
                    {/* Simple confetti animation */}
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-3 h-3 rounded-full animate-confetti"
                        style={{
                          left: `${Math.random() * 100}%`,
                          backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][i % 5],
                          animationDelay: `${Math.random() * 0.5}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-14 h-14 text-green-500 animate-bounce-slow" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold">{currentStep.question}</h1>
                  <p className="text-muted-foreground">{currentStep.subtitle}</p>
                </div>
                <div className="max-w-sm mx-auto space-y-4 text-left p-6 rounded-2xl bg-secondary/30">
                  <h3 className="font-semibold text-center mb-4">Your Study Profile</h3>
                  {[
                    { label: 'Commitment', value: formData.commitmentLevel || 'Moderate', emoji: '🎯' },
                    { label: 'Daily Hours', value: formData.dailyStudyHours ? `${formData.dailyStudyHours}h` : '2h', emoji: '⏱️' },
                    { label: 'Focus Areas', value: formData.weakUnits.length > 0 ? `${formData.weakUnits.length} units` : 'All units', emoji: '📚' },
                    { label: 'AI Mentorship', value: formData.wantsMentorship ? 'Enabled' : 'Self-directed', emoji: '🤖' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="flex items-center gap-2">
                        <span>{item.emoji}</span>
                        <span className="text-muted-foreground">{item.label}</span>
                      </span>
                      <span className="font-medium capitalize">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case 'single':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold">{currentStep.question}</h2>
              {currentStep.subtitle && (
                <p className="text-muted-foreground">{currentStep.subtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {currentStep.options?.map((option) => {
                const fieldValue = formData[currentStep.field];
                const isSelected = typeof fieldValue === 'boolean' 
                  ? fieldValue === (option.id === 'true')
                  : fieldValue === option.id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSingleSelect(option.id)}
                    className={`group relative p-4 rounded-2xl border-2 transition-all duration-200 text-left hover:scale-[1.02] ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {option.emoji && (
                        <span className="text-2xl flex-shrink-0">{option.emoji}</span>
                      )}
                      {option.color && (
                        <div className={`w-3 h-3 rounded-full ${option.color} flex-shrink-0 mt-1`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{option.label}</div>
                        {option.description && (
                          <div className="text-sm text-muted-foreground mt-0.5">{option.description}</div>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'multi':
        const multiField = currentStep.field as 'weakUnits' | 'strongUnits';
        const selectedValues = formData[multiField] as string[];
        const otherField = multiField === 'weakUnits' ? 'strongUnits' : 'weakUnits';
        const disabledValues = formData[otherField] as string[];
        
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">{currentStep.question}</h2>
              {currentStep.subtitle && (
                <p className="text-muted-foreground">{currentStep.subtitle}</p>
              )}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className={selectedValues.length > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  {selectedValues.length} selected
                </span>
                <span className="text-muted-foreground">/ {currentStep.maxSelections} max</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {currentStep.options?.map((option) => {
                const isSelected = selectedValues.includes(option.id);
                const isDisabled = disabledValues.includes(option.id);
                const isMaxed = selectedValues.length >= (currentStep.maxSelections || 5) && !isSelected;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => !isDisabled && !isMaxed && handleMultiSelect(option.id)}
                    disabled={isDisabled || isMaxed}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                        : isDisabled
                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed line-through'
                        : isMaxed
                        ? 'bg-secondary text-secondary-foreground opacity-50 cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-105'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {(multiField === 'strongUnits' && disabledValues.length > 0) && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Areas marked as weak are disabled
              </p>
            )}
          </div>
        );

      case 'input':
        return (
          <div className="space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold">{currentStep.question}</h2>
              {currentStep.subtitle && (
                <p className="text-muted-foreground">{currentStep.subtitle}</p>
              )}
            </div>
            <Input
              value={formData[currentStep.field] as string}
              onChange={(e) => handleInputChange(e.target.value)}
              className="text-center text-lg h-14 rounded-xl"
              autoFocus
              {...currentStep.inputProps}
            />
          </div>
        );

      case 'date':
        return (
          <div className="space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold">{currentStep.question}</h2>
              {currentStep.subtitle && (
                <p className="text-muted-foreground">{currentStep.subtitle}</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-4">
              <Input
                type="date"
                value={formData[currentStep.field] as string}
                onChange={(e) => handleInputChange(e.target.value)}
                className="text-center text-lg h-14 rounded-xl max-w-xs"
                {...currentStep.inputProps}
              />
              <button
                onClick={handleNext}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Skip - I&apos;ll set this later
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-50">
        <div 
          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="fixed top-4 right-4 px-3 py-1.5 rounded-full bg-secondary/80 backdrop-blur text-sm font-medium z-40">
        {currentStepIndex + 1} / {activeSteps.length}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
            className="gap-2 rounded-xl h-12 px-6"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          {isLastStep ? (
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="gap-2 rounded-xl h-12 px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating your plan...
                </>
              ) : (
                <>
                  Start My Journey
                  <Rocket className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : currentStep.type === 'info' ? (
            <Button 
              onClick={handleNext}
              className="gap-2 rounded-xl h-12 px-8"
            >
              Let&apos;s Begin
              <Sparkles className="w-4 h-4" />
            </Button>
          ) : currentStep.type === 'single' ? (
            // Single select auto-advances, but show a continue button as backup
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              variant="ghost"
              className="gap-2 rounded-xl h-12 px-6 opacity-50 hover:opacity-100"
            >
              Skip
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2 rounded-xl h-12 px-8"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
        @keyframes confetti {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti 3s ease-in-out forwards;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
