import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export interface PythPrice {
  price: number;
  conf: number;
  expo: number;
  timestamp: number;
}

export class MockPythOracle {
  private priceData: Buffer;

  constructor(
    public readonly keypair: Keypair,
    initialPrice: number,
    expo: number = -8
  ) {
    // Create price feed account data structure matching Pyth's format
    this.priceData = Buffer.alloc(3312); // Standard Pyth price feed size
    
    // Magic number (32 bytes)
    this.priceData.write("UFJpY2UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQo=", 0, "base64");
    
    // Version (4 bytes)
    this.priceData.writeUInt32LE(2, 32);
    
    // Type (4 bytes) - 2 for price feed
    this.priceData.writeUInt32LE(2, 36);
    
    // Price component
    const priceComponent = {
      price: initialPrice * Math.pow(10, -expo),
      conf: 0.1 * Math.pow(10, -expo), // 0.1 confidence interval
      expo,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Write price data starting at offset 640 (where price component starts)
    this.writePriceComponent(priceComponent, 640);
  }

  private writePriceComponent(price: PythPrice, offset: number) {
    // Aggregate price
    this.priceData.writeBigInt64LE(BigInt(Math.floor(price.price * 1e8)), offset);
    // Confidence interval
    this.priceData.writeBigInt64LE(BigInt(Math.floor(price.conf * 1e8)), offset + 8);
    // Status (1 for trading)
    this.priceData.writeUInt32LE(1, offset + 16);
    // Corporate action
    this.priceData.writeUInt32LE(0, offset + 20);
    // Publish slot
    this.priceData.writeBigUInt64LE(BigInt(0), offset + 24);
    // Exponent
    this.priceData.writeInt32LE(price.expo, offset + 32);
  }

  public async createAccount(provider: anchor.AnchorProvider, programId: PublicKey): Promise<void> {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: this.keypair.publicKey,
        space: this.priceData.length,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(this.priceData.length),
        programId,
      })
    );
    await provider.sendAndConfirm(tx, [this.keypair]);
    await this.updatePrice(provider, this.getPrice().price);
  }

  public async updatePrice(provider: anchor.AnchorProvider, newPrice: number): Promise<void> {
    const currentPrice = this.getPrice();
    this.writePriceComponent(
      {
        ...currentPrice,
        price: newPrice,
        timestamp: Math.floor(Date.now() / 1000),
      },
      640
    );
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: this.keypair.publicKey,
        space: this.priceData.length,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(this.priceData.length),
        programId: provider.wallet.publicKey,
      })
    );
    await provider.sendAndConfirm(tx);
  }

  public getPrice(): PythPrice {
    return {
      price: Number(this.priceData.readBigInt64LE(640)) / 1e8,
      conf: Number(this.priceData.readBigInt64LE(648)) / 1e8,
      expo: this.priceData.readInt32LE(672),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }
} 