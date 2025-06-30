"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, TrendingUp, Users, Clock, CheckCircle } from "lucide-react"

interface ProposalCreationProps {
  isWalletConnected: boolean
  tokenBalances: {
    jck: number
    jckp: number
    usdt: number
  }
}

export default function ProposalCreation({ isWalletConnected, tokenBalances }: ProposalCreationProps) {
  const [proposalType, setProposalType] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [votingDuration, setVotingDuration] = useState("7")
  const [maxVoters, setMaxVoters] = useState("100")

  // Staking APR fields
  const [lowTierFee, setLowTierFee] = useState("")
  const [midTierFee, setMidTierFee] = useState("")
  const [highTierFee, setHighTierFee] = useState("")

  // Treasury Allocation fields
  const [treasuryAmount, setTreasuryAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState("")
  const [sourceAccount, setSourceAccount] = useState("")
  const [destinationAccount, setDestinationAccount] = useState("")

  // Time-based Distribution fields
  const [distributionMultiplier, setDistributionMultiplier] = useState("")
  const [isPaused, setIsPaused] = useState("0")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const proposalTypes = [
    {
      value: "StakingApr",
      label: "Staking APR Update",
      icon: <TrendingUp className="w-4 h-4" />,
      description: "Update staking reward rates for different tiers",
    },
    {
      value: "TreasuryAllocation",
      label: "Treasury Allocation",
      icon: <Users className="w-4 h-4" />,
      description: "Allocate treasury funds for specific purposes",
    },
    {
      value: "TimeBasedDistribution",
      label: "Vesting Schedule",
      icon: <Clock className="w-4 h-4" />,
      description: "Modify token vesting and distribution parameters",
    },
  ]

  const canCreateProposal = isWalletConnected && tokenBalances.usdt >= 100

  const validateForm = () => {
    if (!title || !description || !proposalType) return false

    switch (proposalType) {
      case "StakingApr":
        return lowTierFee && midTierFee && highTierFee
      case "TreasuryAllocation":
        return treasuryAmount && selectedToken && sourceAccount && destinationAccount
      case "TimeBasedDistribution":
        return distributionMultiplier && isPaused !== ""
      default:
        return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreateProposal || !validateForm()) return

    setIsSubmitting(true)

    // Simulate proposal creation transaction
    await new Promise((resolve) => setTimeout(resolve, 3000))

    setSubmitSuccess(true)
    setIsSubmitting(false)

    // Reset form after success
    setTimeout(() => {
      setTitle("")
      setDescription("")
      setProposalType("")
      setLowTierFee("")
      setMidTierFee("")
      setHighTierFee("")
      setTreasuryAmount("")
      setSelectedToken("")
      setSourceAccount("")
      setDestinationAccount("")
      setDistributionMultiplier("")
      setIsPaused("0")
      setSubmitSuccess(false)
    }, 3000)
  }

  const renderCategorySpecificFields = () => {
    switch (proposalType) {
      case "StakingApr":
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Staking APR Configuration</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="lowTierFee">Low Tier APR (%)</Label>
                <Input
                  id="lowTierFee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={lowTierFee}
                  onChange={(e) => setLowTierFee(e.target.value)}
                  placeholder="e.g., 2.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="midTierFee">Mid Tier APR (%)</Label>
                <Input
                  id="midTierFee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={midTierFee}
                  onChange={(e) => setMidTierFee(e.target.value)}
                  placeholder="e.g., 5.0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="highTierFee">High Tier APR (%)</Label>
                <Input
                  id="highTierFee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={highTierFee}
                  onChange={(e) => setHighTierFee(e.target.value)}
                  placeholder="e.g., 7.5"
                  required
                />
              </div>
            </div>
          </div>
        )

      case "TreasuryAllocation":
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Treasury Allocation Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="treasuryAmount">Amount</Label>
                <Input
                  id="treasuryAmount"
                  type="number"
                  min="1"
                  value={treasuryAmount}
                  onChange={(e) => setTreasuryAmount(e.target.value)}
                  placeholder="e.g., 50000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="selectedToken">Token Type</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jck">JCK Token</SelectItem>
                    <SelectItem value="Jckp">JCKP Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="sourceAccount">Source Token Account</Label>
                <Input
                  id="sourceAccount"
                  value={sourceAccount}
                  onChange={(e) => setSourceAccount(e.target.value)}
                  placeholder="Source wallet address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="destinationAccount">Destination Token Account</Label>
                <Input
                  id="destinationAccount"
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  placeholder="Destination wallet address"
                  required
                />
              </div>
            </div>
          </div>
        )

      case "TimeBasedDistribution":
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Vesting Parameters</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="distributionMultiplier">Distribution Multiplier</Label>
                <Select value={distributionMultiplier} onValueChange={setDistributionMultiplier} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select multiplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">0.25x (25%)</SelectItem>
                    <SelectItem value="0.50">0.50x (50%)</SelectItem>
                    <SelectItem value="0.75">0.75x (75%)</SelectItem>
                    <SelectItem value="1.00">1.00x (100%)</SelectItem>
                    <SelectItem value="1.25">1.25x (125%)</SelectItem>
                    <SelectItem value="1.50">1.50x (150%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="isPaused">Distribution Status</Label>
                <Select value={isPaused} onValueChange={setIsPaused} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Continue Distribution</SelectItem>
                    <SelectItem value="1">Pause Distribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (submitSuccess) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-semibold text-green-700">Proposal Created Successfully!</h3>
            <p className="text-gray-600">Your proposal has been submitted and is now available for voting.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Eligibility Check */}
      {!canCreateProposal && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!isWalletConnected
              ? "Connect your wallet to create proposals"
              : "You need at least $100 USDT to create proposals"}
          </AlertDescription>
        </Alert>
      )}

      {/* Token Balance Info */}
      {isWalletConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Token Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">JCK:</span> {tokenBalances.jck.toFixed(2)}
              </div>
              <div>
                <span className="font-medium">JCKP:</span> {tokenBalances.jckp.toFixed(2)}
              </div>
              <div className={`font-medium ${tokenBalances.usdt >= 100 ? "text-green-600" : "text-red-600"}`}>
                <span>USDT:</span> ${tokenBalances.usdt.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Create New Proposal</span>
          </CardTitle>
          <CardDescription>Submit a new governance proposal for community voting</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Proposal Type Selection */}
            <div>
              <Label htmlFor="proposalType">Proposal Category</Label>
              <Select value={proposalType} onValueChange={setProposalType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select proposal type" />
                </SelectTrigger>
                <SelectContent>
                  {proposalTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center space-x-2">
                        {type.icon}
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Proposal Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a clear, descriptive title"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed information about your proposal"
                  rows={4}
                  maxLength={1000}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{description.length}/1000 characters</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="votingDuration">Voting Duration</Label>
                  <Select value={votingDuration} onValueChange={setVotingDuration} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="maxVoters">Maximum Voters</Label>
                  <Input
                    id="maxVoters"
                    type="number"
                    min="1"
                    value={maxVoters}
                    onChange={(e) => setMaxVoters(e.target.value)}
                    placeholder="e.g., 100"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Category-specific fields */}
            {proposalType && <div className="border-t pt-6">{renderCategorySpecificFields()}</div>}

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t">
              <Button
                type="submit"
                disabled={!canCreateProposal || isSubmitting || !validateForm()}
                className="min-w-32"
              >
                {isSubmitting ? "Creating..." : "Create Proposal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
