'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LEGAL_DOCUMENT_TYPES, ATP_UNITS } from '@/lib/constants/legal-content';
import PremiumGate from '@/components/PremiumGate';
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
  SlidersHorizontal,
  GraduationCap,
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

// Map document categories to their primary KSL ATP unit(s)
const CATEGORY_UNIT_MAP: Record<string, string[]> = {
  pleadings: ['atp-100', 'atp-103'],       // Civil Litigation + Legal Writing
  affidavits: ['atp-100', 'atp-103'],       // Civil Litigation + Legal Writing
  submissions: ['atp-100', 'atp-104'],      // Civil Litigation + Trial Advocacy
  contracts: ['atp-103', 'atp-108'],        // Legal Writing + Commercial Transactions
  conveyancing: ['atp-107', 'atp-103'],     // Conveyancing + Legal Writing
  corporate: ['atp-108', 'atp-106'],        // Commercial Transactions + Legal Practice Management
  opinions: ['atp-103', 'atp-105'],         // Legal Writing + Professional Ethics
  criminal: ['atp-101', 'atp-103'],         // Criminal Litigation + Legal Writing
  notices: ['atp-100', 'atp-101'],          // Civil Litigation + Criminal Litigation
  judgments: ['atp-100', 'atp-104'],        // Civil Litigation + Trial Advocacy
  adr: ['atp-100', 'atp-108'],             // Civil Litigation + Commercial Transactions
};

type SortMode = 'category' | 'unit';

export default function DraftingPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('category');

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

  // Build unit-grouped view
  const getUnitGroupedDocs = () => {
    const unitGroups: Record<string, { unit: typeof ATP_UNITS[number]; docs: { id: string; name: string; description: string; categoryKey: string; categoryName: string }[] }> = {};

    for (const unit of ATP_UNITS) {
      unitGroups[unit.id] = { unit, docs: [] };
    }

    for (const [key, cat] of categories) {
      const unitIds = CATEGORY_UNIT_MAP[key] || [];
      const primaryUnit = unitIds[0];
      if (!primaryUnit) continue;

      for (const doc of cat.documents) {
        if (search && !doc.name.toLowerCase().includes(search.toLowerCase()) && !doc.description.toLowerCase().includes(search.toLowerCase())) continue;
        if (unitGroups[primaryUnit]) {
          unitGroups[primaryUnit].docs.push({ ...doc, categoryKey: key, categoryName: cat.category });
        }
      }
    }

    return Object.entries(unitGroups)
      .filter(([, g]) => g.docs.length > 0)
      .filter(([unitId]) => !activeUnit || unitId === activeUnit);
  };

  return (
    <PremiumGate feature="drafting">
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Legal Drafting</h1>
        <p className="text-muted-foreground mt-1">
          Select a document type to begin drafting or learn how to draft.{' '}
          <span className="text-xs">({totalDocuments} document types available)</span>
        </p>
      </div>

      {/* Search + Sort toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-lg">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search document types…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => { setSortMode('category'); setActiveUnit(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              sortMode === 'category'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            By Category
          </button>
          <button
            onClick={() => { setSortMode('unit'); setActiveCategory(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              sortMode === 'unit'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            By KSL Unit
          </button>
        </div>
      </div>

      {/* Filter chips */}
      {sortMode === 'category' ? (
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
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveUnit(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !activeUnit
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All Units
          </button>
          {ATP_UNITS.map((unit) => (
            <button
              key={unit.id}
              onClick={() => setActiveUnit(activeUnit === unit.id ? null : unit.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeUnit === unit.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {unit.code}: {unit.name}
            </button>
          ))}
        </div>
      )}

      {/* Document cards */}
      {sortMode === 'category' ? (
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
                      <Link key={doc.id} href={`/drafting/${doc.id}`}>
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
      ) : (
        <div className="space-y-10">
          {getUnitGroupedDocs().map(([unitId, { unit, docs }]) => (
            <section key={unitId}>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{unit.code}: {unit.name}</h2>
                <span className="text-xs text-muted-foreground ml-1">
                  ({docs.length} documents)
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {docs.map((doc) => (
                  <Link key={doc.id} href={`/drafting/${doc.id}`}>
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
                        <span className="text-[10px] text-muted-foreground mt-2 block">{doc.categoryName}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {((sortMode === 'category' && filteredCategories.filter(c => !activeCategory || c.key === activeCategory).length === 0) ||
        (sortMode === 'unit' && getUnitGroupedDocs().length === 0)) && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No documents match your search.</p>
        </div>
      )}
    </div>
    </PremiumGate>
  );
}
