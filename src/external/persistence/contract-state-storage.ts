import { Contract } from "@contracts/types/contract.ts";
import { serialize } from "superjson";

export type ContractState = Record<string, unknown>;

export interface ContractStateStorage {
  loadContractState(contractName: string): Promise<ContractState>;

  store(blockNumber: number, states: Map<string, Contract>): Promise<void>;
}

export const contractStateHelper = {
  createContractState: (contract: Contract) => {
    return contractStateHelper._serializeState(
      contractStateHelper._createStrippedState(contract),
    );
  },

  _createStrippedState: (contract: Contract): ContractState => {
    return Object.entries(contract).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        value = value.filter((v) => typeof v !== "function");
      }

      if (
        key === "activeOn" ||
        key === "mutations" ||
        key === "queries" ||
        typeof value === "function" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return acc;
      }
      return { ...acc, [key]: value };
    }, {});
  },

  _serializeState: (
    state: ContractState,
  ): {
    meta: unknown;
    state: unknown;
  } => {
    const { json, meta } = serialize(state);
    return { state: json, meta: meta };
  },
};
