import { Event } from "@contracts/types/event.ts";
import { EventLogger } from "@contracts/types/event-logger.ts";

export const eventLoggerFactory = (
  events: Event[],
  contract: string,
): EventLogger => {
  return {
    log: (event) => {
      events.push({ ...event, contract: contract });
    },
  };
};
