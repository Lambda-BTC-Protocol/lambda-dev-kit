import { Contract, ContractParams } from "./types/contract.ts";
import { LRC721MetadataBase } from "./standards/base/LRC721MetadataBase.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { Metadata } from "./types/metadata.ts";
import { SeedableRandom } from "./utils/seedable-random.ts";
import { TokenHelper } from "./utils/token-helper.ts";
import { ExtendedMap } from "./utils/extended-map.ts";

type Cat = {
  level: number;
  currentXp: number;
  traits: {
    egg?: number;
    cat?: {
      bg: string;
      cat: string;
      lamb: string;
      accessory: string;
    };
  };
  lastFedTimestamp: number;
  lastHarvestedTimestamp: number;
  imageUri: string;
  dead: boolean;
};

const bgTraits = {
  common: ["blue", "green", "orange", "pink"],
  rare: ["gold", "goldplus"],
  legendary: ["barn", "meadow"],
} as const;

const catTraits = {
  common: ["orangecrab", "ragdoll", "russianblue", "siberian"],
  rare: ["savannah"],
  legendary: ["black"],
} as const;

const lambTraits = {
  common: ["black", "brown", "creme", "grey"],
  rare: ["gold"],
  legendary: ["goldplus"],
} as const;

const accessoryTraits = {
  common: [
    "none",
    "bow-deepblue",
    "bow-blue",
    "bow-green",
    "bow-red",
    "bow-pink",
  ],
  rare: ["bow-gold", "bitcoin"],
  legendary: ["bow-goldplus"],
} as const;

const XP_PER_FEED = 100;

const ONE_DAY = 1000 * 60 * 60 * 24;

const MINT_TOKEN = "LMDA";
const FEED_TOKEN = "dep:dmt:LAMB";
const EVOLVE_TOKEN = "LAMBCHOP";
const REVIVE_TOKEN = "LAMBCHOP";

const MINT_RECEIVER =
  "bc1p3060sksdx04yx9mrfw4pewmefyt6egz04ckk2zg7rr7wxmreqdss5hqzzk";

export default class LambFrens extends LRC721MetadataBase implements Contract {
  activeOn = 834000;

  private _maxSupply = 1000;
  private _perWalletLimit = 25;

  private _cats = new Map<number, Cat>(); // tokenId -> Cat
  private _friends = new Map<string, Set<string>>(); // address -> friend address
  private _minted = new ExtendedMap<string, number>(); // address -> minted amount
  private _lastMintedBlock = new Map<string, number>(); // address -> block number

  private _cooldownForFeed = ONE_DAY;
  private _cooldownForHarvest = ONE_DAY;

  constructor() {
    super(
      "LambFrens",
      "LAMBFRENS",
      "https://lambfrens.ams3.cdn.digitaloceanspaces.com",
    );
  }

  // *** NFT STUFF ***

  protected async _mintLogic(params: ContractParams): Promise<number> {
    const { metadata, ecosystem, oracle } = params;
    if (this._currentTokenId >= this._maxSupply)
      throw new ExecutionError("mint: Max supply reached.");
    if (this._lastMintedBlock.get(metadata.sender) === metadata.blockNumber)
      throw new ExecutionError("mint: Only one mint per block allowed.");
    if (this._minted.get(metadata.sender) === this._perWalletLimit)
      throw new ExecutionError(
        `mint: Only ${this._perWalletLimit} mints per wallet allowed.`,
      );

    const mintToken = new TokenHelper(MINT_TOKEN, ecosystem);
    await mintToken.transferFrom(
      metadata.sender,
      MINT_RECEIVER,
      BigInt(2000 * 10 ** 8),
    );

    const tokenId = await super._mintLogic(params);
    this._minted.update(metadata.sender, 0, (amount) => amount + 1);
    this._lastMintedBlock.set(metadata.sender, metadata.blockNumber);

    const random = oracle.getRandom();

    const cat = this._getRandomEgg(random, metadata.timestamp);
    this._cats.set(tokenId, cat);

    return tokenId;
  }

  tokenURI({ args, metadata }: ContractParams): string | undefined {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "tokenURI");
    const cat = this._getCat(tokenId, metadata.timestamp);
    if (!cat) return undefined;

    return JSON.stringify({
      ...cat,
      imageUri: `${this._baseUrl}/${cat.imageUri}`,
    } satisfies Cat);
  }

  changeBaseURI({ args, metadata }: ContractParams) {
    if (metadata.sender !== MINT_RECEIVER)
      throw new ExecutionError("changeBaseURI: Only the owner can do this.");

    const schema = z.tuple([z.string()]);
    const [newBaseUri] = argsParsing(schema, args, "changeBaseURI");
    this._baseUrl = newBaseUri;
  }

  async withdrawTo({ args, metadata, ecosystem }: ContractParams) {
    if (metadata.sender !== MINT_RECEIVER)
      throw new ExecutionError("withdrawTo: Only the owner can do this.");

    const schema = z.tuple([z.string()]);
    const [to] = argsParsing(schema, args, "withdrawTo");
    const feedToken = new TokenHelper(FEED_TOKEN, ecosystem);
    const balanceFeedToken = await feedToken.balanceOf(
      metadata.currentContract,
    );
    await feedToken.transferFrom(
      metadata.currentContract,
      to,
      balanceFeedToken,
    );

    const evolveToken = new TokenHelper(EVOLVE_TOKEN, ecosystem);
    const balanceEvolveToken = await evolveToken.balanceOf(
      metadata.currentContract,
    );
    await evolveToken.transferFrom(
      metadata.currentContract,
      to,
      balanceEvolveToken,
    );
  }

  // *** GAME ***

  public async feed({
    args,
    metadata,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "feed");
    const cat = this._getAllowedCat(tokenId, metadata, "feed");

    if (cat.dead)
      throw new ExecutionError(`feed: Cat is dead. Revive it first.`);

    const onCooldown =
      metadata.timestamp - cat.lastFedTimestamp < this._cooldownForFeed; // on cooldown if fed in the last 24 hours; now - lastFed < 24 hours
    if (onCooldown)
      throw new ExecutionError(`feed: Cat is already fed. Try again later.`);

    cat.currentXp += XP_PER_FEED;
    if (cat.currentXp >= this._neededForLevelUp(cat.level)) {
      if (cat.level === 5 || cat.level === 10) {
        // evolve is needed at 5 + max xp or 10 + max xp
        cat.currentXp = this._neededForLevelUp(cat.level);
      } else {
        // normal level ups
        cat.currentXp = cat.currentXp - this._neededForLevelUp(cat.level);
        cat.level++;
        eventLogger.log({
          type: "LEVEL_UP",
          message: `cat ${tokenId} has leveled up to level ${cat.level}`,
        });
      }
    }
    cat.lastFedTimestamp = metadata.timestamp;
    this._cats.set(tokenId, cat);

    const feedToken = new TokenHelper(FEED_TOKEN, ecosystem);
    await feedToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      BigInt(5000 * 10 ** 4), // 5k LAMB per feed
    );

    eventLogger.log({ type: "FEED", message: `cat ${tokenId} has been fed` });
  }

  public async evolve({
    args,
    metadata,
    eventLogger,
    ecosystem,
    oracle,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "evolve");
    const cat = this._getAllowedCat(tokenId, metadata, "evolve");
    if (cat.dead)
      throw new ExecutionError(`evolve: Cat is dead. Revive it first.`);

    if (
      (cat.level !== 5 && cat.level !== 10) ||
      cat.currentXp < this._neededForLevelUp(cat.level)
    ) {
      throw new ExecutionError(
        "evolve: Cat needs to be level 5 or level 10 and have max xp to evolve.",
      );
    }

    // create new evolved cat
    const random = oracle.getRandom();
    if (cat.level === 5) {
      // create cat
      const bg = this._getRandomTrait(random, "bg");
      const catTrait = this._getRandomTrait(random, "cat");
      const lambTrait = this._getRandomTrait(random, "lamb");
      cat.traits.cat = {
        bg,
        cat: catTrait,
        lamb: lambTrait,
        accessory: "none",
      };
      cat.imageUri = `${catTrait}.${lambTrait}.${bg}.none.png`; // cat.lamb.bg.accessory.png
      cat.traits.egg = undefined;
    } else if (cat.level === 10) {
      // create accessory and add to cat
      const accessory = this._getRandomTrait(random, "accessory");
      cat.traits.cat!.accessory = accessory;
      cat.imageUri = `${cat.traits.cat?.cat}.${cat.traits.cat?.lamb}.${cat.traits.cat?.bg}.${accessory}.png`; // cat.lamb.bg.accessory.png
    }

    cat.level += 1;
    cat.currentXp = 0;

    this._cats.set(tokenId, cat);

    const evolveToken = new TokenHelper(EVOLVE_TOKEN, ecosystem);
    await evolveToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      BigInt((cat.level === 6 ? 25 : 250) * 10 ** 4), // 5->6 25 LAMBCHOP; 10->11 250 LAMBCHOP
    );

    eventLogger.log({
      type: "EVOLVE",
      message: `cat ${tokenId} has evolved`,
    });
  }

  public async revive({
    args,
    metadata,
    eventLogger,
    ecosystem,
    oracle,
  }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "revive");
    const cat = this._getAllowedCat(tokenId, metadata, null);
    if (!cat.dead) throw new ExecutionError(`revive: Cat is not dead.`);

    // revive
    const newCat = this._getRandomEgg(oracle.getRandom(), metadata.timestamp);
    this._cats.set(tokenId, newCat);

    const daysSinceDeath = Math.floor(
      (metadata.timestamp - cat.lastFedTimestamp) / ONE_DAY,
    );
    if (daysSinceDeath === 0)
      throw new ExecutionError("revive: Cat has died today.");

    let reviveCost = 100;
    if (daysSinceDeath === 2) reviveCost = 95;
    if (daysSinceDeath === 3) reviveCost = 85;
    if (daysSinceDeath === 4) reviveCost = 70;
    if (daysSinceDeath >= 5) reviveCost = 50;

    const reviveToken = new TokenHelper(REVIVE_TOKEN, ecosystem);
    await reviveToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      BigInt(reviveCost * 10 ** 4),
    );

    eventLogger.log({
      type: "REVIVE",
      message: `cat ${tokenId} has been revived`,
    });
  }

  public async harvest({
    args,
    metadata,
    ecosystem,
    eventLogger,
  }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "feed");
    const cat = this._getAllowedCat(tokenId, metadata, "harvest");
    if (
      metadata.timestamp - cat.lastHarvestedTimestamp <
      this._cooldownForHarvest
    )
      throw new ExecutionError(`harvest: Cat is on cooldown. Try again later.`);
    const harvestToken = new TokenHelper("MEOW", ecosystem);
    const baseAmount = 100;
    const rarityMultiplier = this._getMultiplier(cat);
    const harvestableAmount = BigInt(
      Math.floor(baseAmount * rarityMultiplier * 10 ** 4),
    );
    await harvestToken.mint(metadata.sender, harvestableAmount);

    cat.lastHarvestedTimestamp = metadata.timestamp;
    this._cats.set(tokenId, cat);

    eventLogger.log({
      type: "HARVEST",
      message: `cat ${tokenId} has been harvested for ${harvestableAmount} tokens`,
    });
  }

  public addFriend({ args, metadata, eventLogger }: ContractParams): void {
    const schema = z.tuple([z.string()]);
    const [friend] = argsParsing(schema, args, "addFriend");
    const friends = this._friends.get(metadata.sender) ?? new Set<string>();
    if (friends.has(friend))
      throw new ExecutionError("addFriend: Friend already added.");
    friends.add(friend);
    this._friends.set(metadata.sender, friends);

    eventLogger.log({
      type: "ADD_FRIEND",
      message: `Friend '${friend}' has been added`,
    });
  }

  public removeFriend({ args, metadata, eventLogger }: ContractParams): void {
    const schema = z.tuple([z.string()]);
    const [friend] = argsParsing(schema, args, "removeFriend");
    const friends = this._friends.get(metadata.sender) ?? new Set<string>();
    if (!friends.has(friend))
      throw new ExecutionError("removeFriend: Friend not found.");
    friends.delete(friend);
    this._friends.set(metadata.sender, friends);

    eventLogger.log({
      type: "REMOVE_FRIEND",
      message: `Friend '${friend}' has been removed`,
    });
  }

  // *** QUERIES ***

  /**
   * only use as query for the frontend. not for contract logic
   * @param args
   * @param metadata
   */
  public getMyCats({
    args,
    metadata,
  }: ContractParams): (Cat & { id: number })[] {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "getAllCats");
    return Array.from(this._tokenHolder.entries())
      .filter(([tokenId, sender]) => sender === from)
      .map(([tokenId, sender]) => {
        const cat = this._getCat(tokenId, metadata.timestamp)!;
        return {
          ...cat,
          imageUri: `${this._baseUrl}/${cat.imageUri}`,
          id: tokenId,
        };
      });
  }

  /**
   * only use as query for the frontend. not for contract logic
   * changes the image URI of the cat
   * @param args
   * @param metadata
   */
  public getCatById({ args, metadata }: ContractParams): Cat & { id: number } {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "getCatById");
    const cat = this._getCat(tokenId, metadata.timestamp);
    if (!cat)
      throw new ExecutionError(
        `getCatById: Cat with tokenId ${tokenId} not found`,
      );
    return {
      ...cat,
      imageUri: `${this._baseUrl}/${cat.imageUri}`,
      id: tokenId,
    };
  }

  public getMultiplierForCat({ args, metadata }: ContractParams): number {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "getMultiplierForCat");
    const cat = this._getCat(tokenId, metadata.timestamp);
    if (!cat) return 0;
    return this._getMultiplier(cat);
  }

  public currentSupply(): number {
    return this._currentTokenId;
  }

  public getFriends({ args }: ContractParams): string[] {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "getFriends");
    return Array.from(this._friends.get(from) ?? []);
  }

  // *** INTERNAL HELPER ***

  /**
   * Get the cat, if it is dead, return a gravestone image
   * @param tokenId
   * @param timestamp
   * @private
   */
  private _getCat(tokenId: number, timestamp: number): Cat | undefined {
    const cat = this._cats.get(tokenId);
    if (!cat) return undefined;
    // dies if not fed in 7 days
    if (timestamp - cat.lastFedTimestamp > ONE_DAY * 7)
      return {
        ...cat,
        imageUri: `${this._baseUrl}/gravestone.png`,
        dead: true,
      };
    return cat;
  }

  private _isOwner(tokenId: number, address: string): boolean {
    if (address === null) return false;
    return this._tokenHolder.get(tokenId) === address;
  }

  /**
   * Get the cat and check if the sender is allowed to interact with it
   * @param tokenId
   * @param metadata
   * @param action the action the sender wants to take
   * @private
   */
  private _getAllowedCat(
    tokenId: number,
    metadata: Metadata,
    action: "feed" | "evolve" | "harvest" | null,
  ) {
    const cat = this._getCat(tokenId, metadata.timestamp);
    if (!cat) {
      throw new ExecutionError(
        `getAllowedCat: Cat with tokenId ${tokenId} not found`,
      );
    }
    const isOwner = this._isOwner(tokenId, metadata.sender);
    const friends = this._friends.get(metadata.sender) ?? new Set<string>();
    if (action !== "feed") {
      if (!isOwner) {
        throw new ExecutionError(
          `getAllowedCat: Only the owner of the cat can do this.`,
        );
      }
    } else if (action === "feed") {
      if (!isOwner && !friends.has(metadata.sender)) {
        throw new ExecutionError(
          `getAllowedCat: Only the owner or friends of the cat can do this.`,
        );
      }
    }
    return cat;
  }

  /**
   * Get a random trait based on the type and rarity
   * @param random - random number generator
   * @param type - type of the trait
   * @private
   */
  private _getRandomTrait(
    random: SeedableRandom,
    type: "bg" | "cat" | "lamb" | "accessory",
  ): string {
    const traits =
      type === "bg"
        ? bgTraits
        : type === "cat"
          ? catTraits
          : type === "lamb"
            ? lambTraits
            : accessoryTraits;
    const rarity =
      random.nextNumber() < 0.01
        ? "legendary"
        : random.nextNumber() < 0.1
          ? "rare"
          : "common";
    const index = random.nextInt32([0, traits[rarity].length]);
    return traits[rarity][index]!;
  }

  private _neededForLevelUp(currentLevel: number): number {
    if (currentLevel < 10) return 100;
    if (currentLevel < 20) return 1.2 ** (currentLevel - 10) * 100; // TODO check
    return 1.2 ** (currentLevel - 20) * 1000; // TODO check
  }

  private _getRandomEgg(random: SeedableRandom, timestamp: number): Cat {
    const egg = random.nextInt32([0, 3]);

    return {
      level: 0,
      currentXp: 0,
      traits: {
        egg: egg,
      },
      lastFedTimestamp: timestamp,
      lastHarvestedTimestamp: timestamp,
      imageUri: `egg-${egg}.png`, // base-uri/egg-0.png
      dead: false,
    };
  }

  private _getMultiplier(cat: Cat): number {
    if (cat.traits.cat === undefined) return 0;
    // @ts-ignore
    const catRarity = this._getRarity(cat.traits.cat.cat, "cat");
    const lambRarity = this._getRarity(cat.traits.cat.lamb, "lamb");
    const bgRarity = this._getRarity(cat.traits.cat.bg, "bg");
    const accessoryRarity = this._getRarity(
      cat.traits.cat.accessory,
      "accessory",
    );
    const levelMultiplier = cat.level < 5 ? 0 : 1.1 ** (cat.level - 5); // up to level 5 multiplier is 0; starting with 5 it's 1.1^level-5; 10% bonus per level
    return (
      this._getMultiplierForRarity(catRarity) *
      this._getMultiplierForRarity(lambRarity) *
      this._getMultiplierForRarity(bgRarity) *
      this._getMultiplierForRarity(accessoryRarity) *
      levelMultiplier
    );
  }

  private _getRarity(
    trait: string,
    type: "bg" | "cat" | "lamb" | "accessory",
  ): "common" | "rare" | "legendary" {
    const traits =
      type === "bg"
        ? bgTraits
        : type === "cat"
          ? catTraits
          : type === "lamb"
            ? lambTraits
            : accessoryTraits;
    // @ts-ignore
    return traits.legendary.includes(trait)
      ? "legendary"
      : // @ts-ignore
        traits.rare.includes(trait)
        ? "rare"
        : "common";
  }

  private _getMultiplierForRarity(
    rarity: "common" | "rare" | "legendary",
  ): number {
    return rarity === "legendary" ? 2 : rarity === "rare" ? 1.5 : 1;
  }
}
