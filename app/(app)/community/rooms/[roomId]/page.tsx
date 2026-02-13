'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  MessageCircle,
  Send,
  BookOpen,
  MoreVertical,
  Pin,
  Heart,
  Reply,
  Share,
  Settings,
  Bell,
  BellOff,
  LogOut,
  Shield,
  Crown,
  Clock,
  Image as ImageIcon,
  Link as LinkIcon,
  Hash,
  ThumbsUp,
  MessageSquare,
  Star,
} from 'lucide-react';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  likes: number;
  replies: number;
  isLiked: boolean;
}

interface RoomMember {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: string;
  isOnline: boolean;
}

// Mock messages
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    userId: '1',
    userName: 'Sarah Wanjiku',
    content: 'Has anyone studied the amendments to the Constitution regarding county functions? I\'m finding it confusing.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    likes: 5,
    replies: 3,
    isLiked: false,
  },
  {
    id: '2',
    userId: '2',
    userName: 'John Kamau',
    content: 'Yes! The Fourth Schedule is key. It divides functions between national and county governments. Focus on Articles 186 and 187 for the principles.',
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    isPinned: true,
    likes: 12,
    replies: 1,
    isLiked: true,
  },
  {
    id: '3',
    userId: '3',
    userName: 'Grace Adhiambo',
    content: 'Also check out the Intergovernmental Relations Act 2012 - it complements the constitutional provisions.',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    likes: 8,
    replies: 0,
    isLiked: false,
  },
  {
    id: '4',
    userId: '1',
    userName: 'Sarah Wanjiku',
    content: 'Thanks everyone! This is really helpful. I\'ll focus on those sections for the quiz tomorrow.',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isPinned: false,
    likes: 3,
    replies: 0,
    isLiked: false,
  },
  {
    id: '5',
    userId: '4',
    userName: 'Peter Omondi',
    content: 'Quick tip: The Supreme Court advisory opinion on devolution (Advisory Opinion No. 2 of 2014) is great for understanding how courts interpret county powers.',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isPinned: false,
    likes: 15,
    replies: 2,
    isLiked: false,
  },
];

const MOCK_MEMBERS: RoomMember[] = [
  { id: '1', userId: '1', displayName: 'Sarah Wanjiku', role: 'member', joinedAt: '2024-01-15', isOnline: true },
  { id: '2', userId: '2', displayName: 'John Kamau', role: 'admin', joinedAt: '2024-01-10', isOnline: true },
  { id: '3', userId: '3', displayName: 'Grace Adhiambo', role: 'moderator', joinedAt: '2024-01-12', isOnline: false },
  { id: '4', userId: '4', displayName: 'Peter Omondi', role: 'member', joinedAt: '2024-01-18', isOnline: true },
  { id: '5', userId: '5', displayName: 'Mary Njeri', role: 'member', joinedAt: '2024-01-20', isOnline: false },
];

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [members, setMembers] = useState<RoomMember[]>(MOCK_MEMBERS);
  const [newMessage, setNewMessage] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Extract room info from ID
  const roomId = params.roomId as string;
  const isOfficialRoom = roomId.startsWith('official-');
  const unitId = isOfficialRoom ? roomId.replace('official-', '') : null;
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  
  const roomName = unit?.name || 'Study Room';
  const roomDescription = unit 
    ? `Official study room for ${unit.name}. Ask questions, share insights, and collaborate with fellow learners.`
    : 'A place to discuss and learn together.';

  const onlineCount = members.filter(m => m.isOnline).length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const message: Message = {
      id: Date.now().toString(),
      userId: user?.uid || 'anonymous',
      userName: user?.displayName || 'Anonymous',
      content: newMessage,
      createdAt: new Date().toISOString(),
      isPinned: false,
      likes: 0,
      replies: 0,
      isLiked: false,
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleLike = (messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          isLiked: !msg.isLiked,
          likes: msg.isLiked ? msg.likes - 1 : msg.likes + 1,
        };
      }
      return msg;
    }));
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'admin': return <Shield className="h-3 w-3 text-green-500" />;
      case 'moderator': return <Star className="h-3 w-3 text-emerald-500" />;
      default: return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/community')}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {isOfficialRoom ? (
                <BookOpen className="h-5 w-5 text-green-600 dark:text-green-500" />
              ) : (
                <Hash className="h-5 w-5 text-green-600 dark:text-green-500" />
              )}
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                {roomName}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {onlineCount} online
                </span>
                <span>•</span>
                <span>{members.length} members</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNotificationsOn(!isNotificationsOn)}
              className="h-8 w-8"
            >
              {isNotificationsOn ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMembers(!showMembers)}
              className={`h-8 w-8 ${showMembers ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : ''}`}
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Room Info Card */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <BookOpen className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {roomDescription}
                </p>
                {unit && (
                  <div className="mt-2 flex items-center gap-2">
                    <Link href={`/study/${unit.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <BookOpen className="h-3 w-3" />
                        Study This Unit
                      </Button>
                    </Link>
                    <Link href={`/exams/${unit.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        Take Quiz
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Pinned Messages */}
            {messages.filter(m => m.isPinned).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Pin className="h-3 w-3" />
                  Pinned Messages
                </p>
                {messages.filter(m => m.isPinned).map((message) => (
                  <div
                    key={message.id}
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-medium shrink-0">
                        {message.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{message.userName}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                          <Pin className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Regular Messages */}
            {messages.filter(m => !m.isPinned).map((message) => (
              <div key={message.id} className="group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-medium shrink-0">
                    {message.userName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {message.userName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {message.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={() => handleLike(message.id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          message.isLiked 
                            ? 'text-rose-500' 
                            : 'text-muted-foreground hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${message.isLiked ? 'fill-current' : ''}`} />
                        {message.likes > 0 && message.likes}
                      </button>
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-500 transition-colors">
                        <Reply className="h-3.5 w-3.5" />
                        {message.replies > 0 && message.replies}
                      </button>
                    </div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Share your thoughts..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                  className="resize-none pr-20"
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-green-600 hover:bg-green-700 h-10 w-10 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Members Sidebar */}
        {showMembers && (
          <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Members ({members.length})
              </h3>
              
              {/* Online Members */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Online - {onlineCount}
                </p>
                <div className="space-y-2">
                  {members.filter(m => m.isOnline).map((member) => (
                    <div key={member.id} className="flex items-center gap-2 group">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-medium">
                          {member.displayName.charAt(0)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
                          {member.displayName}
                          {getRoleBadge(member.role)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offline Members */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Offline - {members.length - onlineCount}
                </p>
                <div className="space-y-2">
                  {members.filter(m => !m.isOnline).map((member) => (
                    <div key={member.id} className="flex items-center gap-2 opacity-60">
                      <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium">
                        {member.displayName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex items-center gap-1">
                          {member.displayName}
                          {getRoleBadge(member.role)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
