export interface DemoRow {
  id: string;
  created: string;
  client: { name: string; sector: string; country: string };
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'pending' | 'completed' | 'in_progress';
  score: number;
  amount: number;
}

const sectors = ['Banking', 'Energy', 'Tech', 'Health', 'Retail'];
const countries = ['ES', 'FR', 'DE', 'IT', 'PT', 'UK'];
const levels: DemoRow['level'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const statuses: DemoRow['status'][] = ['pending', 'completed', 'in_progress'];

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateSampleData(count = 200): DemoRow[] {
  const rng = pseudoRandom(42);
  const rows: DemoRow[] = [];
  for (let i = 0; i < count; i++) {
    const sector = sectors[Math.floor(rng() * sectors.length)];
    const country = countries[Math.floor(rng() * countries.length)];
    const level = levels[Math.floor(rng() * levels.length)];
    const status = statuses[Math.floor(rng() * statuses.length)];
    const date = new Date(2025, Math.floor(rng() * 12), 1 + Math.floor(rng() * 28));
    rows.push({
      id: `row-${i + 1}`,
      created: date.toISOString().slice(0, 10),
      client: {
        name: `Client ${String(i + 1).padStart(3, '0')}`,
        sector,
        country,
      },
      level,
      status,
      score: Math.round(rng() * 100),
      amount: Math.round(rng() * 100000) / 100,
    });
  }
  return rows;
}

export const sectorOptions = sectors.map((s) => ({ value: s, label: s }));
export const countryOptions = countries.map((c) => ({ value: c, label: c }));
export const levelOptions = levels.map((l) => ({ value: l, label: l }));
export const statusOptions = statuses.map((s) => ({
  value: s,
  label: s.replace('_', ' '),
}));
