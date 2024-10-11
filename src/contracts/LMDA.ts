import { LRC20Base } from "./standards/base/LRC20Base.ts";
import { ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";

export default class LMDA extends LRC20Base {
  constructor() {
    super(
      "Lambda",
      "LMDA",
      8,
      "bc1p3dadye5ar65ekxkfh83lmgm2r90mlt5uqx2pfdfl7mdz48trdn8qnnznnu",
      828000,
    );
  }

  protected async mintLogic({
    metadata,
    eventLogger,
  }: ContractParams): Promise<void> {
    if (metadata.sender !== this._owner)
      throw new ExecutionError("mint: only the owner can mint");
    if (this._alreadyMinted)
      throw new ExecutionError("mint: already minted; can only be done once");

    const oneBillion = 1_000_000_000_0000_0000n; // 1 billion with 8 decimals
    this._balance.set(metadata.sender, oneBillion);
    this._alreadyMinted = true;
    this._totalSupply = oneBillion;
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: 0x0; TO: '${metadata.sender}'; VALUE: ${oneBillion}`,
    });
  }

  changeOwner({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [newOwner] = argsParsing(schema, args, "changeOwner");

    if (metadata.sender !== this._owner)
      throw new ExecutionError(
        "only the owner can change the ownership of LMDA",
      );
    this._owner = newOwner;

    eventLogger.log({
      type: "CHANGE_OWNERSHIP",
      message: `ownership changed to '${newOwner}'`,
    });
  }
}
