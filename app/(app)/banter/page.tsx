'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EngagingLoader from '@/components/EngagingLoader';
import { Coffee, RefreshCw, Loader2 } from 'lucide-react';

/* ── Category definitions ── */
const CATEGORIES = [
  { id: 'jokes', icon: '⚖️', label: 'Legal Jokes', prompt: 'Tell me 3 different short, funny legal jokes or lawyer jokes. Number them. Keep each under 60 words.' },
  { id: 'facts', icon: '📚', label: 'Fun Facts', prompt: 'Share 3 fascinating or bizarre legal facts from history. Number them. Keep each under 80 words.' },
  { id: 'cases', icon: '🎭', label: 'Famous Cases', prompt: 'Tell me about 2 weird or unusual court cases that actually happened. Give each a catchy title and keep under 100 words each.' },
  { id: 'puns', icon: '💬', label: 'Legal Puns', prompt: 'Give me 5 clever one-liner legal puns. Number them.' },
  { id: 'world', icon: '🌍', label: 'Law Around the World', prompt: 'Share 3 strange or surprising laws from different countries. Number them. Keep each under 60 words.' },
  { id: 'popculture', icon: '🎬', label: 'Law in Pop Culture', prompt: 'Discuss 2 interesting ways law is portrayed in movies or TV shows. Keep each under 80 words.' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

interface ContentCard {
  id: string;
  categoryId: CategoryId;
  content: string;
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
    try {
      const token = await getIdToken();
      const results = await Promise.allSettled(
        CATEGORIES.map(async (cat) => {
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
          return { categoryId: cat.id, content: data.response } as ContentCard;
        })
      );

      const newCards: ContentCard[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          newCards.push({ ...r.value, id: CATEGORIES[i].id + '-' + Date.now() });
        }
      });
      setCards(newCards);
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
          message: cat.prompt + ' Make sure these are different from the previous ones.',
          competencyType: 'banter',
          context: 'legal_banter_relaxation',
        }),
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setCards(prev => {
        const without = prev.filter(c => c.categoryId !== catId);
        return [...without, { id: catId + '-' + Date.now(), categoryId: catId, content: data.response }];
      });
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshingCat(null);
    }
  };

  const visible = activeCat === 'all' ? cards : cards.filter(c => c.categoryId === activeCat);

  if (loading) {
    return <EngagingLoader size="lg" message="Loading some legal fun for you..." />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
      {/* Header */}
      <div className="border-b border-border/30 bg-card/40 px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Legal Banter</h1>
              <p className="text-xs text-muted-foreground">Take a break — you deserve it</p>
            </div>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh All
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="border-b border-border/20 px-4 sm:px-6 shrink-0">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => setActiveCat('all')}
            className={'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ' +
              (activeCat === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ' +
                (activeCat === cat.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {visible.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No content loaded yet. Hit Refresh All to generate fresh content.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map(card => {
                const cat = CATEGORIES.find(c => c.id === card.categoryId)!;
                const isRefreshing = refreshingCat === card.categoryId;
                return (
                  <div
                    key={card.id}
                    className="rounded-xl bg-card/60 border border-border/30 p-5 transition-all hover:border-border/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-sm font-semibold">{cat.label}</span>
                      </div>
                      <button
                        onClick={() => refreshCategory(card.categoryId)}
                        disabled={isRefreshing}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        title="Get new content"
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-sm leading-relaxed">
                      <MarkdownRenderer content={card.content} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
