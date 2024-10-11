import { undefined, z } from "zod";
import { DeployedContractsStorage } from "@external/persistence/deployed-contracts-storage.ts";

export class DeployedContractsStorageJson implements DeployedContractsStorage {
  _schema = z.record(z.string(), z.string());

  constructor(private _path: string) {}

  async delete(contractName: string): Promise<void> {
    const state = await this._loadJsonFile();
    delete state[contractName];
    await this._writeJsonFile(state);
  }

  async get(contractName: string): Promise<string | undefined> {
    const state = await this._loadJsonFile();
    return state[contractName];
  }

  async getAll(): Promise<{ deployedName: string; template: string }[]> {
    const state = await this._loadJsonFile();
    return Object.entries(state).map(([deployedName, template]) => ({
      deployedName,
      template,
    }));
  }

  async set(contractName: string, template: string): Promise<void> {
    const state = await this._loadJsonFile();
    state[contractName] = template;
    await this._writeJsonFile(state);
  }

  private async _loadJsonFile() {
    const file = Bun.file(this._path);
    if (!(await file.exists())) return {};
    const json = await file.json();
    return this._schema.parse(json);
  }

  private async _writeJsonFile(state: z.infer<typeof this._schema>) {
    await Bun.write(this._path, JSON.stringify(state));
  }
}
