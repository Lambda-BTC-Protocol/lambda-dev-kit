import { Contract, ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { TokenHelper } from "./utils/token-helper.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import { zUtils } from "./utils/zod.ts";
import { NftHelper } from "./utils/nft-helper.ts";

type Listing = {
  id: number;
  seller: string;
  sellNftId: number;
  sellNftContract: string;
  wantAmount: bigint;
  wantTokenContract: string;
  expiry: number | null;
};

export default class NftOtc implements Contract {
  activeOn = 828000;
  private _currentNumber = 0;
  private _listings = new Map<number, Listing>();

  list = async ({ ecosystem, args, metadata, eventLogger }: ContractParams) => {
    const schema = z.tuple([
      z.number(),
      z.string(),
      zUtils.bigint(),
      z.string(),
      z.number().nullable(),
    ]);
    const [tokenId, nftContract, sellPrice, tokenWant, expiry] = argsParsing(
      schema,
      args,
      "list",
    );

    const sellToken = new NftHelper(nftContract, ecosystem);
    await sellToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      tokenId,
    ); // move the tokens into the otc wallet

    const listing = {
      id: this._currentNumber,
      seller: metadata.sender,
      wantAmount: sellPrice,
      sellNftContract: nftContract,
      sellNftId: tokenId,
      wantTokenContract: tokenWant,
      expiry,
    } satisfies Listing;

    this._listings.set(listing.id, listing);
    this._currentNumber++;

    eventLogger.log({
      type: "OTC",
      message: `'${metadata.sender}' listed NFT ${nftContract} TOKENID: ${tokenId} for ${sellPrice} ${tokenWant}`,
    });
  };

  buy = async ({ args, ecosystem, metadata, eventLogger }: ContractParams) => {
    const schema = z.tuple([z.number()]);
    const [listingId] = argsParsing(schema, args, "buy");

    const wantToBuy = this._listings.get(listingId);
    if (!wantToBuy) throw new ExecutionError("buy: Listing does not exist");
    if (!wantToBuy.expiry || metadata.blockNumber > wantToBuy.expiry)
      throw new ExecutionError("buy: Listing expired");

    // reading from perspective seller
    const sellerNft = new NftHelper(wantToBuy.sellNftContract, ecosystem);
    const buyerToken = new TokenHelper(wantToBuy.wantTokenContract, ecosystem);

    // move buyer token to seller
    await buyerToken.transferFrom(
      metadata.sender,
      wantToBuy.seller,
      wantToBuy.wantAmount,
      true,
    );

    // move seller nft from OTC to buyer
    await sellerNft.transfer(metadata.sender, wantToBuy.sellNftId);

    eventLogger.log({
      type: "OTC",
      message: `'${metadata.sender}' bought NFT ${wantToBuy.sellNftContract} TOKENID: ${wantToBuy.sellNftId} for ${wantToBuy.wantAmount} ${wantToBuy.wantTokenContract} from '${wantToBuy.seller}'`,
    });

    // remove listing
    this._listings.delete(listingId);
  };

  cancel = async ({ args, metadata, ecosystem }: ContractParams) => {
    const schema = z.tuple([z.number()]);
    const [listingId] = argsParsing(schema, args, "cancel");

    const wantToCancel = this._listings.get(listingId);
    if (!wantToCancel)
      throw new ExecutionError("cancel: Listing does not exist");

    if (wantToCancel.seller !== metadata.sender)
      throw new ExecutionError("cancel: can only cancel my own listings");

    // withdraw seller nft
    await new NftHelper(wantToCancel.sellNftContract, ecosystem).transfer(
      metadata.sender,
      wantToCancel.sellNftId,
    );

    // remove listing
    this._listings.delete(listingId);
  };

  listings = async () => {
    return Array.from(this._listings.values());
  };
}
