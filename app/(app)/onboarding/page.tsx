'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  GraduationCap, Briefcase, Target, Clock, Brain, Zap, 
  ChevronRight, ChevronLeft, CheckCircle2, Flame, BookOpen,
  Scale, FileText, Users
} from 'lucide-react';
import { ATP_UNITS } from '@/lib/constants/legal-content';

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Scale },
  { id: 'background', title: 'Background', icon: GraduationCap },
  { id: 'goals', title: 'Goals', icon: Target },
  { id: 'schedule', title: 'Schedule', icon: Clock },
  { id: 'assessment', title: 'Assessment', icon: Brain },
  { id: 'complete', title: 'Complete', icon: CheckCircle2 },
];

const OCCUPATIONS = [
  { id: 'law_student', label: 'Law Student', icon: GraduationCap },
  { id: 'llb_graduate', label: 'LLB Graduate', icon: BookOpen },
  { id: 'paralegal', label: 'Paralegal', icon: FileText },
  { id: 'advocate', label: 'Practicing Advocate', icon: Scale },
  { id: 'other', label: 'Other Legal Professional', icon: Users },
];

const STUDY_TIMES = [
  { id: 'morning', label: 'Morning', description: '6am - 12pm', emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon', description: '12pm - 5pm', emoji: '☀️' },
  { id: 'evening', label: 'Evening', description: '5pm - 10pm', emoji: '🌆' },
  { id: 'night', label: 'Night Owl', description: '10pm - 2am', emoji: '🌙' },
];

const STUDY_PACES = [
  { id: 'relaxed', label: 'Relaxed', description: '2-3 hours/week', color: 'bg-blue-500' },
  { id: 'moderate', label: 'Moderate', description: '5-7 hours/week', color: 'bg-green-500' },
  { id: 'intensive', label: 'Intensive', description: '10+ hours/week', color: 'bg-orange-500' },
];

const GOALS = [
  { id: 'pass_bar', label: 'Pass the Bar Exam', icon: CheckCircle2 },
  { id: 'improve_drafting', label: 'Improve Legal Drafting', icon: FileText },
  { id: 'master_research', label: 'Master Legal Research', icon: BookOpen },
  { id: 'oral_advocacy', label: 'Excel in Oral Advocacy', icon: Users },
  { id: 'all_competencies', label: 'Master All Competencies', icon: Zap },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    occupation: '',
    yearsOfStudy: '',
    targetExamDate: '',
    studyPace: 'moderate',
    preferredStudyTime: '',
    dailyStudyGoal: 60,
    weeklyQuizGoal: 3,
    weakAreas: [] as string[],
    strongAreas: [] as string[],
    goals: [] as string[],
    learningStyle: '',
  });

  const toggleArrayItem = (array: string[], item: string): string[] => {
    return array.includes(item) 
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Scale className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome to Ynai, {user?.displayName?.split(' ')[0] || 'Future Advocate'}!
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Let&apos;s personalize your Kenya Bar Exam preparation. Answer a few questions 
                so we can create a study plan tailored for your success at Kenya School of Law.
              </p>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Track your streaks</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span>Adaptive learning</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>AI-powered</span>
              </div>
            </div>
          </div>
        );

      case 'background':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">What best describes you?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OCCUPATIONS.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => setFormData({ ...formData, occupation: occ.id })}
                    className={`mode-button flex-row justify-start ${
                      formData.occupation === occ.id ? 'selected' : ''
                    }`}
                  >
                    <occ.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{occ.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Years of legal study/experience
              </label>
              <Input
                type="number"
                min="0"
                max="20"
                value={formData.yearsOfStudy}
                onChange={(e) => setFormData({ ...formData, yearsOfStudy: e.target.value })}
                placeholder="e.g., 4"
                className="max-w-32"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Target exam date (optional)
              </label>
              <Input
                type="date"
                value={formData.targetExamDate}
                onChange={(e) => setFormData({ ...formData, targetExamDate: e.target.value })}
                className="max-w-48"
              />
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">What are your main goals? (Select all that apply)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => setFormData({ 
                      ...formData, 
                      goals: toggleArrayItem(formData.goals, goal.id) 
                    })}
                    className={`mode-button flex-row justify-start ${
                      formData.goals.includes(goal.id) ? 'selected' : ''
                    }`}
                  >
                    <goal.icon className={`w-5 h-5 ${formData.goals.includes(goal.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-medium">{goal.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Which areas do you find challenging? (Select 1-3)</h3>
              <div className="flex flex-wrap gap-2">
                {ATP_UNITS.slice(0, 8).map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => {
                      if (formData.weakAreas.length < 3 || formData.weakAreas.includes(unit.id)) {
                        setFormData({ 
                          ...formData, 
                          weakAreas: toggleArrayItem(formData.weakAreas, unit.id) 
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      formData.weakAreas.includes(unit.id)
                        ? 'bg-orange-500 text-white'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">When do you prefer to study?</h3>
              <div className="grid grid-cols-2 gap-3">
                {STUDY_TIMES.map((time) => (
                  <button
                    key={time.id}
                    onClick={() => setFormData({ ...formData, preferredStudyTime: time.id })}
                    className={`mode-button ${
                      formData.preferredStudyTime === time.id ? 'selected' : ''
                    }`}
                  >
                    <span className="text-3xl">{time.emoji}</span>
                    <span className="font-medium">{time.label}</span>
                    <span className="text-xs text-muted-foreground">{time.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Study intensity</h3>
              <div className="grid grid-cols-3 gap-3">
                {STUDY_PACES.map((pace) => (
                  <button
                    key={pace.id}
                    onClick={() => setFormData({ ...formData, studyPace: pace.id })}
                    className={`mode-button ${
                      formData.studyPace === pace.id ? 'selected' : ''
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${pace.color}`} />
                    <span className="font-medium">{pace.label}</span>
                    <span className="text-xs text-muted-foreground">{pace.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Daily study goal (minutes)
                </label>
                <Input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={formData.dailyStudyGoal}
                  onChange={(e) => setFormData({ ...formData, dailyStudyGoal: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Weekly quiz goal
                </label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.weeklyQuizGoal}
                  onChange={(e) => setFormData({ ...formData, weeklyQuizGoal: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>
          </div>
        );

      case 'assessment':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">How do you learn best?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'visual', label: 'Visual', description: 'Diagrams, charts, videos', emoji: '👁️' },
                  { id: 'reading', label: 'Reading', description: 'Text-based materials', emoji: '📚' },
                  { id: 'practice', label: 'Practice', description: 'Hands-on exercises', emoji: '✍️' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setFormData({ ...formData, learningStyle: style.id })}
                    className={`mode-button ${
                      formData.learningStyle === style.id ? 'selected' : ''
                    }`}
                  >
                    <span className="text-2xl">{style.emoji}</span>
                    <span className="font-medium">{style.label}</span>
                    <span className="text-xs text-muted-foreground text-center">{style.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Which areas are you already confident in?</h3>
              <div className="flex flex-wrap gap-2">
                {ATP_UNITS.slice(0, 8).map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => {
                      if (!formData.weakAreas.includes(unit.id)) {
                        setFormData({ 
                          ...formData, 
                          strongAreas: toggleArrayItem(formData.strongAreas, unit.id) 
                        });
                      }
                    }}
                    disabled={formData.weakAreas.includes(unit.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      formData.strongAreas.includes(unit.id)
                        ? 'bg-primary text-primary-foreground'
                        : formData.weakAreas.includes(unit.id)
                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Areas marked as challenging are disabled
              </p>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re All Set!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                We&apos;ve created a personalized study plan based on your goals and preferences. 
                Your journey to becoming an advocate starts now!
              </p>
            </div>
            
            <Card className="max-w-sm mx-auto text-left">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Study pace</span>
                  <span className="font-medium capitalize">{formData.studyPace}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Daily goal</span>
                  <span className="font-medium">{formData.dailyStudyGoal} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Focus areas</span>
                  <span className="font-medium">{formData.weakAreas.length} topics</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl glass-card">
        <CardHeader className="text-center pb-2">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    index < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index === currentStep
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 transition-colors ${
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <CardTitle className="text-lg">{STEPS[currentStep].title}</CardTitle>
        </CardHeader>
        
        <CardContent className="min-h-[400px] flex flex-col">
          <div className="flex-1 py-6 animate-fade-in" key={currentStep}>
            {renderStepContent()}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="gap-2 min-w-32"
              >
                {isSubmitting ? 'Setting up...' : 'Start Learning'}
                <Zap className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleNext} className="gap-2">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
