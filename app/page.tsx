'use client';

import { useEffect, useState } from 'react';
import { PostcodeSearch } from '@/components/PostcodeSearch';
import { ScheduleView } from '@/components/ScheduleView';
import type { ScheduleData } from '@/lib/types';

const STORAGE_KEY = 'whichbin.postcode';

export default function Home() {
  const [postcode, setPostcode] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage must happen after mount to avoid an SSR/client hydration mismatch,
    // so setting state here (rather than during render) is unavoidable.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPostcode(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !postcode) return;
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

  function handleSearch(pc: string) {
    localStorage.setItem(STORAGE_KEY, pc);
    setPostcode(pc);
    setSchedule(null);
  }

  function handleChangePostcode() {
    localStorage.removeItem(STORAGE_KEY);
    setPostcode(null);
    setSchedule(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">Which Bin?</h1>
      <p className="text-sm text-zinc-500 mb-8">Mid Sussex bin collection calendar</p>

      {!hydrated ? null : !postcode ? (
        <PostcodeSearch onSubmit={handleSearch} />
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading schedule…</p>
      ) : schedule ? (
        <ScheduleView
          schedule={schedule}
          refreshing={refreshing}
          onRefresh={() => loadSchedule(postcode, true)}
          onChangePostcode={handleChangePostcode}
        />
      ) : error ? (
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={handleChangePostcode}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium"
          >
            Try a different postcode
          </button>
        </div>
      ) : null}
    </div>
  );
}
