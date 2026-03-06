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
  Heart, Zap, Target, TrendingUp, Calendar,
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

interface RoomMessage {
  id: string;
  content: string;
  userId: string | null;
  isAgent: boolean;
  createdAt: string;
  displayName?: string;
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
  { id: 'friends',   label: 'Friends',    icon: UserPlus },
  { id: 'events',    label: 'Challenges', icon: Trophy },
  { id: 'rankings',  label: 'Rankings',   icon: Crown },
] as const;

type TabId = (typeof TABS)[number]['id'];

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
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [weekInfo, setWeekInfo] = useState<any>(null);

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
      } else if (t === 'events') {
        const res = await apiFetch('/api/community/events');
        if (res.ok) { const d = await res.json(); setEvents(d.events || []); }
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
    // Load messages - no dedicated messages endpoint yet, placeholder
    setMessages([]);
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.isAgent ? 'flex-row' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.isAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {msg.isAgent ? <Sparkles className="h-3.5 w-3.5" /> : (msg.displayName?.[0] || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{msg.isAgent ? 'YNAI Agent' : (msg.displayName || 'Anonymous')}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="px-4 py-3 border-t border-border/20 bg-card/50">
          <div className="flex gap-2">
            <input
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); /* sendMessage() */ } }}
              placeholder={`Message #${activeRoom.name.toLowerCase()}`}
              className="flex-1 px-3 py-2 rounded-xl bg-background border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              disabled={!msgInput.trim() || sendingMsg}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
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

        {/* ============ EVENTS TAB ============ */}
        {!loading && tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No challenges yet. Check back soon!</p>
              </div>
            ) : (
              events.map(event => {
                const isActive = event.status === 'active';
                const isUpcoming = event.status === 'upcoming';
                const typeColors: Record<string, string> = {
                  trivia: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
                  reading: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
                  quiz_marathon: 'from-orange-500/10 to-orange-600/5 border-orange-500/20',
                  drafting: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
                  research: 'from-teal-500/10 to-teal-600/5 border-teal-500/20',
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
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{event.title}</h3>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-emerald-500/10 text-emerald-600' : isUpcoming ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                          }`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.participantCount} joined</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Ends {new Date(event.endsAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {!event.isJoined ? (
                        <button
                          onClick={() => joinEvent(event.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15"
                        >
                          Join Challenge
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
              })
            )}
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
