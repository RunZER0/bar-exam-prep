'use client';

/**
 * YNAI Mastery Engine v3 - Main Hub Page
 * 
 * The flagship study interface combining:
 * - Immediate next action (no scrolling to start)
 * - Readiness Dashboard (overall + per-unit mastery)
 * - Daily Study Plan (personalized tasks)
 * 
 * UX PRINCIPLE: Action first, metrics second.
 * The first thing users see is "Start Now" with their next task.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReadinessDashboard from '@/components/ReadinessDashboard';
import DailyPlanView from '@/components/DailyPlanView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type TabView = 'action' | 'overview' | 'skills';

export default function MasteryPage() {
  const [activeTab, setActiveTab] = useState<TabView>('action');

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mastery Hub</h1>
            <p className="text-sm text-muted-foreground">
              Your path to bar exam success
            </p>
          </div>
          <Link href="/study">
            <Button variant="outline" size="sm">
              Browse All Units →
            </Button>
          </Link>
        </div>

        {/* Tab Navigation - More compact */}
        <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
          <TabButton 
            active={activeTab === 'action'} 
            onClick={() => setActiveTab('action')}
          >
            📍 Today
          </TabButton>
          <TabButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
          >
            📊 Readiness
          </TabButton>
          <TabButton 
            active={activeTab === 'skills'} 
            onClick={() => setActiveTab('skills')}
          >
            🗺️ Skills
          </TabButton>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary Content Area */}
          <div className="lg:col-span-2">
            <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'action' && <DailyPlanView />}
              {activeTab === 'overview' && <ReadinessDashboard />}
              {activeTab === 'skills' && <SkillsMapPlaceholder />}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <QuickAction 
                  href="/study" 
                  label="Start Practice Session" 
                  icon="📝"
                  primary
                />
                <QuickAction 
                  href="/exams" 
                  label="Take Mock Exam" 
                  icon="⏱️"
                />
                <QuickAction 
                  href="/tutor" 
                  label="Ask AI Tutor" 
                  icon="🤖"
                />
                <QuickAction 
                  href="/clarify" 
                  label="Clarify Concepts" 
                  icon="💡"
                />
              </CardContent>
            </Card>

            {/* Weekly Report */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Stat label="This week" value="23 attempts" />
                  <Stat label="Study time" value="4h 35m" />
                  <Stat label="Gates passed" value="2" />
                  <Stat label="Streak" value="5 days 🔥" />
                </div>
                <Link href="/history">
                  <Button variant="link" className="mt-4 w-full">
                    View Full Report →
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Learning Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Learning Tip</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Spaced repetition boost:</strong> Skills practiced 24+ hours apart 
                    have 40% better retention. Your planner optimizes for this automatically.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Gate Progress Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gate Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Skills verified</span>
                    <span className="font-medium">12 / 72</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: '17%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pass gates by achieving 85%+ mastery with timed verification
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function TabButton({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active 
          ? 'text-primary' 
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {/* Active indicator bar with smooth animation */}
      <span 
        className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-300 ease-out ${
          active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
        }`}
      />
    </button>
  );
}

function QuickAction({ 
  href, 
  label, 
  icon, 
  primary = false 
}: { 
  href: string; 
  label: string; 
  icon: string; 
  primary?: boolean;
}) {
  return (
    <Link href={href}>
      <Button 
        variant={primary ? 'default' : 'outline'} 
        className="w-full justify-start gap-2"
      >
        <span>{icon}</span>
        {label}
      </Button>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SkillsMapPlaceholder() {
  const router = useRouter();
  
  // ATP Units for navigation
  const ATP_UNITS = [
    { id: 'atp-100', name: 'Civil Procedure', icon: '⚖️', skills: 59 },
    { id: 'atp-101', name: 'Criminal Procedure', icon: '🔒', skills: 37 },
    { id: 'atp-102', name: 'Evidence Law', icon: '📋', skills: 21 },
    { id: 'atp-103', name: 'Contract Law', icon: '📝', skills: 22 },
    { id: 'atp-104', name: 'Property Law', icon: '🏠', skills: 21 },
    { id: 'atp-105', name: 'Tort Law', icon: '⚠️', skills: 23 },
    { id: 'atp-106', name: 'Constitutional Law', icon: '📜', skills: 25 },
    { id: 'atp-107', name: 'Company Law', icon: '🏢', skills: 32 },
    { id: 'atp-108', name: 'Land Law', icon: '🗺️', skills: 33 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Skills by Subject</span>
          <span className="text-sm font-normal text-muted-foreground">273 skills across 9 units</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Unit Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {ATP_UNITS.map((unit) => (
            <button
              key={unit.id}
              onClick={() => router.push(`/study/${unit.id}`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted hover:shadow-md transition-all text-left group"
            >
              <span className="text-2xl">{unit.icon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                  {unit.name}
                </h4>
                <p className="text-xs text-muted-foreground">{unit.skills} skills</p>
              </div>
              <span className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">
                →
              </span>
            </button>
          ))}
        </div>
        
        {/* Top Priority Skills */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <span>🎯</span>
            Top Priority Skills
            <span className="text-xs font-normal text-muted-foreground">(by exam weight)</span>
          </h4>
          <div className="space-y-2">
            {[
              { name: 'Issue Spotting - Civil Claims', unit: 'atp-100', weight: 12, mastery: 75 },
              { name: 'Criminal Evidence Rules', unit: 'atp-102', weight: 10, mastery: 62 },
              { name: 'Contract Formation', unit: 'atp-103', weight: 8, mastery: 45 },
              { name: 'Constitutional Rights', unit: 'atp-106', weight: 8, mastery: 80 },
              { name: 'Professional Ethics', unit: 'atp-100', weight: 7, mastery: 88 },
            ].map((skill, i) => (
              <button
                key={i}
                onClick={() => router.push(`/study/${skill.unit}?focus=${encodeURIComponent(skill.name)}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      skill.mastery >= 80 ? 'bg-green-500' : 
                      skill.mastery >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${skill.mastery}%` }}
                  />
                </div>
                <span className="flex-1 text-sm text-left group-hover:text-primary transition-colors">{skill.name}</span>
                <span className="text-xs text-muted-foreground">{skill.weight}% weight</span>
                <span className="text-sm font-medium w-12 text-right">{skill.mastery}%</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
