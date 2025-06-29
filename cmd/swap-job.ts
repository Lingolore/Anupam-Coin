import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@project-serum/anchor";
import { configDotenv } from "dotenv";
import { calculateAPMPrice, PriceData, APMPriceResult } from '../src/controller/calculate-price';
import { fetchPrices } from '../src/controller/price-feed';
import idl from '../abi/swap.json';
import { BN } from "bn.js";

configDotenv();

interface UpdateResult {
  success: boolean;
  pricing?: APMPriceResult;
  txSignature?: string;
  error?: string;
}

const connection = new Connection(
  process.env.RPC_URL || "https://api.devnet.solana.com"
);
if (!connection) {
  throw new Error("Failed to create connection. Please check your RPC_URL.");
}

const PROGRAM_ID = new PublicKey(process.env.SWAP_CONTRACT_ADDRESS as any);
const STATE_ACCOUNT = new PublicKey(process.env.SWAP_CONTRACT_STATE as any);
const GOVERNANCE_PROGRAM_ID = new PublicKey(process.env.APM_DAO as any);
const APM_MINT = new PublicKey(process.env.APM_TOKEN as any);
const AUTHORITY = new PublicKey("HvRZWbReRzrK52DoLxa5bpeWnEH2LJ6kvx5DuFvzxN8H");

const keypairData = (process.env.SWAP_PRIVATE_KEY as any)
  .split(",")
  .map((num: any) => parseInt(num, 10));
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
const wallet = new Wallet(keypair);
console.log("wallet", wallet.publicKey.toBase58());

const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const program = new Program(idl as any, PROGRAM_ID, provider)!;

/**
 * Updates prices on the Solana contract
 * @param priceData Fetched price data from external sources
 * @returns UpdateResult containing transaction details
 */
async function updateContractPrices(priceData: PriceData): Promise<UpdateResult> {
  try {
    // Calculate APM price and get market data
    const apmResult: APMPriceResult = calculateAPMPrice(priceData);
    console.log('APM Price Result:', JSON.stringify(apmResult, null, 2));

    // Extract prices (converting to lamports/u64 format - assuming 8 decimals)
    const usdPrice = priceData?.forex?.find(a => a.symbol === 'USD/USD')?.price;
    const usdtPriceValue = priceData?.forex?.find(a => a.symbol === 'USDT/USD')?.price;
    
    const usdcPrice = Math.round((usdPrice || 1.0) * 10**8);
    const usdtPrice = Math.round((usdtPriceValue || 1.0) * 10**8);
    const apmPrice = Math.round((apmResult.apmPrice || 0) * 10**8);

    // Validate prices
    if (usdcPrice <= 0 || usdtPrice <= 0 || apmPrice <= 0) {
      throw new Error('Invalid price values');
    }

    // Update prices using Anchor program
    const txSignature = await program.methods
      .updatePrices(
        new BN(usdcPrice),
        new BN(usdtPrice),
        new BN(apmPrice)
      )
      .accounts({
        state: STATE_ACCOUNT,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Transaction successful: ${txSignature}`);
    console.log(`📊 Updated prices - USDC: $${(usdcPrice / 10**8).toFixed(4)}, USDT: $${(usdtPrice / 10**8).toFixed(4)}, APM: $${(apmPrice / 10**8).toFixed(4)}`);

    return {
      success: true,
      pricing: apmResult,
      txSignature,
    };
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Example usage function
async function main() {
  try {
    const priceData: PriceData = await fetchPrices(); // From your price-feed module

    const result = await updateContractPrices(priceData);
    
    if (result.success) {
      console.log('Price update completed:', result);
    } else {
      console.error('Price update failed:', result.error);
    }
  } catch (error) {
    console.error('Main execution error:', error);
  }
}

export { updateContractPrices };
export type { UpdateResult };