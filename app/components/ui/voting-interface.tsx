"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Vote, CheckCircle, XCircle, Clock, TrendingUp, Users, AlertCircle } from "lucide-react"

interface VotingInterfaceProps {
  isWalletConnected: boolean
  tokenBalances: {
    jck: number
    jckp: number
    usdt: number
    anc: number
  }
}

export default function VotingInterface({ isWalletConnected, tokenBalances }: VotingInterfaceProps) {
  const [votingOnProposal, setVotingOnProposal] = useState<number | null>(null)

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
      description: "Proposal to adjust staking rewards: Low tier 2.5%, Mid tier 5.0%, High tier 7.5%",
      hasVoted: false,
      timeRemaining: "2 days, 14 hours",
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
      description: "Allocate 50,000 JCK tokens from treasury for platform development and marketing initiatives",
      hasVoted: true,
      userVote: false,
      timeRemaining: "5 days, 8 hours",
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
      description: "Update distribution multiplier to 1.25x and implement pause mechanism for emergency situations",
      hasVoted: false,
      timeRemaining: "7 days, 2 hours",
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

  const activeProposals = proposals.filter((p) => p.status === "Active")
  const pendingProposals = proposals.filter((p) => p.status === "Pending")

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">JCK Tokens</span>
                <span className="text-sm">{tokenBalances.jck.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Voting Weight (2x)</span>
                <span className="text-xs">{(tokenBalances.jck * 2).toFixed(0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">JCKP Tokens</span>
                <span className="text-sm">{tokenBalances.jckp.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Voting Weight (3x)</span>
                <span className="text-xs">{(tokenBalances.jckp * 3).toFixed(0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Voting Power</span>
                <span className="text-lg font-bold">{calculateVotingPower().toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">USDT Balance</span>
                <span className={`text-xs ${tokenBalances.usdt >= 100 ? "text-green-600" : "text-red-600"}`}>
                  ${tokenBalances.usdt.toFixed(2)}
                </span>
              </div>
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
          <TabsTrigger value="history">Voting History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeProposals.map((proposal) => (
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
                  <Progress value={(proposal.totalVoters / proposal.maxVoters) * 100} className="h-2" />
                  <p className="text-xs text-gray-500 text-center">
                    Participation: {((proposal.totalVoters / proposal.maxVoters) * 100).toFixed(1)}%
                  </p>
                </div>

                {/* Voting Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  {proposal.hasVoted ? (
                    <div className="flex items-center space-x-2">
                      {proposal.userVote ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">You voted {proposal.userVote ? "FOR" : "AGAINST"} this proposal</span>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleVote(proposal.id, true)}
                        disabled={!canVote || votingOnProposal === proposal.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {votingOnProposal === proposal.id ? "Voting..." : "Vote FOR"}
                      </Button>
                      <Button
                        onClick={() => handleVote(proposal.id, false)}
                        disabled={!canVote || votingOnProposal === proposal.id}
                        variant="destructive"
                      >
                        {votingOnProposal === proposal.id ? "Voting..." : "Vote AGAINST"}
                      </Button>
                    </div>
                  )}

                  <div className="text-sm text-gray-500">
                    Your voting power: {calculateVotingPower().toLocaleString()}
                  </div>
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
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>This proposal is pending and voting has not yet started.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Your Voting History</CardTitle>
              <CardDescription>Track your participation in past governance decisions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Vote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No voting history yet</p>
                <p className="text-sm">Your voting activity will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
