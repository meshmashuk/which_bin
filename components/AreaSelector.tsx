'use client';

import { AREAS } from '@/lib/areas';

export function AreaSelector({
  selectedPostcode,
  onChange,
  onRefresh,
  refreshing,
}: {
  selectedPostcode: string;
  onChange: (postcode: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex gap-2 w-full max-w-md mx-auto">
      <select
        value={selectedPostcode}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-base"
      >
        {AREAS.map((area) => (
          <option key={area.postcode} value={area.postcode}>
            {area.label}
          </option>
        ))}
      </select>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 font-medium disabled:opacity-50"
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}
