'use client';

import { binTypeFor } from '@/lib/binTypes';
import { daysUntil, formatDateLabel, formatFetchedAt, todayISO } from '@/lib/dateFormat';
import type { ScheduleData } from '@/lib/types';

function groupByDate(events: ScheduleData['events']) {
  const map = new Map<string, string[]>();
  for (const { date, service } of events) {
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(service);
  }
  return Array.from(map.entries())
    .filter(([date]) => date >= todayISO())
    .sort(([a], [b]) => a.localeCompare(b));
}

function BinPill({ service }: { service: string }) {
  const bin = binTypeFor(service);
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
      style={{ backgroundColor: bin.color, color: bin.textColor }}
    >
      {bin.label}
    </span>
  );
}

export function ScheduleView({ schedule }: { schedule: ScheduleData }) {
  const grouped = groupByDate(schedule.events);
  const next = grouped[0];
  const rest = grouped.slice(1);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="text-xs text-zinc-400 text-right mb-4">
        Updated {formatFetchedAt(schedule.fetchedAt)}
        {schedule.cached ? ' (cached)' : ''}
      </p>

      {next && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 mb-6">
          <p className="text-sm font-medium text-zinc-500 mb-2">Next collection</p>
          <p className="text-2xl font-semibold mb-3">
            {formatDateLabel(next[0])}
            <span className="text-base font-normal text-zinc-500 ml-2">
              {daysUntil(next[0]) === 0
                ? ''
                : `(in ${daysUntil(next[0])} day${daysUntil(next[0]) === 1 ? '' : 's'})`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {next[1].map((service) => (
              <BinPill key={service} service={service} />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {rest.map(([date, services]) => (
            <li key={date} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm font-medium">{formatDateLabel(date)}</span>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <BinPill key={service} service={service} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {grouped.length === 0 && (
        <p className="text-sm text-zinc-500">No upcoming collections found in the data — try Refresh.</p>
      )}
    </div>
  );
}
