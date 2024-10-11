import { Contract, ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { TokenHelper } from "./utils/token-helper.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import { zUtils } from "./utils/zod.ts";

type Listing = {
  id: number;
  seller: string;
  sellAmount: bigint;
  sellTokenContract: string;
  wantAmount: bigint;
  wantTokenContract: string;
  expiry: number | null;
};

export default class OTC implements Contract {
  activeOn = 828000;
  private _currentNumber = 0;
  private _listings = new Map<number, Listing>();

  async list({ ecosystem, args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([
      zUtils.bigint(),
      z.string(),
      zUtils.bigint(),
      z.string(),
      z.number().nullable(),
    ]);
    const [amount, tokenSell, sellPrice, tokenWant, expiry] = argsParsing(
      schema,
      args,
      "list",
    );

    const sellToken = new TokenHelper(tokenSell, ecosystem);
    await sellToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      amount,
      true,
    ); // move the tokens into the otc wallet

    const listing = {
      id: this._currentNumber,
      seller: metadata.sender,
      wantAmount: sellPrice,
      sellAmount: amount,
      sellTokenContract: tokenSell,
      wantTokenContract: tokenWant,
      expiry,
    } satisfies Listing;

    this._listings.set(listing.id, listing);
    this._currentNumber++;

    eventLogger.log({
      type: "OTC",
      message: `'${metadata.sender}' listed ${amount} ${tokenSell} for ${sellPrice} ${tokenWant}`,
    });
  }

  async buy({ args, ecosystem, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [listingId] = argsParsing(schema, args, "buy");

    const wantToBuy = this._listings.get(listingId);
    if (!wantToBuy) return;
    if (wantToBuy.expiry && metadata.blockNumber > wantToBuy.expiry)
      throw new ExecutionError("buy: Listing expired");

    // reading from seller perspective
    const sellerToken = new TokenHelper(wantToBuy.sellTokenContract, ecosystem);
    const buyerToken = new TokenHelper(wantToBuy.wantTokenContract, ecosystem);

    // move buyer token to seller
    await buyerToken.transferFrom(
      metadata.sender,
      wantToBuy.seller,
      wantToBuy.wantAmount,
      true,
    );

    // move seller token from OTC to buyer
    await sellerToken.transfer(metadata.sender, wantToBuy.sellAmount, true);

    eventLogger.log({
      type: "OTC",
      message: `'${metadata.sender}' bought ${wantToBuy.sellAmount} ${wantToBuy.sellTokenContract} for ${wantToBuy.wantAmount} ${wantToBuy.wantTokenContract} from '${wantToBuy.seller}'`,
    });

    // remove listing
    this._listings.delete(listingId);
  }

  async cancel({ args, metadata, ecosystem }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [listingId] = argsParsing(schema, args, "cancel");

    const wantToCancel = this._listings.get(listingId);
    if (!wantToCancel)
      throw new ExecutionError("cancel: Listing does not exist");

    if (wantToCancel.seller !== metadata.sender)
      throw new ExecutionError("cancel: can only cancel my own listings");

    // withdraw seller token
    await new TokenHelper(wantToCancel.sellTokenContract, ecosystem).transfer(
      metadata.sender,
      wantToCancel.sellAmount,
      true,
    );

    // remove listing
    this._listings.delete(listingId);
  }

  async listings() {
    return Array.from(this._listings.values());
  }
}
