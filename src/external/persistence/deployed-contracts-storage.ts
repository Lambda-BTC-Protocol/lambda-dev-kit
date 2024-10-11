import { undefined } from "zod";

export interface DeployedContractsStorage {
  get(contractName: string): Promise<string | undefined>;
  getAll(): Promise<
    {
      deployedName: string;
      template: string;
    }[]
  >;
  set(contractName: string, template: string): Promise<void>;
  delete(contractName: string): Promise<void>;
}
