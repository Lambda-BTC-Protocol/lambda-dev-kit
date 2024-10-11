import { CallExecutor } from "./execution/call-executor.ts";
import { TransactionLog } from "./types/transaction-log.ts";
import { Metadata } from "../contracts/types/metadata.ts";
import { Query } from "./execution/query.ts";
import { Inscription } from "./types/inscription.ts";
import _ from "lodash";
import { Scope } from "./scopes.ts";
import { contractStateStorage, txnLogStorage } from "@core/storage.ts";
import { getLogger } from "@core/logging.ts";
import { bigIntJson } from "../util/big-int-json.ts";

const executors = {
  call: CallExecutor,
} as const;

export const lambdaEngine = {
  processInscription: async (inscription: Inscription, metadata: Metadata) => {
    const scope = Scope.getScope(metadata.transactionHash);
    const txnLogger = getLogger(metadata.transactionHash);
    try {
      const executor = new executors[inscription.op](
        _.cloneDeep(inscription),
        _.cloneDeep(metadata),
      );
      txnLogger.info({ inscription, metadata }, "process inscription");
      const transactionLog = await executor.startExecution();

      await contractStateStorage.store(
        metadata.blockNumber,
        scope.inscriptionScope.contractStateBuffer,
      );
      await txnLogStorage.addTransaction({
        ...transactionLog,
        status: "SUCCESS",
      });
      txnLogger.info(transactionLog, "inscription success");
      return transactionLog;
    } catch (e: unknown) {
      const log = {
        ...metadata,
        inscription: bigIntJson.stringify(inscription),
        eventLogs: [],
        status: "ERROR",
        errorMessage: "unknown error",
      } satisfies TransactionLog;
      await txnLogStorage.addTransaction(log);
    }
  },

  callQuery: async (
    contract: string,
    functionName: string,
    args: unknown[],
  ) => {
    const query = new Query();
    return await query.execute(contract, functionName, args);
  },
};
