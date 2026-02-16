'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ExternalLink, BookOpen, FileText, Scale, ChevronDown, ChevronRight, X } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface Citation {
  authority_id: string;
  url: string;
  title?: string;
  citation_text?: string; // e.g., "[2020] KECA 123"
  locator_json: {
    paragraph_start?: number;
    paragraph_end?: number;
    section?: string;
    subsection?: string;
    page?: number;
  };
  passage_id?: string;
  excerpt?: string;
  source_type?: 'CASE' | 'STATUTE' | 'REGULATION' | 'ARTICLE' | 'TEXTBOOK' | 'OTHER';
}

export interface NotesSection {
  id: string;
  heading: string;
  content: string;
  citations: Citation[];
}

export interface NotesReaderProps {
  title: string;
  skillName?: string;
  sections: NotesSection[];
  className?: string;
  onCitationClick?: (citation: Citation) => void;
}

// ============================================
// CITATION CHIP COMPONENT
// ============================================

function CitationChip({
  citation,
  index,
  isActive,
  onClick,
}: {
  citation: Citation;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const getTypeIcon = () => {
    switch (citation.source_type) {
      case 'CASE':
        return <Scale className="w-3 h-3" />;
      case 'STATUTE':
        return <FileText className="w-3 h-3" />;
      default:
        return <BookOpen className="w-3 h-3" />;
    }
  };

  const formatLocator = () => {
    const { locator_json } = citation;
    const parts: string[] = [];
    
    if (locator_json.section) {
      parts.push(`s.${locator_json.section}`);
    }
    if (locator_json.subsection) {
      parts.push(`(${locator_json.subsection})`);
    }
    if (locator_json.paragraph_start !== undefined) {
      if (locator_json.paragraph_end && locator_json.paragraph_end !== locator_json.paragraph_start) {
        parts.push(`¶${locator_json.paragraph_start}-${locator_json.paragraph_end}`);
      } else {
        parts.push(`¶${locator_json.paragraph_start}`);
      }
    }
    if (locator_json.page) {
      parts.push(`p.${locator_json.page}`);
    }
    
    return parts.length > 0 ? parts.join(' ') : '';
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors',
        'hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50',
        isActive
          ? 'bg-primary/20 text-primary'
          : 'bg-muted/60 text-muted-foreground hover:text-foreground'
      )}
      title={citation.title || citation.citation_text || 'View citation'}
    >
      {getTypeIcon()}
      <span className="font-mono">[{index + 1}]</span>
      {formatLocator() && <span className="text-[10px] opacity-75">{formatLocator()}</span>}
    </button>
  );
}

// ============================================
// CITATION PANEL COMPONENT
// ============================================

function CitationPanel({
  citation,
  onClose,
}: {
  citation: Citation;
  onClose: () => void;
}) {
  const formatLocator = () => {
    const { locator_json } = citation;
    const parts: string[] = [];
    
    if (locator_json.section) {
      parts.push(`Section ${locator_json.section}`);
    }
    if (locator_json.subsection) {
      parts.push(`(${locator_json.subsection})`);
    }
    if (locator_json.paragraph_start !== undefined) {
      if (locator_json.paragraph_end && locator_json.paragraph_end !== locator_json.paragraph_start) {
        parts.push(`Paragraphs ${locator_json.paragraph_start}-${locator_json.paragraph_end}`);
      } else {
        parts.push(`Paragraph ${locator_json.paragraph_start}`);
      }
    }
    if (locator_json.page) {
      parts.push(`Page ${locator_json.page}`);
    }
    
    return parts.join(', ');
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-lg animate-in slide-in-from-right-2">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          {citation.source_type === 'CASE' && <Scale className="w-4 h-4 text-primary" />}
          {citation.source_type === 'STATUTE' && <FileText className="w-4 h-4 text-primary" />}
          {!citation.source_type && <BookOpen className="w-4 h-4 text-primary" />}
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {citation.source_type || 'Authority'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-md transition-colors"
          aria-label="Close citation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h4 className="font-semibold text-foreground mb-1 text-sm">
        {citation.title || 'Legal Authority'}
      </h4>

      {citation.citation_text && (
        <p className="text-xs text-muted-foreground mb-2 font-mono">
          {citation.citation_text}
        </p>
      )}

      {formatLocator() && (
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <span className="font-medium">Location:</span>
          <span>{formatLocator()}</span>
        </div>
      )}

      {citation.excerpt && (
        <blockquote className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 py-1 my-3 bg-muted/30 rounded-r italic">
          &ldquo;{citation.excerpt}&rdquo;
        </blockquote>
      )}

      {citation.url && (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80',
            'transition-colors underline-offset-2 hover:underline'
          )}
        >
          <ExternalLink className="w-3 h-3" />
          Open source
        </a>
      )}
    </div>
  );
}

// ============================================
// SECTION COMPONENT
// ============================================

function NotesSection({
  section,
  isExpanded,
  onToggle,
  activeCitation,
  onCitationClick,
}: {
  section: NotesSection;
  isExpanded: boolean;
  onToggle: () => void;
  activeCitation: Citation | null;
  onCitationClick: (citation: Citation | null) => void;
}) {
  // Parse markdown and insert citation chips at footnote markers
  const renderContentWithCitations = () => {
    // First, render with regular markdown
    return (
      <div className="prose-notes">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0 text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-2 leading-relaxed text-sm text-foreground/90 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-4 mb-2 space-y-1 text-sm">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-4 mb-2 space-y-1 text-sm">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed text-foreground/90">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-foreground/90">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-primary/40 pl-3 py-1 my-2 bg-muted/30 rounded-r italic text-muted-foreground text-sm">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-primary">
                {children}
              </code>
            ),
          }}
        >
          {section.content}
        </ReactMarkdown>
        
        {/* Citation chips at bottom of section */}
        {section.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground mr-1">Sources:</span>
            {section.citations.map((citation, index) => (
              <CitationChip
                key={citation.authority_id + index}
                citation={citation}
                index={index}
                isActive={activeCitation?.authority_id === citation.authority_id}
                onClick={() => onCitationClick(
                  activeCitation?.authority_id === citation.authority_id ? null : citation
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between gap-3 p-3',
          'text-left hover:bg-muted/50 transition-colors',
          isExpanded && 'border-b border-border bg-muted/30'
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <h3 className="font-medium text-foreground text-sm">{section.heading}</h3>
        </div>
        {section.citations.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {section.citations.length} {section.citations.length === 1 ? 'source' : 'sources'}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(
              activeCitation ? 'lg:col-span-2' : 'lg:col-span-3'
            )}>
              {renderContentWithCitations()}
            </div>
            
            {activeCitation && (
              <div className="lg:col-span-1">
                <CitationPanel
                  citation={activeCitation}
                  onClose={() => onCitationClick(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN NOTES READER COMPONENT
// ============================================

export function NotesReader({
  title,
  skillName,
  sections,
  className,
  onCitationClick,
}: NotesReaderProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    // Expand first section by default
    new Set(sections.length > 0 ? [sections[0].id] : [])
  );
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
        // Clear citation if collapsing section
        setActiveCitation(null);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleCitationClick = useCallback((citation: Citation | null) => {
    setActiveCitation(citation);
    if (citation && onCitationClick) {
      onCitationClick(citation);
    }
  }, [onCitationClick]);

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
    setActiveCitation(null);
  };

  const totalCitations = sections.reduce((acc, s) => acc + s.citations.length, 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {skillName && (
            <p className="text-sm text-muted-foreground mt-0.5">{skillName}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {sections.length} {sections.length === 1 ? 'section' : 'sections'}
            {totalCitations > 0 && ` • ${totalCitations} citations`}
          </span>
          <span className="text-muted-foreground">•</span>
          <button
            onClick={expandAll}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Expand all
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={collapseAll}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map(section => (
          <NotesSection
            key={section.id}
            section={section}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            activeCitation={activeCitation}
            onCitationClick={handleCitationClick}
          />
        ))}
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No notes available yet.</p>
        </div>
      )}
    </div>
  );
}

export default NotesReader;
