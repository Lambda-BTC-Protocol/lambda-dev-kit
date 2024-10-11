import { TransactionLog } from "../types/transaction-log.ts";
import { Inscription } from "../types/inscription.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { z } from "zod";
import { ExecutionError } from "@contracts/types/execution-error.ts";

export abstract class InscriptionExecutor<T extends Inscription> {
  protected inscription: T;

  protected constructor(
    _inscription: Inscription,
    protected metadata: Metadata,
  ) {
    const result = this.getInscriptionSchema().safeParse(_inscription);
    if (!result.success) {
      throw new ExecutionError("inscription can not be parsed");
    }
    this.inscription = result.data;
  }

  abstract getInscriptionSchema(): z.Schema<T>;

  abstract startExecution(): Promise<Omit<TransactionLog, "status">>;
}
