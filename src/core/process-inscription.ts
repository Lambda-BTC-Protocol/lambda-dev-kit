import { lambdaEngine } from "@core/lambda-engine.ts";
import { getLogger } from "@core/logging.ts";
import { Inscription } from "@core/types/inscription.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { Scope } from "@core/scopes.ts";

export async function processInscription(
  inscription: Inscription,
  metadata: Metadata,
) {
  const txnLogger = getLogger(metadata.transactionHash);
  Scope.createScope(metadata);
  txnLogger.debug({ metadata: metadata }, "processing job");
  try {
    return await lambdaEngine.processInscription(inscription, metadata);
  } catch (e) {
    txnLogger.fatal(e, "error processing job");
  }
}
