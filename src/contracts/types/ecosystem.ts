import { Contract } from "./contract.ts";
import { WrappedContract } from "../utils/contract-wrapper.ts";

export type Ecosystem = {
  getContractObj: <T extends Contract>(
    contractName: string,
  ) => Promise<WrappedContract<T> | null>;
  redeployContract: <T extends Contract>(
    templateContract: string,
    newContractName: string,
  ) => Promise<WrappedContract<T>>;
};
