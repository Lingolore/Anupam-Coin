import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import cron from "node-cron";
import { Program, AnchorProvider } from "@project-serum/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { configDotenv } from "dotenv";
import idl from "../abi/dao.json";
import { BN } from "bn.js";

configDotenv();

interface ProposalAccount {
  proposalId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  forVotes: string;
  againstVotes: string;
  executed: boolean;
  isActive: boolean;
  createdBy: string;
  executedBy: string | null;
  executedAt: string | null;
  proposalCategory: {
    yearlyCap?: {};
    treasuryFundMove?: {};
    transferFee?: {};
  };
  treasureAmount: string;
  maxVoters: string;
  currentVoters: string;
  voteRecord: string;
  transferFeeBasisPoints: number | null;
  treasurySourceWallet: string | null;
  treasuryDestinationWallet: string | null;
  treasuryMintWallet: string | null;
}

const connection = new Connection(
  process.env.RPC_URL || "https://api.devnet.solana.com"
);
if (!connection) {
  throw new Error("Failed to create connection. Please check your RPC_URL.");
}

const GOVERNANCE_PROGRAM_ID = new PublicKey(process.env.APM_DAO as any);
const APM_MINT = new PublicKey(process.env.APM_TOKEN as any);
const AUTHORITY = new PublicKey("HvRZWbReRzrK52DoLxa5bpeWnEH2LJ6kvx5DuFvzxN8H");

const keypairData = (process.env.PRIVATE_KEY as any)
  .split(",")
  .map((num: any) => parseInt(num, 10));
const wallet: any = Keypair.fromSecretKey(new Uint8Array(keypairData));
console.log("wallet", wallet.publicKey.toBase58());
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const program = new Program(idl as any, GOVERNANCE_PROGRAM_ID, provider)!;

const handleCronJob = async (args: string[]) => {
  try {
    const cronJob = args[0];
    // console.log("Cron job arguments:", args);
    if (!cronJob) {
      console.error("No cron job provided.");
      return;
    }

    console.log(`Handling cron job: ${cronJob}`);

    if (cronJob === "execute_proposal") {
      await executeExpiredProposals();
    }
  } catch (error) {
    console.error("Error handling cron job:", error);
  }
};

const executeExpiredProposals = async () => {
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY environment variable is not defined.");
    }

    const result = await program.account.proposal.all();

    console.log(
      "Starting to execute expired proposals...",
      new Date().toISOString(),
      result
    );

    const data = await executeProposal(result as any);
    console.log("Executing proposals with data:", data);
  } catch (error) {
    console.error("Error executing expired proposals:", error);
  }
};

const executeProposal = async (proposals: any) => {
  console.log("proposals", proposals);
  try {
    for (const { publicKey, account } of proposals) {
      const { isActive, executed, endTime, forVotes, againstVotes } = account;
      console.log("Proposal Account:", account);
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      console.log(
        "Current Time:",
        currentTime,
        new BN(endTime).toNumber(),
        currentTime > endTime.toNumber()
      );
      if (!process.env.TREASURY_WALLET) {
        throw new Error("TREASURY_WALLET environment variable is not set");
      }
      if (!process.env.TREASURY_WALLET_SWAP) {
        throw new Error("TREASURY_WALLET_SWAP environment variable is not set");
      }
      if (!process.env.ALLOCATED_TREASURY_WALLET) {
        throw new Error("ALLOCATED_TREASURY_WALLET environment variable is not set");
      }

      const [governance_config] = await PublicKey.findProgramAddress(
        [Buffer.from("governance_config")],
        GOVERNANCE_PROGRAM_ID
      );

      // Derive treasury_config PDA
      const [treasury_config] = await PublicKey.findProgramAddress(
        [Buffer.from("treasury_config")],
        GOVERNANCE_PROGRAM_ID
      );

      console.log("*******", treasury_config, governance_config);

      console.log("Accounts being used:");
      console.log("proposal:", publicKey.toString());
      console.log("voteRecord:", account.voteRecord[0]?.toString());
      console.log("authority:", wallet.publicKey.toString());
      console.log("governanceConfig:", governance_config.toString());
      console.log("treasuryConfig:", treasury_config.toString());
      console.log("apmMint:", APM_MINT.toString());
    

      if (!executed && isActive && currentTime > 1749648241) {
        console.log(`Executing Proposal ${account.proposalId.toNumber()}...`);

        try {
          
          const tx = await program.methods
            .executeProposal()
            .accounts({
              proposal: publicKey,
              voteRecord: account.voteRecord[0], 
              authority: wallet.publicKey,
              governanceConfig: governance_config,
              treasuryWallet: new PublicKey(
                process.env.TREASURY_WALLET as string
              ),
              treasuryWalletSwap: new PublicKey(
                process.env.TREASURY_WALLET_SWAP as string
              ),
              treasuryConfig: treasury_config, // Fixed: use directly, no new PublicKey()
              allocatedTreasuryWallet: new PublicKey(
                process.env.ALLOCATED_TREASURY_WALLET as string
              ), // Fixed: was incorrectly set to APM_MINT
              tokenProgram: TOKEN_2022_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([wallet])
            .rpc();

          console.log(
            `✅ Executed proposal ${account.proposalId.toNumber()} in transaction: ${tx}`
          );
        } catch (execErr) {
          console.error(
            `❌ Failed to execute proposal ${account.proposalId.toNumber()}:`,
            execErr
          );
        }
      } else {
        console.log(
          "No proposals to execute or all proposals are already executed."
        );
        return [];
      }
    }
  } catch (error: any) {
    console.log("Error executing proposal:", error.message);
  }
};

// export async function getGovernancePDA(
//     authority: PublicKey
//   ): Promise<[PublicKey, number]> {
//     return  PublicKey.findProgramAddressSync(
//       [Buffer.from('governance_config'), authority.toBuffer()],
//       GOVERNANCE_PROGRAM_ID
//     );
//   }

// export async function getTreasuryConfigPDA(
//     authority: PublicKey
//   ): Promise<[PublicKey, number]> {
//     return  PublicKey.findProgramAddressSync(
//       [Buffer.from('treasury_config'), proposal.toBuffer()],
//       GOVERNANCE_PROGRAM_ID
//     );

//     await PublicKey.findProgramAddressSync([Buffer.from('vote_record'), proposal.toBuffer(), authorityKeypair.publicKey.toBuffer()], this.programId))[0]
//   }

cron.schedule("* * * * *", async () => {
  try {
    console.log("Running scheduled proposal execution check...");
    handleCronJob(["execute_proposal"]);
  } catch (error) {
    console.error("Cron job failed:", error);
  }
});
