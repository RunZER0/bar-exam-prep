'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import {
  Coffee,
  ChevronRight,
  Star,
  MessageCircle,
  Send,
  Loader2,
  Shuffle,
  Sparkles,
  ArrowLeft,
  X,
} from 'lucide-react';

/* ═══════════════════════════════════════
   CATEGORIES
   ═══════════════════════════════════════ */
const CATEGORIES = [
  { id: 'jokes',      icon: '⚖️', label: 'Jokes',      color: 'bg-amber-500/10 text-amber-600' },
  { id: 'facts',      icon: '📚', label: 'Fun Facts',   color: 'bg-blue-500/10 text-blue-600' },
  { id: 'cases',      icon: '🎭', label: 'Wild Cases',  color: 'bg-purple-500/10 text-purple-600' },
  { id: 'puns',       icon: '💬', label: 'Puns',        color: 'bg-emerald-500/10 text-emerald-600' },
  { id: 'world',      icon: '🌍', label: 'World Laws',  color: 'bg-teal-500/10 text-teal-600' },
  { id: 'popculture', icon: '🎬', label: 'Pop Culture', color: 'bg-rose-500/10 text-rose-600' },
] as const;
type CategoryId = (typeof CATEGORIES)[number]['id'];

/* ═══════════════════════════════════════
   PREFERENCES (localStorage)
   ═══════════════════════════════════════ */
interface BanterPrefs {
  ratings: Record<string, number>;
  highRated: string[];
  likedCategories: string[];
  totalRated: number;
}

function loadPrefs(): BanterPrefs {
  if (typeof window === 'undefined') return { ratings: {}, highRated: [], likedCategories: [], totalRated: 0 };
  try {
    const raw = localStorage.getItem('ynai-banter-prefs');
    return raw ? JSON.parse(raw) : { ratings: {}, highRated: [], likedCategories: [], totalRated: 0 };
  } catch { return { ratings: {}, highRated: [], likedCategories: [], totalRated: 0 }; }
}

function savePrefs(prefs: BanterPrefs) {
  try { localStorage.setItem('ynai-banter-prefs', JSON.stringify(prefs)); } catch {}
}

function hashContent(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return 'b' + Math.abs(h).toString(36);
}

/* ═══════════════════════════════════════
   CONTENT ITEM
   ═══════════════════════════════════════ */
interface ContentItem {
  id: string;
  category: CategoryId;
  content: string;
  rating: number | null;
  shown: boolean;
}

/* ═══════════════════════════════════════
   ROAST NUDGE MESSAGES
   ═══════════════════════════════════════ */
const ROAST_NUDGES = [
  "Think you're funnier than the AI? Try the Roast Zone up top.",
  "There's a Roast Zone where you can trade legal burns with the AI. Dare to try?",
  "Feeling brave? The Roast Zone is where you and the AI trade legal roasts.",
  "You know there's a Roast Zone, right? It's like moot court, but for insults.",
  "If you can handle the banter, try the Roast Zone - it's a legal roast battle.",
];

const BANTER_NUDGES = [
  "Missing the jokes? Head back to Legal Banter for more.",
  "Ready for another joke? The banter section has fresh content waiting.",
  "Time for a change of pace? Go back and discover more legal gems.",
];

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function BanterPage() {
  const { user, getIdToken } = useAuth();
  useTimeTracker('banter');
  const firstName = user?.displayName?.split(' ')[0] || 'Counsel';

  // View mode: 'banter' or 'roast'
  const [view, setView] = useState<'banter' | 'roast'>('banter');

  // Banter states
  const [greeting, setGreeting] = useState<string | null>(null);
  const [greetingLoading, setGreetingLoading] = useState(true);
  const [currentItem, setCurrentItem] = useState<ContentItem | null>(null);
  const [nextItem, setNextItem] = useState<ContentItem | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<CategoryId | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [history, setHistory] = useState<ContentItem[]>([]);
  const [prefs, setPrefs] = useState<BanterPrefs>(loadPrefs);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeText, setNudgeText] = useState('');
  const nudgeCountRef = useRef(0);

  // Roast chat
  const [roastMessages, setRoastMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [roastInput, setRoastInput] = useState('');
  const [roastLoading, setRoastLoading] = useState(false);
  const roastEndRef = useRef<HTMLDivElement>(null);
  const roastNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRoastReturnNudge, setShowRoastReturnNudge] = useState(false);

  const prefetchRef = useRef<ContentItem | null>(null);

  /* ── API helper ── */
  const banterFetch = useCallback(async (body: Record<string, unknown>) => {
    const token = await getIdToken();
    const res = await fetch('/api/ai/banter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('fetch failed');
    return ((await res.json()).response as string).replace(/\u2014/g, '-');
  }, [getIdToken]);

  /* ── Streaming API helper for content — text appears character by character ── */
  const banterFetchStreaming = useCallback(async (
    body: Record<string, unknown>,
    onChunk: (text: string) => void,
  ): Promise<string> => {
    const token = await getIdToken();
    const res = await fetch('/api/ai/banter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...body, stream: true }),
    });
    if (!res.ok) throw new Error('fetch failed');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              accumulated += data.content;
              onChunk(accumulated.replace(/\u2014/g, '-'));
            } else if (data.type === 'done') {
              accumulated = data.content || accumulated;
              onChunk(accumulated);
            }
          } catch { /* skip partial */ }
        }
      }
    }
    return accumulated.replace(/\u2014/g, '-');
  }, [getIdToken]);

  /* ── Pick next category ── */
  const pickCategory = useCallback((): CategoryId => {
    if (activeCat) return activeCat;
    const weights = CATEGORIES.map(c => {
      const isLiked = prefs.likedCategories.includes(c.id);
      return { id: c.id, w: isLiked ? 3 : 1 };
    });
    const total = weights.reduce((s, w) => s + w.w, 0);
    let r = Math.random() * total;
    for (const w of weights) {
      r -= w.w;
      if (r <= 0) return w.id as CategoryId;
    }
    return weights[weights.length - 1].id as CategoryId;
  }, [activeCat, prefs.likedCategories]);

  /* ── Load one content item (streaming — text appears word by word) ── */
  const loadContentStreaming = useCallback(async (category?: CategoryId): Promise<ContentItem> => {
    const cat = category || pickCategory();
    const previousContent = history.length > 0 ? history[history.length - 1].content : undefined;

    const itemId = cat + '-' + Date.now();
    // Create the item immediately so UI can show streaming text
    const item: ContentItem = {
      id: itemId,
      category: cat,
      content: '',
      rating: null,
      shown: false,
    };

    // Show the card immediately and stream text into it
    setFadeIn(false);
    setTimeout(() => {
      setCurrentItem({ ...item, shown: true });
      setFadeIn(true);
    }, 80);

    const finalContent = await banterFetchStreaming(
      {
        type: 'content',
        category: cat,
        preferences: { highRated: prefs.highRated, likedCategories: prefs.likedCategories },
        previousContent: previousContent?.slice(0, 200),
      },
      (streamedText) => {
        // Update the current item with streamed text
        setCurrentItem(prev => prev && prev.id === itemId ? { ...prev, content: streamedText } : prev);
      },
    );

    const finalItem = { ...item, content: finalContent, shown: true };
    setCurrentItem(finalItem);
    return finalItem;
  }, [banterFetchStreaming, pickCategory, history, prefs]);

  /* ── Load one content item (non-streaming fallback for prefetch) ── */
  const loadContent = useCallback(async (category?: CategoryId): Promise<ContentItem> => {
    const cat = category || pickCategory();
    const previousContent = history.length > 0 ? history[history.length - 1].content : undefined;
    const response = await banterFetch({
      type: 'content',
      category: cat,
      preferences: { highRated: prefs.highRated, likedCategories: prefs.likedCategories },
      previousContent: previousContent?.slice(0, 200),
    });
    return {
      id: cat + '-' + Date.now(),
      category: cat,
      content: response,
      rating: null,
      shown: false,
    };
  }, [banterFetch, pickCategory, history, prefs]);

  /* ── Show item with animation ── */
  const showItem = useCallback((item: ContentItem) => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrentItem({ ...item, shown: true });
      setFadeIn(true);
    }, 80);
  }, []);

  /* ── Prefetch next item in background ── */
  const prefetchNext = useCallback(async () => {
    try {
      const item = await loadContent();
      prefetchRef.current = item;
      setNextItem(item);
    } catch {
      prefetchRef.current = null;
    }
  }, [loadContent]);

  /* ── Load greeting + first content ── */
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setGreetingLoading(true);
      try {
        const [greetingText, firstContent] = await Promise.all([
          banterFetch({
            type: 'greeting',
            userName: firstName,
            preferences: { likedCategories: prefs.likedCategories },
          }),
          loadContent(),
        ]);
        if (cancelled) return;
        setGreeting(greetingText);
        showItem(firstContent);
        setGreetingLoading(false);
        prefetchNext();
      } catch (err) {
        console.error('Banter init failed:', err);
        if (!cancelled) {
          setGreeting(`Hey ${firstName}, ready for something fun?`);
          setGreetingLoading(false);
        }
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Show roast nudge periodically between jokes ── */
  const maybeShowRoastNudge = useCallback(() => {
    nudgeCountRef.current++;
    // Show nudge every 3rd-5th item, but not on the first few
    if (nudgeCountRef.current >= 3 && nudgeCountRef.current % (3 + Math.floor(Math.random() * 3)) === 0) {
      setNudgeText(ROAST_NUDGES[Math.floor(Math.random() * ROAST_NUDGES.length)]);
      setShowNudge(true);
      setTimeout(() => setShowNudge(false), 6000);
    }
  }, []);

  /* ── Start timer for return nudge when in roast mode ── */
  useEffect(() => {
    if (view === 'roast') {
      roastNudgeTimerRef.current = setTimeout(() => {
        setShowRoastReturnNudge(true);
      }, 90000); // After ~90s in roast zone
    } else {
      setShowRoastReturnNudge(false);
      if (roastNudgeTimerRef.current) clearTimeout(roastNudgeTimerRef.current);
    }
    return () => { if (roastNudgeTimerRef.current) clearTimeout(roastNudgeTimerRef.current); };
  }, [view]);

  /* ── Next content handler ── */
  const handleNext = async () => {
    if (contentLoading) return;
    if (currentItem) setHistory(prev => [...prev.slice(-20), currentItem]);

    maybeShowRoastNudge();

    if (prefetchRef.current) {
      const prefetched = prefetchRef.current;
      prefetchRef.current = null;
      setNextItem(null);
      showItem(prefetched);
      prefetchNext();
      return;
    }

    setContentLoading(true);
    try {
      await loadContentStreaming();
      prefetchNext();
    } catch {} finally {
      setContentLoading(false);
    }
  };

  /* ── Category change ── */
  const handleCategoryChange = async (catId: CategoryId | null) => {
    setActiveCat(catId);
    if (currentItem) setHistory(prev => [...prev.slice(-20), currentItem]);
    setContentLoading(true);
    prefetchRef.current = null;
    try {
      await loadContentStreaming(catId || undefined);
      prefetchNext();
    } catch {} finally {
      setContentLoading(false);
    }
  };

  /* ── Rate content ── */
  const handleRate = (rating: number) => {
    if (!currentItem) return;
    const hash = hashContent(currentItem.content);
    const newPrefs = { ...prefs };
    newPrefs.ratings[hash] = rating;
    newPrefs.totalRated++;
    if (rating >= 4) {
      newPrefs.highRated = [currentItem.content.slice(0, 150), ...newPrefs.highRated].slice(0, 10);
    }
    const catRatings: Record<string, number[]> = {};
    for (const item of [...history, currentItem]) {
      const h = hashContent(item.content);
      const r = newPrefs.ratings[h];
      if (r) {
        if (!catRatings[item.category]) catRatings[item.category] = [];
        catRatings[item.category].push(r);
      }
    }
    newPrefs.likedCategories = Object.entries(catRatings)
      .filter(([, ratings]) => ratings.length >= 2 && ratings.reduce((a, b) => a + b, 0) / ratings.length >= 3.5)
      .map(([cat]) => cat);
    setPrefs(newPrefs);
    savePrefs(newPrefs);
    setCurrentItem(prev => prev ? { ...prev, rating } : null);
  };

  /* ── Roast chat ── */
  const sendRoast = async () => {
    if (!roastInput.trim() || roastLoading) return;
    const msg = roastInput.trim();
    setRoastInput('');
    setRoastMessages(prev => [...prev, { role: 'user', text: msg }]);
    setRoastLoading(true);
    try {
      const response = await banterFetch({ type: 'roast', message: msg, userName: firstName });
      setRoastMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch {
      setRoastMessages(prev => [...prev, { role: 'ai', text: 'Objection! My wit circuits are overloaded. Try again.' }]);
    } finally {
      setRoastLoading(false);
      setTimeout(() => roastEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  /* ── Switch views with animation ── */
  const switchToRoast = () => {
    setFadeIn(false);
    setTimeout(() => setView('roast'), 200);
  };
  const switchToBanter = () => {
    setShowRoastReturnNudge(false);
    setView('banter');
    setTimeout(() => setFadeIn(true), 100);
  };

  const catInfo = currentItem ? CATEGORIES.find(c => c.id === currentItem.category) : null;

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  if (greetingLoading && !greeting) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-background">
        <div className="text-center space-y-4 animate-fade-in">
          <Coffee className="h-8 w-8 mx-auto text-amber-500/60 animate-pulse" />
          <p className="text-sm text-muted-foreground">Setting the mood...</p>
        </div>
      </div>
    );
  }

  /* ── ROAST VIEW (full-page, displaces banter) ── */
  if (view === 'roast') {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
        {/* Roast header */}
        <div className="shrink-0 border-b border-border/15 bg-card/30 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={switchToBanter} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" /> Roast Zone
                </p>
                <p className="text-[11px] text-muted-foreground">Trade legal burns with the AI - keep it clever</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-3">
            {roastMessages.length === 0 && (
              <div className="text-center py-12 space-y-3 animate-fade-in">
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Say something - let&apos;s see if you can out-roast a legal AI.
                </p>
                <p className="text-[11px] text-muted-foreground/50">
                  Think lawyer jokes, law school life, or courtroom comedy.
                </p>
              </div>
            )}
            {roastMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-foreground rounded-br-sm'
                    : 'bg-muted/50 text-foreground rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {roastLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="px-4 py-2.5 rounded-2xl bg-muted/50 rounded-bl-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={roastEndRef} />
          </div>
        </div>

        {/* Return nudge */}
        {showRoastReturnNudge && (
          <div className="shrink-0 px-4 py-2 bg-primary/5 border-t border-primary/10 animate-fade-in">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <p className="text-xs text-primary/70">
                {BANTER_NUDGES[Math.floor(Math.random() * BANTER_NUDGES.length)]}
              </p>
              <div className="flex gap-2">
                <button onClick={switchToBanter} className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                  Go back
                </button>
                <button onClick={() => setShowRoastReturnNudge(false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Stay here
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border/15 bg-card/20 px-4 py-3 mb-16 md:mb-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              value={roastInput}
              onChange={e => setRoastInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendRoast()}
              placeholder="Your best legal roast..."
              className="flex-1 px-4 py-2 rounded-xl bg-background/80 border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              autoFocus
            />
            <button
              onClick={sendRoast}
              disabled={roastLoading || !roastInput.trim()}
              className="px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── BANTER VIEW (main) ── */
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background pb-20">

      {/* ── Roast ribbon (top bar - click to switch to roast view) ── */}
      <div className="shrink-0 sticky top-0 z-10">
        <button
          onClick={switchToRoast}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500/10 via-orange-500/8 to-amber-500/10 border-b border-rose-500/15 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-foreground hover:from-rose-500/20 hover:via-orange-500/15 hover:to-amber-500/20 transition-all"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Enter Roast Zone - trade legal burns with the AI
        </button>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-4">
        <div className="w-full max-w-lg pt-10 pb-24 space-y-6">

          {/* Greeting */}
          <div className="text-center animate-fade-in">
            <p className="text-sm text-foreground/70 italic">{greeting}</p>
          </div>

          {/* Roast nudge popup */}
          {showNudge && (
            <div className="animate-fade-in">
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                <MessageCircle className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-primary/70 leading-relaxed">{nudgeText}</p>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => { setShowNudge(false); switchToRoast(); }}
                      className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Try it
                    </button>
                    <button
                      onClick={() => setShowNudge(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Maybe later
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowNudge(false)} className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Content card */}
          {currentItem && (
            <div
              className={`rounded-2xl bg-card/60 p-6 transition-all duration-300 ${
                fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              {catInfo && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-4 ${catInfo.color}`}>
                  <span>{catInfo.icon}</span> {catInfo.label}
                </div>
              )}

              {/* Content - plain text, no markdown */}
              <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                {currentItem.content}
              </div>

              {/* Rating */}
              <div className="mt-5 pt-4 border-t border-border/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {currentItem.rating ? 'Thanks for the feedback!' : 'How was that?'}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className="p-0.5 transition-transform hover:scale-110"
                        title={`Rate ${star}/5`}
                      >
                        <Star
                          className={`h-4 w-4 transition-colors ${
                            currentItem.rating && star <= currentItem.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-muted-foreground/30 hover:text-amber-400/60'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {contentLoading && !currentItem && (
            <div className="rounded-2xl bg-card/40 p-6 animate-pulse">
              <div className="space-y-3">
                <div className="h-3 bg-muted/60 rounded w-1/4" />
                <div className="h-3 bg-muted/60 rounded w-full" />
                <div className="h-3 bg-muted/60 rounded w-4/5" />
                <div className="h-3 bg-muted/60 rounded w-3/5" />
              </div>
            </div>
          )}

          {/* Next button */}
          <div className="flex justify-center">
            <button
              onClick={handleNext}
              disabled={contentLoading}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card/60 hover:bg-card text-sm font-medium text-foreground/80 hover:text-foreground transition-all hover:shadow-sm disabled:opacity-50"
            >
              {contentLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : nextItem ? (
                <Sparkles className="h-4 w-4 text-amber-500/70" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              {contentLoading ? 'Loading...' : nextItem ? 'Next one ready' : 'Hit me with another'}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Category selector */}
          <div className="flex flex-wrap justify-center gap-1.5">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                !activeCat ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              Surprise me
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                  activeCat === cat.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <span className="text-xs">{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>

          {/* Subtle stats */}
          {prefs.totalRated > 0 && (
            <p className="text-center text-[10px] text-muted-foreground/40">
              {prefs.totalRated} rated · {prefs.likedCategories.length > 0 ? `you seem to like ${prefs.likedCategories.map(c => CATEGORIES.find(cc => cc.id === c)?.label).filter(Boolean).join(', ')}` : 'still learning your taste'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
