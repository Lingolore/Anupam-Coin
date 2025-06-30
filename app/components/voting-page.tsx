"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, ThumbsUp, ThumbsDown, Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { getGovernanceConfigPDA } from "@/helper/dao-helpers";
import { Connection, PublicKey } from "@solana/web3.js";
import IDL from "../abi/dao.json";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com"
);

console.log("NEXT_PUBLIC_DAO_PROGRAM_ID", process.env.NEXT_PUBLIC_DAO_PROGRAM_ID)
const programId: any =
  process.env.NEXT_PUBLIC_DAO_PROGRAM_ID ||
  "J9jZ5p75dJG9MqFiC4bFJGi1ApLpBHzF6LikpzRLyg88";

interface VotingPageProps {
  isWalletConnected: boolean;
  isWhitelisted: boolean;
  walletAddress: string;
}

interface BlockchainProposal {
  publicKey: string;
  account: {
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
    proposalCategory: any;
    treasureAmount: string;
    maxVoters: string;
    currentVoters: string;
    voteRecord: string;
    transferFeeBasisPoints: number | null;
    treasurySourceWallet: string | null;
    treasuryDestinationWallet: string | null;
    treasuryMintWallet: string | null;
    emergencyPauseDuration: number | null;
  };
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "passed" | "rejected" | "executed";
  forVotes: number;
  againstVotes: number;
  totalVotes: number;
  endDate: string;
  hasVoted: boolean;
  publicKey: string;
  voteRecord: string;
  isExpired: boolean;
}

export default function VotingPage({
  isWalletConnected,
  walletAddress,
}: VotingPageProps) {
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get proposal category name
  const getProposalCategoryName = (category: any): string => {
    if (category.yearlyCap) return "Yearly Cap";
    if (category.treasuryFundMove) return "Treasury Fund Move";
    if (category.emergencyCircuitBreaker) return "Emergency Circuit Breaker";
    if (category.transferFee) return "Transfer Fee";
    return "Unknown";
  };

  // Helper function to determine proposal status
  const getProposalStatus = (proposal: BlockchainProposal): "active" | "passed" | "rejected" | "executed" => {
    if (proposal.account.executed) return "executed";
    if (!proposal.account.isActive) return "rejected";
    
    const currentTime = Math.floor(Date.now() / 1000);
    const endTime = parseInt(proposal.account.endTime);
    
    if (currentTime > endTime) {
      const totalVotes = parseInt(proposal.account.forVotes) + parseInt(proposal.account.againstVotes);
      const forVotes = parseInt(proposal.account.forVotes);
      
      // Simple majority check (you can adjust this logic based on your requirements)
      if (totalVotes > 0 && forVotes > totalVotes / 2) {
        return "passed";
      } else {
        return "rejected";
      }
    }
    
    return "active";
  };

  // Check if proposal is expired
  const isProposalExpired = (endTime: string): boolean => {
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime > parseInt(endTime);
  };

  // Format timestamp to readable date
  const formatDate = (timestamp: string): string => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // // Check if user has voted on a proposal
  // const checkIfUserVoted = async (voteRecordPublicKey: string, userPublicKey: string): Promise<boolean> => {
  //   try {
  //     const wallet = window.solana;
  //     const provider = new AnchorProvider(connection, wallet, {
  //       commitment: "processed",
  //     });
  //     const program = new Program(IDL as any, programId, provider);

  //     console.log("voteRecordPublicKey" , new PublicKey(voteRecordPublicKey))
      
  //     const voteRecord = await program.account.proposal.fetch(new PublicKey(voteRecordPublicKey));
  //     console.log("Vote Record:", voteRecord);
      
  //     // Check if user's public key is in the voters array
  //     // const userVoted = voteRecord.voters.some((voter: any) => 
  //     //   voter.toString() === userPublicKey
  //     // );
      
  //     // return userVoted;
  //     return false
  //   } catch (error) {
  //     console.error("Error checking vote status:", error);
  //     return false;
  //   }
  // };

  // Fetch proposals from blockchain
  const fetchProposals = async () => {
    if (!isWalletConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const wallet = window.solana;
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
      });
      const program = new Program(IDL as any, programId, provider);

      // Fetch all proposal accounts
      const proposalAccounts = await program.account.proposal.all();
      
      // Transform blockchain data to our component format
      const transformedProposals: Proposal[] = await Promise.all(
        proposalAccounts.map(async (proposalAccount: any) => {
          const proposal = proposalAccount as BlockchainProposal;
          const forVotes = parseInt(proposal.account.forVotes);
          const againstVotes = parseInt(proposal.account.againstVotes);
          const totalVotes = forVotes + againstVotes;
          
          // Check if current user has voted (only if wallet is connected)
          let hasVoted = false;
          // if (wallet?.publicKey) {
          //   hasVoted = await checkIfUserVoted(
          //     proposal.account.proposalId, 
          //     wallet.publicKey.toString()
          //   );
          // }
          
          return {
            id: proposal.account.proposalId,
            title: proposal.account.title,
            description: proposal.account.description,
            status: getProposalStatus(proposal),
            forVotes,
            againstVotes,
            totalVotes,
            endDate: formatDate(proposal.account.endTime),
            hasVoted,
            publicKey: proposal.publicKey,
            voteRecord: proposal.account.voteRecord,
            isExpired: isProposalExpired(proposal.account.endTime),
          };
        })
      );

      // Sort by proposal ID (newest first)
      transformedProposals.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      
      setProposals(transformedProposals);
    } catch (err) {
      console.error("Error fetching proposals:", err);
      setError("Failed to fetch proposals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleIsWhitelistedAddress = async () => {
    try {
      const wallet = window.solana;
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
      });
      if (!wallet?.publicKey) return;

      const program = new Program(IDL as any, programId, provider);
      let governanceConfig = await getGovernanceConfigPDA();

      const whitelistedAddresses: any =
        await program.account.governanceConfig.fetch(governanceConfig);

      const { proposalCreatorWhitelist } = whitelistedAddresses;

      // Convert PublicKey objects to strings for comparison
      const whitelistedStrings = proposalCreatorWhitelist.map((pubkey: any) =>
        pubkey.toString()
      );
      const walletString = wallet.publicKey.toString();

      // Check if wallet is whitelisted
      const isUserWhitelisted = whitelistedStrings.includes(walletString);
      setIsWhitelisted(isUserWhitelisted);
    } catch (error) {
      console.error("Error checking whitelist:", error);
      setIsWhitelisted(false);
    }
  };

  // Cast vote on blockchain
  const handleVote = async (proposalId: string, vote: true | false) => {
    if (!window.solana?.isPhantom) {
      alert("Phantom wallet not found.");
      return;
    }

    try {
      const wallet = window.solana;
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "processed",
      });
      const program = new Program(IDL as any, programId, provider);

      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) {
        alert("Proposal not found.");
        return;
      }

      if (proposal.isExpired) {
        alert("This proposal has expired and voting is no longer allowed.");
        return;
      }

      if (proposal.hasVoted) {
        alert("You have already voted on this proposal.");
        return;
      }

      const governanceConfig = await getGovernanceConfigPDA();
      console.log("Governance Config PDA:", governanceConfig.toBase58());
      console.log("***************", new PublicKey(proposal.voteRecord), wallet.publicKey.toBase58() , governanceConfig.toBase58()); 
      console.log("Vote Record:", proposal.voteRecord);
      console.log("Voter Public Key:", wallet.publicKey.toBase58());
      console.log("Vote Type:", vote);
      await program.methods
        .castVote(vote)
        .accounts({
          proposal: new PublicKey(proposal.publicKey),
          governanceConfig: governanceConfig,
          voteRecord: proposal.voteRecord,
          voter: wallet.publicKey,
        })
        .rpc();

      alert("Vote cast successfully!");

      await fetchProposals();
    } catch (err) {
      console.error("Error casting vote:", err);
      alert("Failed to cast vote. Please try again.");
    }
  };

  useEffect(() => {
    if (isWalletConnected) {
      handleIsWhitelistedAddress();
      fetchProposals();
    }
  }, [isWalletConnected]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "passed":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "executed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  //testing 

  if (!isWalletConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proposals & Voting</CardTitle>
          <CardDescription>
            View and vote on community proposals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to view and vote on proposals.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proposals & Voting</h2>
          <p className="text-gray-600">View and vote on community proposals</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-sm">
            {proposals.filter((p) => p.status === "active").length} Active
            Proposals
          </Badge>
          <Button
            onClick={fetchProposals}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!isWhitelisted && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your wallet is not whitelisted for voting. You can view proposals
            but cannot vote.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading proposals...</span>
        </div>
      )}

      <div className="grid gap-6">
        {proposals.map((proposal) => {
          const yesPercentage =
            proposal.totalVotes > 0
              ? (proposal.forVotes / proposal.totalVotes) * 100
              : 0;
          const noPercentage =
            proposal.totalVotes > 0
              ? (proposal.againstVotes / proposal.totalVotes) * 100
              : 0;

          return (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{proposal.title}</CardTitle>
                    <CardDescription>{proposal.description}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={getStatusColor(proposal.status)}>
                      {proposal.status.charAt(0).toUpperCase() +
                        proposal.status.slice(1)}
                    </Badge>
                    {proposal.isExpired && proposal.status === "active" && (
                      <Badge variant="destructive" className="text-xs">
                        Expired
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Yes Votes</span>
                      <span className="font-medium">
                        {proposal?.forVotes} ({yesPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={yesPercentage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-600">No Votes</span>
                      <span className="font-medium">
                        {proposal.againstVotes} ({noPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={noPercentage} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Votes</span>
                      <span className="font-medium">{proposal.totalVotes}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      Ends: {proposal.endDate}
                    </div>
                  </div>
                </div>

                {proposal.status === "active" && isWhitelisted && !proposal.isExpired && (
                  <div className="flex space-x-3 pt-4 border-t">
                    {proposal.hasVoted ? (
                      <div className="text-sm text-gray-500 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        You have already voted on this proposal
                      </div>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleVote(proposal.id, true)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          Vote Yes
                        </Button>
                        <Button
                          onClick={() => handleVote(proposal.id, false)}
                          variant="destructive"
                          className="flex-1"
                        >
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Vote No
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {proposal.status === "active" && proposal.isExpired && (
                  <div className="text-sm text-gray-500 flex items-center pt-4 border-t">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    This proposal has expired. Voting is no longer allowed.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {proposals.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No proposals found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}