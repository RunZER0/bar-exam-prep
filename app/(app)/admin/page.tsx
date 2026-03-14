'use client';

import { useEffect, useState, useCallback } from 'react';
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

interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalAttempts: number;
  completedSessions: number;
  aiInteractions: number;
}

interface RecentActivity {
  id: string;
  userId: string;
  competencyType: string;
  isCompleted: boolean;
  createdAt: string;
  user?: { displayName?: string; email: string };
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  recentActivity: RecentActivity[];
  competencyDistribution: { competencyType: string; count: number }[];
  engagement?: {
    totalStudyMinutes: number;
    avgDailyMinutes: number;
    featureUsage: { section: string; totalMinutes: number; visitCount: number }[];
    dailyActiveUsers: { date: string; count: number }[];
    sessionTypeBreakdown: { type: string; count: number }[];
  };
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
  tags?: string[];
}

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  subscriptionPlan?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  createdAt: string;
  updatedAt?: string;
}

interface TopicData {
  id: string;
  title: string;
  description?: string;
  competencyType: string;
  category: string;
  order: number;
  isActive: boolean;
}

interface QuestionData {
  id: string;
  topicId: string;
  questionType: string;
  difficulty: string;
  question: string;
  context?: string;
  options?: any;
  correctAnswer?: string;
  explanation?: string;
  isActive: boolean;
  createdAt: string;
  topic?: TopicData;
}

interface AdminSettings {
  defaultDailyStudyGoal: number;
  defaultWeeklyQuizGoal: number;
  spacedRepetitionDefaultEF: number;
  maxNewCardsPerDay: number;
  siteAnnouncement: string;
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  enableCommunityFeatures: boolean;
  enableAIChat: boolean;
  enableTutorMode: boolean;
  [key: string]: any;
}

interface RoomRequest {
  id: string;
  requestedBy: string;
  name: string;
  description: string | null;
  visibility: string;
  status: string;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
}

type AdminTab = 'dashboard' | 'users' | 'curriculum' | 'questions' | 'knowledge' | 'timelines' | 'community' | 'settings';

const DEFAULT_SETTINGS: AdminSettings = {
  defaultDailyStudyGoal: 60,
  defaultWeeklyQuizGoal: 3,
  spacedRepetitionDefaultEF: 2.5,
  maxNewCardsPerDay: 10,
  siteAnnouncement: '',
  maintenanceMode: false,
  allowNewSignups: true,
  enableCommunityFeatures: true,
  enableAIChat: true,
  enableTutorMode: true,
};

// ============================================================
// COMPONENT
// ============================================================

export default function AdminPage() {
  const { user, getIdToken } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timelines, setTimelines] = useState<KslTimeline[]>([]);
  const [roomRequests, setRoomRequests] = useState<RoomRequest[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [ragEntries, setRagEntries] = useState<RagEntry[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [questionsList, setQuestionsList] = useState<QuestionData[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [newTimeline, setNewTimeline] = useState({
    intakeName: '', registrationOpens: '', registrationCloses: '',
    examDate: '', examEndDate: '', resultsDate: '', notes: '',
  });

  const [newRagEntry, setNewRagEntry] = useState({
    title: '', content: '', contentType: 'case_law',
    unitId: '', citation: '', importance: 'medium',
  });

  const [newTopic, setNewTopic] = useState({
    title: '', description: '', competencyType: 'drafting', category: '', order: 0,
  });

  const [newQuestion, setNewQuestion] = useState({
    topicId: '', questionType: 'multiple_choice', difficulty: 'intermediate',
    question: '', context: '', correctAnswer: '', explanation: '',
  });

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTimeline, setEditingTimeline] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Pagination
  const [usersPagination, setUsersPagination] = useState({ total: 0, hasMore: false });
  const [ragPagination, setRagPagination] = useState({ total: 0, hasMore: false });

  const getHeaders = useCallback(async () => {
    const token = await getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [getIdToken]);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchAnalytics = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/analytics', { headers });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchUsers = useCallback(async (search = '') => {
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUsersPagination(data.pagination);
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchTimelines = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/timelines', { headers });
      if (res.ok) {
        const data = await res.json();
        setTimelines(data.timelines || []);
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchKnowledge = useCallback(async (search = '') => {
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/knowledge?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRagEntries(data.entries || []);
        setRagPagination(data.pagination || { total: 0, hasMore: false });
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchSettings = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchTopics = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/topics', { headers });
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchQuestions = useCallback(async (search = '') => {
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/questions?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQuestionsList(data.questions || []);
      }
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchCommunityRequests = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/community?status=pending', { headers });
      if (res.ok) {
        const data = await res.json();
        setRoomRequests(data.requests || []);
      }
    } catch {
      setError('Failed to load community requests');
    } finally {
      setCommunityLoading(false);
    }
  }, [getHeaders]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAnalytics(),
        fetchUsers(),
        fetchTimelines(),
        fetchKnowledge(),
        fetchSettings(),
      ]);
    } catch {
      setError('Failed to load admin data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics, fetchUsers, fetchTimelines, fetchKnowledge, fetchSettings]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (activeTab === 'community' && roomRequests.length === 0) fetchCommunityRequests();
    if (activeTab === 'curriculum' && topics.length === 0) fetchTopics();
    if (activeTab === 'questions' && questionsList.length === 0) fetchQuestions();
  }, [activeTab]);

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const saveTimeline = async () => {
    if (!newTimeline.intakeName || !newTimeline.examDate) {
      setError('Intake Name and Exam Date are required');
      return;
    }
    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/timelines', {
        method: 'POST', headers,
        body: JSON.stringify(newTimeline),
      });
      if (res.ok) {
        setSuccess('Timeline created successfully');
        setNewTimeline({ intakeName: '', registrationOpens: '', registrationCloses: '', examDate: '', examEndDate: '', resultsDate: '', notes: '' });
        await fetchTimelines();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create timeline');
      }
    } catch { setError('Failed to create timeline'); }
    finally { setSaving(false); }
  };

  const toggleTimelineActive = async (id: string, isActive: boolean) => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/timelines', {
        method: 'PATCH', headers,
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (res.ok) {
        setSuccess(`Timeline ${!isActive ? 'activated' : 'deactivated'}`);
        await fetchTimelines();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update timeline');
      }
    } catch { setError('Failed to update timeline'); }
  };

  const deleteTimeline = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timeline?')) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/timelines?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setSuccess('Timeline deleted');
        await fetchTimelines();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete timeline');
      }
    } catch { setError('Failed to delete timeline'); }
  };

  const saveKnowledgeEntry = async () => {
    if (!newRagEntry.title || !newRagEntry.content) {
      setError('Title and Content are required');
      return;
    }
    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST', headers,
        body: JSON.stringify(newRagEntry),
      });
      if (res.ok) {
        setSuccess('Knowledge entry created');
        setNewRagEntry({ title: '', content: '', contentType: 'case_law', unitId: '', citation: '', importance: 'medium' });
        await fetchKnowledge();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create entry');
      }
    } catch { setError('Failed to create knowledge entry'); }
    finally { setSaving(false); }
  };

  const deleteKnowledgeEntry = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/knowledge?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setSuccess('Entry deleted');
        await fetchKnowledge();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete entry');
      }
    } catch { setError('Failed to delete entry'); }
  };

  const saveTopic = async () => {
    if (!newTopic.title || !newTopic.category) {
      setError('Title and Category are required');
      return;
    }
    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/topics', {
        method: 'POST', headers,
        body: JSON.stringify(newTopic),
      });
      if (res.ok) {
        setSuccess('Topic created');
        setNewTopic({ title: '', description: '', competencyType: 'drafting', category: '', order: 0 });
        await fetchTopics();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create topic');
      }
    } catch { setError('Failed to create topic'); }
    finally { setSaving(false); }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm('Deactivate this topic?')) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/topics?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setSuccess('Topic deactivated');
        await fetchTopics();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to deactivate topic');
      }
    } catch { setError('Failed to deactivate topic'); }
  };

  const saveQuestion = async () => {
    if (!newQuestion.topicId || !newQuestion.question) {
      setError('Topic and Question text are required');
      return;
    }
    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/questions', {
        method: 'POST', headers,
        body: JSON.stringify(newQuestion),
      });
      if (res.ok) {
        setSuccess('Question created');
        setNewQuestion({ topicId: '', questionType: 'multiple_choice', difficulty: 'intermediate', question: '', context: '', correctAnswer: '', explanation: '' });
        await fetchQuestions();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create question');
      }
    } catch { setError('Failed to create question'); }
    finally { setSaving(false); }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Deactivate this question?')) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setSuccess('Question deactivated');
        await fetchQuestions();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to deactivate question');
      }
    } catch { setError('Failed to deactivate question'); }
  };

  const saveSettings = async (updates: Partial<AdminSettings>) => {
    setSettingsSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH', headers,
        body: JSON.stringify({ settings: updates }),
      });
      if (res.ok) {
        setAdminSettings(prev => ({ ...prev, ...updates }));
        setSuccess('Settings saved');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch { setError('Failed to save settings'); }
    finally { setSettingsSaving(false); }
  };

  const handleRoomAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/community', {
        method: 'POST', headers,
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        setRoomRequests(prev => prev.filter(r => r.id !== requestId));
        setSuccess(`Room request ${action}d successfully`);
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${action} request`);
      }
    } catch { setError(`Failed to ${action} request`); }
  };

  // ============================================================
  // TAB CONFIG
  // ============================================================

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
    { id: 'questions', label: 'Questions', icon: FileText },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'timelines', label: 'KSL Timelines', icon: Calendar },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderDashboard = () => {
    const overview = analytics?.overview;
    return (
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-500/10 dark:bg-gray-800 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overview?.totalUsers || 0}</p>
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
                  <p className="text-2xl font-bold">{overview?.activeUsers || 0}</p>
                  <p className="text-xs text-muted-foreground">Active (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overview?.totalAttempts || 0}</p>
                  <p className="text-xs text-muted-foreground">Questions Attempted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overview?.completedSessions || 0}</p>
                  <p className="text-xs text-muted-foreground">Sessions Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overview?.aiInteractions || 0}</p>
                  <p className="text-xs text-muted-foreground">AI Interactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('timelines')}>
                <Calendar className="w-5 h-5 text-gray-500" /><span className="text-xs">Update KSL Dates</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('questions')}>
                <Plus className="w-5 h-5 text-green-500" /><span className="text-xs">Add Questions</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('knowledge')}>
                <Database className="w-5 h-5 text-gray-500" /><span className="text-xs">Manage RAG</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setActiveTab('users')}>
                <Users className="w-5 h-5 text-orange-500" /><span className="text-xs">View Users</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity + Timelines */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Signups</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
              ) : users.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">{u.displayName?.[0] || u.email[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.displayName || u.email}</p>
                      <p className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</p>
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
            <CardHeader><CardTitle className="text-lg">KSL Timeline Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {timelines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No timelines configured</p>
              ) : timelines.slice(0, 4).map(t => (
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
                    <span>Exam: {new Date(t.examDate).toLocaleDateString()}</span>
                    {t.registrationCloses && <span>Reg closes: {new Date(t.registrationCloses).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Competency Distribution */}
        {analytics?.competencyDistribution && analytics.competencyDistribution.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Practice by Competency</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {analytics.competencyDistribution.map(c => (
                  <div key={c.competencyType} className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold">{c.count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.competencyType}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engagement Analytics */}
        {analytics?.engagement && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-lg">Engagement Overview (30 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold">{Math.round((analytics.engagement.totalStudyMinutes || 0) / 60)}h</p>
                    <p className="text-xs text-muted-foreground">Total Study Hours</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold">{analytics.engagement.avgDailyMinutes || 0}m</p>
                    <p className="text-xs text-muted-foreground">Avg Daily Study</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold">{analytics.engagement.featureUsage?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Features Used</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature Usage Ranking */}
            {analytics.engagement.featureUsage && analytics.engagement.featureUsage.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Most Used Features</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.engagement.featureUsage.map((f: any, i: number) => {
                      const maxMinutes = analytics.engagement.featureUsage[0]?.totalMinutes || 1;
                      const width = Math.max((f.totalMinutes / maxMinutes) * 100, 8);
                      return (
                        <div key={f.section} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize font-medium">{f.section.replace(/-/g, ' ')}</span>
                            <span className="text-muted-foreground text-xs">
                              {Math.round(f.totalMinutes / 60)}h · {f.visitCount} visits
                            </span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full">
                            <div
                              className="h-full bg-primary/70 rounded-full transition-all"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Daily Active Users Trend */}
            {analytics.engagement.dailyActiveUsers && analytics.engagement.dailyActiveUsers.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Daily Active Users (14 days)</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-1.5 h-32">
                    {analytics.engagement.dailyActiveUsers.map((d: any) => {
                      const maxCount = Math.max(...analytics.engagement.dailyActiveUsers.map((x: any) => x.count), 1);
                      const height = Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 3);
                      const date = new Date(d.date);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full group relative">
                          <div className="w-full flex justify-center items-end flex-1">
                            <div
                              className="w-full max-w-8 rounded-t bg-primary/50 group-hover:bg-primary/80 transition-all"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground">
                            {date.toLocaleDateString('en-KE', { day: 'numeric' })}
                          </span>
                          {d.count > 0 && (
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                              <div className="bg-popover border text-xs rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                                <div className="font-medium">{d.count} users</div>
                                <div className="text-muted-foreground">{date.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  };

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
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers(searchQuery)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchUsers(searchQuery)}>
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
          <Button variant="outline" onClick={() => { setSearchQuery(''); fetchUsers(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{usersPagination.total} users total</p>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Onboarding</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No users found</td></tr>
                ) : users.map(u => (
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
                        u.subscriptionTier === 'premium' ? 'bg-purple-500/10 text-purple-500' :
                        u.subscriptionTier === 'standard' ? 'bg-blue-500/10 text-blue-500' :
                        u.subscriptionTier === 'light' ? 'bg-green-500/10 text-green-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {u.subscriptionTier || 'free_trial'}
                      </span>
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
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
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
          <CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Add KSL Timeline</CardTitle>
          <CardDescription>Add a new Kenya School of Law intake and exam timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Intake Name</label>
              <Input placeholder="e.g., June 2025 Intake" value={newTimeline.intakeName}
                onChange={(e) => setNewTimeline({...newTimeline, intakeName: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Exam Date</label>
              <Input type="date" value={newTimeline.examDate}
                onChange={(e) => setNewTimeline({...newTimeline, examDate: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Registration Opens</label>
              <Input type="date" value={newTimeline.registrationOpens}
                onChange={(e) => setNewTimeline({...newTimeline, registrationOpens: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Registration Closes</label>
              <Input type="date" value={newTimeline.registrationCloses}
                onChange={(e) => setNewTimeline({...newTimeline, registrationCloses: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Exam End Date (optional)</label>
              <Input type="date" value={newTimeline.examEndDate}
                onChange={(e) => setNewTimeline({...newTimeline, examEndDate: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Results Date (optional)</label>
              <Input type="date" value={newTimeline.resultsDate}
                onChange={(e) => setNewTimeline({...newTimeline, resultsDate: e.target.value})} />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Notes</label>
            <Textarea placeholder="Any additional notes about this intake..."
              value={newTimeline.notes}
              onChange={(e) => setNewTimeline({...newTimeline, notes: e.target.value})} />
          </div>
          <Button className="mt-4 gap-2" disabled={saving} onClick={saveTimeline}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Timeline
          </Button>
        </CardContent>
      </Card>

      {/* Existing Timelines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">KSL Timelines ({timelines.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchTimelines}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {timelines.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No timelines yet. Add one above.</p>
          ) : timelines.map(t => (
            <div key={t.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {t.intakeName}
                    <span className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${
                      t.isActive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    }`} onClick={() => toggleTimelineActive(t.id, t.isActive)}>
                      {t.isActive ? 'Active' : 'Inactive'} (click to toggle)
                    </span>
                  </h3>
                  {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                    onClick={() => deleteTimeline(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Registration Opens</span>
                  <p className="font-medium">{t.registrationOpens ? new Date(t.registrationOpens).toLocaleDateString() : 'TBD'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registration Closes</span>
                  <p className="font-medium">{t.registrationCloses ? new Date(t.registrationCloses).toLocaleDateString() : 'TBD'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Exam Date</span>
                  <p className="font-medium">{new Date(t.examDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Results Date</span>
                  <p className="font-medium">{t.resultsDate ? new Date(t.resultsDate).toLocaleDateString() : 'TBD'}</p>
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
          <CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Add Knowledge Entry</CardTitle>
          <CardDescription>Add case law, statutes, or concepts to the RAG knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input placeholder="e.g., Anarita Karimi Njeru v Republic" value={newRagEntry.title}
                onChange={(e) => setNewRagEntry({...newRagEntry, title: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content Type</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newRagEntry.contentType}
                onChange={(e) => setNewRagEntry({...newRagEntry, contentType: e.target.value})}>
                <option value="case_law">Case Law</option>
                <option value="statute">Statute</option>
                <option value="concept">Legal Concept</option>
                <option value="procedure">Procedure</option>
                <option value="commentary">Commentary</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Citation (if applicable)</label>
              <Input placeholder="e.g., [1979] KLR 154" value={newRagEntry.citation}
                onChange={(e) => setNewRagEntry({...newRagEntry, citation: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Importance</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newRagEntry.importance}
                onChange={(e) => setNewRagEntry({...newRagEntry, importance: e.target.value})}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <Textarea placeholder="Full content including ratio decidendi, key principles, relevant provisions..."
              rows={6} value={newRagEntry.content}
              onChange={(e) => setNewRagEntry({...newRagEntry, content: e.target.value})} />
          </div>
          <Button className="mt-4 gap-2" disabled={saving} onClick={saveKnowledgeEntry}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Entry
          </Button>
        </CardContent>
      </Card>

      {/* Search & List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle className="text-lg">Knowledge Base ({ragPagination.total} entries)</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search entries..." className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && fetchKnowledge((e.target as HTMLInputElement).value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {ragEntries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No knowledge entries yet. Add one above.</p>
          ) : ragEntries.map(entry => (
            <div key={entry.id} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{entry.title}</h3>
                    {entry.isVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.importance === 'high' ? 'bg-red-500/10 text-red-500' :
                      entry.importance === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>{entry.importance}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {entry.contentType.replace('_', ' ')}
                    </span>
                  </div>
                  {entry.citation && <p className="text-sm font-mono text-muted-foreground">{entry.citation}</p>}
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Used {entry.usageCount} times</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                  onClick={() => deleteKnowledgeEntry(entry.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderCurriculum = () => (
    <div className="space-y-6">
      {/* Add Topic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Add Topic</CardTitle>
          <CardDescription>Create a new curriculum topic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input placeholder="e.g., Constitutional Law Fundamentals" value={newTopic.title}
                onChange={(e) => setNewTopic({...newTopic, title: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Input placeholder="e.g., Constitutional Law" value={newTopic.category}
                onChange={(e) => setNewTopic({...newTopic, category: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Competency Type</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newTopic.competencyType}
                onChange={(e) => setNewTopic({...newTopic, competencyType: e.target.value})}>
                <option value="drafting">Drafting</option>
                <option value="research">Research</option>
                <option value="oral">Oral</option>
                <option value="banter">Banter</option>
                <option value="clarification">Clarification</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Order</label>
              <Input type="number" value={newTopic.order}
                onChange={(e) => setNewTopic({...newTopic, order: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea placeholder="Topic description..." value={newTopic.description}
              onChange={(e) => setNewTopic({...newTopic, description: e.target.value})} />
          </div>
          <Button className="mt-4 gap-2" disabled={saving} onClick={saveTopic}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Topic
          </Button>
        </CardContent>
      </Card>

      {/* Topic List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Topics ({topics.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchTopics}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No topics yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">#</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{t.order}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-sm">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                      </td>
                      <td className="py-3 px-4 text-sm">{t.category}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                          {t.competencyType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          t.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                          onClick={() => deleteTopic(t.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderQuestions = () => (
    <div className="space-y-6">
      {/* Add Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Add Question</CardTitle>
          <CardDescription>Create a new question for the question bank</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newQuestion.topicId}
                onChange={(e) => setNewQuestion({...newQuestion, topicId: e.target.value})}>
                <option value="">Select a topic...</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Question Type</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newQuestion.questionType}
                onChange={(e) => setNewQuestion({...newQuestion, questionType: e.target.value})}>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="essay">Essay</option>
                <option value="case_analysis">Case Analysis</option>
                <option value="practical">Practical</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={newQuestion.difficulty}
                onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value})}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Correct Answer</label>
              <Input placeholder="Correct answer or key points" value={newQuestion.correctAnswer}
                onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})} />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Question</label>
            <Textarea placeholder="Enter the question text..." rows={3} value={newQuestion.question}
              onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})} />
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Context (optional)</label>
            <Textarea placeholder="Additional context or case facts..." rows={2} value={newQuestion.context}
              onChange={(e) => setNewQuestion({...newQuestion, context: e.target.value})} />
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">Explanation</label>
            <Textarea placeholder="Explanation for the correct answer..." rows={2} value={newQuestion.explanation}
              onChange={(e) => setNewQuestion({...newQuestion, explanation: e.target.value})} />
          </div>
          <Button className="mt-4 gap-2" disabled={saving} onClick={saveQuestion}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Question
          </Button>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle className="text-lg">Questions ({questionsList.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search questions..." className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && fetchQuestions((e.target as HTMLInputElement).value)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchQuestions()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {questionsList.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No questions yet.</p>
          ) : questionsList.map(q => (
            <div key={q.id} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm line-clamp-2">{q.question}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                      {q.questionType?.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      q.difficulty === 'advanced' ? 'bg-red-500/10 text-red-500' :
                      q.difficulty === 'intermediate' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-green-500/10 text-green-500'
                    }`}>{q.difficulty}</span>
                    {q.topic && (
                      <span className="text-xs text-muted-foreground">{q.topic.title}</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                  onClick={() => deleteQuestion(q.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
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
              <Input type="number" value={adminSettings.defaultDailyStudyGoal} min={15} max={480}
                onChange={(e) => setAdminSettings(s => ({...s, defaultDailyStudyGoal: parseInt(e.target.value) || 60}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Default Weekly Quiz Goal</label>
              <Input type="number" value={adminSettings.defaultWeeklyQuizGoal} min={1} max={20}
                onChange={(e) => setAdminSettings(s => ({...s, defaultWeeklyQuizGoal: parseInt(e.target.value) || 3}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Spaced Repetition Default EF</label>
              <Input type="number" value={adminSettings.spacedRepetitionDefaultEF} step={0.1} min={1.3} max={3.0}
                onChange={(e) => setAdminSettings(s => ({...s, spacedRepetitionDefaultEF: parseFloat(e.target.value) || 2.5}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Max New Cards Per Day</label>
              <Input type="number" value={adminSettings.maxNewCardsPerDay} min={1} max={50}
                onChange={(e) => setAdminSettings(s => ({...s, maxNewCardsPerDay: parseInt(e.target.value) || 10}))} />
            </div>
          </div>
          <Button className="gap-2" disabled={settingsSaving}
            onClick={() => saveSettings({
              defaultDailyStudyGoal: adminSettings.defaultDailyStudyGoal,
              defaultWeeklyQuizGoal: adminSettings.defaultWeeklyQuizGoal,
              spacedRepetitionDefaultEF: adminSettings.spacedRepetitionDefaultEF,
              maxNewCardsPerDay: adminSettings.maxNewCardsPerDay,
            })}>
            {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save AI Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Site Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Site Announcement (shown to all users)</label>
            <Textarea placeholder="Leave empty to hide announcement banner"
              value={adminSettings.siteAnnouncement}
              onChange={(e) => setAdminSettings(s => ({...s, siteAnnouncement: e.target.value}))} />
            <Button className="mt-2 gap-2" size="sm" disabled={settingsSaving}
              onClick={() => saveSettings({ siteAnnouncement: adminSettings.siteAnnouncement })}>
              {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Announcement
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">Temporarily disable access for non-admin users</p>
            </div>
            <Button variant="outline" size="sm"
              className={adminSettings.maintenanceMode ? 'border-red-500 text-red-500' : ''}
              onClick={() => saveSettings({ maintenanceMode: !adminSettings.maintenanceMode })}>
              {adminSettings.maintenanceMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">New User Signups</p>
              <p className="text-sm text-muted-foreground">Allow new users to register</p>
            </div>
            <Button variant="outline" size="sm"
              className={!adminSettings.allowNewSignups ? 'border-red-500 text-red-500' : ''}
              onClick={() => saveSettings({ allowNewSignups: !adminSettings.allowNewSignups })}>
              {adminSettings.allowNewSignups ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Community Features</p>
              <p className="text-sm text-muted-foreground">Enable community rooms and discussions</p>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => saveSettings({ enableCommunityFeatures: !adminSettings.enableCommunityFeatures })}>
              {adminSettings.enableCommunityFeatures ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">AI Chat</p>
              <p className="text-sm text-muted-foreground">Enable AI chat features for students</p>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => saveSettings({ enableAIChat: !adminSettings.enableAIChat })}>
              {adminSettings.enableAIChat ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Tutor Mode</p>
              <p className="text-sm text-muted-foreground">Enable AI tutor sessions</p>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => saveSettings({ enableTutorMode: !adminSettings.enableTutorMode })}>
              {adminSettings.enableTutorMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Testing</CardTitle>
          <CardDescription>Test in-app notifications and Brevo email delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Single In-App Notification</p>
              <p className="text-sm text-muted-foreground">Fires one random notification toast + bell entry</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const res = await fetch('/api/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'single' }) });
                const data = await res.json();
                if (data.success && data.notifications) {
                  data.notifications.forEach((n: any) => {
                    setTimeout(() => { window.dispatchEvent(new CustomEvent('ynai:notify', { detail: n })); }, n.delay || 0);
                  });
                  setSuccess('Test notification sent!');
                }
              } catch { setError('Failed to send test notification'); }
            }}>
              <Zap className="h-4 w-4 mr-1" /> Test Single
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Burst (3 Notifications)</p>
              <p className="text-sm text-muted-foreground">Fires 3 notifications in quick succession</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const res = await fetch('/api/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'burst' }) });
                const data = await res.json();
                if (data.success && data.notifications) {
                  data.notifications.forEach((n: any) => {
                    setTimeout(() => { window.dispatchEvent(new CustomEvent('ynai:notify', { detail: n })); }, n.delay || 0);
                  });
                  setSuccess('Burst notification sent!');
                }
              } catch { setError('Failed to send burst notification'); }
            }}>
              <Zap className="h-4 w-4 mr-1" /> Test Burst
            </Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Test Brevo Email</p>
              <p className="text-sm text-muted-foreground">Send a test email to {user?.email || 'your address'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const res = await fetch('/api/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'email', email: user?.email }) });
                const data = await res.json();
                if (data.success) { setSuccess(data.message); }
                else { setError(data.message || 'Email test failed'); }
              } catch { setError('Failed to send test email'); }
            }}>
              <Zap className="h-4 w-4 mr-1" /> Test Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg text-red-500">Danger Zone</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Clear All Preloaded Content</p>
              <p className="text-sm text-muted-foreground">Remove all cached AI-prepared content</p>
            </div>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!confirm('Are you sure? This will delete all preloaded study notes and practice content.')) return;
              try {
                const headers = await getHeaders();
                const res = await fetch('/api/admin/settings', {
                  method: 'POST', headers,
                  body: JSON.stringify({ key: 'clearPreloadedContent', value: true }),
                });
                if (res.ok) setSuccess('Preloaded content cleared');
                else setError('Failed to clear content');
              } catch { setError('Failed to clear content'); }
            }}>Clear</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Reset All User Progress</p>
              <p className="text-sm text-muted-foreground">This will delete all user progress data</p>
            </div>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!confirm('THIS IS IRREVERSIBLE. Are you absolutely sure you want to reset ALL user progress?')) return;
              try {
                const headers = await getHeaders();
                const res = await fetch('/api/admin/settings', {
                  method: 'POST', headers,
                  body: JSON.stringify({ key: 'resetAllProgress', value: true }),
                });
                if (res.ok) setSuccess('User progress reset initiated');
                else setError('Failed to reset progress');
              } catch { setError('Failed to reset progress'); }
            }}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCommunity = () => {
    if (communityLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Community Management</h2>
            <p className="text-sm text-muted-foreground">Approve or reject room creation requests from students</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCommunityRequests}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Pending Room Requests ({roomRequests.length})
            </CardTitle>
            <CardDescription>Students can request custom study rooms. Review and approve or reject them here.</CardDescription>
          </CardHeader>
          <CardContent>
            {roomRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending room requests at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {roomRequests.map(req => (
                  <div key={req.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base">{req.name}</h3>
                        {req.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{req.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {req.requesterName || req.requesterEmail}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            req.visibility === 'public'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>{req.visibility}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline"
                          className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => handleRoomAction(req.id, 'reject')}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleRoomAction(req.id, 'approve')}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'timelines': return renderTimelines();
      case 'knowledge': return renderKnowledgeBase();
      case 'settings': return renderSettings();
      case 'community': return renderCommunity();
      case 'curriculum': return renderCurriculum();
      case 'questions': return renderQuestions();
      default: return null;
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
