export interface BinType {
  key: string;
  label: string;
  color: string;
  textColor: string;
}

const KNOWN_BIN_TYPES: Record<string, BinType> = {
  'Domestic Refuse Waste Collection Service': {
    key: 'general',
    label: 'General Waste',
    color: '#3f3f46',
    textColor: '#ffffff',
  },
  'Domestic Recycling Waste Collection Service': {
    key: 'recycling',
    label: 'Recycling',
    color: '#2563eb',
    textColor: '#ffffff',
  },
  'Domestic Food Waste Service': {
    key: 'food',
    label: 'Food Waste',
    color: '#16a34a',
    textColor: '#ffffff',
  },
  'Domestic Garden Waste Service': {
    key: 'garden',
    label: 'Garden Waste',
    color: '#a16207',
    textColor: '#ffffff',
  },
};

const FALLBACK_COLOR: BinType = {
  key: 'other',
  label: 'Other Collection',
  color: '#64748b',
  textColor: '#ffffff',
};

export function binTypeFor(serviceName: string): BinType {
  return KNOWN_BIN_TYPES[serviceName] ?? { ...FALLBACK_COLOR, label: serviceName };
}
