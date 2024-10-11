import { Contract } from "../contracts/types/contract.ts";
import { Event } from "../contracts/types/event.ts";
import { SeedableRandom } from "../contracts/utils/seedable-random.ts";
import { hashToNumber } from "../contracts/utils/on-chain-random.ts";
import { Metadata } from "../contracts/types/metadata.ts";
import ExpiryMap from "expiry-map";

export type InscriptionScope = {
  block: number;
  blockTimestamp: number;
  deployedContracts: string[];
  contractStateBuffer: Map<string, Contract>;
  seedableRandom: SeedableRandom;
};

export type ExecutionScope = {
  deployedContractsAmount: number;
  events: Event[];
};

export class Scope {
  inscriptionScope: InscriptionScope;
  executionScope: ExecutionScope;

  // scopes are stored in a transaction hash map with a 1 minute expiry
  static scopes = new ExpiryMap<string, Scope>(1000 * 60);

  static getScope(transactionHash: string) {
    if (!Scope.scopes.has(transactionHash)) {
      throw new Error("Scope not found");
    }
    return Scope.scopes.get(transactionHash)!;
  }

  static createScope(metadata: Metadata) {
    const scope = new Scope(metadata);
    Scope.scopes.set(metadata.transactionHash, scope);
    return scope;
  }

  constructor(metadata: Metadata) {
    this.inscriptionScope = {
      block: metadata.blockNumber,
      blockTimestamp: metadata.timestamp,
      deployedContracts: [],
      contractStateBuffer: new Map(),
      seedableRandom: new SeedableRandom(
        hashToNumber(metadata.transactionHash),
      ),
    };

    this.executionScope = {
      deployedContractsAmount: 0,
      events: [],
    };
  }
}
