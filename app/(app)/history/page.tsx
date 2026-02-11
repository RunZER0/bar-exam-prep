'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  History, Search, FileText, BookOpen, Coffee, MessageCircleQuestion,
  Trash2, ExternalLink, Clock, MessageSquare, MoreVertical, Archive
} from 'lucide-react';

type ChatSession = {
  id: string;
  title: string;
  competencyType: string;
  context: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  isArchived: boolean;
};

const COMPETENCY_ICONS: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  drafting: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  research: { icon: Search, color: 'text-green-600', bg: 'bg-green-500/10' },
  banter: { icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  clarification: { icon: MessageCircleQuestion, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  oral: { icon: BookOpen, color: 'text-red-600', bg: 'bg-red-500/10' },
};

export default function HistoryPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = await getIdToken();
      const response = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      const token = await getIdToken();
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.context?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || session.competencyType === filter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <History className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Chat History</h1>
            <p className="text-sm text-muted-foreground">
              {sessions.length} conversation{sessions.length !== 1 ? 's' : ''} saved
            </p>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['all', 'drafting', 'research', 'banter', 'clarification'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-card border animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
            <p className="text-muted-foreground mb-4">
              Start a chat in any section and it will appear here
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => router.push('/research')}>
                Start Research
              </Button>
              <Button onClick={() => router.push('/drafting')}>
                Start Drafting
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredSessions.map((session) => {
            const typeInfo = COMPETENCY_ICONS[session.competencyType] || COMPETENCY_ICONS.research;
            const TypeIcon = typeInfo.icon;
            
            return (
              <Card 
                key={session.id}
                className="group hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/history/${session.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-2.5 rounded-xl ${typeInfo.bg}`}>
                    <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{session.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {session.messageCount} messages
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.lastMessageAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/history/${session.id}`);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
