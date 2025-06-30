"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useWallet } from "@/contexts/wallet-context"
import { Wallet, CheckCircle, XCircle } from "lucide-react"

export function WalletStatus() {
  const { connected, walletAddress, balance } = useWallet()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Wallet Status</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge variant="default">Connected</Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <Badge variant="secondary">Disconnected</Badge>
              </>
            )}
          </div>

          {connected && walletAddress && (
            <>
              <div className="text-xs text-muted-foreground">
                Address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
              </div>
              <div className="text-lg font-bold">{balance.toFixed(4)} ANC</div>
              <div className="text-xs text-muted-foreground">≈ ${(balance * 1.25).toFixed(2)} USD</div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
