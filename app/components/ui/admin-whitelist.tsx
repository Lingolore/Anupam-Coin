"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { UserPlus, UserMinus, Shield, AlertCircle, CheckCircle, Trash2 } from "lucide-react"

interface AdminWhitelistProps {
  isWalletConnected: boolean
  isAdmin: boolean
}

export default function AdminWhitelist({ isWalletConnected, isAdmin }: AdminWhitelistProps) {
  const [newAddress, setNewAddress] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [whitelistedAddresses, setWhitelistedAddresses] = useState([
    {
      address: "7xKXyH2mBqR2vN8sP9dF3kL6wE1tY4uI8oP5qR7sT9vW",
      addedDate: "2024-06-01",
      addedBy: "Admin",
      status: "Active",
    },
    {
      address: "9mBqR2vN8sP9dF3kL6wE1tY4uI8oP5qR7sT9vW2xKX",
      addedDate: "2024-06-03",
      addedBy: "Admin",
      status: "Active",
    },
    {
      address: "3kL6wE1tY4uI8oP5qR7sT9vW2xKXyH2mBqR2vN8sP9d",
      addedDate: "2024-06-05",
      addedBy: "Admin",
      status: "Active",
    },
  ])

  const validateSolanaAddress = (address: string) => {
    // Basic Solana address validation (44 characters, base58)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    return base58Regex.test(address)
  }

  const handleAddAddress = async () => {
    if (!newAddress.trim()) return

    if (!validateSolanaAddress(newAddress)) {
      alert("Please enter a valid Solana address")
      return
    }

    if (whitelistedAddresses.some((addr) => addr.address === newAddress)) {
      alert("Address is already whitelisted")
      return
    }

    setIsAdding(true)

    // Simulate blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newWhitelistEntry = {
      address: newAddress,
      addedDate: new Date().toISOString().split("T")[0],
      addedBy: "Admin",
      status: "Active",
    }

    setWhitelistedAddresses([...whitelistedAddresses, newWhitelistEntry])
    setNewAddress("")
    setIsAdding(false)

    alert("Address successfully added to whitelist!")
  }

  const handleRemoveAddress = async (address: string) => {
    if (!confirm(`Are you sure you want to remove ${address} from the whitelist?`)) {
      return
    }

    setIsRemoving(address)

    // Simulate blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setWhitelistedAddresses(whitelistedAddresses.filter((addr) => addr.address !== address))
    setIsRemoving(null)

    alert("Address successfully removed from whitelist!")
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  if (!isWalletConnected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to access admin functions.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>Access denied. Only admin wallets can manage the whitelist.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Admin Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <span>Admin Panel</span>
          </CardTitle>
          <CardDescription>Manage proposal creator whitelist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm">You have admin privileges to manage the whitelist</span>
          </div>
        </CardContent>
      </Card>

      {/* Add New Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <span>Add New Address</span>
          </CardTitle>
          <CardDescription>Whitelist a new address to create proposals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newAddress">Solana Wallet Address</Label>
              <Input
                id="newAddress"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Enter Solana wallet address (e.g., 7xKXyH2mBqR2vN8sP9dF3kL6wE1tY4uI8oP5qR7sT9vW)"
                className="font-mono text-sm"
              />
              {newAddress && !validateSolanaAddress(newAddress) && (
                <p className="text-xs text-red-600 mt-1">Invalid Solana address format</p>
              )}
            </div>

            <Button
              onClick={handleAddAddress}
              disabled={!newAddress.trim() || !validateSolanaAddress(newAddress) || isAdding}
              className="w-full"
            >
              {isAdding ? "Adding to Whitelist..." : "Add to Whitelist"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Whitelist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserMinus className="w-5 h-5" />
              <span>Current Whitelist</span>
            </div>
            <Badge variant="outline">{whitelistedAddresses.length} addresses</Badge>
          </CardTitle>
          <CardDescription>Addresses currently authorized to create proposals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {whitelistedAddresses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No addresses whitelisted yet</p>
                <p className="text-sm">Add addresses to allow proposal creation</p>
              </div>
            ) : (
              whitelistedAddresses.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-mono text-sm">{entry.address}</div>
                    <div className="text-xs text-gray-500">
                      Added on {entry.addedDate} by {entry.addedBy}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {entry.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAddress(entry.address)}
                      disabled={isRemoving === entry.address}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      {isRemoving === entry.address ? (
                        "Removing..."
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Whitelist Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Whitelist Statistics</CardTitle>
          <CardDescription>Overview of whitelist activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{whitelistedAddresses.length}</div>
              <div className="text-sm text-gray-600">Total Whitelisted</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {whitelistedAddresses.filter((addr) => addr.status === "Active").length}
              </div>
              <div className="text-sm text-gray-600">Active Addresses</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">12</div>
              <div className="text-sm text-gray-600">Total Proposals Created</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
