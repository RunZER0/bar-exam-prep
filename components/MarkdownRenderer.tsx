'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Renders AI responses with proper markdown formatting
 * Prevents the "stuffed up" look by properly formatting:
 * - Headers, paragraphs, lists
 * - Bold, italic, code
 * - Blockquotes and code blocks
 * - Tables (via remark-gfm)
 */
export function MarkdownRenderer({ 
  content, 
  className,
  size = 'md' 
}: MarkdownRendererProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-sm md:text-base',
    lg: 'text-base md:text-lg',
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn('prose-ai', sizeClasses[size], className)}
      components={{
        // Custom heading rendering with proper spacing
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-3 mb-1.5">{children}</h3>
        ),
        
        // Paragraphs with proper spacing
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
        ),
        
        // Lists with proper formatting
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        
        // Emphasis and strong
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        
        // Code formatting
        code: ({ className, children, ...props }) => {
          // Check if it's inline code or a code block
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">
                {children}
              </code>
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-muted/80 p-4 rounded-lg overflow-x-auto text-sm my-3 border border-border/50">
            {children}
          </pre>
        ),
        
        // Blockquotes for legal citations
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-muted/30 rounded-r-lg italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        
        // Links
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        ),
        
        // Tables (useful for legal comparisons)
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border-collapse border border-border rounded-lg">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-muted px-3 py-2 text-left font-semibold text-sm">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-2 text-sm">
            {children}
          </td>
        ),
        
        // Horizontal rule
        hr: () => (
          <hr className="my-4 border-border" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Simple text renderer that strips all markdown
 * Use when you want plain text display
 */
export function PlainTextRenderer({ content }: { content: string }) {
  // Strip common markdown syntax
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // Headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/`(.+?)`/g, '$1') // Inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s+/gm, '• ') // List items
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered list
    .replace(/^>\s+/gm, '') // Blockquotes
    .trim();

  return (
    <p className="whitespace-pre-wrap leading-relaxed">{plainText}</p>
  );
}
