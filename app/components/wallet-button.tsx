"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useWallet } from "@/contexts/wallet-context"
import { Wallet, Copy, ExternalLink, LogOut, AlertCircle } from "lucide-react"

export function WalletButton() {
  const { connected, connecting, walletAddress, balance, connectWallet, disconnectWallet, error } = useWallet()
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (!connected) {
    return (
      <div className="space-y-2">
        <Button onClick={connectWallet} disabled={connecting} className="w-full">
          <Wallet className="h-4 w-4 mr-2" />
          {connecting ? "Connecting..." : "Connect Phantom Wallet"}
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span>{walletAddress ? truncateAddress(walletAddress) : "Connected"}</span>
          </div>
          <Badge variant="secondary">{balance.toFixed(2)} ANC</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Wallet Details</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-2 py-1.5 space-y-2">
          <div className="text-sm">
            <div className="text-gray-500">Address:</div>
            <div className="font-mono text-xs break-all">{walletAddress}</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500">ANC Balance:</div>
            <div className="font-semibold">{balance.toFixed(4)} ANC</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500">USD Value:</div>
            <div className="font-semibold">${(balance * 1.25).toFixed(2)}</div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="h-4 w-4 mr-2" />
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => window.open(`https://explorer.solana.com/address/${walletAddress}`, "_blank")}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Explorer
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={disconnectWallet} className="text-red-600">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
