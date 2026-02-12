'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, Users, BarChart3, BookOpen, Plus, Trash2, Save, Loader2,
  AlertTriangle, CheckCircle2, FileText, TrendingUp, Target, Settings,
  Calendar, Brain, Database, Search, Edit2, Eye, Download, Upload,
  RefreshCw, Clock, Sparkles, GraduationCap, Scale, ChevronRight,
  MoreVertical, Filter, X, ExternalLink, Zap
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalResponses: number;
  averageScore: number;
  totalQuestions: number;
  averageStudyTime: number;
  completionRate: number;
}

interface KslTimeline {
  id: string;
  intakeName: string;
  registrationOpens: string;
  registrationCloses: string;
  examDate: string;
  examEndDate?: string;
  resultsDate?: string;
  isActive: boolean;
  notes?: string;
}

interface RagEntry {
  id: string;
  title: string;
  content: string;
  contentType: string;
  unitId?: string;
  citation?: string;
  importance: string;
  isVerified: boolean;
  usageCount: number;
}

interface CurriculumUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  estimatedHours: number;
  isActive: boolean;
}

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

type AdminTab = 'dashboard' | 'users' | 'curriculum' | 'questions' | 'knowledge' | 'timelines' | 'settings';

// ============================================================
// COMPONENT
// ============================================================

export default function AdminPage() {
  const { user, getIdToken } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [timelines, setTimelines] = useState<KslTimeline[]>([]);
  const [ragEntries, setRagEntries] = useState<RagEntry[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [newTimeline, setNewTimeline] = useState({
    intakeName: '',
    registrationOpens: '',
    registrationCloses: '',
    examDate: '',
    examEndDate: '',
    resultsDate: '',
    notes: '',
  });

  const [newRagEntry, setNewRagEntry] = useState({
    title: '',
    content: '',
    contentType: 'case_law',
    unitId: '',
    citation: '',
    importance: 'medium',
  });

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch analytics
      const analyticsRes = await fetch('/api/admin/analytics', { headers });
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }

      // More data would be fetched based on active tab
    } catch (err) {
      setError('Failed to load admin data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
    { id: 'questions', label: 'Questions', icon: FileText },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'timelines', label: 'KSL Timelines', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Mock data for demonstration
  const MOCK_TIMELINES: KslTimeline[] = [
    {
      id: '1',
      intakeName: 'June 2025 Intake',
      registrationOpens: '2025-01-15',
      registrationCloses: '2025-02-28',
      examDate: '2025-06-02',
      examEndDate: '2025-06-13',
      resultsDate: '2025-08-15',
      isActive: true,
      notes: 'Main intake for 2025',
    },
    {
      id: '2',
      intakeName: 'November 2025 Intake',
      registrationOpens: '2025-06-01',
      registrationCloses: '2025-07-31',
      examDate: '2025-11-03',
      examEndDate: '2025-11-14',
      isActive: false,
    },
  ];

  const MOCK_RAG_ENTRIES: RagEntry[] = [
    {
      id: '1',
      title: 'Anarita Karimi Njeru v Republic',
      content: 'Establishes the standard for constitutional petitions...',
      contentType: 'case_law',
      unitId: 'atp-100',
      citation: '[1979] KLR 154',
      importance: 'high',
      isVerified: true,
      usageCount: 156,
    },
    {
      id: '2',
      title: 'Civil Procedure Act, Cap 21',
      content: 'The principal legislation governing civil proceedings...',
      contentType: 'statute',
      unitId: 'atp-100',
      importance: 'high',
      isVerified: true,
      usageCount: 234,
    },
  ];

  const MOCK_USERS: UserData[] = [
    {
      id: '1',
      email: 'john@example.com',
      displayName: 'John Kamau',
      role: 'student',
      isActive: true,
      onboardingCompleted: true,
      createdAt: '2025-01-15',
    },
    {
      id: '2',
      email: 'jane@example.com',
      displayName: 'Jane Wanjiku',
      role: 'student',
      isActive: true,
      onboardingCompleted: false,
      createdAt: '2025-01-20',
    },
  ];

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-500/10 dark:bg-gray-800 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.activeUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Active (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-500/10 dark:bg-gray-800 flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.totalResponses || 0}</p>
                <p className="text-xs text-muted-foreground">Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.averageScore || 0}%</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('timelines')}>
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-xs">Update KSL Dates</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('questions')}>
              <Plus className="w-5 h-5 text-green-500" />
              <span className="text-xs">Add Questions</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('knowledge')}>
              <Database className="w-5 h-5 text-gray-500" />
              <span className="text-xs">Manage RAG</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('users')}>
              <Users className="w-5 h-5 text-orange-500" />
              <span className="text-xs">View Users</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_USERS.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">{u.displayName?.[0] || u.email[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.displayName || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.createdAt}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.onboardingCompleted ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                }`}>
                  {u.onboardingCompleted ? 'Onboarded' : 'Pending'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">KSL Timeline Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_TIMELINES.map(t => (
              <div key={t.id} className="p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{t.intakeName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    t.isActive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    {t.isActive ? 'Active' : 'Upcoming'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Exam: {t.examDate}</span>
                  <span>Reg closes: {t.registrationCloses}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search users by name or email..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Onboarding</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_USERS.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{u.displayName?.[0] || u.email[0]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.displayName || 'No name'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm capitalize">{u.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.onboardingCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-orange-500" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{u.createdAt}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimelines = () => (
    <div className="space-y-6">
      {/* Add new timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add KSL Timeline
          </CardTitle>
          <CardDescription>
            Add a new Kenya School of Law intake and exam timeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Intake Name</label>
              <Input 
                placeholder="e.g., June 2025 Intake" 
                value={newTimeline.intakeName}
                onChange={(e) => setNewTimeline({...newTimeline, intakeName: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Exam Date</label>
              <Input 
                type="date" 
                value={newTimeline.examDate}
                onChange={(e) => setNewTimeline({...newTimeline, examDate: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Registration Opens</label>
              <Input 
                type="date" 
                value={newTimeline.registrationOpens}
                onChange={(e) => setNewTimeline({...newTimeline, registrationOpens: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Registration Closes</label>
              <Input 
                type="date" 
                value={newTimeline.registrationCloses}
                onChange={(e) => setNewTimeline({...newTimeline, registrationCloses: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Exam End Date (optional)</label>
              <Input 
                type="date" 
                value={newTimeline.examEndDate}
                onChange={(e) => setNewTimeline({...newTimeline, examEndDate: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Results Date (optional)</label>
              <Input 
                type="date" 
                value={newTimeline.resultsDate}
                onChange={(e) => setNewTimeline({...newTimeline, resultsDate: e.target.value})}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Notes</label>
            <Textarea 
              placeholder="Any additional notes about this intake..."
              value={newTimeline.notes}
              onChange={(e) => setNewTimeline({...newTimeline, notes: e.target.value})}
            />
          </div>
          <Button className="mt-4 gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Timeline
          </Button>
        </CardContent>
      </Card>

      {/* Existing Timelines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">KSL Timelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MOCK_TIMELINES.map(t => (
            <div key={t.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {t.intakeName}
                    {t.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                        Active
                      </span>
                    )}
                  </h3>
                  {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Registration Opens</span>
                  <p className="font-medium">{t.registrationOpens}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registration Closes</span>
                  <p className="font-medium">{t.registrationCloses}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Exam Date</span>
                  <p className="font-medium">{t.examDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Results Date</span>
                  <p className="font-medium">{t.resultsDate || 'TBD'}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderKnowledgeBase = () => (
    <div className="space-y-6">
      {/* Add new entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Knowledge Entry
          </CardTitle>
          <CardDescription>
            Add case law, statutes, or concepts to the RAG knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input 
                placeholder="e.g., Anarita Karimi Njeru v Republic" 
                value={newRagEntry.title}
                onChange={(e) => setNewRagEntry({...newRagEntry, title: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content Type</label>
              <select 
                className="w-full h-10 px-3 rounded-md border bg-background"
                value={newRagEntry.contentType}
                onChange={(e) => setNewRagEntry({...newRagEntry, contentType: e.target.value})}
              >
                <option value="case_law">Case Law</option>
                <option value="statute">Statute</option>
                <option value="concept">Legal Concept</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Citation (if applicable)</label>
              <Input 
                placeholder="e.g., [1979] KLR 154" 
                value={newRagEntry.citation}
                onChange={(e) => setNewRagEntry({...newRagEntry, citation: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Importance</label>
              <select 
                className="w-full h-10 px-3 rounded-md border bg-background"
                value={newRagEntry.importance}
                onChange={(e) => setNewRagEntry({...newRagEntry, importance: e.target.value})}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <Textarea 
              placeholder="Full content including ratio decidendi, key principles, relevant provisions..."
              rows={6}
              value={newRagEntry.content}
              onChange={(e) => setNewRagEntry({...newRagEntry, content: e.target.value})}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <Button className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Entry
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Bulk Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle className="text-lg">Knowledge Base Entries</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search entries..." className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_RAG_ENTRIES.map(entry => (
            <div key={entry.id} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{entry.title}</h3>
                    {entry.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.importance === 'high' ? 'bg-red-500/10 text-red-500' :
                      entry.importance === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {entry.importance}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {entry.contentType.replace('_', ' ')}
                    </span>
                  </div>
                  {entry.citation && (
                    <p className="text-sm font-mono text-muted-foreground">{entry.citation}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Used {entry.usageCount} times</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Tutor Settings</CardTitle>
          <CardDescription>Configure AI behavior and defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Default Daily Study Goal (minutes)</label>
              <Input type="number" defaultValue={60} min={15} max={480} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Default Weekly Quiz Goal</label>
              <Input type="number" defaultValue={3} min={1} max={20} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Spaced Repetition Default EF</label>
              <Input type="number" defaultValue={2.5} step={0.1} min={1.3} max={3.0} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Max New Cards Per Day</label>
              <Input type="number" defaultValue={10} min={1} max={50} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Site Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Site Announcement (shown to all users)</label>
            <Textarea placeholder="Leave empty to hide announcement banner" />
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">Temporarily disable access for non-admin users</p>
            </div>
            <Button variant="outline" size="sm">Disabled</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">New User Signups</p>
              <p className="text-sm text-muted-foreground">Allow new users to register</p>
            </div>
            <Button variant="outline" size="sm">Enabled</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-red-500">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Clear All Preloaded Content</p>
              <p className="text-sm text-muted-foreground">Remove all cached AI-generated content</p>
            </div>
            <Button variant="destructive" size="sm">Clear</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Reset All User Progress</p>
              <p className="text-sm text-muted-foreground">This will delete all user progress data</p>
            </div>
            <Button variant="destructive" size="sm">Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'users':
        return renderUsers();
      case 'timelines':
        return renderTimelines();
      case 'knowledge':
        return renderKnowledgeBase();
      case 'settings':
        return renderSettings();
      case 'curriculum':
      case 'questions':
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              The {activeTab} management interface is under development.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold">Control Center</h1>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setError('')}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <p className="text-sm text-green-500">{success}</p>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setSuccess('')}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {renderContent()}
      </div>

      {/* Custom animation */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
