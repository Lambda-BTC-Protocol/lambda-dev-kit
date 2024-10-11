import { LRC20Base } from "./standards/base/LRC20Base.ts";
import { Contract, ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { argsParsing } from "./utils/args-parsing.ts";
import { zUtils } from "./utils/zod.ts";
import { z } from "zod";

export default class MEOW extends LRC20Base implements Contract {
  constructor() {
    super("Meowcoin", "MEOW", 4, "LambFrens", 834000);
  }

  protected async mintLogic({
    args,
    metadata,
    eventLogger,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, amount] = argsParsing(schema, args, "mint");

    if (metadata.sender !== this._owner)
      throw new ExecutionError("mint: only the owner can mint");

    this._internalMint(to, amount, eventLogger);
  }
}
