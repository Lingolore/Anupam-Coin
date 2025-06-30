"use client"

import type React from "react"

// Extend the Window interface to include the solana property
declare global {
  interface Window {
    solana?: any;
  }
}



import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Plus, Trash2, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { getGovernanceConfigPDA, useDao } from "@/helper/dao-helpers"
import { Connection } from "@solana/web3.js"
import { useWallet } from "@/contexts/wallet-context"
import IDL from "../abi/dao.json"
import { AnchorProvider, Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com'
);
const programId:any= process.env.NEXT_PUBLIC_DAO_PROGRAM_ID || "J9jZ5p75dJG9MqFiC4bFJGi1ApLpBHzF6LikpzRLyg88"
console.log("Program ID:", programId)

interface AdminWhitelistProps {
  isWalletConnected: boolean
  isAdmin: boolean
}

interface WhitelistedUser {
  address: string
  addedDate: string
  // addedBy: string
}

export default function AdminWhitelist({ isWalletConnected, isAdmin }: AdminWhitelistProps) {
  
 // Asumming this is a function to add address to whitelist
 const { wallet , connection } = useWallet()
  const [newAddress, setNewAddress] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [whitelistedUsers, setWhitelistedUsers] = useState<WhitelistedUser[]>([])



  const handleAddAddress = async (e:any) => {
    e.preventDefault()
    console.log("Adding address:", newAddress);
    const wallet:any = window.solana;
    if (!wallet?.isConnected) {
      alert("Please connect your wallet first.");
      return;
    }    
    const provider:any = new AnchorProvider(connection, wallet, { commitment: 'processed' });
    if (!wallet?.publicKey) return;
    if (!newAddress.trim()) {
      alert("Please enter a valid address.");
      return;
    }
    // const wallet = new window
    console.log("Wallet public key:", wallet.publicKey?.toBase58());
    const program = new Program(IDL as any, programId, provider)!;
    let governanceConfig:any = await getGovernanceConfigPDA();
    console.log("Governance Config PDA:", governanceConfig.toBase58());
    try {
      await program.methods.addProposalCreator(new PublicKey(newAddress))
        .accounts({
          governanceConfig: new PublicKey(governanceConfig),
          authority: wallet.publicKey,
        })
        .rpc();
      alert("Creator added successfully!");
    } catch (e:any) {
      console.error(e);
      alert(`Error adding creator : ${e.message}`);
    }
  };

  const handleRemoveAddress = async (addressToRemove: string) => {

    console.log("Remove address:", addressToRemove);
    const wallet:any = window.solana;
    if (!wallet?.isConnected) {
      alert("Please connect your wallet first.");
      return;
    }    
    const provider:any = new AnchorProvider(connection, wallet, { commitment: 'processed' });
    if (!wallet?.publicKey) return;
    if (!addressToRemove.trim()) {
      alert("Please enter a valid address.");
      return;
    }
    // const wallet = new window
    console.log("Wallet public key:", wallet.publicKey?.toBase58());
    const program = new Program(IDL as any, programId, provider)!;
    let governanceConfig:any = await getGovernanceConfigPDA();
    console.log("Governance Config PDA:", governanceConfig.toBase58());
    try {
      await program.methods.removeProposalCreator(new PublicKey(addressToRemove))
        .accounts({
          governanceConfig: new PublicKey(governanceConfig),
          authority: wallet.publicKey,
        })
        .rpc();
      alert("Creator added successfully!");
    } catch (e:any) {
      console.error(e);
      alert(`Error adding creator : ${e.message}`);
    }
  };

  const handleShowWhitelistedAddress = async () => {
    try{
      const wallet:any = window.solana;
      const provider:any = new AnchorProvider(connection, wallet, { commitment: 'processed' });
      if (!wallet?.publicKey) return;
      const program = new Program(IDL as any, programId, provider)!;
      let governanceConfig:any = await getGovernanceConfigPDA();
      console.log("Governance Config PDA:", governanceConfig.toBase58());

      const whitelistedAddresses:any = await program.account.governanceConfig.fetch(governanceConfig);
      console.log("Whitelisted Addresses:", whitelistedAddresses?.proposalCreatorWhitelist);

      const {proposalCreatorWhitelist} = whitelistedAddresses;

      // Assuming whitelistedAddresses is an array of PublicKey
      
      const addresses = proposalCreatorWhitelist.map((addr:any) => addr.toBase58());
      setWhitelistedUsers(addresses.map((address:any) => ({
        address,
      })));
      console.log("Formatted Addresses:", addresses);
    }
    catch (error) {
      console.error("Error fetching whitelisted addresses:", error);
      // alert("Failed to fetch whitelisted addresses. Please try again later.");
    }
  }

  useEffect(() => {
    handleShowWhitelistedAddress()
  }, [isWalletConnected, isAdmin])

  // const handleRemoveAddress = (addressToRemove: string) => {
  //   setWhitelistedUsers((prev) => prev.filter((user) => user.address !== addressToRemove))
  // }

  if (!isWalletConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Manage whitelisted addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to access admin features.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Manage whitelisted addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You do not have admin privileges to access this panel.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Panel</h2>
          <p className="text-gray-600">Manage whitelisted addresses for proposal creation and voting</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Users className="w-3 h-3 mr-1" />
          {/* {whitelistedUsers.length} Whitelisted */}
        </Badge>
      </div>

      {/* Add New Address */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Address</CardTitle>
          <CardDescription>Whitelist a new wallet address for DAO participation</CardDescription>
        </CardHeader>
        <CardContent>
          {showSuccess && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">Address added to whitelist successfully!</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAddAddress} className="flex space-x-3">
            <div className="flex-1">
              <Label htmlFor="address" className="sr-only">
                Wallet Address
              </Label>
              <Input
                id="address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Enter wallet address..."
                required
              />
            </div>
            <Button type="submit" disabled={isAdding || !newAddress.trim()}>
              {isAdding ? (
                "Adding..."
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Address
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Whitelisted Addresses */}
      <Card>
        <CardHeader>
          <CardTitle>Whitelisted Addresses</CardTitle>
          <CardDescription>Currently whitelisted wallet addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {whitelistedUsers.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-mono text-sm">{user.address}</p>
                  <p className="text-xs text-gray-500">
                    Added on {user.addedDate} 
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveAddress(user.address)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
