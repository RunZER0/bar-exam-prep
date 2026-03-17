'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBundleById, getDocumentById } from '@/lib/constants/legal-content';
import PremiumGate from '@/components/PremiumGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  PackageOpen,
  FileText,
  CheckCircle2,
  Circle,
  BookOpenCheck,
  PenLine,
} from 'lucide-react';

type DocStatus = 'not-started' | 'in-progress' | 'completed';

export default function BundlePage() {
  const params = useParams();
  const router = useRouter();
  const bundleId = params.bundleId as string;
  const bundle = getBundleById(bundleId);

  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>({});

  if (!bundle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <PackageOpen className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold">Bundle not found</h1>
        <p className="text-muted-foreground text-sm">This document bundle does not exist.</p>
        <Button variant="outline" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Drafting
        </Button>
      </div>
    );
  }

  const bundleDocs = bundle.documents
    .map((dId) => getDocumentById(dId))
    .filter(Boolean) as { id: string; name: string; description: string; category: string }[];

  const completedCount = bundleDocs.filter((d) => docStatuses[d.id] === 'completed').length;
  const progress = bundleDocs.length > 0 ? Math.round((completedCount / bundleDocs.length) * 100) : 0;

  const markStatus = (docId: string, status: DocStatus) => {
    setDocStatuses((prev) => ({ ...prev, [docId]: status }));
  };

  // Find the next document to work on (first non-completed)
  const nextDoc = bundleDocs.find((d) => docStatuses[d.id] !== 'completed');

  return (
    <PremiumGate feature="drafting">
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/drafting')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Drafting
          </button>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <PackageOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{bundle.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{bundle.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-0.5 rounded-full">{bundle.category}</span>
                <span>{bundleDocs.length} documents</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Bundle Progress</span>
            <span className="text-muted-foreground">{completedCount}/{bundleDocs.length} completed</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* How it works */}
        <div className="bg-muted/50 border rounded-lg p-4 text-sm space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            How Bundle Drafting Works
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Work through each document in order — they build on each other</li>
            <li>Click <strong>Learn</strong> to study the drafting guide, or <strong>Practice</strong> to draft it yourself</li>
            <li>Mark each document as complete when you&apos;re done, then move to the next</li>
            <li>The bundle tracks your progress across all documents</li>
          </ol>
        </div>

        {/* Document list */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Documents in this Bundle</h2>
          
          {bundleDocs.map((doc, index) => {
            const status = docStatuses[doc.id] || 'not-started';
            const isNext = doc.id === nextDoc?.id;
            
            return (
              <Card
                key={doc.id}
                className={`border transition-all duration-200 ${
                  status === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10'
                    : isNext
                    ? 'border-primary/40 shadow-sm'
                    : ''
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    {/* Step number / status icon */}
                    <div className="shrink-0">
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isNext ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold">{doc.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{doc.description}</CardDescription>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'completed' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => markStatus(doc.id, 'not-started')}
                        >
                          Redo
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-emerald-600"
                          onClick={() => markStatus(doc.id, 'completed')}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                      )}
                      <Link href={`/drafting/${doc.id}`}>
                        <Button
                          variant={isNext ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-7 gap-1"
                        >
                          <PenLine className="h-3 w-3" />
                          {isNext ? 'Start' : 'Open'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Completion message */}
        {completedCount === bundleDocs.length && bundleDocs.length > 0 && (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-semibold text-emerald-600">Bundle Complete!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You have completed all {bundleDocs.length} documents in this bundle.
              In real practice, these documents would be filed or prepared together.
            </p>
            <Button variant="outline" onClick={() => router.push('/drafting')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Documents
            </Button>
          </div>
        )}
      </div>
    </PremiumGate>
  );
}
