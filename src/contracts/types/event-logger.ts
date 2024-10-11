import { Event } from "./event.ts";

export type EventLogger = {
  log: (event: Omit<Event, "contract">) => void;
};
