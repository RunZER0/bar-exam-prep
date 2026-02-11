'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ATP_UNITS } from '@/lib/constants/legal-content';
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
  ArrowRight,
  PenTool,
  Mic,
  TrendingUp,
  Sparkles,
  X,
  Loader2,
  Lightbulb,
  Target,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
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
  PenTool,
  Mic,
  TrendingUp,
};

const COLORS = [
  'bg-emerald-500/10 text-emerald-600 hover:border-emerald-500/40',
  'bg-red-500/10 text-red-600 hover:border-red-500/40',
  'bg-blue-500/10 text-blue-600 hover:border-blue-500/40',
  'bg-violet-500/10 text-violet-600 hover:border-violet-500/40',
  'bg-amber-500/10 text-amber-600 hover:border-amber-500/40',
  'bg-cyan-500/10 text-cyan-600 hover:border-cyan-500/40',
  'bg-pink-500/10 text-pink-600 hover:border-pink-500/40',
  'bg-indigo-500/10 text-indigo-600 hover:border-indigo-500/40',
  'bg-teal-500/10 text-teal-600 hover:border-teal-500/40',
  'bg-orange-500/10 text-orange-600 hover:border-orange-500/40',
  'bg-lime-500/10 text-lime-600 hover:border-lime-500/40',
  'bg-fuchsia-500/10 text-fuchsia-600 hover:border-fuchsia-500/40',
];

interface SmartSuggestion {
  unitId: string;
  unitName: string;
  topic: string;
  reason: string;
  prompt: string;
}

export default function StudyPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Show suggestions on first load
  useEffect(() => {
    const hasSeenSuggestions = sessionStorage.getItem('study-suggestions-shown');
    if (!hasSeenSuggestions) {
      setShowSuggestionModal(true);
      loadSmartSuggestions();
      sessionStorage.setItem('study-suggestions-shown', 'true');
    }
  }, []);

  const loadSmartSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const token = await getIdToken();
      // Get suggestions for the first 3 units (most commonly studied)
      const priorityUnits = ATP_UNITS.slice(0, 3);
      const allSuggestions: SmartSuggestion[] = [];

      for (const unit of priorityUnits) {
        const res = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            unitId: unit.id,
            unitName: unit.name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            allSuggestions.push({
              unitId: unit.id,
              unitName: unit.name,
              ...data.suggestions[0],
            });
          }
        }
      }

      setSuggestions(allSuggestions.slice(0, 3));
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: SmartSuggestion) => {
    setShowSuggestionModal(false);
    router.push(`/study/${suggestion.unitId}`);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Smart Suggestions Modal */}
      {showSuggestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Ready to study?</h2>
                    <p className="text-sm text-muted-foreground">Here are some smart suggestions for you</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestionModal(false)}
                  className="h-8 w-8 p-0 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Generating personalized suggestions...</p>
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted/80 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                              {suggestion.unitName}
                            </span>
                          </div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {suggestion.topic}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {suggestion.reason}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Select a unit below to start studying</p>
                </div>
              )}
            </div>

            <div className="border-t bg-muted/30 px-6 py-4">
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setShowSuggestionModal(false)}
              >
                Browse all units instead
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Study</h1>
          <p className="text-muted-foreground mt-1">
            Choose an ATP unit to begin AI-powered study. Each session uses retrieval-augmented
            generation to provide accurate, cited responses.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowSuggestionModal(true);
            loadSmartSuggestions();
          }}
          className="shrink-0"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Get Suggestions</span>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATP_UNITS.map((unit, i) => {
          const Icon = ICON_MAP[unit.icon] || BookOpen;
          const color = COLORS[i % COLORS.length];
          const [bgColor, textColor, hoverBorder] = color.split(' ');
          return (
            <Link key={unit.id} href={`/study/${unit.id}`}>
              <Card
                className={`group cursor-pointer border transition-all duration-200 hover:shadow-md h-full ${hoverBorder}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg w-fit ${bgColor} ${textColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {(unit as any).code}
                    </span>
                  </div>
                  <CardTitle className="text-base mt-3 flex items-center justify-between">
                    {unit.name}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {unit.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {unit.statutes.slice(0, 3).map((statute, j) => (
                      <span
                        key={j}
                        className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                      >
                        {statute.length > 30 ? statute.slice(0, 28) + '…' : statute}
                      </span>
                    ))}
                    {unit.statutes.length > 3 && (
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        +{unit.statutes.length - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
