import { LRC20Base } from "./standards/base/LRC20Base.ts";
import { ContractParams } from "./types/contract.ts";
import { zUtils } from "./utils/zod.ts";
import { argsParsing } from "./utils/args-parsing.ts";
import { z } from "zod";
import { ExecutionError } from "./types/execution-error.ts";

export default class LAMBCHOP extends LRC20Base {
  constructor() {
    super("LAMBCHOP", "LAMBCHOP", 4, "kitchen", 0);
  }

  protected async mintLogic({
    metadata,
    eventLogger,
    args,
  }: ContractParams): Promise<void> {
    if (this._alreadyMinted) throw new ExecutionError("mint: already minted");
    if (metadata.sender !== this._owner)
      throw new ExecutionError("mint: only owner can mint");

    const schema = z.tuple([zUtils.bigint()]);
    const [toMint] = argsParsing(schema, args, "mint");

    this._balance.set(metadata.sender, toMint);
    this._totalSupply = toMint;
    this._alreadyMinted = true;

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${metadata.sender}'; VALUE: ${toMint}`,
    });
  }
}
