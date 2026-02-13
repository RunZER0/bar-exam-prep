'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { 
  Coffee, Send, Sparkles, Scale, BookOpen, Gavel, 
  MessageCircle, RefreshCw, Heart, Share2
} from 'lucide-react';

const BANTER_PROMPTS = [
  { icon: '⚖️', label: 'Legal Jokes', prompt: 'Tell me a funny legal joke or lawyer joke!' },
  { icon: '📚', label: 'Fun Facts', prompt: 'Share a fascinating or bizarre legal fact from history!' },
  { icon: '🎭', label: 'Famous Cases', prompt: 'Tell me about a weird or unusual court case that actually happened!' },
  { icon: '💬', label: 'Legal Puns', prompt: 'Give me some clever legal puns!' },
  { icon: '🌍', label: 'Law Around World', prompt: 'Tell me about a strange law from another country!' },
  { icon: '🎬', label: 'Law in Pop Culture', prompt: 'Discuss how law is portrayed in movies or TV shows!' },
];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function BanterPage() {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          competencyType: 'banter',
          context: 'legal_banter_relaxation',
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Oops! Even lawyers need a break sometimes. Please try again!',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Coffee className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Legal Banter</h1>
            <p className="text-sm text-muted-foreground">Take a break with legal humor and fun facts</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Coffee className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Time for a Break!</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              All work and no play makes for a dull advocate. Explore legal humor, 
              fun facts, and entertaining stories to lighten your study load.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-lg">
              {BANTER_PROMPTS.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] ${
                    message.role === 'user'
                      ? 'chat-bubble-user'
                      : 'chat-bubble-ai'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownRenderer content={message.content} size="sm" />
                  ) : (
                    <div className="prose-ai text-sm">{message.content}</div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="chat-bubble-ai">
                  <div className="flex items-center gap-2">
                    <div className="dot-pulse flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick prompts when in chat */}
      {messages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {BANTER_PROMPTS.slice(0, 4).map((item, index) => (
              <button
                key={index}
                onClick={() => handleQuickPrompt(item.prompt)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-secondary hover:bg-accent transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2 max-w-4xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for jokes, fun facts, or anything entertaining..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
