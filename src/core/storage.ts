import { TransactionLogStorage } from "@external/persistence/transaction-log-storage.ts";
import { DeployedContractsStorage } from "@external/persistence/deployed-contracts-storage.ts";
import { ContractStateStorage } from "@external/persistence/contract-state-storage.ts";
import { DeployedContractsStorageJson } from "@external/persistence/impl/deployed-contracts-storage-json.ts";
import { ContractStateStorageJson } from "@external/persistence/impl/contract-state-storage-json.ts";
import { TxnLogStorageJson } from "@external/persistence/impl/txn-log-storage-json.ts";

export const txnLogStorage: TransactionLogStorage = new TxnLogStorageJson(
  "./tmp/transactions.json",
);

export const deployedContractsStorage: DeployedContractsStorage =
  new DeployedContractsStorageJson("./tmp/deployed.json");

export const contractStateStorage: ContractStateStorage =
  new ContractStateStorageJson("./tmp/state.json");
