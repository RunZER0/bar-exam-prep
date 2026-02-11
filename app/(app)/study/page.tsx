'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import {
  Gavel,
  Scale,
  FileText,
  Shield,
  Building,
  Briefcase,
  Users,
  BookOpen,
  Building2,
  Handshake,
  Calculator,
  ArrowRight,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel,
  Scale,
  FileText,
  Shield,
  Building,
  Briefcase,
  Users,
  BookOpen,
  Building2,
  Handshake,
  Calculator,
};

const COLORS = [
  'bg-emerald-500/10 text-emerald-600 hover:border-emerald-500/40',
  'bg-red-500/10 text-red-600 hover:border-red-500/40',
  'bg-blue-500/10 text-blue-600 hover:border-blue-500/40',
  'bg-violet-500/10 text-violet-600 hover:border-violet-500/40',
  'bg-amber-500/10 text-amber-600 hover:border-amber-500/40',
  'bg-cyan-500/10 text-cyan-600 hover:border-cyan-500/40',
  'bg-pink-500/10 text-pink-600 hover:border-pink-500/40',
  'bg-indigo-500/10 text-indigo-600 hover:border-indigo-500/40',
  'bg-teal-500/10 text-teal-600 hover:border-teal-500/40',
  'bg-orange-500/10 text-orange-600 hover:border-orange-500/40',
  'bg-lime-500/10 text-lime-600 hover:border-lime-500/40',
  'bg-fuchsia-500/10 text-fuchsia-600 hover:border-fuchsia-500/40',
];

export default function StudyPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Study</h1>
        <p className="text-muted-foreground mt-1">
          Choose an ATP unit to begin your in-depth study. Each unit covers core statutes,
          concepts, and practical application.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATP_UNITS.map((unit, i) => {
          const Icon = ICON_MAP[unit.icon] || BookOpen;
          const color = COLORS[i % COLORS.length];
          const [bgColor, textColor, hoverBorder] = color.split(' ');
          return (
            <Link key={unit.id} href={`/study/${unit.id}`}>
              <Card
                className={`group cursor-pointer border transition-all duration-200 hover:shadow-md h-full ${hoverBorder}`}
              >
                <CardHeader className="pb-3">
                  <div className={`p-2.5 rounded-lg w-fit ${bgColor} ${textColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base mt-3 flex items-center justify-between">
                    {unit.name}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {unit.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {unit.statutes.slice(0, 3).map((statute, j) => (
                      <span
                        key={j}
                        className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                      >
                        {statute.length > 30 ? statute.slice(0, 28) + '…' : statute}
                      </span>
                    ))}
                    {unit.statutes.length > 3 && (
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        +{unit.statutes.length - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
