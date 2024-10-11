import { Metadata } from "./metadata.ts";
import { EventLogger } from "./event-logger.ts";
import { Ecosystem } from "./ecosystem.ts";
import { Oracle } from "./oracle.ts";

export type ContractParams = {
  metadata: Metadata;
  ecosystem: Ecosystem;
  eventLogger: EventLogger;
  oracle: Oracle;
  args: Array<unknown>;
};

export interface Contract {
  activeOn: number;
}
