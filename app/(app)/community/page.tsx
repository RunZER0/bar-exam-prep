'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import {
  Users, MessageSquare, Trophy, UserPlus, Search, Send, Hash,
  Crown, Medal, Award, Star, Flame, Clock, ChevronRight, ChevronLeft,
  Plus, Lock, Globe, Loader2, Check, X, AlertCircle, Sparkles,
  BookOpen, Scale, FileText, ShieldCheck, Briefcase, Home as HomeIcon,
  Handshake, Building2, Gavel, UserCheck, UserX, Bell, ArrowRight,
  Heart, Zap, Target, TrendingUp, Calendar, ThumbsUp, ThumbsDown,
  MessageCircle, ArrowUp, Filter, CornerDownRight,
} from 'lucide-react';

/* ================================================================
   TYPES
   ================================================================ */
interface Room {
  id: string;
  name: string;
  description: string | null;
  unitId: string | null;
  roomType: 'official' | 'custom';
  isPublic: boolean;
  memberCount: number;
  messageCount: number;
  isJoined: boolean;
  lastActivity: string;
}

interface Friend {
  friendshipId: string;
  friendId: string;
  displayName: string;
  photoURL: string | null;
  matchScore: number;
  sharedInterests: string[];
  connectedAt: string;
}

interface FriendSuggestion {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string | null;
  matchScore: number;
  reasons: string[];
  mutualFriends: number;
}

interface PendingRequest {
  requestId: string;
  fromUserId: string;
  displayName: string;
  photoURL: string | null;
  requestedAt: string;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  participantCount: number;
  startsAt: string;
  endsAt: string;
  rewards: { position: number; reward: string }[];
  isJoined: boolean;
  isAgentCreated: boolean;
  submitterName: string | null;
  challengeContent: any[] | null;
  hoursLeft: number;
  daysLeft: number;
  unitId: string | null;
}

interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  photoURL: string | null;
  totalPoints: number;
  quizzesCompleted: number;
  bonusEarned: number;
  isCurrentUser: boolean;
}

interface Thread {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isAgentPost: boolean;
  userVote: 'up' | 'down' | null;
  createdAt: string;
}

interface ThreadReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  parentReplyId: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  isAgentReply: boolean;
  userVote: 'up' | 'down' | null;
  createdAt: string;
}

const THREAD_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'memes', label: 'Memes' },
  { id: 'study-tips', label: 'Study Tips' },
  { id: 'case-discussion', label: 'Case Talk' },
  { id: 'exam-anxiety', label: 'Exam Stress' },
  { id: 'career', label: 'Career' },
  { id: 'resources', label: 'Resources' },
  { id: 'off-topic', label: 'Off-Topic' },
] as const;

interface RoomMessage {
  id: string;
  content: string;
  userId: string | null;
  displayName: string;
  photoURL: string | null;
  isAgent: boolean;
  isCurrentUser: boolean;
  createdAt: string;
  isPinned: boolean;
  reactions: Record<string, string[]>;
}

/* ================================================================
   UNIT ICON/COLOR MAP
   ================================================================ */
const UNIT_CONFIG: Record<string, { icon: typeof Scale; color: string; bg: string }> = {
  'atp-100': { icon: Gavel,       color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'atp-101': { icon: ShieldCheck,  color: 'text-red-500',     bg: 'bg-red-500/10' },
  'atp-102': { icon: FileText,     color: 'text-purple-500',  bg: 'bg-purple-500/10' },
  'atp-103': { icon: BookOpen,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'atp-104': { icon: Scale,        color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'atp-105': { icon: Handshake,    color: 'text-teal-500',    bg: 'bg-teal-500/10' },
  'atp-106': { icon: Briefcase,    color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'atp-107': { icon: Building2,    color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'atp-108': { icon: HomeIcon,     color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
};

const TABS = [
  { id: 'rooms',     label: 'Rooms',      icon: Hash },
  { id: 'threads',   label: 'Threads',    icon: MessageCircle },
  { id: 'friends',   label: 'Friends',    icon: UserPlus },
  { id: 'events',    label: 'Challenges', icon: Trophy },
  { id: 'rankings',  label: 'Rankings',   icon: Crown },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ================================================================
   HELPERS
   ================================================================ */
function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function CommunityPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  useTimeTracker('community');

  const [tab, setTab] = useState<TabId>('rooms');
  const [loading, setLoading] = useState(true);

  // Username setup
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [suggestedUsername, setSuggestedUsername] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomVisibility, setNewRoomVisibility] = useState<'public' | 'private'>('public');
  const [submittingRoom, setSubmittingRoom] = useState(false);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Events & Rankings
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [aiChallenges, setAiChallenges] = useState<CommunityEvent[]>([]);
  const [communityChallenges, setCommunityChallenges] = useState<CommunityEvent[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [weekInfo, setWeekInfo] = useState<any>(null);

  // Challenge submission
  const [showSubmitChallenge, setShowSubmitChallenge] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitType, setSubmitType] = useState<string>('trivia');
  const [submitUnitId, setSubmitUnitId] = useState('');
  const [submitQuestions, setSubmitQuestions] = useState<{ question: string; type: string; options?: string[]; answer?: string }[]>([{ question: '', type: 'mcq', options: ['', '', '', ''], answer: '' }]);
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ approved: boolean; message: string } | null>(null);

  // Threads
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCategory, setThreadCategory] = useState('all');
  const [threadSort, setThreadSort] = useState<'recent' | 'top' | 'hot'>('recent');
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threadReplies, setThreadReplies] = useState<ThreadReply[]>([]);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState('general');
  const [submittingThread, setSubmittingThread] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }, [getIdToken]);

  /* ---- Check username on mount ---- */
  useEffect(() => {
    checkUsername();
  }, []);

  const checkUsername = async () => {
    try {
      const res = await apiFetch('/api/community/username');
      if (res.ok) {
        const data = await res.json();
        if (!data.hasUsername) {
          setSuggestedUsername(data.suggestedUsername || '');
          setUsername(data.suggestedUsername || '');
          setShowUsernameSetup(true);
        }
        setUsernameChecked(true);
      }
    } catch {
      setUsernameChecked(true);
    }
  };

  const checkUsernameAvailability = async (name: string) => {
    if (name.length < 3) { setUsernameAvailable(null); return; }
    setCheckingUsername(true);
    try {
      const res = await apiFetch('/api/community/username', {
        method: 'PUT',
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      setUsernameAvailable(data.available);
      if (!data.available) setUsernameError(data.reason || 'Already taken');
      else setUsernameError('');
    } catch { setUsernameAvailable(null); }
    finally { setCheckingUsername(false); }
  };

  const saveUsername = async () => {
    setSavingUsername(true);
    try {
      const res = await apiFetch('/api/community/username', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        setShowUsernameSetup(false);
        loadTabData('rooms');
      } else {
        const data = await res.json();
        setUsernameError(data.error || 'Failed to save');
        if (data.taken) setUsernameAvailable(false);
      }
    } catch { setUsernameError('Network error'); }
    finally { setSavingUsername(false); }
  };

  /* ---- Load data per tab ---- */
  useEffect(() => {
    if (usernameChecked && !showUsernameSetup) {
      loadTabData(tab);
    }
  }, [tab, usernameChecked, showUsernameSetup]);

  // Reload threads when filter/sort changes
  useEffect(() => {
    if (tab === 'threads' && usernameChecked && !showUsernameSetup) {
      loadTabData('threads');
    }
  }, [threadCategory, threadSort]);

  const loadTabData = async (t: TabId) => {
    setLoading(true);
    try {
      if (t === 'rooms') {
        const res = await apiFetch('/api/community/rooms');
        if (res.ok) { const d = await res.json(); setRooms(d.rooms || []); }
      } else if (t === 'friends') {
        const res = await apiFetch('/api/community/friends?type=all');
        if (res.ok) {
          const d = await res.json();
          setFriends(d.friends || []);
          setSuggestions(d.suggestions || []);
          setPendingRequests(d.pendingRequests || []);
        }
      } else if (t === 'threads') {
        const params = new URLSearchParams({ sort: threadSort });
        if (threadCategory !== 'all') params.set('category', threadCategory);
        const res = await apiFetch(`/api/community/threads?${params}`);
        if (res.ok) { const d = await res.json(); setThreads(d.threads || []); }
      } else if (t === 'events') {
        const res = await apiFetch('/api/community/events');
        if (res.ok) { const d = await res.json(); setEvents(d.events || []); setAiChallenges(d.aiChallenges || []); setCommunityChallenges(d.communityChallenges || []); }
      } else if (t === 'rankings') {
        const res = await apiFetch('/api/community/rankings');
        if (res.ok) {
          const d = await res.json();
          setRankings(d.rankings || []);
          setWeekInfo(d.weekInfo || null);
        }
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  };

  /* ---- Room actions ---- */
  const joinRoom = async (roomId: string) => {
    await apiFetch('/api/community/rooms', {
      method: 'POST', body: JSON.stringify({ action: 'join', roomId }),
    });
    loadTabData('rooms');
  };

  const leaveRoom = async (roomId: string) => {
    await apiFetch('/api/community/rooms', {
      method: 'POST', body: JSON.stringify({ action: 'leave', roomId }),
    });
    if (activeRoom?.id === roomId) setActiveRoom(null);
    loadTabData('rooms');
  };

  const openRoom = async (room: Room) => {
    if (!room.isJoined) await joinRoom(room.id);
    setActiveRoom(room);
    setMessages([]);
    // Load messages from API
    try {
      const res = await apiFetch(`/api/community/rooms/${room.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeRoom || sendingMsg) return;
    setSendingMsg(true);
    try {
      const res = await apiFetch(`/api/community/rooms/${activeRoom.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: msgInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setMsgInput('');
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    finally { setSendingMsg(false); }
  };

  const submitRoomRequest = async () => {
    if (!newRoomName.trim()) return;
    setSubmittingRoom(true);
    try {
      const res = await apiFetch('/api/community/rooms/request', {
        method: 'POST',
        body: JSON.stringify({ name: newRoomName, description: newRoomDesc, visibility: newRoomVisibility }),
      });
      if (res.ok) {
        setShowCreateRoom(false);
        setNewRoomName('');
        setNewRoomDesc('');
      }
    } catch {}
    finally { setSubmittingRoom(false); }
  };

  /* ---- Friend actions ---- */
  const sendFriendRequest = async (targetUserId: string) => {
    await apiFetch('/api/community/friends', {
      method: 'POST', body: JSON.stringify({ action: 'send', targetUserId }),
    });
    setSuggestions(prev => prev.filter(s => s.userId !== targetUserId));
  };

  const acceptFriendRequest = async (requestId: string) => {
    await apiFetch('/api/community/friends', {
      method: 'POST', body: JSON.stringify({ action: 'accept', requestId }),
    });
    loadTabData('friends');
  };

  const rejectFriendRequest = async (requestId: string) => {
    await apiFetch('/api/community/friends', {
      method: 'POST', body: JSON.stringify({ action: 'reject', requestId }),
    });
    setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const dismissSuggestion = async (targetUserId: string) => {
    await apiFetch('/api/community/friends', {
      method: 'POST', body: JSON.stringify({ action: 'dismiss_suggestion', targetUserId }),
    });
    setSuggestions(prev => prev.filter(s => s.userId !== targetUserId));
  };

  /* ---- Event actions ---- */
  const joinEvent = async (eventId: string) => {
    await apiFetch('/api/community/events', {
      method: 'POST', body: JSON.stringify({ action: 'join', eventId }),
    });
    loadTabData('events');
  };

  const submitChallenge = async () => {
    if (!submitTitle.trim() || !submitDescription.trim()) return;
    setSubmittingChallenge(true);
    setSubmitFeedback(null);
    try {
      const res = await apiFetch('/api/community/events', {
        method: 'POST',
        body: JSON.stringify({
          action: 'submit_challenge',
          title: submitTitle,
          description: submitDescription,
          type: submitType,
          unitId: submitUnitId || undefined,
          questions: submitQuestions.length > 0 ? submitQuestions : undefined,
        }),
      });
      const d = await res.json();
      if (d.approved) {
        setSubmitFeedback({ approved: true, message: d.feedback || 'Your challenge was approved and is now live!' });
        setShowSubmitChallenge(false);
        setSubmitTitle(''); setSubmitDescription(''); setSubmitType('trivia');
        setSubmitUnitId(''); setSubmitQuestions([]);
        loadTabData('events');
      } else {
        setSubmitFeedback({ approved: false, message: d.feedback || 'Your challenge was not approved. Please revise and try again.' });
      }
    } catch {
      setSubmitFeedback({ approved: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setSubmittingChallenge(false);
    }
  };

  /* ---- Thread actions ---- */
  const createThread = async () => {
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;
    setSubmittingThread(true);
    try {
      const res = await apiFetch('/api/community/threads', {
        method: 'POST',
        body: JSON.stringify({ title: newThreadTitle, content: newThreadContent, category: newThreadCategory }),
      });
      if (res.ok) {
        setShowNewThread(false);
        setNewThreadTitle('');
        setNewThreadContent('');
        setNewThreadCategory('general');
        loadTabData('threads');
      }
    } catch {}
    finally { setSubmittingThread(false); }
  };

  const voteThread = async (threadId: string, vote: 'up' | 'down' | 'none') => {
    await apiFetch('/api/community/threads', {
      method: 'PATCH',
      body: JSON.stringify({ threadId, vote }),
    });
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      const oldVote = t.userVote;
      let up = t.upvotes, down = t.downvotes;
      if (oldVote === 'up') up--;
      if (oldVote === 'down') down--;
      if (vote === 'up') up++;
      if (vote === 'down') down++;
      return { ...t, upvotes: up, downvotes: down, userVote: vote === 'none' ? null : vote };
    }));
  };

  const openThread = async (thread: Thread) => {
    setActiveThread(thread);
    setLoadingReplies(true);
    try {
      const res = await apiFetch(`/api/community/threads/replies?threadId=${thread.id}`);
      if (res.ok) { const d = await res.json(); setThreadReplies(d.replies || []); }
    } catch {}
    finally { setLoadingReplies(false); }
  };

  const postReply = async () => {
    if (!replyInput.trim() || !activeThread) return;
    setSubmittingReply(true);
    try {
      const res = await apiFetch('/api/community/threads/replies', {
        method: 'POST',
        body: JSON.stringify({ threadId: activeThread.id, content: replyInput }),
      });
      if (res.ok) {
        setReplyInput('');
        const d = await res.json();
        setThreadReplies(prev => [...prev, d.reply]);
        setActiveThread(prev => prev ? { ...prev, replyCount: prev.replyCount + 1 } : null);
      }
    } catch {}
    finally { setSubmittingReply(false); }
  };

  const voteReply = async (replyId: string, vote: 'up' | 'down' | 'none') => {
    await apiFetch('/api/community/threads/replies', {
      method: 'PATCH',
      body: JSON.stringify({ replyId, vote }),
    });
    setThreadReplies(prev => prev.map(r => {
      if (r.id !== replyId) return r;
      const oldVote = r.userVote;
      let up = r.upvotes, down = r.downvotes;
      if (oldVote === 'up') up--;
      if (oldVote === 'down') down--;
      if (vote === 'up') up++;
      if (vote === 'down') down++;
      return { ...r, upvotes: up, downvotes: down, userVote: vote === 'none' ? null : vote };
    }));
  };

  /* ================================================================
     USERNAME SETUP MODAL
     ================================================================ */
  if (showUsernameSetup) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-card border border-border/30 p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Welcome to the Community</h2>
            <p className="text-sm text-muted-foreground">
              Choose a username that other students will see. You can keep the suggested one or pick your own.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input
                value={username}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setUsername(v);
                  setUsernameAvailable(null);
                  setUsernameError('');
                }}
                onBlur={() => checkUsernameAvailability(username)}
                placeholder="your_username"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl bg-background border border-border/30 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingUsername && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!checkingUsername && usernameAvailable === true && <Check className="h-4 w-4 text-emerald-500" />}
                {!checkingUsername && usernameAvailable === false && <X className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            {usernameError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {usernameError}
              </p>
            )}
            {suggestedUsername && username !== suggestedUsername && (
              <button
                onClick={() => { setUsername(suggestedUsername); checkUsernameAvailability(suggestedUsername); }}
                className="text-xs text-primary hover:underline"
              >
                Use suggested: @{suggestedUsername}
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">3-20 characters. Letters, numbers, underscores only.</p>
          </div>

          <button
            onClick={saveUsername}
            disabled={!username || username.length < 3 || usernameAvailable === false || savingUsername}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {savingUsername ? 'Saving...' : 'Join Community'}
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================
     ROOM CHAT VIEW
     ================================================================ */
  if (activeRoom) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
        {/* Room header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-card/50">
          <button onClick={() => setActiveRoom(null)} className="p-1.5 rounded-lg hover:bg-muted/40">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {activeRoom.name}
            </h2>
            <p className="text-[11px] text-muted-foreground">{activeRoom.memberCount} members</p>
          </div>
          <button
            onClick={() => leaveRoom(activeRoom.id)}
            className="text-xs text-muted-foreground hover:text-red-500"
          >
            Leave
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const showHeader = !prev || prev.userId !== msg.userId || 
              (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000);
            const isMe = msg.isCurrentUser;

            return (
              <div key={msg.id} className={`flex gap-2.5 ${showHeader ? 'mt-3 first:mt-0' : 'mt-0.5'} ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar - only show on header messages */}
                {showHeader ? (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.isAgent ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20' 
                    : isMe ? 'bg-primary/15 text-primary' 
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {msg.isAgent ? <Sparkles className="h-3.5 w-3.5" /> : (msg.displayName?.[0]?.toUpperCase() || '?')}
                  </div>
                ) : (
                  <div className="w-8 shrink-0" />
                )}

                {/* Message bubble */}
                <div className={`max-w-[75%] min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                  {showHeader && (
                    <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`text-xs font-semibold ${msg.isAgent ? 'text-primary' : isMe ? 'text-primary/80' : 'text-foreground'}`}>
                        {msg.isAgent ? 'YNAI Agent' : (msg.displayName || 'Anonymous')}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(msg.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.isAgent 
                      ? 'bg-primary/5 border border-primary/10 text-foreground rounded-tl-md' 
                      : isMe 
                        ? 'bg-primary text-primary-foreground rounded-tr-md' 
                        : 'bg-card border border-border/20 text-foreground rounded-tl-md'
                  } ${!showHeader && !isMe ? 'rounded-tl-2xl' : ''} ${!showHeader && isMe ? 'rounded-tr-2xl' : ''}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="px-4 py-3 border-t border-border/20 bg-card/50">
          <div className="flex gap-2 items-end">
            <textarea
              value={msgInput}
              onChange={e => {
                setMsgInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Message #${activeRoom.name.toLowerCase()}`}
              rows={1}
              className="flex-1 px-3 py-2 rounded-xl bg-background border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20 resize-none overflow-y-auto"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!msgInput.trim() || sendingMsg}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 transition-opacity shrink-0"
            >
              {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     MAIN COMMUNITY VIEW
     ================================================================ */
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Community
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Study together, compete, and grow with fellow candidates
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card/30 border border-border/15 rounded-2xl p-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  tab === t.id
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        )}

        {/* ============ ROOMS TAB ============ */}
        {!loading && tab === 'rooms' && (
          <div className="space-y-4">
            {/* Create room button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateRoom(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Request Room
              </button>
            </div>

            {/* Official Unit Rooms */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Official Unit Groups</h3>
              <div className="grid gap-2">
                {rooms.filter(r => r.roomType === 'official').map(room => {
                  const cfg = UNIT_CONFIG[room.unitId || ''] || { icon: Hash, color: 'text-primary', bg: 'bg-primary/10' };
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/10 cursor-pointer hover:bg-card/60 transition-colors"
                    >
                      <div className={`p-2.5 rounded-xl ${cfg.bg} shrink-0`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{room.name}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" /> {room.memberCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-2.5 w-2.5" /> {room.messageCount}
                          </span>
                          <span>{room.lastActivity}</span>
                        </div>
                      </div>
                      {room.isJoined ? (
                        <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Joined</span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); joinRoom(room.id); }}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Join
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Rooms */}
            {rooms.filter(r => r.roomType === 'custom').length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Rooms</h3>
                <div className="grid gap-2">
                  {rooms.filter(r => r.roomType === 'custom').map(room => (
                    <div
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/10 cursor-pointer hover:bg-card/60 transition-colors"
                    >
                      <div className={`p-2.5 rounded-xl ${room.isPublic ? 'bg-primary/10' : 'bg-amber-500/10'} shrink-0`}>
                        {room.isPublic ? <Globe className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{room.name}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {room.memberCount}</span>
                          <span>{room.lastActivity}</span>
                        </div>
                      </div>
                      {room.isJoined ? (
                        <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Joined</span>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); joinRoom(room.id); }} className="text-xs text-primary font-medium hover:underline">Join</button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Room Modal */}
            {showCreateRoom && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateRoom(false)}>
                <div className="w-full max-w-md rounded-2xl bg-card border border-border/30 p-6 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold">Request a Room</h3>
                  <p className="text-sm text-muted-foreground">Submit a request to create a custom study room. An admin will review it.</p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Room Name</label>
                      <input
                        value={newRoomName}
                        onChange={e => setNewRoomName(e.target.value)}
                        placeholder="e.g. Moot Court Practice Group"
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                      <textarea
                        value={newRoomDesc}
                        onChange={e => setNewRoomDesc(e.target.value)}
                        placeholder="What is this room about?"
                        rows={3}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Visibility</label>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => setNewRoomVisibility('public')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                            newRoomVisibility === 'public' ? 'border-primary bg-primary/5 text-primary' : 'border-border/20 text-muted-foreground'
                          }`}
                        >
                          <Globe className="h-3.5 w-3.5" /> Public
                        </button>
                        <button
                          onClick={() => setNewRoomVisibility('private')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                            newRoomVisibility === 'private' ? 'border-primary bg-primary/5 text-primary' : 'border-border/20 text-muted-foreground'
                          }`}
                        >
                          <Lock className="h-3.5 w-3.5" /> Private
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowCreateRoom(false)} className="flex-1 py-2 rounded-xl border border-border/20 text-sm font-medium text-muted-foreground hover:bg-muted/30">
                      Cancel
                    </button>
                    <button
                      onClick={submitRoomRequest}
                      disabled={!newRoomName.trim() || submittingRoom}
                      className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {submittingRoom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Submit Request
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ THREADS TAB ============ */}
        {!loading && tab === 'threads' && !activeThread && (
          <div className="space-y-4">
            {/* Category pills row */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {THREAD_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setThreadCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    threadCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sort + New Thread */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(['recent', 'top', 'hot'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setThreadSort(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      threadSort === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'recent' ? '🕐 New' : s === 'top' ? '🔥 Top' : '⚡ Hot'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowNewThread(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New Post
              </button>
            </div>

            {/* New thread form */}
            {showNewThread && (
              <div className="rounded-xl border border-primary/20 bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Create a Post</h3>
                  <button onClick={() => setShowNewThread(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={newThreadTitle}
                  onChange={e => setNewThreadTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-3 py-2 rounded-lg border border-border/30 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  maxLength={200}
                />
                <textarea
                  value={newThreadContent}
                  onChange={e => setNewThreadContent(e.target.value)}
                  placeholder="What's on your mind? Share a meme, a study tip, or vent about exams..."
                  className="w-full px-3 py-2 rounded-lg border border-border/30 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none h-24"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newThreadCategory}
                    onChange={e => setNewThreadCategory(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-border/30 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {THREAD_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={() => { setShowNewThread(false); setNewThreadTitle(''); setNewThreadContent(''); }}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createThread}
                    disabled={submittingThread || !newThreadTitle.trim() || !newThreadContent.trim()}
                    className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
                  >
                    {submittingThread ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post'}
                  </button>
                </div>
              </div>
            )}

            {/* Thread list */}
            {threads.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No threads yet. Be the first to post!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map(thread => {
                  const score = thread.upvotes - thread.downvotes;
                  const timeAgo = getTimeAgo(thread.createdAt);
                  return (
                    <div
                      key={thread.id}
                      className={`rounded-xl border bg-card/40 hover:bg-card/70 transition-all cursor-pointer ${
                        thread.isPinned ? 'border-primary/20' : 'border-border/10'
                      }`}
                      onClick={() => openThread(thread)}
                    >
                      <div className="flex gap-3 p-3.5">
                        {/* Vote column */}
                        <div className="flex flex-col items-center gap-0.5 pt-0.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => voteThread(thread.id, thread.userVote === 'up' ? 'none' : 'up')}
                            className={`p-1 rounded-md transition-colors ${thread.userVote === 'up' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-primary'}`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <span className={`text-xs font-bold ${score > 0 ? 'text-primary' : score < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {score}
                          </span>
                          <button
                            onClick={() => voteThread(thread.id, thread.userVote === 'down' ? 'none' : 'down')}
                            className={`p-1 rounded-md transition-colors ${thread.userVote === 'down' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/40 hover:text-red-500'}`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {thread.isPinned && (
                              <span className="text-[9px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">📌 Pinned</span>
                            )}
                            {thread.isAgentPost && (
                              <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">🤖 AI</span>
                            )}
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{thread.category}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground leading-snug mb-1 line-clamp-2">{thread.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{thread.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                            <span className="font-medium">{thread.authorName || 'Anonymous'}</span>
                            <span>·</span>
                            <span>{timeAgo}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {thread.replyCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ THREAD DETAIL VIEW ============ */}
        {!loading && tab === 'threads' && activeThread && (
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => { setActiveThread(null); setThreadReplies([]); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to threads
            </button>

            {/* Thread post */}
            <div className="rounded-xl border border-border/20 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {activeThread.isAgentPost && (
                  <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">🤖 AI</span>
                )}
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{activeThread.category}</span>
              </div>
              <h2 className="text-base font-bold">{activeThread.title}</h2>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{activeThread.content}</p>
              <div className="flex items-center gap-4 pt-2 border-t border-border/10 text-[11px] text-muted-foreground">
                <span className="font-medium">{activeThread.authorName || 'Anonymous'}</span>
                <span>{getTimeAgo(activeThread.createdAt)}</span>
                <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => voteThread(activeThread.id, activeThread.userVote === 'up' ? 'none' : 'up')}
                    className={`p-1 rounded-md ${activeThread.userVote === 'up' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-primary'}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-bold">{activeThread.upvotes - activeThread.downvotes}</span>
                  <button
                    onClick={() => voteThread(activeThread.id, activeThread.userVote === 'down' ? 'none' : 'down')}
                    className={`p-1 rounded-md ${activeThread.userVote === 'down' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/40 hover:text-red-500'}`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Reply input */}
            {!activeThread.isLocked && (
              <div className="flex gap-2">
                <input
                  value={replyInput}
                  onChange={e => setReplyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postReply()}
                  placeholder="Write a reply..."
                  className="flex-1 px-3 py-2 rounded-xl border border-border/30 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  onClick={postReply}
                  disabled={submittingReply || !replyInput.trim()}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                >
                  {submittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Replies */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {activeThread.replyCount} {activeThread.replyCount === 1 ? 'Reply' : 'Replies'}
              </h3>

              {loadingReplies ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                </div>
              ) : threadReplies.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No replies yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {threadReplies.map(reply => (
                    <div
                      key={reply.id}
                      className={`rounded-xl border bg-card/30 p-3.5 ${
                        reply.isAgentReply ? 'border-primary/15' : 'border-border/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                          {reply.isAgentReply ? '🤖' : (reply.authorName?.[0] || '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{reply.authorName || 'Anonymous'}</span>
                            {reply.isAgentReply && (
                              <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">AI</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">{getTimeAgo(reply.createdAt)}</span>
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => voteReply(reply.id, reply.userVote === 'up' ? 'none' : 'up')}
                              className={`p-1 rounded-md text-xs flex items-center gap-0.5 ${reply.userVote === 'up' ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-primary'}`}
                            >
                              <ThumbsUp className="h-3 w-3" /> {reply.upvotes || ''}
                            </button>
                            <button
                              onClick={() => voteReply(reply.id, reply.userVote === 'down' ? 'none' : 'down')}
                              className={`p-1 rounded-md text-xs ${reply.userVote === 'down' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/40 hover:text-red-500'}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ FRIENDS TAB ============ */}
        {!loading && tab === 'friends' && (
          <div className="space-y-5">
            {/* Pending friend requests */}
            {pendingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Bell className="h-3 w-3" /> Friend Requests ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.requestId} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/10">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {req.displayName?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{req.displayName}</p>
                        <p className="text-[11px] text-muted-foreground">Wants to connect</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => acceptFriendRequest(req.requestId)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                          <UserCheck className="h-4 w-4" />
                        </button>
                        <button onClick={() => rejectFriendRequest(req.requestId)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
                          <UserX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions - Snapchat style */}
            {suggestions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Suggested for You
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {suggestions.map(s => (
                    <div key={s.id} className="relative flex flex-col items-center p-4 rounded-xl bg-card/40 border border-border/10 group">
                      <button
                        onClick={() => dismissSuggestion(s.userId)}
                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-bold text-primary mb-2">
                        {s.displayName?.[0] || '?'}
                      </div>
                      <p className="text-xs font-medium truncate w-full text-center">{s.displayName}</p>
                      {s.reasons[0] && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate w-full text-center">{s.reasons[0]}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${s.matchScore}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{s.matchScore}%</span>
                      </div>
                      <button
                        onClick={() => sendFriendRequest(s.userId)}
                        className="mt-2 w-full py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 flex items-center justify-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Friends */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                My Friends ({friends.length})
              </h3>
              {friends.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <UserPlus className="h-10 w-10 mx-auto text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No friends yet. Add some from the suggestions above!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(f => (
                    <div key={f.friendshipId} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/10">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {f.displayName?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.displayName}</p>
                        {f.sharedInterests.length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">{f.sharedInterests.join(' - ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-pink-500" />
                        <span className="text-[10px] text-muted-foreground">{f.matchScore}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ CHALLENGES TAB ============ */}
        {!loading && tab === 'events' && (
          <div className="space-y-6">
            {/* Submit Feedback Banner */}
            {submitFeedback && (
              <div className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${
                submitFeedback.approved
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
              }`}>
                {submitFeedback.approved ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <p className="text-xs">{submitFeedback.message}</p>
                <button onClick={() => setSubmitFeedback(null)} className="ml-auto shrink-0"><X className="h-3 w-3" /></button>
              </div>
            )}

            {/* ---- Section 1: Today's AI Challenges ---- */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold">Today&apos;s AI Challenges</h2>
                <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">Counts for Rankings</span>
              </div>
              {aiChallenges.length === 0 ? (
                <div className="text-center py-10 space-y-2 rounded-xl border border-dashed border-border/30">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">AI challenges for today are being prepared...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiChallenges.map(event => {
                    const isActive = event.status === 'active';
                    const typeColors: Record<string, string> = {
                      trivia: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
                      reading: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
                      quiz_marathon: 'from-orange-500/10 to-orange-600/5 border-orange-500/20',
                      drafting: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
                      research: 'from-teal-500/10 to-teal-600/5 border-teal-500/20',
                    };
                    const typeLabels: Record<string, string> = {
                      trivia: 'Multiple Choice', drafting: 'Drafting', research: 'Short Answer',
                      reading: 'Reading', quiz_marathon: 'Quiz Marathon',
                    };
                    const typeIcons: Record<string, typeof Zap> = {
                      trivia: Zap, reading: BookOpen, quiz_marathon: Target, drafting: FileText, research: Search,
                    };
                    const EventIcon = typeIcons[event.type] || Zap;
                    const colorClass = typeColors[event.type] || typeColors.trivia;

                    return (
                      <div key={event.id} className={`rounded-xl bg-gradient-to-r ${colorClass} border p-4 space-y-3`}>
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-background/50">
                            <EventIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold">{event.title}</h3>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                                {typeLabels[event.type] || event.type}
                              </span>
                              {isActive && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Active</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          </div>
                        </div>

                        {/* Challenge content preview */}
                        {event.challengeContent && event.challengeContent.length > 0 && event.isJoined && (
                          <div className="bg-background/60 rounded-lg p-3 space-y-2 border border-border/10">
                            {event.challengeContent.map((q: { question: string; type: string; options?: string[] }, qi: number) => (
                              <div key={qi} className="space-y-1">
                                <p className="text-xs font-medium">Q{qi + 1}. {q.question}</p>
                                {q.type === 'mcq' && q.options && (
                                  <div className="grid grid-cols-2 gap-1 pl-3">
                                    {q.options.map((opt: string, oi: number) => (
                                      <span key={oi} className="text-[11px] text-muted-foreground">{String.fromCharCode(65 + oi)}. {opt}</span>
                                    ))}
                                  </div>
                                )}
                                {q.type === 'drafting' && <p className="text-[11px] text-muted-foreground pl-3 italic">Draft your response below...</p>}
                                {q.type === 'short_answer' && <p className="text-[11px] text-muted-foreground pl-3 italic">Write a brief answer...</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.participantCount} joined</span>
                            {event.hoursLeft != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.hoursLeft}h left</span>}
                          </div>
                          {!event.isJoined ? (
                            <button onClick={() => joinEvent(event.id)}
                              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors">
                              Take Challenge
                            </button>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Participating</span>
                          )}
                        </div>

                        {event.rewards && event.rewards.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {event.rewards.slice(0, 3).map((r, i) => (
                              <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                {i === 0 ? <Crown className="h-3 w-3 text-amber-500" /> : i === 1 ? <Medal className="h-3 w-3 text-slate-400" /> : <Award className="h-3 w-3 text-amber-700" />}
                                {r.reward}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ---- Section 2: Community Challenges ---- */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <h2 className="text-sm font-bold">Community Challenges</h2>
                  <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium">Peer-Created</span>
                </div>
                <button
                  onClick={() => setShowSubmitChallenge(!showSubmitChallenge)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Submit Challenge
                </button>
              </div>

              {/* Submit Challenge Form */}
              {showSubmitChallenge && (
                <div className="mb-4 p-4 rounded-xl border border-border/30 bg-card/60 space-y-3">
                  <h3 className="text-xs font-semibold flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Create a Challenge
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Your challenge will be reviewed by AI for quality before being published.</p>
                  <input
                    value={submitTitle}
                    onChange={e => setSubmitTitle(e.target.value)}
                    placeholder="Challenge title (e.g. 'Constitutional Law Quiz')"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <textarea
                    value={submitDescription}
                    onChange={e => setSubmitDescription(e.target.value)}
                    placeholder="Describe the challenge — what students should expect, topic areas..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={submitType}
                      onChange={e => setSubmitType(e.target.value as string)}
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="trivia">Multiple Choice</option>
                      <option value="drafting">Drafting</option>
                      <option value="research">Short Answer</option>
                      <option value="quiz_marathon">Quiz Marathon</option>
                      <option value="reading">Reading Challenge</option>
                    </select>
                  </div>

                  {/* Questions Builder */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground">Questions (optional — add your own or let AI generate)</p>
                      <button
                        onClick={() => setSubmitQuestions([...submitQuestions, { question: '', type: submitType === 'trivia' ? 'mcq' : submitType === 'drafting' ? 'drafting' : 'short_answer', options: ['', '', '', ''], answer: '' }])}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add Question
                      </button>
                    </div>
                    {submitQuestions.map((q, qi) => (
                      <div key={qi} className="p-3 rounded-lg bg-background/80 border border-border/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium">Question {qi + 1}</span>
                          <button onClick={() => setSubmitQuestions(submitQuestions.filter((_, i) => i !== qi))} className="text-red-500 hover:text-red-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <input
                          value={q.question}
                          onChange={e => { const updated = [...submitQuestions]; updated[qi] = { ...updated[qi], question: e.target.value }; setSubmitQuestions(updated); }}
                          placeholder="Enter the question..."
                          className="w-full px-2 py-1.5 rounded bg-background border border-border/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        {q.type === 'mcq' && q.options && (
                          <div className="grid grid-cols-2 gap-1">
                            {q.options.map((opt, oi) => (
                              <input
                                key={oi}
                                value={opt}
                                onChange={e => {
                                  const updated = [...submitQuestions];
                                  const opts = [...(updated[qi].options || [])];
                                  opts[oi] = e.target.value;
                                  updated[qi] = { ...updated[qi], options: opts };
                                  setSubmitQuestions(updated);
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                className="px-2 py-1 rounded bg-background border border-border/20 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            ))}
                          </div>
                        )}
                        <input
                          value={q.answer}
                          onChange={e => { const updated = [...submitQuestions]; updated[qi] = { ...updated[qi], answer: e.target.value }; setSubmitQuestions(updated); }}
                          placeholder="Correct answer..."
                          className="w-full px-2 py-1.5 rounded bg-background border border-border/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={submitChallenge}
                      disabled={submittingChallenge || !submitTitle.trim() || !submitDescription.trim()}
                      className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {submittingChallenge ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI is reviewing...</> : <><Send className="h-3.5 w-3.5" /> Submit for Review</>}
                    </button>
                    <button
                      onClick={() => { setShowSubmitChallenge(false); setSubmitFeedback(null); }}
                      className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {communityChallenges.length === 0 && !showSubmitChallenge ? (
                <div className="text-center py-10 space-y-2 rounded-xl border border-dashed border-border/30">
                  <Globe className="h-8 w-8 mx-auto text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No community challenges yet. Be the first to create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {communityChallenges.map(event => {
                    const isActive = event.status === 'active';
                    const typeLabels: Record<string, string> = {
                      trivia: 'Multiple Choice', drafting: 'Drafting', research: 'Short Answer',
                      reading: 'Reading', quiz_marathon: 'Quiz Marathon',
                    };

                    return (
                      <div key={event.id} className="rounded-xl bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-blue-500/15 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <Globe className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold">{event.title}</h3>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                                {typeLabels[event.type] || event.type}
                              </span>
                              {isActive && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Active</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                            {event.submitterName && (
                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                <UserCheck className="h-3 w-3" /> Posted by {event.submitterName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Challenge content for participants */}
                        {event.challengeContent && event.challengeContent.length > 0 && event.isJoined && (
                          <div className="bg-background/60 rounded-lg p-3 space-y-2 border border-border/10">
                            {event.challengeContent.map((q: { question: string; type: string; options?: string[] }, qi: number) => (
                              <div key={qi} className="space-y-1">
                                <p className="text-xs font-medium">Q{qi + 1}. {q.question}</p>
                                {q.type === 'mcq' && q.options && (
                                  <div className="grid grid-cols-2 gap-1 pl-3">
                                    {q.options.map((opt: string, oi: number) => (
                                      <span key={oi} className="text-[11px] text-muted-foreground">{String.fromCharCode(65 + oi)}. {opt}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.participantCount} joined</span>
                          </div>
                          {!event.isJoined ? (
                            <button onClick={() => joinEvent(event.id)}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 text-xs font-medium hover:bg-blue-500/15 transition-colors">
                              Join Challenge
                            </button>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Participating</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ RANKINGS TAB ============ */}
        {!loading && tab === 'rankings' && (
          <div className="space-y-4">
            {/* Week info */}
            {weekInfo && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-card/40 border border-border/10">
                <div>
                  <p className="text-xs text-muted-foreground">This Week's Leaderboard</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {weekInfo.daysRemaining}d {weekInfo.hoursRemaining}h remaining
                  </p>
                </div>
                <div className="flex gap-1">
                  {[
                    { icon: Crown, label: '1st', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { icon: Medal, label: '2nd', color: 'text-slate-400', bg: 'bg-slate-400/10' },
                    { icon: Award, label: '3rd', color: 'text-amber-700', bg: 'bg-amber-700/10' },
                  ].map(({ icon: I, label, color, bg }, idx) => (
                    <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded-full ${bg}`}>
                      <I className={`h-3 w-3 ${color}`} />
                      <span className="text-[10px]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rankings list */}
            {rankings.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No rankings yet this week. Start studying to climb the board!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {rankings.map((r, i) => {
                  const isTop3 = r.rank <= 3;
                  const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
                  const RankIcon = r.rank === 1 ? Crown : r.rank === 2 ? Medal : r.rank === 3 ? Award : null;

                  return (
                    <div
                      key={r.userId}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        r.isCurrentUser ? 'bg-primary/5 border border-primary/20' : 'bg-card/40 border border-border/10'
                      }`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                        isTop3 ? 'bg-amber-500/10' : 'bg-muted'
                      }`}>
                        {RankIcon ? (
                          <RankIcon className={`h-4 w-4 ${rankColors[r.rank - 1]}`} />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">#{r.rank}</span>
                        )}
                      </div>

                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {r.displayName?.[0] || '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.displayName} {r.isCurrentUser && <span className="text-[10px] text-primary">(You)</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{r.quizzesCompleted} quizzes completed</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold">{r.totalPoints.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
