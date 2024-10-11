import { TransactionLog } from "@core/types/transaction-log.ts";

export interface TransactionLogStorage {
  addTransaction(transaction: TransactionLog): Promise<void>;
  addTransactions(transactions: TransactionLog[]): Promise<void>;
  getAll(): Promise<Array<TransactionLog>>;
}
