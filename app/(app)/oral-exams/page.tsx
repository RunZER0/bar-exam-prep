'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import {
  Mic, MicOff, Volume2, VolumeX, Play, Square, Send, ArrowLeft,
  Loader2, Swords, Users, Zap, Shield, Flame, BookOpen, ChevronRight,
  RotateCcw, BarChart3, MessageSquare, Settings, StopCircle,
  CheckCircle, AlertCircle, Clock, Sparkles,
} from 'lucide-react';
import { ATP_UNITS } from '@/lib/constants/legal-content';

/* ================================================================
   TYPES
   ================================================================ */
type ExamType = 'devils-advocate' | 'examiner';
type Mode = 'easy' | 'balanced' | 'aggressive';
type FeedbackMode = 'per-exchange' | 'end';
type InputMode = 'voice' | 'text';
type SessionPhase = 'setup' | 'active' | 'summary';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  panelist?: {
    id: string;
    name: string;
    title: string;
    avatar: string;
    voice: string;
  };
  isPlaying?: boolean;
}

interface SessionSummary {
  content: string;
  score: number | null;
}

/* ================================================================
   PANELIST DATA (mirrors API)
   ================================================================ */
const PANELISTS_INFO = [
  { id: 'justice-mwangi', name: 'Justice Mwangi', title: 'Retired High Court Judge', avatar: '⚖️' },
  { id: 'advocate-amara', name: 'Advocate Amara', title: 'Senior Litigation Counsel', avatar: '🔥' },
  { id: 'prof-otieno', name: 'Prof. Otieno', title: 'Professor of Law', avatar: '📚' },
];

/* ================================================================
   COMPONENT
   ================================================================ */
export default function OralExamsPage() {
  useTimeTracker('oral-exams');
  const { user, getIdToken } = useAuth();

  // ---- Setup state ----
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [mode, setMode] = useState<Mode>('balanced');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('end');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [panelistCount, setPanelistCount] = useState(3);
  const [enableStreaming, setEnableStreaming] = useState(true);

  // ---- Session state ----
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPanelistIndex, setCurrentPanelistIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingPanelist, setStreamingPanelist] = useState<any>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ---- Voice state ----
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ---- Refs ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ---- Scroll to bottom ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---- Auto-resize textarea ----
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [textInput]);

  /* ================================================================
     API HELPERS
     ================================================================ */
  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    return fetch(url, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}` },
    });
  }, [getIdToken]);

  const authFetchJSON = useCallback(async (url: string, body: any) => {
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [authFetch]);

  /* ================================================================
     TTS — Play AI response
     ================================================================ */
  const playTTS = useCallback(async (text: string, voice: string = 'onyx') => {
    if (isMuted) return;
    try {
      setIsPlayingAudio(true);
      const res = await authFetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: 1.05 }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setIsPlayingAudio(false);
    }
  }, [isMuted, authFetch]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
  }, []);

  /* ================================================================
     STT — Record and transcribe
     ================================================================ */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic error:', err);
      setError('Microphone access denied. Please allow microphone access or switch to text mode.');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size < 100) {
          reject(new Error('Recording too short'));
          return;
        }

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const token = await getIdToken();
          const res = await fetch('/api/voice/stt', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json();
          resolve(data.text || '');
        } catch (err) {
          reject(err);
        }

        // Stop all tracks
        recorder.stream.getTracks().forEach(t => t.stop());
      };

      recorder.stop();
    });
  }, [getIdToken]);

  /* ================================================================
     SEND MESSAGE — core conversation loop
     ================================================================ */
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading || isStreaming) return;
    setError(null);

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userText.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setTextInput('');

    try {
      const payload: any = {
        type: examType,
        mode,
        feedbackMode,
        unitId: selectedUnit || undefined,
        stream: enableStreaming,
        messages: updatedMessages.map(m => ({
          role: m.role,
          content: m.content,
          panelistId: m.panelist?.id,
        })),
      };

      if (examType === 'examiner') {
        payload.panelistCount = panelistCount;
        payload.currentPanelistIndex = currentPanelistIndex;
      }

      if (enableStreaming) {
        // -------- STREAMING MODE --------
        setIsStreaming(true);
        setStreamingContent('');
        setStreamingPanelist(null);

        const token = await getIdToken();
        const response = await fetch('/api/oral-exams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Stream failed');
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let metadata: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'metadata') {
                  metadata = data;
                  if (data.panelist) setStreamingPanelist(data.panelist);
                  if (data.nextPanelistIndex !== undefined) {
                    setCurrentPanelistIndex(data.nextPanelistIndex);
                  }
                }

                if (data.type === 'chunk') {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }

                if (data.type === 'done') {
                  // Stream complete — add final message
                  const aiMsg: Message = {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    content: data.fullContent || fullContent,
                    timestamp: new Date(),
                    panelist: metadata?.panelist || undefined,
                  };
                  setMessages(prev => [...prev, aiMsg]);
                  setStreamingContent('');
                  setStreamingPanelist(null);
                  setIsStreaming(false);

                  // Play TTS after streaming completes
                  const voice = metadata?.panelist?.voice || metadata?.voice || 'onyx';
                  await playTTS(aiMsg.content, voice);
                }

                if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseErr) {
                // Incomplete JSON, continue
              }
            }
          }
        }
      } else {
        // NON-STREAMING MODE (existing)
        setIsLoading(true);
        const data = await authFetchJSON('/api/oral-exams', payload);

        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
          panelist: data.panelist || undefined,
        };
        setMessages(prev => [...prev, aiMsg]);

        if (data.nextPanelistIndex !== undefined) {
          setCurrentPanelistIndex(data.nextPanelistIndex);
        }

        // Play TTS
        const voice = data.panelist?.voice || data.voice || 'onyx';
        await playTTS(data.content, voice);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Send error:', err);
      setError('Failed to get response. Please try again.');
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [messages, examType, mode, feedbackMode, selectedUnit, panelistCount, currentPanelistIndex, isLoading, isStreaming, enableStreaming, authFetchJSON, playTTS, getIdToken]);

  /* ================================================================
     START SESSION
     ================================================================ */
  const startSession = useCallback(async () => {
    setPhase('active');
    setMessages([]);
    setIsLoading(true);
    setError(null);
    setCurrentPanelistIndex(0);

    try {
      const payload: any = {
        type: examType,
        mode,
        feedbackMode,
        unitId: selectedUnit || undefined,
        messages: [],
      };

      if (examType === 'examiner') {
        payload.panelistCount = panelistCount;
        payload.currentPanelistIndex = 0;
      }

      const data = await authFetchJSON('/api/oral-exams', payload);

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        panelist: data.panelist || undefined,
      };
      setMessages([aiMsg]);

      if (data.nextPanelistIndex !== undefined) {
        setCurrentPanelistIndex(data.nextPanelistIndex);
      }

      const voice = data.panelist?.voice || data.voice || 'onyx';
      await playTTS(data.content, voice);
    } catch (err) {
      console.error('Start error:', err);
      setError('Failed to start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [examType, mode, feedbackMode, selectedUnit, panelistCount, authFetchJSON, playTTS]);

  /* ================================================================
     END SESSION — get summary
     ================================================================ */
  const endSession = useCallback(async () => {
    if (messages.length < 2) {
      setPhase('setup');
      return;
    }

    setIsLoading(true);
    stopAudio();
    try {
      const data = await authFetchJSON('/api/oral-exams', {
        type: examType,
        mode,
        feedbackMode,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        generateSummary: true,
      });

      setSummary({ content: data.content, score: data.score });
      setPhase('summary');

      await playTTS(data.content, 'nova');
    } catch (err) {
      console.error('Summary error:', err);
      setError('Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, examType, mode, feedbackMode, authFetchJSON, playTTS, stopAudio]);

  /* ================================================================
     HANDLE VOICE SEND
     ================================================================ */
  const handleVoiceSend = useCallback(async () => {
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (text.trim()) await sendMessage(text);
        else setError('Could not understand the recording. Try again or switch to text.');
      } catch (err) {
        setError('Transcription failed. Try again.');
        setIsRecording(false);
      }
    } else {
      stopAudio();
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording, sendMessage, stopAudio]);

  /* ================================================================
     HANDLE TEXT SEND
     ================================================================ */
  const handleTextSend = useCallback(() => {
    if (textInput.trim()) sendMessage(textInput);
  }, [textInput, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  }, [handleTextSend]);

  /* ================================================================
     FORMAT DURATION
     ================================================================ */
  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  /* ================================================================
     RENDER — SETUP PHASE
     ================================================================ */
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Oral Examinations</h1>
            <p className="text-muted-foreground text-lg">
              Sharpen your advocacy skills with AI-powered oral practice
            </p>
          </div>

          {/* Exam Type Selection */}
          {!examType ? (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Devil's Advocate */}
              <button
                onClick={() => setExamType('devils-advocate')}
                className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-left transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full" />
                <div className="relative space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Swords className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Devil&apos;s Advocate</h2>
                    <p className="text-muted-foreground mt-1">
                      Go toe-to-toe with an AI that challenges your every legal assertion.
                      Defend your position with authority — statute, case law, and logic.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium">Debate</span>
                    <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium">Challenge</span>
                    <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium">1v1</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground group-hover:text-red-500 transition-colors">
                    Start Debate <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </button>

              {/* Oral Examiner */}
              <button
                onClick={() => setExamType('examiner')}
                className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-left transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full" />
                <div className="relative space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Oral Examiner Panel</h2>
                    <p className="text-muted-foreground mt-1">
                      Face a panel of up to 3 examiners with distinct personas.
                      Turn-taking, interruptions, and real oral exam simulation.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">Panel</span>
                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">Simulation</span>
                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">Multi-Examiner</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground group-hover:text-blue-500 transition-colors">
                    Begin Examination <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Configuration Panel */
            <div className="space-y-6">
              <button
                onClick={() => setExamType(null)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to selection
              </button>

              <div className="rounded-2xl border bg-card p-6 md:p-8 space-y-8">
                <div className="flex items-center gap-3">
                  {examType === 'devils-advocate' ? (
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Swords className="w-5 h-5 text-red-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold">
                      {examType === 'devils-advocate' ? "Devil's Advocate" : 'Oral Examiner Panel'}
                    </h2>
                    <p className="text-sm text-muted-foreground">Configure your session</p>
                  </div>
                </div>

                {/* Unit Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Subject Area</label>
                  <select
                    value={selectedUnit}
                    onChange={e => setSelectedUnit(e.target.value)}
                    className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="">All Units (General)</option>
                    {ATP_UNITS.map(u => (
                      <option key={u.id} value={u.id}>{u.code}: {u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Mode Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Difficulty Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: 'easy', label: 'Easy', icon: Shield, desc: 'Warm & guiding', color: 'text-green-500 bg-green-500/10' },
                      { value: 'balanced', label: 'Balanced', icon: Zap, desc: 'Firm but fair', color: 'text-yellow-500 bg-yellow-500/10' },
                      { value: 'aggressive', label: 'Aggressive', icon: Flame, desc: 'Cold & relentless', color: 'text-red-500 bg-red-500/10' },
                    ] as const).map(m => (
                      <button
                        key={m.value}
                        onClick={() => setMode(m.value)}
                        className={`rounded-xl border-2 p-4 text-center transition-all ${
                          mode === m.value
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <m.icon className={`w-6 h-6 mx-auto mb-2 ${m.color.split(' ')[0]}`} />
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panelist Count (examiner only) */}
                {examType === 'examiner' && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Panelists</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(n => (
                        <button
                          key={n}
                          onClick={() => setPanelistCount(n)}
                          className={`rounded-xl border-2 p-4 text-center transition-all ${
                            panelistCount === n
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex justify-center gap-1 mb-2">
                            {PANELISTS_INFO.slice(0, n).map(p => (
                              <span key={p.id} className="text-xl">{p.avatar}</span>
                            ))}
                          </div>
                          <div className="text-sm font-medium">{n} Examiner{n > 1 ? 's' : ''}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {n === 1 ? 'Focused' : n === 2 ? 'Duo' : 'Full Panel'}
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Panel preview */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {PANELISTS_INFO.slice(0, panelistCount).map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs">
                          <span>{p.avatar}</span>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground">• {p.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Mode */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Feedback</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'per-exchange', label: 'After Each Exchange', desc: 'Get feedback on every answer' },
                      { value: 'end', label: 'End of Session', desc: 'Full summary at the end' },
                    ] as const).map(f => (
                      <button
                        key={f.value}
                        onClick={() => setFeedbackMode(f.value)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          feedbackMode === f.value
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="text-sm font-medium">{f.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Mode */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Input Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setInputMode('voice')}
                      className={`rounded-xl border-2 p-4 text-center transition-all ${
                        inputMode === 'voice'
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <Mic className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Voice</div>
                      <div className="text-xs text-muted-foreground mt-1">Speak your answers</div>
                    </button>
                    <button
                      onClick={() => setInputMode('text')}
                      className={`rounded-xl border-2 p-4 text-center transition-all ${
                        inputMode === 'text'
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <MessageSquare className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Text</div>
                      <div className="text-xs text-muted-foreground mt-1">Type your answers</div>
                    </button>
                  </div>
                </div>

                {/* Streaming Mode Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Response Delivery</label>
                    <button
                      onClick={() => setEnableStreaming(!enableStreaming)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enableStreaming ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enableStreaming ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {enableStreaming ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Streaming enabled — responses appear in real-time with controlled interruptions
                      </span>
                    ) : (
                      <span>Standard mode — complete responses delivered at once</span>
                    )}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={startSession}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-lg"
                >
                  <Play className="w-5 h-5" />
                  {examType === 'devils-advocate' ? 'Start Debate' : 'Begin Examination'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER — SUMMARY PHASE
     ================================================================ */
  if (phase === 'summary' && summary) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Session Complete</h1>
            {summary.score !== null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border">
                <span className="text-2xl font-bold">{summary.score}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
            )}
          </div>

          {/* Summary content */}
          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {summary.content}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{messages.filter(m => m.role === 'user').length}</div>
              <div className="text-xs text-muted-foreground">Your Responses</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{messages.length}</div>
              <div className="text-xs text-muted-foreground">Total Exchanges</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <Sparkles className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold capitalize">{mode}</div>
              <div className="text-xs text-muted-foreground">Difficulty</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPhase('setup');
                setMessages([]);
                setSummary(null);
              }}
              className="flex-1 py-3 rounded-xl border bg-card hover:bg-muted transition-colors font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> New Session
            </button>
            <button
              onClick={() => {
                setPhase('active');
                setSummary(null);
              }}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> Continue Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER — ACTIVE SESSION
     ================================================================ */
  const accent = examType === 'devils-advocate' ? 'red' : 'blue';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Top Bar */}
      <div className="shrink-0 border-b bg-card/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {examType === 'devils-advocate' ? (
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Swords className="w-4 h-4 text-red-500" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold leading-none">
              {examType === 'devils-advocate' ? "Devil's Advocate" : 'Oral Panel'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs capitalize ${
                mode === 'easy' ? 'text-green-500' : mode === 'aggressive' ? 'text-red-500' : 'text-yellow-500'
              }`}>
                {mode}
              </span>
              {selectedUnit && (
                <span className="text-xs text-muted-foreground">
                  • {ATP_UNITS.find(u => u.id === selectedUnit)?.code || ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Panelist indicators (examiner) */}
          {examType === 'examiner' && (
            <div className="hidden md:flex items-center gap-1 mr-2">
              {PANELISTS_INFO.slice(0, panelistCount).map((p, i) => (
                <div
                  key={p.id}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                    i === currentPanelistIndex
                      ? 'bg-blue-500/20 ring-2 ring-blue-500 scale-110'
                      : 'bg-muted'
                  }`}
                  title={p.name}
                >
                  {p.avatar}
                </div>
              ))}
            </div>
          )}

          {/* Mute toggle */}
          <button
            onClick={() => { setIsMuted(m => !m); if (!isMuted) stopAudio(); }}
            className={`p-2 rounded-lg transition-colors ${isMuted ? 'bg-red-500/10 text-red-500' : 'hover:bg-muted'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Input mode toggle */}
          <button
            onClick={() => setInputMode(m => m === 'voice' ? 'text' : 'voice')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title={`Switch to ${inputMode === 'voice' ? 'text' : 'voice'} mode`}
          >
            {inputMode === 'voice' ? <MessageSquare className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* End session */}
          <button
            onClick={endSession}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-xs font-medium flex items-center gap-1"
          >
            <StopCircle className="w-3.5 h-3.5" /> End
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const panelist = msg.panelist;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] md:max-w-[70%] ${isUser ? 'order-last' : ''}`}>
                {/* Panelist header */}
                {panelist && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-lg">{panelist.avatar}</span>
                    <span className="text-xs font-medium">{panelist.name}</span>
                    <span className="text-xs text-muted-foreground">• {panelist.title}</span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 ${
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : examType === 'devils-advocate'
                        ? 'bg-card border-l-4 border-l-red-500 border rounded-bl-md'
                        : 'bg-card border-l-4 border-l-blue-500 border rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>

                <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'justify-end' : ''}`}>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isUser && !isMuted && (
                    <button
                      onClick={() => playTTS(msg.content, panelist?.voice || 'onyx')}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Replay"
                    >
                      <Volume2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && !isStreaming && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-4 py-3 bg-card border-l-4 ${
              examType === 'devils-advocate' ? 'border-l-red-500' : 'border-l-blue-500'
            } border rounded-bl-md`}>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {examType === 'examiner'
                    ? `${PANELISTS_INFO[currentPanelistIndex % PANELISTS_INFO.length]?.name || 'Examiner'} is thinking...`
                    : 'Preparing challenge...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`max-w-[85%] md:max-w-[70%]`}>
              {/* Panelist header for streaming */}
              {streamingPanelist && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-lg">{streamingPanelist.avatar}</span>
                  <span className="text-xs font-medium">{streamingPanelist.name}</span>
                  <span className="text-xs text-muted-foreground">• {streamingPanelist.title}</span>
                  <div className="ml-2 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 ${
                  examType === 'devils-advocate'
                    ? 'bg-card border-l-4 border-l-red-500 border rounded-bl-md'
                    : 'bg-card border-l-4 border-l-blue-500 border rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t bg-card/80 backdrop-blur-sm p-4">
        {isPlayingAudio && (
          <div className="flex items-center justify-center gap-2 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
              <span className="w-1 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <span>Speaking...</span>
            <button onClick={stopAudio} className="ml-2 p-1 rounded hover:bg-muted">
              <Square className="w-3 h-3" />
            </button>
          </div>
        )}

        {inputMode === 'voice' ? (
          /* Voice Input */
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleVoiceSend}
              disabled={isLoading}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30 animate-pulse'
                  : isLoading
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:scale-105 shadow-lg'
              }`}
            >
              {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {isRecording && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-500 font-mono">{fmtDuration(recordingDuration)}</span>
              </div>
            )}
          </div>
        ) : (
          /* Text Input */
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              disabled={isLoading}
              rows={1}
              className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none overflow-y-auto transition-[height] duration-100 disabled:opacity-50"
              style={{ maxHeight: '160px' }}
            />
            <button
              onClick={handleTextSend}
              disabled={isLoading || !textInput.trim()}
              className="p-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* Hint */}
        <p className="text-center text-xs text-muted-foreground mt-2">
          {inputMode === 'voice'
            ? isRecording ? 'Tap to stop recording and send' : 'Tap the mic to speak your answer'
            : 'Press Enter to send, Shift+Enter for new line'
          }
        </p>
      </div>
    </div>
  );
}
