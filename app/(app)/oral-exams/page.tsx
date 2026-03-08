'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import {
  Mic, MicOff, Volume2, VolumeX, Play, Square, Send, ArrowLeft,
  Loader2, Swords, Users, Zap, Shield, Flame, BookOpen, ChevronRight,
  RotateCcw, BarChart3, MessageSquare, Settings, StopCircle,
  CheckCircle, AlertCircle, Clock, Sparkles, Download, Timer,
} from 'lucide-react';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import TrialLimitReached from '@/components/TrialLimitReached';

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
  const [trialLimitFeature, setTrialLimitFeature] = useState<'oral_devil' | 'oral_exam' | null>(null);

  // ---- Voice state ----
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ---- Session timer state ----
  const SESSION_MAX_MINUTES = 15;
  const ANSWER_TIME_LIMIT = 120; // seconds — 2 min per answer
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [answerElapsedSec, setAnswerElapsedSec] = useState(0);
  const [answerWarningShown, setAnswerWarningShown] = useState(false);
  const [sessionTimeUp, setSessionTimeUp] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Session recording state ----
  const [sessionRecordingBlob, setSessionRecordingBlob] = useState<Blob | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionAudioChunksRef = useRef<Blob[]>([]);
  const sessionStreamRef = useRef<MediaStream | null>(null);
  const endSessionRef = useRef<() => Promise<void>>(() => Promise.resolve());

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

  // ---- Session timer — runs while session is active ----
  useEffect(() => {
    if (phase === 'active') {
      sessionTimerRef.current = setInterval(() => {
        setSessionElapsedSec(prev => {
          const next = prev + 1;
          if (next >= SESSION_MAX_MINUTES * 60 && !sessionTimeUp) {
            setSessionTimeUp(true);
          }
          return next;
        });
      }, 1000);
    } else {
      if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [phase, sessionTimeUp]);

  // ---- Answer timer — resets each time AI speaks, ticks while waiting for user ----
  useEffect(() => {
    // Start counting when AI finishes speaking and it's user's turn
    if (phase === 'active' && !isLoading && !isStreaming && !isPlayingAudio && messages.length > 0) {
      setAnswerElapsedSec(0);
      setAnswerWarningShown(false);
      answerTimerRef.current = setInterval(() => {
        setAnswerElapsedSec(prev => {
          const next = prev + 1;
          if (next === 90 && !answerWarningShown) {
            // 90 seconds — show soft warning
            setAnswerWarningShown(true);
          }
          return next;
        });
      }, 1000);
    } else {
      if (answerTimerRef.current) { clearInterval(answerTimerRef.current); answerTimerRef.current = null; }
    }
    return () => { if (answerTimerRef.current) clearInterval(answerTimerRef.current); };
  }, [phase, isLoading, isStreaming, isPlayingAudio, messages.length, answerWarningShown]);

  // ---- Start session recording (microphone captures full session audio) ----
  const startSessionRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sessionStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      sessionRecorderRef.current = recorder;
      sessionAudioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sessionAudioChunksRef.current.push(e.data);
      };
      recorder.start(1000); // chunk every second
    } catch (err) {
      console.warn('Session recording not available:', err);
    }
  }, []);

  const stopSessionRecording = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      const recorder = sessionRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(sessionAudioChunksRef.current, { type: 'audio/webm' });
        setSessionRecordingBlob(blob);
        sessionStreamRef.current?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  // ---- Save session to backend ----
  const saveSession = useCallback(async (summaryContent?: string, summaryScore?: number | null) => {
    if (isSavingSession || messages.length < 2) return;
    setIsSavingSession(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/oral-exams/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: examType,
          mode,
          unitId: selectedUnit || undefined,
          durationSeconds: sessionElapsedSec,
          exchangeCount: messages.length,
          score: summaryScore || null,
          summary: summaryContent || null,
          transcript: messages.map(m => ({ role: m.role, content: m.content, panelist: m.panelist?.name })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSessionId(data.id);
      }
    } catch (err) {
      console.error('Failed to save session:', err);
    } finally {
      setIsSavingSession(false);
    }
  }, [isSavingSession, messages, getIdToken, examType, mode, selectedUnit, sessionElapsedSec]);

  // ---- Download session recording ----
  const downloadRecording = useCallback(() => {
    if (!sessionRecordingBlob) return;
    const url = URL.createObjectURL(sessionRecordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ynai-${examType}-session-${new Date().toISOString().split('T')[0]}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sessionRecordingBlob, examType]);

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
        elapsedMinutes: sessionElapsedSec / 60,
        sessionMaxMinutes: SESSION_MAX_MINUTES,
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

        if (!response.ok) {
          // Check for subscription limit error
          if (response.status === 403) {
            const errData = await response.json();
            if (errData.error === 'FREE_TRIAL_LIMIT') {
              setTrialLimitFeature(examType === 'devils-advocate' ? 'oral_devil' : 'oral_exam');
              setIsStreaming(false);
              return;
            }
          }
          throw new Error('Stream failed');
        }
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

                  // If AI signaled session end, auto-trigger summary
                  if (metadata?.sessionEnded) {
                    setTimeout(() => endSessionRef.current(), 2000);
                  }
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
  }, [messages, examType, mode, feedbackMode, selectedUnit, panelistCount, currentPanelistIndex, isLoading, isStreaming, enableStreaming, authFetchJSON, playTTS, getIdToken, sessionElapsedSec]);

  /* ================================================================
     START SESSION
     ================================================================ */
  const startSession = useCallback(async () => {
    setPhase('active');
    setMessages([]);
    setIsLoading(true);
    setError(null);
    setCurrentPanelistIndex(0);
    setSessionElapsedSec(0);
    setSessionTimeUp(false);
    setAnswerElapsedSec(0);
    setAnswerWarningShown(false);
    setSessionRecordingBlob(null);
    setSavedSessionId(null);

    // Start session recording
    await startSessionRecording();

    try {
      const payload: any = {
        type: examType,
        mode,
        feedbackMode,
        unitId: selectedUnit || undefined,
        messages: [],
        elapsedMinutes: 0,
        sessionMaxMinutes: SESSION_MAX_MINUTES,
      };

      if (examType === 'examiner') {
        payload.panelistCount = panelistCount;
        payload.currentPanelistIndex = 0;
      }

      const data = await authFetchJSON('/api/oral-exams', payload);

      // Check for subscription limit
      if (data.error === 'FREE_TRIAL_LIMIT') {
        setTrialLimitFeature(examType === 'devils-advocate' ? 'oral_devil' : 'oral_exam');
        setPhase('setup');
        await stopSessionRecording();
        return;
      }

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
    } catch (err: any) {
      console.error('Start error:', err);
      // Handle 403 from authFetchJSON
      if (err.message?.includes('403') || err.message?.includes('FREE_TRIAL_LIMIT')) {
        setTrialLimitFeature(examType === 'devils-advocate' ? 'oral_devil' : 'oral_exam');
        setPhase('setup');
      } else {
        setError('Failed to start session. Please try again.');
      }
      await stopSessionRecording();
    } finally {
      setIsLoading(false);
    }
  }, [examType, mode, feedbackMode, selectedUnit, panelistCount, authFetchJSON, playTTS, startSessionRecording, stopSessionRecording]);

  /* ================================================================
     END SESSION — get summary
     ================================================================ */
  const endSession = useCallback(async () => {
    if (messages.length < 2) {
      setPhase('setup');
      await stopSessionRecording();
      return;
    }

    setIsLoading(true);
    setError(null);
    stopAudio();

    // Stop session recording
    await stopSessionRecording();

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

      // Save session to backend
      await saveSession(data.content, data.score);
    } catch (err) {
      console.error('Summary error:', err);
      setError('Failed to generate summary. Please try again.');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, [messages, examType, mode, feedbackMode, authFetchJSON, stopAudio, stopSessionRecording, saveSession]);

  // Keep ref in sync so sendMessage can call it without circular dep
  useEffect(() => { endSessionRef.current = endSession; }, [endSession]);

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
              Sharpen your advocacy skills with realistic oral practice
            </p>
          </div>

          {/* Exam Type Selection */}
          {!examType ? (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Devil's Advocate */}
              <button
                onClick={() => setExamType('devils-advocate')}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/8 via-red-500/4 to-transparent p-8 text-left transition-all hover:from-red-500/15 hover:shadow-lg hover:shadow-red-500/5"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full" />
                <div className="relative space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Swords className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Devil&apos;s Advocate</h2>
                    <p className="text-muted-foreground mt-1">
                      Go toe-to-toe with a challenger that tests your every legal assertion.
                      Defend your position under pressure — cite statute, case law, and logic.
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
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/8 via-blue-500/4 to-transparent p-8 text-left transition-all hover:from-blue-500/15 hover:shadow-lg hover:shadow-blue-500/5"
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
                      Realistic oral exam simulation with turn-taking and follow-up questions.
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

              <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-6 md:p-8 space-y-8">
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
    // Strip markdown for clean display
    const cleanContent = summary.content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/---/g, '');

    const handleSaveReport = async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20;
      const usable = pageW - margin * 2;
      let y = margin;

      const addHeader = () => {
        // Ynai branding header
        doc.setFillColor(24, 24, 27); // zinc-900
        doc.rect(0, 0, pageW, 28, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text('YNAI', margin, 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('Your Next-Gen AI Legal Tutor', margin, 23);
        // Right side date
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), pageW - margin, 16, { align: 'right' });
        y = 38;
      };

      const addFooter = (pageNum: number) => {
        doc.setFillColor(245, 245, 245);
        doc.rect(0, pageH - 14, pageW, 14, 'F');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text('Ynai — Empowering Future Advocates', margin, pageH - 6);
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 6, { align: 'right' });
      };

      addHeader();

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(24, 24, 27);
      doc.text('Oral Examination Report', margin, y);
      y += 8;

      // Score badge
      if (summary.score !== null) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, y, 50, 12, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(22, 101, 52);
        doc.text(`${summary.score}/100`, margin + 25, y + 8.5, { align: 'center' });
        y += 18;
      }

      // Meta info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const unit = selectedUnit ? ATP_UNITS.find(u => u.id === selectedUnit) : null;
      doc.text(`Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)} | Type: ${examType === 'devils-advocate' ? "Devil's Advocate" : 'Oral Panel'}${unit ? ` | Unit: ${unit.name}` : ''}`, margin, y);
      y += 4;
      doc.text(`Exchanges: ${messages.length} | Your Responses: ${messages.filter(m => m.role === 'user').length}`, margin, y);
      y += 8;

      // Divider
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // Content body
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      let pageNum = 1;

      const lines = doc.splitTextToSize(cleanContent, usable);
      for (const line of lines) {
        if (y > pageH - 24) {
          addFooter(pageNum);
          doc.addPage();
          pageNum++;
          addHeader();
        }
        doc.text(line, margin, y);
        y += 5;
      }

      addFooter(pageNum);
      doc.save(`ynai-oral-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Session Complete</h1>
            {summary.score !== null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5">
                <span className="text-2xl font-bold">{summary.score}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
            )}
          </div>

          {/* Summary content — clean text, no markdown */}
          <div className="rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Feedback</h2>
              <button
                onClick={() => isPlayingAudio ? stopAudio() : playTTS(cleanContent, 'onyx')}
                disabled={isLoading}
                className={`p-2 rounded-full transition-all ${
                  isPlayingAudio
                    ? 'bg-primary/20 text-primary animate-pulse'
                    : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
                title={isPlayingAudio ? 'Stop reading' : 'Read feedback aloud'}
              >
                {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {cleanContent}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gradient-to-br from-muted/30 to-transparent p-4 text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{messages.filter(m => m.role === 'user').length}</div>
              <div className="text-xs text-muted-foreground">Your Responses</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-muted/30 to-transparent p-4 text-center">
              <Timer className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{fmtDuration(sessionElapsedSec)}</div>
              <div className="text-xs text-muted-foreground">Duration</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-muted/30 to-transparent p-4 text-center">
              <Sparkles className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold capitalize">{mode}</div>
              <div className="text-xs text-muted-foreground">Difficulty</div>
            </div>
          </div>

          {/* Session Recording Download */}
          {sessionRecordingBlob && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Session Recording</p>
                  <p className="text-xs text-muted-foreground">
                    {(sessionRecordingBlob.size / (1024 * 1024)).toFixed(1)} MB &middot; Available for download
                  </p>
                </div>
              </div>
              <button
                onClick={downloadRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveReport}
              className="flex-1 py-3 rounded-xl border border-border/30 bg-gradient-to-r from-muted/20 to-transparent hover:from-muted/40 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Save Report
            </button>
            <button
              onClick={() => {
                setPhase('setup');
                setMessages([]);
                setSummary(null);
                setSessionRecordingBlob(null);
              }}
              className="flex-1 py-3 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> New Session
            </button>
            <button
              onClick={() => {
                setPhase('active');
                setSummary(null);
              }}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2 text-sm"
            >
              <Play className="w-4 h-4" /> Continue
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
      <div className="shrink-0 border-b border-border/20 bg-gradient-to-r from-background to-background px-4 py-3 flex items-center justify-between">
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

        {/* Session Timer */}
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm ${
          sessionTimeUp 
            ? 'bg-red-500/15 text-red-500 animate-pulse'
            : sessionElapsedSec >= (SESSION_MAX_MINUTES - 2) * 60
            ? 'bg-amber-500/15 text-amber-500'
            : 'bg-muted/30 text-muted-foreground'
        }`}>
          <Timer className="w-3.5 h-3.5" />
          <span>{fmtDuration(sessionElapsedSec)}</span>
          <span className="text-xs opacity-60">/ {SESSION_MAX_MINUTES}:00</span>
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
        {/* Answer time warning */}
        {answerElapsedSec >= 90 && !isLoading && !isStreaming && !isPlayingAudio && (
          <div className={`mx-auto max-w-md rounded-lg px-4 py-3 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            answerElapsedSec >= ANSWER_TIME_LIMIT
              ? 'border border-red-500/30 bg-red-500/10 text-red-500'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <Clock className="w-4 h-4 shrink-0" />
            {answerElapsedSec >= ANSWER_TIME_LIMIT
              ? 'Time to respond has passed. Please answer or the session will move on.'
              : `You have ${ANSWER_TIME_LIMIT - answerElapsedSec} seconds to respond. Take your time, but don't overthink it.`
            }
          </div>
        )}

        {/* Session time-up warning */}
        {sessionTimeUp && (
          <div className="mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 flex items-center gap-2 animate-pulse">
            <Timer className="w-4 h-4 shrink-0" />
            Session time is up. The examiner will wrap up shortly.
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const panelist = msg.panelist;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} style={{ animation: 'fadeSlideIn 0.4s ease-out forwards' }}>
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
      <div className="shrink-0 border-t border-border/20 bg-gradient-to-t from-background to-transparent p-4">
        {isPlayingAudio && (
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`w-0.5 rounded-full bg-primary animate-pulse`} style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Speaking...</span>
            <button onClick={stopAudio} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
              <Square className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {inputMode === 'voice' ? (
          /* Voice Input — cleaner design */
          <div className="flex flex-col items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-red-500/10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono text-red-500">{fmtDuration(recordingDuration)}</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              <button
                onClick={handleVoiceSend}
                disabled={isLoading}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-105'
                    : isLoading
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : `bg-${accent}-500/10 text-${accent}-500 hover:bg-${accent}-500/20 hover:scale-105`
                }`}
              >
                {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <span className="text-xs text-muted-foreground">
                {isRecording ? 'Tap to stop & send' : 'Tap to speak'}
              </span>
            </div>
          </div>
        ) : (
          /* Text Input — modern design */
          <div className="flex items-end gap-3 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                disabled={isLoading}
                rows={1}
                className="w-full rounded-2xl bg-muted/20 border border-border/20 px-4 py-3 pr-12 text-sm resize-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 outline-none overflow-y-auto transition-colors disabled:opacity-50"
                style={{ maxHeight: '140px' }}
              />
            </div>
            <button
              onClick={handleTextSend}
              disabled={isLoading || !textInput.trim()}
              className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                isLoading || !textInput.trim()
                  ? 'bg-muted text-muted-foreground'
                  : `bg-${accent === 'red' ? 'red' : 'blue'}-500 text-white hover:opacity-90 shadow-md`
              }`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Trial limit modal */}
      {trialLimitFeature && (
        <TrialLimitReached
          feature={trialLimitFeature}
          onDismiss={() => setTrialLimitFeature(null)}
        />
      )}
    </div>
  );
}
