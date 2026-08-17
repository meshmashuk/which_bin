export interface CollectionEvent {
  date: string;
  service: string;
}

export interface ScheduleData {
  postcode: string;
  events: CollectionEvent[];
  fetchedAt: string;
  cached: boolean;
}
