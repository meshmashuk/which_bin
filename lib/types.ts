export interface AddressOption {
  pIndex: string;
  label: string;
}

export interface CollectionEvent {
  date: string;
  service: string;
}

export interface ScheduleData {
  postcode: string;
  pIndex: string;
  addressLabel: string;
  events: CollectionEvent[];
  fetchedAt: string;
  cached: boolean;
}

export interface SavedAddress {
  postcode: string;
  pIndex: string;
  label: string;
}
