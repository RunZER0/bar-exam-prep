'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  Users,
  BarChart3,
  BookOpen,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Target,
} from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  description: string;
  competencyType: string;
  category: string;
  isActive: boolean;
}

interface Analytics {
  totalUsers: number;
  totalSessions: number;
  totalResponses: number;
  averageScore: number;
}

type Tab = 'analytics' | 'topics' | 'questions';

export default function AdminPage() {
  const { getIdToken } = useAuth();

  const [tab, setTab] = useState<Tab>('analytics');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New topic form
  const [newTopic, setNewTopic] = useState({
    name: '',
    description: '',
    competencyType: 'drafting' as string,
    category: '',
  });
  const [saving, setSaving] = useState(false);

  // New question form
  const [newQuestion, setNewQuestion] = useState({
    topicId: '',
    questionType: 'multiple_choice' as string,
    difficulty: 'intermediate' as string,
    content: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [analyticsRes, topicsRes] = await Promise.all([
        fetch('/api/admin/analytics', { headers }),
        fetch('/api/admin/topics', { headers }),
      ]);

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setTopics(data.topics || []);
      }
    } catch (err) {
      setError('Failed to load admin data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  const createTopic = async () => {
    if (!newTopic.name || !newTopic.description) return;
    setSaving(true);
    setError('');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTopic),
      });

      if (!res.ok) throw new Error('Failed to create topic');
      setSuccess('Topic created successfully');
      setNewTopic({ name: '', description: '', competencyType: 'drafting', category: '' });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create topic');
    } finally {
      setSaving(false);
    }
  };

  const createQuestion = async () => {
    if (!newQuestion.topicId || !newQuestion.content) return;
    setSaving(true);
    setError('');
    try {
      const token = await getIdToken();
      const body: any = {
        topicId: newQuestion.topicId,
        questionType: newQuestion.questionType,
        difficulty: newQuestion.difficulty,
        content: newQuestion.content,
        explanation: newQuestion.explanation,
        correctAnswer: newQuestion.correctAnswer,
      };

      if (newQuestion.questionType === 'multiple_choice') {
        body.options = newQuestion.options.filter((o) => o.trim());
      }

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed');
      setSuccess('Question created successfully');
      setNewQuestion({
        topicId: '',
        questionType: 'multiple_choice',
        difficulty: 'intermediate',
        content: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        explanation: '',
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create question');
    } finally {
      setSaving(false);
    }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm('Delete this topic? This cannot be undone.')) return;
    try {
      const token = await getIdToken();
      await fetch('/api/admin/topics', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch (err) {
      setError('Failed to delete topic');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Manage content, view analytics, and configure the platform.</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto underline text-xs">dismiss</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {([
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'topics', label: 'Topics', icon: BookOpen },
          { id: 'questions', label: 'Questions', icon: FileText },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics?.totalUsers ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Target className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics?.totalSessions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <FileText className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics?.totalResponses ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Responses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics?.averageScore ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Topics Tab */}
      {tab === 'topics' && (
        <div className="space-y-6">
          {/* Create topic form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Topic
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Topic name"
                  value={newTopic.name}
                  onChange={(e) => setNewTopic((t) => ({ ...t, name: e.target.value }))}
                />
                <Input
                  placeholder="Category (e.g. Civil Procedure)"
                  value={newTopic.category}
                  onChange={(e) => setNewTopic((t) => ({ ...t, category: e.target.value }))}
                />
              </div>
              <Textarea
                placeholder="Description"
                value={newTopic.description}
                onChange={(e) => setNewTopic((t) => ({ ...t, description: e.target.value }))}
                rows={2}
              />
              <div className="flex items-center gap-3">
                <select
                  value={newTopic.competencyType}
                  onChange={(e) => setNewTopic((t) => ({ ...t, competencyType: e.target.value }))}
                  className="px-3 py-2 rounded-md border text-sm bg-background"
                >
                  <option value="drafting">Drafting</option>
                  <option value="research">Research</option>
                  <option value="oral">Oral Advocacy</option>
                </select>
                <Button onClick={createTopic} disabled={saving || !newTopic.name}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing topics */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Existing Topics ({topics.length})
            </h3>
            {topics.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No topics yet. Create one above.</p>
            ) : (
              topics.map((topic) => (
                <Card key={topic.id}>
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{topic.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {topic.competencyType} · {topic.category || 'Uncategorized'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTopic(topic.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {tab === 'questions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Question
            </CardTitle>
            <CardDescription>Add exam questions for study and assessment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <select
                value={newQuestion.topicId}
                onChange={(e) => setNewQuestion((q) => ({ ...q, topicId: e.target.value }))}
                className="px-3 py-2 rounded-md border text-sm bg-background"
              >
                <option value="">Select topic…</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select
                value={newQuestion.questionType}
                onChange={(e) => setNewQuestion((q) => ({ ...q, questionType: e.target.value }))}
                className="px-3 py-2 rounded-md border text-sm bg-background"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="essay">Essay</option>
                <option value="case_analysis">Case Analysis</option>
                <option value="practical">Practical</option>
              </select>
              <select
                value={newQuestion.difficulty}
                onChange={(e) => setNewQuestion((q) => ({ ...q, difficulty: e.target.value }))}
                className="px-3 py-2 rounded-md border text-sm bg-background"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <Textarea
              placeholder="Question content"
              value={newQuestion.content}
              onChange={(e) => setNewQuestion((q) => ({ ...q, content: e.target.value }))}
              rows={3}
            />

            {newQuestion.questionType === 'multiple_choice' && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Options</p>
                {newQuestion.options.map((opt, i) => (
                  <Input
                    key={i}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) => {
                      const opts = [...newQuestion.options];
                      opts[i] = e.target.value;
                      setNewQuestion((q) => ({ ...q, options: opts }));
                    }}
                  />
                ))}
              </div>
            )}

            <Input
              placeholder="Correct answer"
              value={newQuestion.correctAnswer}
              onChange={(e) => setNewQuestion((q) => ({ ...q, correctAnswer: e.target.value }))}
            />

            <Textarea
              placeholder="Explanation (shown after answering)"
              value={newQuestion.explanation}
              onChange={(e) => setNewQuestion((q) => ({ ...q, explanation: e.target.value }))}
              rows={2}
            />

            <Button onClick={createQuestion} disabled={saving || !newQuestion.topicId || !newQuestion.content}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Create Question
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
