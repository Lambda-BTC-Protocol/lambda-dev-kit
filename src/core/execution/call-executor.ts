import {
  CallInscription,
  callInscriptionSchema,
  Inscription,
} from "../types/inscription.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { TransactionLog } from "../types/transaction-log.ts";
import pino from "pino";
import { execute } from "./execute.ts";
import { InscriptionExecutor } from "./inscription-executor.ts";
import _ from "lodash";
import { Scope } from "../scopes.ts";
import { getLogger } from "@core/logging.ts";
import { bigIntJson } from "../../util/big-int-json.ts";

export class CallExecutor extends InscriptionExecutor<CallInscription> {
  childLogger: pino.Logger;

  constructor(inscription: Inscription, metadata: Metadata) {
    super(inscription, metadata);
    metadata.currentContract = this.inscription.contract;

    this.childLogger = getLogger(this.metadata.transactionHash).child({
      contract: this.inscription.contract,
      method: this.inscription.function,
      origin: this.metadata.origin,
    });
  }

  getInscriptionSchema() {
    return callInscriptionSchema;
  }

  async startExecution(): Promise<Omit<TransactionLog, "status">> {
    await execute(
      this.inscription.contract,
      this.inscription.function,
      this.inscription.args,
      _.cloneDeep(this.metadata),
    );

    const scope = Scope.getScope(this.metadata.transactionHash);
    return {
      ...this.metadata,
      currentContract: this.inscription.contract,
      method: this.inscription.function,
      eventLogs: scope.executionScope.events,
      inscription: bigIntJson.stringify(this.inscription),
    };
  }
}
