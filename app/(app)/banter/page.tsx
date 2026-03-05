'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EngagingLoader from '@/components/EngagingLoader';
import { Coffee, RefreshCw, Loader2, Sparkles } from 'lucide-react';

/* ── Category definitions ── */
const CATEGORIES = [
  { id: 'jokes', icon: '⚖️', label: 'Legal Jokes', color: 'from-amber-500/10 to-orange-500/5', prompt: 'Tell me 3 different short, funny legal jokes or lawyer jokes. Number them. Keep each under 60 words. Make them genuinely funny and clever.' },
  { id: 'facts', icon: '📚', label: 'Fun Facts', color: 'from-blue-500/10 to-cyan-500/5', prompt: 'Share 3 fascinating or bizarre legal facts from history — things most people would never guess. Number them. Keep each under 80 words.' },
  { id: 'cases', icon: '🎭', label: 'Famous Cases', color: 'from-purple-500/10 to-pink-500/5', prompt: 'Tell me about 2 weird, unusual, or landmark court cases that actually happened. Give each a catchy title and keep under 120 words each. Include the year and jurisdiction.' },
  { id: 'puns', icon: '💬', label: 'Legal Puns', color: 'from-emerald-500/10 to-green-500/5', prompt: 'Give me 5 clever one-liner legal puns that would make a lawyer groan. Number them. Be creative.' },
  { id: 'world', icon: '🌍', label: 'Law Around the World', color: 'from-teal-500/10 to-sky-500/5', prompt: 'Share 3 strange, surprising, or funny laws from different countries around the world. Number them. Include the country and keep each under 60 words.' },
  { id: 'popculture', icon: '🎬', label: 'Law in Pop Culture', color: 'from-rose-500/10 to-red-500/5', prompt: 'Discuss 2 interesting or inaccurate ways law is portrayed in popular movies or TV shows. Name the movie/show, keep each under 100 words.' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

interface ContentCard {
  id: string;
  categoryId: CategoryId;
  content: string;
  loadedAt: number;
}

export default function BanterPage() {
  const { getIdToken } = useAuth();
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingCat, setRefreshingCat] = useState<CategoryId | null>(null);
  const [activeCat, setActiveCat] = useState<CategoryId | 'all'>('all');

  /* Load all categories on mount */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setCards([]);
    try {
      const token = await getIdToken();
      // Load each category and show results as they come in (staggered)
      const promises = CATEGORIES.map(async (cat, i) => {
        // Small stagger to avoid all hitting at once
        await new Promise(r => setTimeout(r, i * 100));
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            message: cat.prompt,
            competencyType: 'banter',
            context: 'legal_banter_relaxation',
          }),
        });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const card: ContentCard = {
          id: cat.id + '-' + Date.now(),
          categoryId: cat.id,
          content: data.response,
          loadedAt: Date.now(),
        };
        // Add card as soon as it arrives
        setCards(prev => [...prev, card]);
        return card;
      });
      await Promise.allSettled(promises);
    } catch (err) {
      console.error('Failed to load banter content:', err);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* Refresh one category */
  const refreshCategory = async (catId: CategoryId) => {
    setRefreshingCat(catId);
    try {
      const cat = CATEGORIES.find(c => c.id === catId)!;
      const token = await getIdToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: cat.prompt + ' Make sure these are completely different from the previous ones — surprise me.',
          competencyType: 'banter',
          context: 'legal_banter_relaxation',
        }),
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setCards(prev => {
        const without = prev.filter(c => c.categoryId !== catId);
        return [...without, { id: catId + '-' + Date.now(), categoryId: catId, content: data.response, loadedAt: Date.now() }];
      });
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshingCat(null);
    }
  };

  const visible = activeCat === 'all'
    ? [...cards].sort((a, b) => {
        const ai = CATEGORIES.findIndex(c => c.id === a.categoryId);
        const bi = CATEGORIES.findIndex(c => c.id === b.categoryId);
        return ai - bi;
      })
    : cards.filter(c => c.categoryId === activeCat);

  if (loading && cards.length === 0) {
    return <EngagingLoader size="lg" message="Brewing some legal entertainment for you..." />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
      {/* Header */}
      <div className="border-b border-border/20 bg-card/40 px-4 sm:px-6 py-5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10">
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                Legal Banter
                <Sparkles className="h-4 w-4 text-amber-500" />
              </h1>
              <p className="text-xs text-muted-foreground">Take a break — you&apos;ve earned it</p>
            </div>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh All
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="border-b border-border/10 px-4 sm:px-6 shrink-0 bg-card/20">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto no-scrollbar py-2.5">
          <button
            onClick={() => setActiveCat('all')}
            className={'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ' +
              (activeCat === 'all' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted/60')}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ' +
                (activeCat === cat.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted/60')}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {visible.length === 0 && !loading ? (
            <div className="text-center py-20 text-muted-foreground">
              <Coffee className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No content yet. Hit Refresh All to generate fresh content.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((card, cardIdx) => {
                const cat = CATEGORIES.find(c => c.id === card.categoryId)!;
                const isRefreshing = refreshingCat === card.categoryId;
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl bg-card/60 p-5 transition-all hover:shadow-md group animate-fade-in"
                    style={{ animationDelay: cardIdx * 60 + 'ms', animationFillMode: 'both' }}
                  >
                    {/* Card header with gradient accent */}
                    <div className={'rounded-lg px-3 py-2 mb-4 bg-gradient-to-r ' + cat.color}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-sm font-semibold">{cat.label}</span>
                        </div>
                        <button
                          onClick={() => refreshCategory(card.categoryId)}
                          disabled={isRefreshing}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors disabled:opacity-50"
                          title="Get new content"
                        >
                          {isRefreshing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Card content */}
                    <div className="text-sm leading-relaxed text-foreground/85">
                      <MarkdownRenderer content={card.content} size="sm" />
                    </div>
                  </div>
                );
              })}

              {/* Loading placeholders for categories still loading */}
              {loading && CATEGORIES
                .filter(cat => !cards.some(c => c.categoryId === cat.id))
                .filter(cat => activeCat === 'all' || activeCat === cat.id)
                .map(cat => (
                  <div key={'loading-' + cat.id} className="rounded-2xl bg-card/40 p-5 animate-pulse">
                    <div className={'rounded-lg px-3 py-2 mb-4 bg-gradient-to-r ' + cat.color}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm font-semibold text-muted-foreground">{cat.label}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted/60 rounded w-full" />
                      <div className="h-3 bg-muted/60 rounded w-4/5" />
                      <div className="h-3 bg-muted/60 rounded w-3/5" />
                      <div className="h-3 bg-muted/60 rounded w-4/5" />
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
