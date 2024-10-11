import { ExecutionError } from "./types/execution-error.ts";
import { LRC20Base } from "./standards/base/LRC20Base.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import { ContractParams } from "./types/contract.ts";
import { zUtils } from "./utils/zod.ts";

export default class Bitcoin extends LRC20Base {
  _protocolWallet = "protocol";
  _receivingWallet =
    "bc1p4utk7w9mnr0tvuyne5fgts7cu6z6t85umwvss0wnwxuu6fpg5r3qn4lre4";

  constructor() {
    super("Protocol Bitcoin", "pBTC", 8, "protocol", 828000);
  }

  payProtocolFees({ eventLogger, metadata, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [from, fees] = argsParsing(schema, args, "payProtocolFees");

    if (metadata.sender !== this._protocolWallet) {
      throw new ExecutionError(
        "payProtocolFees: only protocol wallet can do this",
      );
    }
    const fromBefore = this._balance.get(from) ?? 0n;
    if (fromBefore < fees)
      throw new ExecutionError("payProtocolFees: not enough balance");

    // update the payer of the fees
    this._balance.set(from, fromBefore - fees);

    // update the balance of the receiver of the fees
    this._balance.update(this._receivingWallet, 0n, (val) => val + fees);

    eventLogger.log({
      type: "PROTOCOL FEES",
      message: `${from} paid ${fees}`,
    });
  }

  protected async mintLogic({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, amount] = argsParsing(schema, args, "mint");

    if (metadata.sender !== this._protocolWallet)
      throw new ExecutionError(
        "mint: only the protocol wallet can mint bitcoin",
      );

    this._balance.update(to, 0n, (balance) => balance + amount);
    this._totalSupply += amount;

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${to}'; VALUE: ${amount}`,
    });
  }

  /**
   * a function for the protocol to burn bitcoin of someone, is used in conjunction with the withdrawal operation
   * @param args
   * @param metadata
   * @param eventLogger
   * @protected
   */
  async burn({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [from, amount] = argsParsing(schema, args, "payProtocolFees");

    if (metadata.sender !== this._protocolWallet) {
      throw new ExecutionError("burn: only protocol wallet can do this");
    }
    const fromBefore = this._balance.get(from) ?? 0n;
    if (fromBefore < amount)
      throw new ExecutionError("burn: not enough balance");

    // burn the tokens of the from
    this._balance.set(from, fromBefore - amount);
    // update the total supply
    this._totalSupply -= amount;

    eventLogger.log({
      type: "BURN",
      message: `${from} burned ${amount}`,
    });
  }
  protected updateReceivingWallet({
    args,
    metadata,
    eventLogger,
  }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [newReceiver] = argsParsing(schema, args, "updateReceivingWallet");

    if (metadata.sender !== this._receivingWallet)
      throw new ExecutionError(
        "updateReceivingWallet: only the receiving wallet can change it",
      );

    this._receivingWallet = newReceiver;

    eventLogger.log({
      type: "UPDATE",
      message: `receiving wallet updated to '${newReceiver}'`,
    });
  }
}
