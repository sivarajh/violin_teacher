import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Note } from '../lib/notes';

export type Settings = {
  name: string;
  a4: number;
  tolerance: number;
  holdMs: number;
  bpm: number;
  autoPlayRef: boolean;
};

export type Progress = { completedLessons: string[]; days: string[] };

export type Piece = {
  id: string;
  title: string;
  format: string;
  notes: Note[];
  tempo?: number | null;
  created: number;
  lastPracticed?: number | null;
  bestAccuracy?: number | null;
  /** Photo of the sheet music, if the piece was transcribed from one. */
  hasImage?: boolean;
};

export const DEFAULT_SETTINGS: Settings = { name: '', a4: 440, tolerance: 25, holdMs: 300, bpm: 72, autoPlayRef: false };
const KEYS = { settings: 'vt.settings', progress: 'vt.progress', pieces: 'vt.pieces' };

type Store = {
  ready: boolean;
  settings: Settings;
  progress: Progress;
  pieces: Piece[];
  updateSettings: (patch: Partial<Settings>) => void;
  addPiece: (p: Omit<Piece, 'id' | 'created'>) => Piece;
  updatePiece: (id: string, patch: Partial<Piece>) => void;
  deletePiece: (id: string) => void;
  completeLesson: (id: string) => void;
  markPracticedToday: () => void;
  resetProgress: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
};

const Ctx = createContext<Store | null>(null);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<Progress>({ completedLessons: [], days: [] });
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [s, p, pc] = await Promise.all([
        loadJSON<Partial<Settings>>(KEYS.settings, {}),
        loadJSON<Partial<Progress>>(KEYS.progress, {}),
        loadJSON<Piece[]>(KEYS.pieces, []),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setProgress({ completedLessons: [], days: [], ...p });
      setPieces(pc);
      setReady(true);
    })();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Persist after the first load.
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings)).catch(() => undefined); }, [ready, settings]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.progress, JSON.stringify(progress)).catch(() => undefined); }, [ready, progress]);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEYS.pieces, JSON.stringify(pieces)).catch(() => showToast('Could not save — storage may be full.'));
  }, [ready, pieces, showToast]);

  const store = useMemo<Store>(() => ({
    ready,
    settings,
    progress,
    pieces,
    toast,
    showToast,
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    addPiece: (p) => {
      const piece: Piece = { ...p, id: uid(), created: Date.now() };
      setPieces((list) => [...list, piece]);
      return piece;
    },
    updatePiece: (id, patch) => setPieces((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    deletePiece: (id) => setPieces((list) => list.filter((p) => p.id !== id)),
    completeLesson: (id) => setProgress((pr) => (pr.completedLessons.includes(id) ? pr : { ...pr, completedLessons: [...pr.completedLessons, id] })),
    markPracticedToday: () => setProgress((pr) => {
      const d = today();
      return pr.days.includes(d) ? pr : { ...pr, days: [...pr.days, d].sort() };
    }),
    resetProgress: () => setProgress({ completedLessons: [], days: [] }),
  }), [ready, settings, progress, pieces, toast, showToast]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}

/** Consecutive practice days ending today (or yesterday). */
export function streak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!set.has(key(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (set.has(key(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
