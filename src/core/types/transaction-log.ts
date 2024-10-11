import { Metadata } from "@contracts/types/metadata.ts";
import { Event } from "@contracts/types/event.ts";

export type TransactionLog = (Omit<Metadata, "sender" | "currentContract"> & {
  inscription?: string;
  eventLogs: Array<Event>;
  currentContract?: string;
  method?: string;
}) &
  (
    | {
        status: "ERROR";
        errorMessage: string;
      }
    | {
        status: "SUCCESS";
      }
  );
