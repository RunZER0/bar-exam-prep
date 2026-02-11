export async function fetchWithAuth(
  url: string,
  token: string | null,
  options: RequestInit = {}
) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function getCompetencyColor(competency: string): string {
  const colors = {
    drafting: 'text-blue-600 bg-blue-100',
    research: 'text-green-600 bg-green-100',
    oral: 'text-purple-600 bg-purple-100',
  };
  return colors[competency as keyof typeof colors] || 'text-gray-600 bg-gray-100';
}

export function getDifficultyColor(difficulty: string): string {
  const colors = {
    beginner: 'text-green-600 bg-green-100',
    intermediate: 'text-yellow-600 bg-yellow-100',
    advanced: 'text-red-600 bg-red-100',
  };
  return colors[difficulty as keyof typeof colors] || 'text-gray-600 bg-gray-100';
}
