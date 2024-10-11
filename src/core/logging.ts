import pino from "pino";
import { env } from "../env.ts";

export const logger = pino({ level: env.PINO_LOG_LEVEL ?? "debug" });

const _loggers = new Map<string, pino.Logger>();

export function getLogger(txnHash: string) {
  if (!_loggers.has(txnHash)) {
    _loggers.set(txnHash, logger.child({ txnHash: txnHash }));
  }
  return _loggers.get(txnHash)!;
}
