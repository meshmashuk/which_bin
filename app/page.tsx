'use client';

import { useEffect, useState } from 'react';
import { AddressSearch } from '@/components/AddressSearch';
import { ScheduleView } from '@/components/ScheduleView';
import type { SavedAddress, ScheduleData } from '@/lib/types';

const STORAGE_KEY = 'whichbin.address';

export default function Home() {
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage must happen after mount to avoid an SSR/client hydration mismatch,
    // so setting state here (rather than during render) is unavoidable.
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAddress(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !address) return;
    loadSchedule(address, false);
  }, [hydrated, address]);

  async function loadSchedule(addr: SavedAddress, force: boolean) {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({ postcode: addr.postcode, pIndex: addr.pIndex });
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

  function handleSelect(addr: SavedAddress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addr));
    setAddress(addr);
    setSchedule(null);
  }

  function handleChangeAddress() {
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
    setSchedule(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">Which Bin?</h1>
      <p className="text-sm text-zinc-500 mb-8">Mid Sussex bin collection calendar</p>

      {!hydrated ? null : !address ? (
        <AddressSearch onSelect={handleSelect} />
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading schedule…</p>
      ) : schedule ? (
        <ScheduleView
          schedule={schedule}
          refreshing={refreshing}
          onRefresh={() => loadSchedule(address, true)}
          onChangeAddress={handleChangeAddress}
        />
      ) : error ? (
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={handleChangeAddress}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium"
          >
            Try a different address
          </button>
        </div>
      ) : null}
    </div>
  );
}
