import { Contract } from "@contracts/types/contract";
import {
  ContractState,
  contractStateHelper,
  ContractStateStorage,
} from "@external/persistence/contract-state-storage.ts";
import { z } from "zod";
import { deserialize, parse, stringify } from "superjson";

export class ContractStateStorageJson implements ContractStateStorage {
  private _schema = z.record(
    z.string(),
    z.object({ state: z.unknown(), meta: z.unknown() }),
  );

  constructor(private _path: string) {}

  async loadContractState(contractName: string): Promise<ContractState> {
    const json = await this._loadJsonFile();
    const storedState = json[contractName];
    if (!storedState) return {};
    return deserialize({
      json: storedState.state as any,
      meta: storedState.meta as any,
    }) satisfies Record<string, unknown>;
  }

  async store(
    blockNumber: number,
    states: Map<string, Contract>,
  ): Promise<void> {
    const json = await this._loadJsonFile();
    for (let [name, state] of states) {
      json[name] = contractStateHelper.createContractState(state);
    }
    await this._writeJsonFile(json);
  }

  private async _loadJsonFile() {
    const file = Bun.file(this._path);
    if (!(await file.exists())) return {};
    const json = parse(await file.text());
    return this._schema.parse(json);
  }

  private async _writeJsonFile(state: z.infer<typeof this._schema>) {
    await Bun.write(this._path, stringify(state));
  }
}
