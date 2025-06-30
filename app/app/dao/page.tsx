"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import ProposalCreation from "@/components/proposal-creation";
import VotingPage from "@/components/voting-page";
import AdminWhitelist from "@/components/admin-whitelist";
import { useWallet } from "@/contexts/wallet-context";
import { set } from "date-fns";

export default function DAOPlatform() {
  const {
    connected,
    balance: walletBalance,
    totalSupply: tokenSupply,
    hasToken,
    tokenCheckLoading,
    showTokenModal,
    setShowTokenModal,
    tokenAddress,
    getToken,
    transfer,
    isTransferring,
    walletAddress,
    connectWallet,
  } = useWallet();
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [newWalletAddress, setWalletAddress] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  useEffect(() => {
    if (!connected) return;

    // Simulate wallet connection
    // Replace with actual wallet address logic
    setIsWalletConnected(true);

    const adminAddresses = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS as any; // Mock admin address
    setIsAdmin(walletAddress !== null && adminAddresses.includes(walletAddress));
    setWalletAddress(walletAddress || "");
  }, [connected, walletAddress]);

  // const connectWallet = async () => {
  //   // Simulate wallet connection
  //   const mockAddress = "7xKXyH...9mBqR2"
  //   setIsWalletConnected(true)
  //   setWalletAddress(mockAddress)

  //   // Check if admin (in real app, this would be checked against contract)
  //   const adminAddresses = ["7xKXyH...9mBqR2"] // Mock admin address
  //   setIsAdmin(adminAddresses.includes(mockAddress))

  //   // Check if whitelisted for proposal creation/voting
  //   const whitelistedAddresses = ["7xKXyH...9mBqR2", "9mBqR2...vN8sP9"]
  //   setIsWhitelisted(whitelistedAddresses.includes(mockAddress))
  // }

  const disconnectWallet = () => {
    if (!isWalletConnected) return;
    setIsWalletConnected(false);
    setWalletAddress("");
    setIsAdmin(false);
    setIsWhitelisted(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="text-center lg:text-left space-y-2">
              <h1 className="text-4xl font-bold text-gray-900">
                APM DAO Governance
              </h1>
              <p className="text-gray-600">
                Decentralized Governance for APM Token
              </p>
            </div>

            {/* Single Wallet Connection Section */}
            <div className="flex items-center space-x-4">
              {isWalletConnected ? (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {walletAddress}
                    </p>
                    <div className="flex justify-end space-x-2 mt-1">
                      {isAdmin && (
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full">
                          Admin
                        </span>
                      )}
                      {isWhitelisted && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">
                          Whitelisted
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectWallet}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={connectWallet}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="voting" className="space-y-6">
          <TabsList
            className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <TabsTrigger value="voting">Proposals & Voting</TabsTrigger>
            <TabsTrigger value="create">Create Proposal</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Admin Panel</TabsTrigger>}
          </TabsList>

          <TabsContent value="voting">
            <VotingPage
              isWalletConnected={isWalletConnected}
              isWhitelisted={isWhitelisted}
              walletAddress={newWalletAddress}
            />
          </TabsContent>

          <TabsContent value="create">
            <ProposalCreation
              // isWalletConnected={isWalletConnected}
              // isWhitelisted={isWhitelisted}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminWhitelist
                isWalletConnected={isWalletConnected}
                isAdmin={isAdmin}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
