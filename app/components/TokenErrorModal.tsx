"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TokenErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenAddress: string
  onGetToken: () => void
}

export function TokenErrorModal({ open, onOpenChange, tokenAddress, onGetToken }: TokenErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Token Not Found
          </DialogTitle>
          <DialogDescription>
            Your wallet is connected but does not have the required Anupam Coin (ANC) token.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium">Token Details:</p>
            <p className="text-xs font-mono mt-1 break-all">{tokenAddress}</p>
          </div>
          <p className="text-sm text-gray-600">
            You need to have the ANC token in your wallet to use all features of this dashboard. 
            Please add the token to your wallet or get some tokens from our faucet.
          </p>
        </div>
        <DialogFooter className="flex flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue Anyway
          </Button>
          <Button onClick={onGetToken}>
            Get ANC Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

