"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Plus, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { getGovernanceConfigPDA } from "@/helper/dao-helpers";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import IDL from "../abi/dao.json";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { BN } from "bn.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com"
);
const programId: any =
  process.env.NEXT_PUBLIC_DAO_PROGRAM_ID ||
  "J9jZ5p75dJG9MqFiC4bFJGi1ApLpBHzF6LikpzRLyg88";
console.log("Program ID:", programId);

interface VotingPageProps {
  isWalletConnected: boolean;
  isWhitelisted: boolean;
  walletAddress: string;
}

// Mock enum for demo purposes
const ProposalCategory = {
  EmergencyCircuitBreaker: "EmergencyCircuitBreaker",
  TreasuryFundMove: "TreasuryFundMove",
  YearlyCap: "YearlyCap",
  TransferFee: "TransferFee",
};

// Mock hook for demo purposes
const useDao = () => ({
  createNewProposal: async (data: any) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true };
  },
  checkIsWhitelisted: async () => {
    // Simulate whitelist check
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  },
});

// Transaction confirmation helper function
const confirmTransaction = async (signature: string, maxRetries = 30, retryDelay = 2000) => {
  console.log(`Confirming transaction: ${signature}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Confirmation attempt ${i + 1}/${maxRetries}`);
      
      const status = await connection.getSignatureStatus(signature);
      console.log(`Transaction status:`, status);
      
      if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
        console.log(`Transaction confirmed with status: ${status.value.confirmationStatus}`);
        
        if (status.value.err) {
          throw new Error(`Transaction failed with error: ${JSON.stringify(status.value.err)}`);
        }
        
        return { confirmed: true, status: status.value };
      }
      
      if (status.value?.err) {
        throw new Error(`Transaction failed with error: ${JSON.stringify(status.value.err)}`);
      }
      
      // If not confirmed yet, wait and retry
      if (i < maxRetries - 1) {
        console.log(`Transaction not confirmed yet, waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
    } catch (error) {
      console.error(`Error checking transaction status (attempt ${i + 1}):`, error);
      
      // If it's a network error, continue retrying
      if (i < maxRetries - 1) {
        console.log(`Retrying confirmation check in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Transaction confirmation timeout after ${maxRetries} attempts`);
};

export default function ProposalCreation() {
  const { createNewProposal, checkIsWhitelisted } = useDao();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingDuration, setVotingDuration] = useState(7);
  const [category, setCategory] = useState(ProposalCategory.TreasuryFundMove);
  const [maxVoters, setMaxVoters] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);

  // Category-specific fields
  const [transferFeeBasisPoints, setTransferFeeBasisPoints] = useState(75);
  const [treasurySourceWallet, setTreasurySourceWallet] = useState("");
  const [treasuryDestinationWallet, setTreasuryDestinationWallet] =
    useState("");
  const [treasuryMintWallet, setTreasuryMintWallet] = useState("");
  const [emergencyPauseDuration, setEmergencyPauseDuration] = useState(24);
  const [treasureAmount, setTreasureAmount] = useState(1000000);

  const getCategoryInfo = (cat: any) => {
    switch (cat) {
      case ProposalCategory.EmergencyCircuitBreaker:
        return {
          name: "Emergency Circuit Breaker",
          description: "Pause protocol operations in emergency situations",
          fields: ["emergencyPauseDuration"],
        };
      case ProposalCategory.TreasuryFundMove:
        return {
          name: "Treasury Fund Move",
          description: "Transfer funds between treasury wallets",
          fields: [
            "treasurySourceWallet",
            "treasuryDestinationWallet",
            "treasureAmount",
          ],
        };
      case ProposalCategory.YearlyCap:
        return {
          name: "Yearly Cap",
          description: "Mint 2% of total supply to treasury (yearly)",
          fields: ["treasuryMintWallet"],
        };
      case ProposalCategory.TransferFee:
        return {
          name: "Transfer Fee",
          description: "Update token transfer fee rates",
          fields: ["transferFeeBasisPoints"],
        };
      default:
        return { name: "Unknown", description: "", fields: [] };
    }
  };

  // Enhanced handleCreateProposal function with transaction confirmation
  // Enhanced handleCreateProposal function with better transaction handling
// Alternative approach with simplified transaction handling
// Robust solution addressing signature verification issues
// Most robust approach using Anchor's built-in wallet integration
// Enhanced handleCreateProposal function with proper PDA derivation and error handling
// Enhanced handleCreateProposal function using random account generation
const handleCreateProposal = async () => {
  try {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setConfirmationStatus("Connecting to wallet...");
    
    // Check if wallet is available
    if (!window.solana) {
      throw new Error("Solana wallet not found. Please install a Solana wallet extension.");
    }
    
    const wallet = window.solana;
    
    // Connect wallet if not connected
    if (!wallet.isConnected) {
      console.log("Connecting wallet...");
      await wallet.connect();
    }
    
    if (!wallet.publicKey) {
      throw new Error("Wallet connection failed - no public key available");
    }

    console.log("Wallet connected successfully:", wallet.publicKey.toBase58());

    setConfirmationStatus("Setting up program connection...");

    // Create a wallet adapter that matches Anchor's expectations
    const walletAdapter = {
      publicKey: wallet.publicKey,
      signTransaction: async (transaction: any) => {
        console.log("Signing transaction...");
        try {
          const signed = await wallet.signTransaction(transaction);
          console.log("Transaction signed successfully");
          return signed;
        } catch (err) {
          console.error("Signing failed:", err);
          throw err;
        }
      },
      signAllTransactions: async (transactions: any[]) => {
        console.log(`Signing ${transactions.length} transactions...`);
        try {
          if (wallet.signAllTransactions) {
            return await wallet.signAllTransactions(transactions);
          } else {
            const signed: any[] = [];
            for (const tx of transactions) {
              signed.push(await wallet.signTransaction(tx));
            }
            return signed;
          }
        } catch (err) {
          console.error("Batch signing failed:", err);
          throw err;
        }
      }
    };

    // Create provider with proper commitment settings
    const provider = new AnchorProvider(
      connection,
      walletAdapter,
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      }
    );

    const program = new Program(IDL as any, new PublicKey(programId), provider);

    setConfirmationStatus("Setting up accounts...");

    // Get governance config PDA (this one uses seeds)
    const [governanceConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_config")],
      program.programId
    );
    
    console.log("Governance Config PDA:", governanceConfig.toBase58());

    // Generate random keypairs for proposal and vote_record (no seeds)
    const proposalKeypair = Keypair.generate();
    const voteRecordKeypair = Keypair.generate();

    console.log("Generated random accounts:", {
      proposal: proposalKeypair.publicKey.toBase58(),
      voteRecord: voteRecordKeypair.publicKey.toBase58()
    });

    setConfirmationStatus("Preparing proposal parameters...");

    // Convert category to proper enum format for Anchor
    let categoryEnum;
    switch (category) {
      case ProposalCategory.EmergencyCircuitBreaker:
        categoryEnum = { emergencyCircuitBreaker: {} };
        break;
      case ProposalCategory.TreasuryFundMove:
        categoryEnum = { treasuryFundMove: {} };
        break;
      case ProposalCategory.YearlyCap:
        categoryEnum = { yearlyCap: {} };
        break;
      case ProposalCategory.TransferFee:
        categoryEnum = { transferFee: {} };
        break;
      default:
        throw new Error("Invalid proposal category selected");
    }

    // Prepare category-specific parameters with proper null handling
    let transferFeeBasisPointsParam: number | null = null;
    let treasurySourceWalletParam: PublicKey | null = null;
    let treasuryDestinationWalletParam: PublicKey | null = null;
    let treasuryMintWalletParam: PublicKey | null = null;
    let emergencyPauseDurationParam: typeof BN | null = null;

    // Validate and set parameters based on category
    switch (category) {
      case ProposalCategory.TransferFee:
        if (transferFeeBasisPoints < 50 || transferFeeBasisPoints > 100) {
          throw new Error("Transfer fee must be between 50 and 100 basis points (0.5% - 1%)");
        }
        transferFeeBasisPointsParam = transferFeeBasisPoints;
        break;
        
      case ProposalCategory.TreasuryFundMove:
        if (!treasurySourceWallet || !treasuryDestinationWallet) {
          throw new Error("Treasury source and destination wallets are required");
        }
        try {
          treasurySourceWalletParam = new PublicKey(treasurySourceWallet);
          treasuryDestinationWalletParam = new PublicKey(treasuryDestinationWallet);
        } catch (pubkeyError) {
          throw new Error("Invalid wallet address format");
        }
        if (treasurySourceWalletParam.equals(treasuryDestinationWalletParam)) {
          throw new Error("Source and destination wallets cannot be the same");
        }
        break;
        
      case ProposalCategory.YearlyCap:
        if (!treasuryMintWallet) {
          throw new Error("Treasury mint wallet is required");
        }
        try {
          treasuryMintWalletParam = new PublicKey(treasuryMintWallet);
        } catch (pubkeyError) {
          throw new Error("Invalid treasury mint wallet address format");
        }
        break;
        
      case ProposalCategory.EmergencyCircuitBreaker:
        if (emergencyPauseDuration < 1 || emergencyPauseDuration > 720) {
          throw new Error("Emergency pause duration must be between 1 and 720 hours");
        }
        emergencyPauseDurationParam = new (BN as any)(emergencyPauseDuration).mul(new (BN as any)(3600));
        break;
    }

    // Validate common parameters
    if (!title.trim() || title.length > 100) {
      throw new Error("Title is required and must be under 100 characters");
    }
    if (!description.trim() || description.length > 1000) {
      throw new Error("Description is required and must be under 1000 characters");
    }
    if (votingDuration < 1 || votingDuration > 30) {
      throw new Error("Voting duration must be between 1 and 30 days");
    }
    if (maxVoters < 1 || maxVoters > 1000) {
      throw new Error("Max voters must be between 1 and 1000");
    }

    console.log("Final proposal parameters:", {
      title: title.trim(),
      description: description.trim(),
      votingDurationSeconds: votingDuration * 24 * 3600,
      category: categoryEnum,
      maxVoters: maxVoters,
      transferFeeBasisPointsParam,
      treasurySourceWalletParam: treasurySourceWalletParam?.toBase58() || null,
      treasuryDestinationWalletParam: treasuryDestinationWalletParam?.toBase58() || null,
      treasuryMintWalletParam: treasuryMintWalletParam?.toBase58() || null,
      emergencyPauseDurationParam: emergencyPauseDurationParam ? emergencyPauseDurationParam.toString() : null,
      treasureAmount: treasureAmount
    });

    setConfirmationStatus("Creating proposal transaction...");

    // Create the proposal with random keypairs as signers
    const signature = await program.methods
      .createProposal(
        title.trim(),
        description.trim(),
        new BN(votingDuration * 24 * 3600),
        categoryEnum,
        new BN(maxVoters),
        transferFeeBasisPointsParam,
        treasurySourceWalletParam,
        treasuryDestinationWalletParam,
        treasuryMintWalletParam,
        emergencyPauseDurationParam,
        new BN(treasureAmount)
      )
      .accounts({
        proposal: proposalKeypair.publicKey,
        governanceConfig: governanceConfig,
        voteRecord: voteRecordKeypair.publicKey,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([proposalKeypair, voteRecordKeypair]) // Add the keypairs as signers
      .rpc({
        commitment: 'confirmed',
        skipPreflight: false
      });

    console.log("Proposal creation transaction submitted:", signature);
    setConfirmationStatus(`Transaction submitted: ${signature.slice(0, 8)}...${signature.slice(-8)}`);

    // Enhanced confirmation with proper error handling
    setConfirmationStatus("Confirming transaction...");
    
    const confirmationResult = await connection.confirmTransaction({
      signature,
      blockhash: (await connection.getLatestBlockhash()).blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
    }, 'confirmed');

    if (confirmationResult.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmationResult.value.err)}`);
    }

    console.log("Transaction confirmed successfully");
    setSuccess(`Proposal created successfully! 
      Transaction: ${signature}
      Proposal Account: ${proposalKeypair.publicKey.toBase58()}
      Vote Record Account: ${voteRecordKeypair.publicKey.toBase58()}`);
    setConfirmationStatus("✅ Transaction confirmed!");
    
    // Reset form after successful creation
    resetForm();
    
    // Clear status after delay
    setTimeout(() => {
      setConfirmationStatus(null);
    }, 10000);

    return { 
      success: true, 
      signature,
      proposalAddress: proposalKeypair.publicKey.toBase58(),
      voteRecordAddress: voteRecordKeypair.publicKey.toBase58()
    };

  } catch (error: any) {
    console.error("Proposal creation failed:", error);
    
    // Enhanced error handling with specific messages
    let userMessage = "Failed to create proposal. ";
    
    if (error.message?.includes("User rejected") || error.message?.includes("User denied")) {
      userMessage = "Transaction was cancelled by user.";
    } else if (error.message?.includes("insufficient funds") || error.message?.includes("Insufficient")) {
      userMessage = "Insufficient SOL balance to pay for transaction fees.";
    } else if (error.message?.includes("Wallet not connected")) {
      userMessage = "Please connect your wallet and try again.";
    } else if (error.message?.includes("Invalid wallet address")) {
      userMessage = "One or more wallet addresses are invalid. Please check the format.";
    } else if (error.message?.includes("Account does not exist")) {
      userMessage = "Required program account not found. Please ensure the DAO is properly initialized.";
    } else if (error.message?.includes("CreatorNotWhitelisted")) {
      userMessage = "Your wallet is not whitelisted to create proposals.";
    } else if (error.message?.includes("DaoExpired")) {
      userMessage = "The DAO voting period has ended.";
    } else if (error.message?.includes("TooManyActiveProposals")) {
      userMessage = "Maximum number of active proposals reached. Please wait for some to complete.";
    } else if (error.message?.includes("already in use")) {
      userMessage = "Account collision detected. Please try again.";
    } else if (error.message?.includes("custom program error")) {
      const errorCode = error.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
      if (errorCode) {
        userMessage += `Program error code: ${errorCode[1]}. Please check the program logs.`;
      } else {
        userMessage += "A program error occurred. Please try again.";
      }
    } else if (error.message) {
      userMessage = error.message;
    } else {
      userMessage += "An unexpected error occurred. Please try again.";
    }

    setError(userMessage);
    setSuccess(null);
    setConfirmationStatus(null);
    
    return { success: false, error: userMessage };

  } finally {
    setIsSubmitting(false);
  }
};

// Helper function to reset form
const resetForm = () => {
  setTitle("");
  setDescription("");
  setVotingDuration(7);
  setMaxVoters(50);
  setTransferFeeBasisPoints(75);
  setTreasurySourceWallet("");
  setTreasuryDestinationWallet("");
  setTreasuryMintWallet("");
  setEmergencyPauseDuration(24);
  setTreasureAmount(1000000);
};




  const categoryInfo = getCategoryInfo(category);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Proposal
        </CardTitle>
        <CardDescription>Submit proposals for community voting</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Basic Fields */}
          <div className="space-y-2">
            <Label htmlFor="title">Proposal Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Proposal Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal in detail..."
              rows={6}
              required
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Proposal Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={ProposalCategory.EmergencyCircuitBreaker}>
                Emergency Circuit Breaker
              </option>
              <option value={ProposalCategory.TreasuryFundMove}>
                Treasury Fund Move
              </option>
              <option value={ProposalCategory.YearlyCap}>Yearly Cap</option>
              <option value={ProposalCategory.TransferFee}>Transfer Fee</option>
            </select>

            {/* Category Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {categoryInfo.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    {categoryInfo.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Category-Specific Fields */}
          {category === ProposalCategory.TransferFee && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-gray-900">
                Transfer Fee Parameters
              </h3>
              <div className="space-y-2">
                <Label htmlFor="transferFeeBasisPoints">
                  Transfer Fee (Basis Points)
                  <span className="text-sm text-gray-500 ml-1">
                    (50-100 allowed)
                  </span>
                </Label>
                <Input
                  id="transferFeeBasisPoints"
                  type="number"
                  value={transferFeeBasisPoints}
                  onChange={(e) =>
                    setTransferFeeBasisPoints(Number(e.target.value))
                  }
                  min={50}
                  max={100}
                  placeholder="75"
                  required
                />
                <p className="text-sm text-gray-600">
                  Current: {transferFeeBasisPoints} basis points (
                  {(transferFeeBasisPoints / 100).toFixed(2)}%)
                </p>
              </div>
            </div>
          )}

          {category === ProposalCategory.TreasuryFundMove && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-gray-900">
                Treasury Fund Move Parameters
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="treasurySourceWallet">
                    Source Treasury Wallet
                  </Label>
                  <Input
                    id="treasurySourceWallet"
                    value={treasurySourceWallet}
                    onChange={(e) => setTreasurySourceWallet(e.target.value)}
                    placeholder="Enter source wallet public key..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="treasuryDestinationWallet">
                    Destination Treasury Wallet
                  </Label>
                  <Input
                    id="treasuryDestinationWallet"
                    value={treasuryDestinationWallet}
                    onChange={(e) =>
                      setTreasuryDestinationWallet(e.target.value)
                    }
                    placeholder="Enter destination wallet public key..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="treasureAmount">Amount to Transfer</Label>
                  <Input
                    id="treasureAmount"
                    type="number"
                    value={treasureAmount}
                    onChange={(e) => setTreasureAmount(Number(e.target.value))}
                    min={1}
                    placeholder="1000000"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {category === ProposalCategory.YearlyCap && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-gray-900">
                Yearly Cap Parameters
              </h3>
              <div className="space-y-2">
                <Label htmlFor="treasuryMintWallet">Treasury Mint Wallet</Label>
                <Input
                  id="treasuryMintWallet"
                  value={treasuryMintWallet}
                  onChange={(e) => setTreasuryMintWallet(e.target.value)}
                  placeholder="Enter treasury mint wallet public key..."
                  required
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This will mint 2% of the total token
                  supply to the specified treasury wallet. This action can only
                  be performed once per year.
                </p>
              </div>
            </div>
          )}

          {category === ProposalCategory.EmergencyCircuitBreaker && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold text-gray-900">
                Emergency Circuit Breaker Parameters
              </h3>
              <div className="space-y-2">
                <Label htmlFor="emergencyPauseDuration">
                  Pause Duration (Hours)
                  <span className="text-sm text-gray-500 ml-1">
                    (1-720 hours)
                  </span>
                </Label>
                <Input
                  id="emergencyPauseDuration"
                  type="number"
                  value={emergencyPauseDuration}
                  onChange={(e) =>
                    setEmergencyPauseDuration(Number(e.target.value))
                  }
                  min={1}
                  max={720}
                  placeholder="24"
                  required
                />
                <p className="text-sm text-gray-600">
                  Protocol will be paused for {emergencyPauseDuration} hours (
                  {(emergencyPauseDuration / 24).toFixed(1)} days)
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will pause all protocol
                  operations for the specified duration. Use only in emergency
                  situations.
                </p>
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="votingDuration">Voting Duration (days)</Label>
              <Input
                id="votingDuration"
                type="number"
                value={votingDuration}
                onChange={(e) => setVotingDuration(Number(e.target.value))}
                min={1}
                max={30}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxVoters">Maximum Voters</Label>
              <Input
                id="maxVoters"
                type="number"
                value={maxVoters}
                onChange={(e) => setMaxVoters(Number(e.target.value))}
                min={1}
                required
              />
            </div>
          </div>

          <Button
            onClick={handleCreateProposal}
            disabled={isSubmitting}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white"
          >
            {isSubmitting ? "Creating Proposal..." : "Create Proposal"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
