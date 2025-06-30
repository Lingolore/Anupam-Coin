import * as anchor from "@project-serum/anchor";
import { Program, web3, BN } from "@project-serum/anchor";
import { PublicKey, Connection, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import IDL from "../../abi/swap-apm.json" assert { type: "json" };

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID as any ); // Replace with actual program ID
const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT as any); // Replace with USDC mint
const USDT_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDT_MINT as any); // Replace with USDT mint
const APM_MINT = new PublicKey(process.env.NEXT_PUBLIC_APM_MINT as any); // Replace with APM mint
const STATE_ADDRESS = new PublicKey(process.env.NEXT_PUBLIC_STATE_ADDRESS as any); // Replace with state account
const DECIMAL_MULTIPLIER = new BN(1_000_000_000); // 10^9 for 9 decimals
const CONNECTION = new Connection("https://api.devnet.solana.com", "confirmed"); // Use mainnet or devnet

console.log(APM_MINT.toBase58(), USDC_MINT.toBase58(), USDT_MINT.toBase58(), STATE_ADDRESS.toBase58());
const getProvider = (wallet:any) => {
  const provider = new anchor.AnchorProvider(
    CONNECTION,
    wallet,
    { preflightCommitment: "confirmed" }
  );
  return provider;
};


const getProgram = (provider:any) => {
  return new Program(IDL as any, PROGRAM_ID, provider);
};

const getATA = async (mint:any, owner:any) => {
  return await getAssociatedTokenAddress(mint, owner);
};

const getATA_2022 = async (mint: any, owner: any) => {
    return await getAssociatedTokenAddress(
      mint, 
      owner, 
      false, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID // programId for Token-2022
    );
  };

// Swap USDC/USDT to APM
const swapToApm = async (wallet:any, amount:any, tokenType:any) => {
  try {
    console.log("Swapping to APM, amount:", amount.toString(), "tokenType:", tokenType);
    const provider = getProvider(wallet);
    const program = getProgram(provider);
    const user = provider.wallet.publicKey;

    

    // Derive PDAs
    const [apmMintAuthority, apmMintBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("apm_mint_authority"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdcFeeWallet, usdcFeeBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("fee_wallet_usdc"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdtFeeWallet, usdtFeeBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("fee_wallet_usdt"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdcTreasury, usdcTreasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_usdc"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdtTreasury, usdtTreasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_usdt"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );

    // Get token accounts
    const userInputAccount = await getATA(tokenType === 0 ? USDC_MINT : USDT_MINT, user);
    // const userApmAccount = await getATA(APM_MINT, user);
    const userApmAccount = await getATA_2022(APM_MINT, user);
    console.log("userInputAccount:", userInputAccount.toBase58());
    console.log("userApmAccount:", userApmAccount.toBase58());

    console.log("usdcFeeWallet:", usdcFeeWallet.toBase58());

    const userInputAccountInfo = await CONNECTION.getAccountInfo(userInputAccount);
    console.log("userInputAccountInfo:", userInputAccountInfo);
    const tx = await program.methods
      .swapToApm(new BN(amount * 10**9), tokenType)
      .accounts({
        state: STATE_ADDRESS,
        user,
        userInputAccount,
        usdcMint: USDC_MINT,
        usdtMint: USDT_MINT,
        usdcFeeWallet,
        usdtFeeWallet,
        usdcTreasury,
        usdtTreasury,
        apmMint: APM_MINT,
        userApmAccount,
        apmMintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    return tx;
  } catch (error:any) {
    console.error("Error executing swap to APM:", error);
    throw new Error("Swap failed: " + error.message);
  }
};

// Swap APM to USDC/USDT
const swapFromApm = async (wallet:any, amount:any, outputToken:any) => {
  try {
    console.log("Swapping from APM, amount:", amount.toString(), "outputToken:", outputToken);
    const provider = getProvider(wallet);
    const program = getProgram(provider);
    const user = provider.wallet.publicKey;

    // Derive PDAs
    const [treasuryAuthority, treasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_authority"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdcFeeWallet, usdcFeeBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("fee_wallet_usdc"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdtFeeWallet, usdtFeeBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("fee_wallet_usdt"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdcTreasury, usdcTreasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_usdc"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const [usdtTreasury, usdtTreasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_usdt"), STATE_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    console.log("wallet", wallet.publicKey.toBase58());
    // Get token accounts
    const userApmAccount = await getATA_2022(APM_MINT, user);
    const userOutputAccount = await getATA(outputToken === 0 ? USDC_MINT : USDT_MINT, user);
    console.log("userAPMACCOUNT",userApmAccount, userOutputAccount);

    const tx = await program.methods
      .swapFromApm(new BN(amount * 10 **9), outputToken)
      .accounts({
        state: STATE_ADDRESS,
        user,
        userApmAccount,
        apmMint: APM_MINT,
        userOutputAccount,
        usdcMint: USDC_MINT,
        usdtMint: USDT_MINT,
        usdcTreasury,
        usdtTreasury,
        usdcFeeWallet,
        usdtFeeWallet,
        treasuryAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    return tx;
  } catch (error:any) {
    console.error("Error executing swap from APM:", error);
    throw new Error("Swap failed: " + error.message);
  }
};

// // Example usage in a frontend (e.g., React)
// const connectWallet = async () => {
//   if (window.solana && window.solana.isPhantom) {
//     try {
//       await window.solana.connect();
//       return window.solana;
//     } catch (error) {
//       console.error("Error connecting wallet:", error);
//       throw new Error("Failed to connect wallet");
//     }
//   } else {
//     throw new Error("Phantom wallet not found");
//   }
// };

// Example function to handle swap in the UI
const handleSwap = async (
  wallet:any,
  amount:any, // Amount in human-readable form (e.g., 100 for 100 USDC)
  swapDirection:any, // "to_apm" or "from_apm"
  tokenType:any // 0 for USDC, 1 for USDT
) => {
  try {
    // Convert amount to token units (multiply by 10^9)
    const amountInUnits = new BN(amount).mul(DECIMAL_MULTIPLIER);

    // Map swap direction to swap type for getSwapPrices
    const swapTypeMap = {
      to_apm: tokenType === 0 ? 1 : 0, // 1: USDC->APM, 0: USDT->APM
      from_apm: tokenType === 0 ? 2 : 3, // 2: APM->USDC, 3: APM->USDT
    };

    // Get swap preview



    // Execute swap
    let tx;
    if (swapDirection === "to_apm") {
      tx = await swapToApm(wallet, amountInUnits, tokenType);
    } else {
      tx = await swapFromApm(wallet, amountInUnits, tokenType);
    }

    console.log("Swap transaction:", tx);
    alert("Swap completed! Transaction: " + tx);
  } catch (error:any) {
    console.error("Swap error:", error);
    alert("Swap failed: " + error.message);
  }
};



export { 
    // connectWallet,
     handleSwap, swapToApm, swapFromApm };