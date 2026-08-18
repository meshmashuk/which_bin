'use client';

import { useEffect, useState } from 'react';
import { AreaSelector } from '@/components/AreaSelector';
import { ScheduleView } from '@/components/ScheduleView';
import { AREAS } from '@/lib/areas';
import type { ScheduleData } from '@/lib/types';

const STORAGE_KEY = 'whichbin.postcode';

export default function Home() {
  const [postcode, setPostcode] = useState(AREAS[0].postcode);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage must happen after mount to avoid an SSR/client hydration mismatch,
    // so setting state here (rather than during render) is unavoidable.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && AREAS.some((a) => a.postcode === saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPostcode(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    loadSchedule(postcode, false);
  }, [hydrated, postcode]);

  async function loadSchedule(pc: string, force: boolean) {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({ postcode: pc });
      if (force) params.set('force', '1');
      const res = await fetch(`/api/schedule?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load schedule');
      setSchedule(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleAreaChange(pc: string) {
    localStorage.setItem(STORAGE_KEY, pc);
    setPostcode(pc);
    setSchedule(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center px-4 py-12 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-1">Which Bin?</h1>
        <p className="text-sm text-zinc-500">Mid Sussex bin collection calendar</p>
      </div>

      <AreaSelector
        selectedPostcode={postcode}
        onChange={handleAreaChange}
        onRefresh={() => loadSchedule(postcode, true)}
        refreshing={refreshing}
      />

      {!hydrated || loading ? (
        <p className="text-sm text-zinc-500">Loading schedule…</p>
      ) : schedule ? (
        <ScheduleView schedule={schedule} />
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
