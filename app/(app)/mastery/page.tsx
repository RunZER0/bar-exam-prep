'use client';

/**
 * YNAI Mastery Engine v3 - Main Hub Page
 * 
 * The flagship study interface combining:
 * - Readiness Dashboard (overall + per-unit mastery)
 * - Daily Study Plan (personalized tasks)
 * - Quick actions and navigation
 * 
 * This replaces the generic dashboard with evidence-based mastery tracking.
 */

import { useState } from 'react';
import ReadinessDashboard from '@/components/ReadinessDashboard';
import DailyPlanView from '@/components/DailyPlanView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type TabView = 'overview' | 'plan' | 'skills';

export default function MasteryPage() {
  const [activeTab, setActiveTab] = useState<TabView>('overview');

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mastery Hub</h1>
          <p className="text-muted-foreground">
            Your evidence-based path to bar exam success
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b pb-2">
          <TabButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </TabButton>
          <TabButton 
            active={activeTab === 'plan'} 
            onClick={() => setActiveTab('plan')}
          >
            Today&apos;s Plan
          </TabButton>
          <TabButton 
            active={activeTab === 'skills'} 
            onClick={() => setActiveTab('skills')}
          >
            Skills Map
          </TabButton>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && <ReadinessDashboard />}
            {activeTab === 'plan' && <DailyPlanView />}
            {activeTab === 'skills' && <SkillsMapPlaceholder />}
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
      className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills Knowledge Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">🗺️</p>
            <p className="font-medium">Coming Soon</p>
            <p className="text-sm">Interactive visualization of your skill mastery</p>
          </div>
        </div>
        
        {/* Placeholder skill list */}
        <div className="mt-6 space-y-3">
          <h4 className="font-medium">Top Skills by Exam Weight</h4>
          {[
            { name: 'Civil Procedure Issue Spotting', weight: '12%', mastery: 75 },
            { name: 'Criminal Evidence Rules', weight: '10%', mastery: 62 },
            { name: 'Contract Formation', weight: '8%', mastery: 45 },
            { name: 'Constitutional Rights', weight: '8%', mastery: 80 },
            { name: 'Professional Ethics', weight: '7%', mastery: 88 },
          ].map((skill, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-2 rounded-full ${
                    skill.mastery >= 80 ? 'bg-green-500' : 
                    skill.mastery >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${skill.mastery}%` }}
                />
              </div>
              <span className="flex-1 text-sm">{skill.name}</span>
              <span className="text-xs text-muted-foreground">{skill.weight}</span>
              <span className="text-sm font-medium w-12 text-right">{skill.mastery}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
