'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/constants/legal-content';
import {
  FileText,
  ScrollText,
  BookOpenCheck,
  Handshake,
  Building2,
  Building,
  Brain,
  Siren,
  Send,
  SearchIcon,
  ArrowRight,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, any> = {
  pleadings: ScrollText,
  affidavits: FileText,
  submissions: BookOpenCheck,
  contracts: Handshake,
  conveyancing: Building,
  corporate: Building2,
  opinions: Brain,
  criminal: Siren,
  notices: Send,
};

export default function DraftingPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = Object.entries(LEGAL_DOCUMENT_TYPES);

  const filteredCategories = categories
    .map(([key, cat]) => {
      const filteredDocs = cat.documents.filter(
        (doc) =>
          doc.name.toLowerCase().includes(search.toLowerCase()) ||
          doc.description.toLowerCase().includes(search.toLowerCase())
      );
      return { key, category: cat.category, documents: filteredDocs };
    })
    .filter((cat) => cat.documents.length > 0);

  const totalDocuments = categories.reduce(
    (sum, [, cat]) => sum + cat.documents.length,
    0
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Legal Drafting</h1>
        <p className="text-muted-foreground mt-1">
          Select a document type to begin drafting or learn how to draft.{' '}
          <span className="text-xs">({totalDocuments} document types available)</span>
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search document types…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !activeCategory
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {categories.map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(activeCategory === key ? null : key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.category}
          </button>
        ))}
      </div>

      {/* Document categories & cards */}
      <div className="space-y-10">
        {filteredCategories
          .filter((cat) => !activeCategory || cat.key === activeCategory)
          .map((cat) => {
            const Icon = CATEGORY_ICONS[cat.key] || FileText;
            return (
              <section key={cat.key}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{cat.category}</h2>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({cat.documents.length})
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.documents.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/drafting/${doc.id}`}
                    >
                      <Card className="group cursor-pointer border hover:border-primary/40 hover:shadow-sm transition-all duration-200 h-full">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            {doc.name}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-muted-foreground" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-xs leading-relaxed">
                            {doc.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No documents match your search.</p>
        </div>
      )}
    </div>
  );
}
