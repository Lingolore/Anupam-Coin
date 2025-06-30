"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Users, Vote, CheckCircle, Clock, TrendingUp, AlertTriangle } from "lucide-react"

interface GovernanceOverviewProps {
  isWalletConnected: boolean
  tokenBalances: {
    jck: number
    jckp: number
    usdt: number
    anc: number
  }
}

export default function GovernanceOverview({ isWalletConnected, tokenBalances }: GovernanceOverviewProps) {
  const activeProposals = [
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
      description: "Proposal to adjust staking rewards for different tiers",
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
      description: "Allocate 50,000 JCK tokens for platform development",
    },
    {
      id: 3,
      title: "Modify Vesting Schedule",
      category: "TimeBasedDistribution",
      status: "Pending",
      endTime: "2024-06-20T10:00:00Z",
      forVotes: 0,
      againstVotes: 0,
      totalVoters: 0,
      maxVoters: 60,
      description: "Update distribution multiplier and pause mechanism",
    },
  ]

  const calculateVotingPower = () => {
    const jckWeight = 2 // From contract
    const jckpWeight = 3 // From contract
    return tokenBalances.jck * jckWeight + tokenBalances.jckp * jckpWeight
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

  return (
    <div className="space-y-6">
      {/* Governance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Voting Power</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isWalletConnected ? calculateVotingPower().toLocaleString() : "0"}
            </div>
            <p className="text-xs text-muted-foreground">Based on JCK + JCKP holdings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Proposals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProposals.filter((p) => p.status === "Active").length}</div>
            <p className="text-xs text-muted-foreground">Requiring your vote</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProposals.length}</div>
            <p className="text-xs text-muted-foreground">All time proposals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participation Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">Average voter turnout</p>
          </CardContent>
        </Card>
      </div>

      {/* Voting Eligibility Check */}
      {isWalletConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Voting Eligibility</CardTitle>
            <CardDescription>Check your eligibility to participate in governance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">USDT Balance Requirement</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">${tokenBalances.usdt.toFixed(2)} / $100.00</span>
                  {tokenBalances.usdt >= 100 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
              <Progress value={Math.min((tokenBalances.usdt / 100) * 100, 100)} className="h-2" />
              {tokenBalances.usdt < 100 && (
                <p className="text-sm text-red-600">You need at least $100 USDT to participate in voting</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Proposals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Proposals</CardTitle>
          <CardDescription>Latest governance proposals and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeProposals.map((proposal) => (
              <div key={proposal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(proposal.category)}
                      <h3 className="font-semibold">{proposal.title}</h3>
                      <Badge className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{proposal.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>For: {proposal.forVotes.toLocaleString()}</span>
                      <span>Against: {proposal.againstVotes.toLocaleString()}</span>
                    </div>
                    <div className="flex space-x-1">
                      <div className="flex-1 bg-green-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${(proposal.forVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex-1 bg-red-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{
                            width: `${(proposal.againstVotes / (proposal.forVotes + proposal.againstVotes)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {proposal.totalVoters}/{proposal.maxVoters} voters
                    </p>
                    <p className="text-xs text-gray-500">Ends: {new Date(proposal.endTime).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" disabled={!isWalletConnected || tokenBalances.usdt < 100}>
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
