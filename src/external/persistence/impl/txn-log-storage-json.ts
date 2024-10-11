import { z } from "zod";
import { TransactionLogStorage } from "@external/persistence/transaction-log-storage.ts";
import { TransactionLog } from "@core/types/transaction-log.ts";
import { parse, stringify } from "superjson";

export class TxnLogStorageJson implements TransactionLogStorage {
  _schema = z.set(z.unknown());

  constructor(private _path: string) {}

  async addTransaction(transaction: TransactionLog): Promise<void> {
    const txns = await this._loadJsonFile();
    txns.add(transaction);
    await this._writeJsonFile(txns);
  }

  async addTransactions(transactions: TransactionLog[]): Promise<void> {
    const txns = await this._loadJsonFile();
    for (const transaction of transactions) {
      txns.add(transaction);
    }
    await this._writeJsonFile(txns);
  }

  async getAll(): Promise<Array<TransactionLog>> {
    const txns = (await this._loadJsonFile()) as Set<TransactionLog>;
    return [...txns];
  }

  private async _loadJsonFile() {
    const file = Bun.file(this._path);
    if (!(await file.exists())) return new Set();
    const json = parse(await file.text());
    return this._schema.parse(json);
  }

  private async _writeJsonFile(state: z.infer<typeof this._schema>) {
    await Bun.write(this._path, stringify(state));
  }
}
