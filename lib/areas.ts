export interface Area {
  /** Shown in the dropdown. */
  label: string;
  /** Postcode used to fetch the schedule — every address on it shares the same collection days. */
  postcode: string;
  /** The specific address originally used to find this postcode, kept for reference/traceability. */
  lookupAddress: string;
}

export const AREAS: Area[] = [
  {
    label: 'Parklands Road, Hassocks',
    postcode: 'BN6 8JZ',
    lookupAddress: '2 Parklands Road, Hassocks',
  },
];
