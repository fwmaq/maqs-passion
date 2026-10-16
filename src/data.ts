export const categories = ['Mechanics', 'Aim', 'Fighting', 'Endgame', 'VOD'] as const;
export type Category = (typeof categories)[number];

export type Session = {
  id: string;
  date: string;
  category: Category;
  minutes: number;
  focus: string;
  notes: string;
  demo?: boolean;
};

export type PracticeRoutine = {
  id: string;
  name: string;
  category: Category;
  duration: number;
  description: string;
  drills: string[];
  difficulty: string;
};

export type Tournament = {
  id: string;
  name: string;
  date: string;
  type: string;
  note: string;
};

export type VodNote = {
  id: string;
  title: string;
  createdAt: string;
  mistake: string;
  adjustment: string;
};

export const routines: PracticeRoutine[] = [
  {
    id: 'mechanics', name: 'MECHANICAL PRECISION', category: 'Mechanics', duration: 30,
    difficulty: 'ADVANCED', description: 'Build consistent edits, clean piece control, and reliable high-speed mechanics.',
    drills: ['5 min — controlled triple edits', '10 min — piece-control tunnels', '10 min — edit resets under pressure', '5 min — full-speed freebuild']
  },
  {
    id: 'fighting', name: 'FIGHT IQ', category: 'Fighting', duration: 40,
    difficulty: 'ELITE', description: 'Work on peek discipline, pressure decisions, and winning realistic engagements.',
    drills: ['10 min — right-hand peek repetitions', '15 min — realistic 1v1s', '10 min — box-fight scenarios', '5 min — mistake review']
  },
  {
    id: 'aim', name: 'AIM LOCK-IN', category: 'Aim', duration: 20,
    difficulty: 'ALL LEVELS', description: 'Sharpen crosshair placement, tracking, and close-range shot accuracy.',
    drills: ['5 min — smooth tracking', '5 min — flick precision', '5 min — movement + crosshair placement', '5 min — shotgun target swaps']
  },
  {
    id: 'endgame', name: 'ENDGAME CONTROL', category: 'Endgame', duration: 45,
    difficulty: 'ELITE', description: 'Improve layer selection, refresh timing, and decision-making in moving zones.',
    drills: ['10 min — rotate review', '20 min — endgame scrims', '10 min — positioning scenarios', '5 min — key takeaways']
  }
];

export const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function makeDemoSessions(): Session[] {
  const data: Array<[number, Category, number, string]> = [
    [6, 'Mechanics', 35, 'Edit consistency'],
    [5, 'Aim', 20, 'Shotgun accuracy'],
    [4, 'Fighting', 45, 'Piece control'],
    [3, 'Endgame', 50, 'Moving zones'],
    [2, 'Mechanics', 40, 'Triple edits'],
    [1, 'Fighting', 55, 'Realistics'],
    [0, 'Aim', 30, 'Tracking']
  ];
  return data.map(([daysAgo, category, minutes, focus], index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return { id: `demo-${index}`, date: date.toISOString(), category, minutes, focus, notes: '', demo: true };
  });
}

export function dayKey(input: Date | string): string {
  const d = new Date(input);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

export function weekDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { key: dayKey(date), label: date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase() };
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
