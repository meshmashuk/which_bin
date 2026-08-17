'use client';

import { useState } from 'react';

export function PostcodeSearch({ onSubmit }: { onSubmit: (postcode: string) => void }) {
  const [postcode, setPostcode] = useState('');

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!postcode.trim()) return;
    onSubmit(postcode.trim());
  }

  return (
    <form onSubmit={search} className="flex gap-2 w-full max-w-md mx-auto">
      <input
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
        placeholder="e.g. BN6 8JZ"
        className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-base"
        autoFocus
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 font-medium"
      >
        Search
      </button>
    </form>
  );
}
