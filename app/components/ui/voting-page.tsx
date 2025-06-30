"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Vote, CheckCircle, XCircle, Clock, TrendingUp, Users, AlertCircle, Eye } from "lucide-react"

interface VotingPageProps {
  isWalletConnected: boolean
  tokenBalances: {
    jck: number
    jckp: number
    usdt: number
  }
}

export default function VotingPage({ isWalletConnected, tokenBalances }: VotingPageProps) {
  const [votingOnProposal, setVotingOnProposal] = useState<number | null>(null)
  const [selectedProposal, setSelectedProposal] = useState<number | null>(null)

  const proposals = [
    {
      id: 1,
      title: "Update Staking APR Rates",
      category: "StakingApr",
      status: "Active",
      endTime: "2024-06-15T12:00:00Z",
      forVotes: 15420,
      againstVotes: 3280,
      totalVoters: 45,
      maxVoters: 100,
      description:
        "Proposal to adjust staking rewards for different tiers to improve platform competitiveness and user retention.",
      detailedDescription:
        "This proposal aims to update the staking APR rates across all tiers:\n\n• Low Tier: 2.5% APR (currently 2.0%)\n• Mid Tier: 5.0% APR (currently 4.5%)\n• High Tier: 7.5% APR (currently 7.0%)\n\nThese changes will help maintain competitive rates in the current market while ensuring sustainable rewards for our stakers.",
      hasVoted: false,
      timeRemaining: "2 days, 14 hours",
      proposalData: {
        lowTierFee: 2.5,
        midTierFee: 5.0,
        highTierFee: 7.5,
      },
    },
    {
      id: 2,
      title: "Treasury Allocation for Development",
      category: "TreasuryAllocation",
      status: "Active",
      endTime: "2024-06-18T15:30:00Z",
      forVotes: 8750,
      againstVotes: 12300,
      totalVoters: 32,
      maxVoters: 75,
      description: "Allocate 50,000 JCK tokens from treasury for platform development and marketing initiatives.",
      detailedDescription:
        "This proposal requests allocation of 50,000 JCK tokens from the DAO treasury for:\n\n• Platform development (60%): 30,000 JCK\n• Marketing and partnerships (25%): 12,500 JCK\n• Community incentives (15%): 7,500 JCK\n\nFunds will be transferred to the development multisig wallet for transparent usage tracking.",
      hasVoted: true,
      userVote: false,
      timeRemaining: "5 days, 8 hours",
      proposalData: {
        treasuryAmount: 50000,
        selectedToken: "JCK",
        sourceAccount: "7xKX...source",
        destinationAccount: "9mBq...dest",
      },
    },
    {
      id: 3,
      title: "Modify Vesting Schedule Parameters",
      category: "TimeBasedDistribution",
      status: "Pending",
      endTime: "2024-06-20T10:00:00Z",
      forVotes: 0,
      againstVotes: 0,
      totalVoters: 0,
      maxVoters: 60,
      description: "Update distribution multiplier to 1.25x and implement pause mechanism for emergency situations.",
      detailedDescription:
        "This proposal modifies the vesting schedule parameters:\n\n• Increase distribution multiplier from 1.0x to 1.25x\n• Implement emergency pause mechanism\n• Allow for more flexible token distribution during market volatility\n\nThese changes will provide better control over token distribution while maintaining fair vesting schedules.",
      hasVoted: false,
      timeRemaining: "7 days, 2 hours",
      proposalData: {
        distributionMultiplier: 1.25,
        isPaused: false,
      },
    },
  ]

  const calculateVotingPower = () => {
    const jckWeight = 2
    const jckpWeight = 3
    return tokenBalances.jck * jckWeight + tokenBalances.jckp * jckpWeight
  }

  const canVote = isWalletConnected && tokenBalances.usdt >= 100

  const handleVote = async (proposalId: number, voteFor: boolean) => {
    if (!canVote) return

    setVotingOnProposal(proposalId)

    // Simulate voting transaction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setVotingOnProposal(null)
    alert(`Vote ${voteFor ? "FOR" : "AGAINST"} proposal ${proposalId} submitted successfully!`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Pending":
        return "bg-yellow-100 text-yellow-800"
      case "Executed":
        return "bg-blue-100 text-blue-800"
      case "Failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "StakingApr":
        return <TrendingUp className="w-4 h-4" />
      case "TreasuryAllocation":
        return <Users className="w-4 h-4" />
      case "TimeBasedDistribution":
        return <Clock className="w-4 h-4" />
      default:
        return <Vote className="w-4 h-4" />
    }
  }

  const renderProposalDetails = (proposal: any) => {
    switch (proposal.category) {
      case "StakingApr":
        return (
          <div className="space-y-2">
            <h4 className="font-medium">Proposed APR Rates:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <div className="font-medium">Low Tier</div>
                <div className="text-lg">{proposal.proposalData.lowTierFee}%</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="font-medium">Mid Tier</div>
                <div className="text-lg">{proposal.proposalData.midTierFee}%</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="font-medium">High Tier</div>
                <div className="text-lg">{proposal.proposalData.highTierFee}%</div>
              </div>
            </div>
          </div>
        )
      case "TreasuryAllocation":
        return (
          <div className="space-y-2">
            <h4 className="font-medium">Allocation Details:</h4>
            <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
              <div>
                <span className="font-medium">Amount:</span> {proposal.proposalData.treasuryAmount.toLocaleString()}{" "}
                {proposal.proposalData.selectedToken}
              </div>
              <div>
                <span className="font-medium">From:</span> {proposal.proposalData.sourceAccount}
              </div>
              <div>
                <span className="font-medium">To:</span> {proposal.proposalData.destinationAccount}
              </div>
            </div>
          </div>
        )
      case "TimeBasedDistribution":
        return (
          <div className="space-y-2">
            <h4 className="font-medium">Vesting Parameters:</h4>
            <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
              <div>
                <span className="font-medium">Multiplier:</span> {proposal.proposalData.distributionMultiplier}x
              </div>
              <div>
                <span className="font-medium">Status:</span> {proposal.proposalData.isPaused ? "Paused" : "Active"}
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const activeProposals = proposals.filter((p) => p.status === "Active")
  const pendingProposals = proposals.filter((p) => p.status === "Pending")

  if (selectedProposal) {
    const proposal = proposals.find((p) => p.id === selectedProposal)
    if (!proposal) return null

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setSelectedProposal(null)}>
            ← Back to Proposals
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(proposal.category)}
                  <h1 className="text-2xl font-bold">{proposal.title}</h1>
                  <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                </div>
                <p className="text-gray-600">{proposal.description}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Ends in: {proposal.timeRemaining}</p>
                <p>
                  {proposal.totalVoters}/{proposal.maxVoters} voters
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Detailed Description */}
            <div>
              <h3 className="font-semibold mb-2">Detailed Description</h3>
              <div className="bg-gray-50 p-4 rounded whitespace-pre-line text-sm">{proposal.detailedDescription}</div>
            </div>

            {/* Proposal Specific Details */}
            {renderProposalDetails(proposal)}

            {/* Vote Results */}
            <div className="space-y-4">
              <h3 className="font-semibold">Voting Results</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">For: {proposal.forVotes.toLocaleString()}</span>
                  <span className="text-red-600">Against: {proposal.againstVotes.toLocaleString()}</span>
                </div>
                <div className="flex space-x-1">
                  <div className="flex-1 bg-green-200 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${(proposal.forVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex-1 bg-red-200 rounded-full h-4">
                    <div
                      className="bg-red-500 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${(proposal.againstVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <Progress value={(proposal.totalVoters / proposal.maxVoters) * 100} className="h-2" />
                <p className="text-xs text-gray-500 text-center">
                  Participation: {((proposal.totalVoters / proposal.maxVoters) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Voting Actions */}
            <div className="border-t pt-6">
              {proposal.hasVoted ? (
                <div className="flex items-center justify-center space-x-2 py-4">
                  {proposal.userVote ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-lg">You voted {proposal.userVote ? "FOR" : "AGAINST"} this proposal</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {!canVote && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {!isWalletConnected ? "Connect your wallet to vote" : "You need at least $100 USDT to vote"}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={() => handleVote(proposal.id, true)}
                      disabled={!canVote || votingOnProposal === proposal.id}
                      className="bg-green-600 hover:bg-green-700 px-8 py-3"
                      size="lg"
                    >
                      {votingOnProposal === proposal.id ? "Voting..." : "Vote FOR"}
                    </Button>
                    <Button
                      onClick={() => handleVote(proposal.id, false)}
                      disabled={!canVote || votingOnProposal === proposal.id}
                      variant="destructive"
                      size="lg"
                      className="px-8 py-3"
                    >
                      {votingOnProposal === proposal.id ? "Voting..." : "Vote AGAINST"}
                    </Button>
                  </div>

                  <div className="text-center text-sm text-gray-500">
                    Your voting power: {calculateVotingPower().toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Voting Power Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Vote className="w-5 h-5" />
            <span>Your Voting Power</span>
          </CardTitle>
          <CardDescription>Your influence in governance decisions based on token holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-500">JCK Tokens</div>
              <div className="text-lg font-semibold">{tokenBalances.jck.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Weight: 2x</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-500">JCKP Tokens</div>
              <div className="text-lg font-semibold">{tokenBalances.jckp.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Weight: 3x</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-500">USDT Balance</div>
              <div className={`text-lg font-semibold ${tokenBalances.usdt >= 100 ? "text-green-600" : "text-red-600"}`}>
                ${tokenBalances.usdt.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Min: $100</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-500">Total Voting Power</div>
              <div className="text-2xl font-bold">{calculateVotingPower().toLocaleString()}</div>
              <div className="text-xs text-gray-400">Combined weight</div>
            </div>
          </div>

          {!canVote && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!isWalletConnected
                  ? "Connect your wallet to participate in voting"
                  : "You need at least $100 USDT to vote on proposals"}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Proposals Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">Active Proposals ({activeProposals.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Proposals ({pendingProposals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeProposals.map((proposal) => (
            <Card key={proposal.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(proposal.category)}
                      <h3 className="text-lg font-semibold">{proposal.title}</h3>
                      <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{proposal.description}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Ends in: {proposal.timeRemaining}</p>
                    <p>
                      {proposal.totalVoters}/{proposal.maxVoters} voters
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Vote Results */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">For: {proposal.forVotes.toLocaleString()}</span>
                    <span className="text-red-600">Against: {proposal.againstVotes.toLocaleString()}</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="flex-1 bg-green-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${(proposal.forVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex-1 bg-red-200 rounded-full h-3">
                      <div
                        className="bg-red-500 h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${(proposal.againstVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProposal(proposal.id)}
                    className="flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </Button>

                  {proposal.hasVoted ? (
                    <div className="flex items-center space-x-2">
                      {proposal.userVote ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">Voted {proposal.userVote ? "FOR" : "AGAINST"}</span>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleVote(proposal.id, true)}
                        disabled={!canVote || votingOnProposal === proposal.id}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        Vote FOR
                      </Button>
                      <Button
                        onClick={() => handleVote(proposal.id, false)}
                        disabled={!canVote || votingOnProposal === proposal.id}
                        variant="destructive"
                        size="sm"
                      >
                        Vote AGAINST
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingProposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(proposal.category)}
                      <h3 className="text-lg font-semibold">{proposal.title}</h3>
                      <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{proposal.description}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Starts in: {proposal.timeRemaining}</p>
                    <p>Max voters: {proposal.maxVoters}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Alert className="flex-1 mr-4">
                    <Clock className="h-4 w-4" />
                    <AlertDescription>This proposal is pending and voting has not yet started.</AlertDescription>
                  </Alert>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProposal(proposal.id)}
                    className="flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Preview</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
