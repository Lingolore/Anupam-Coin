
"use client"

import { useState, useEffect } from "react"
import { PublicKey } from "@solana/web3.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api";
import { TokenErrorModal } from "@/components/TokenErrorModal";
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Shield,
  BarChart3,
  Settings,
  Wallet,
  ArrowUpDown,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react"

import { WalletButton } from "@/components/wallet-button"
import { WalletStatus } from "@/components/wallet-status"
import { useWallet } from "@/contexts/wallet-context"

// Default prices used as fallback when API data is loading or unavailable
const defaultPrices = {
  BTC: 45000,
  ETH: 2800,
  GOLD: 2050,
  SILVER: 24.5,
  USD: 1.0,
  GBP: 0.79,
  EUR: 0.92,
}

const mockReserveComposition = {
  stablecoins: {
    percentage: 45,
    assets: {
      USD: 30,
      GBP: 7.5,
      EUR: 7.5,
    },
  },
  preciousMetals: {
    percentage: 37,
    assets: {
      GOLD: 32,
      SILVER: 5,
    },
  },
  cryptocurrencies: {
    percentage: 18,
    assets: {
      BTC: 10.5,
      ETH: 7.5,
    },
  },
}

export default function AnupamCoinDashboard() {
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
    isTransferring
  } = useWallet()
  
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [marketCondition, setMarketCondition] = useState<"bull" | "bear" | "neutral">("neutral")
  const [liquidityPoolFrozen, setLiquidityPoolFrozen] = useState(false)
  const [reserveComposition, setReserveComposition] = useState(mockReserveComposition)
  const [rebalanceInProgress, setRebalanceInProgress] = useState(false)
  const [transferAmount, setTransferAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const { data, loading, error, fetchData } = useApi();
  
  // States for API price data
  const [priceData, setPriceData] = useState<any>(null);
  const [formattedPrices, setFormattedPrices] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);


  // Function to format price data for UI display
  const formatApiPriceData = (apiData: any) => {
    if (!apiData || !apiData.data) return {};
    
    const formatted: Record<string, number> = {};
    
    // Process each category of price data
    const categories = ['crypto', 'preciousMetals', 'stablecoins', 'forex'];
    
    categories.forEach(category => {
      if (apiData.data[category] && Array.isArray(apiData.data[category])) {
        apiData.data[category].forEach((item: any) => {
          const baseSymbol = item.symbol.split('/')[0];
          
          // Skip USDC
          if (baseSymbol !== 'USDC') {
            formatted[baseSymbol] = item.price;
          }
        });
      }
    });
    
    return formatted;
  };
  
  // Function to refresh price data
  const refreshPriceData = async () => {
    setPriceLoading(true);
    setPriceError(null);
    
    try {
      await fetchData("/api/contract/prices", "GET");
    
    } catch (err: any) {
      console.error("Error fetching price data:", err);
      setPriceError(err.message || "Failed to fetch price data");
      setPriceLoading(false);
    }
  };

  // Watch for changes in the data from useApi hook
  useEffect(() => {
    if (data && !loading && !error) {
      console.log("Response from API:", data);
      
      if (data.success) {
        setPriceData(data);
        setFormattedPrices(formatApiPriceData(data));
        
        // Get the last updated time from the first crypto asset (or any available asset)
        const lastUpdateTime = 
          data.data?.crypto?.[0]?.lastUpdated || 
          data.data?.preciousMetals?.[0]?.lastUpdated ||
          data.data?.stablecoins?.[0]?.lastUpdated ||
          data.data?.forex?.[0]?.lastUpdated;
          
        setLastUpdated(lastUpdateTime || new Date().toISOString());
      } else {
        setPriceError("API response indicated failure");
      }
      setPriceLoading(false);
    } else if (error) {
      setPriceError(error || "Failed to fetch price data");
      setPriceLoading(false);
    }
  }, [data, loading, error]);

  // Fetch price data on component mount
  useEffect(() => {
    refreshPriceData();
    
    // Set up a refresh interval (every 30 seconds)
    const intervalId = setInterval(refreshPriceData, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);


  // const postData = () => {
  //   fetchData("/api/send", "POST", { name: "John" });
  // };


  // Simulate market condition changes
  useEffect(() => {
    const interval = setInterval(() => {
      const random = Math.random()
      if (random < 0.3) setMarketCondition("bull")
      else if (random < 0.6) setMarketCondition("bear")
      else setMarketCondition("neutral")
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleRebalance = () => {
    setRebalanceInProgress(true)
    setTimeout(() => {
      if (marketCondition === "bull") {
        setReserveComposition((prev) => ({
          ...prev,
          cryptocurrencies: { ...prev.cryptocurrencies, percentage: 30 },
          stablecoins: { ...prev.stablecoins, percentage: 35 },
          preciousMetals: { ...prev.preciousMetals, percentage: 35 },
        }))
      } else if (marketCondition === "bear") {
        setReserveComposition((prev) => ({
          ...prev,
          cryptocurrencies: { ...prev.cryptocurrencies, percentage: 10 },
          stablecoins: { ...prev.stablecoins, percentage: 50 },
          preciousMetals: { ...prev.preciousMetals, percentage: 40 },
        }))
      }
      setRebalanceInProgress(false)
    }, 3000)
  }


  // Add the handleTransfer function in your component
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    try {
      if (!recipientAddress || !transferAmount) {
        throw new Error("Please fill in all fields");
      }

      // Validate recipient address
      try {
        new PublicKey(recipientAddress);
      } catch (err) {
        throw new Error("Invalid recipient address");
      }

      // Validate amount
      const amount = parseFloat(transferAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid amount");
      }

      // Check minimum transfer amount
      if (amount < 0.000001) {
        throw new Error("Amount too small. Minimum transfer is 0.000001 ANC");
      }

      // Calculate total amount including 0.3% fee
      const totalAmount = amount * 1.003;
      if (totalAmount > walletBalance) {
        throw new Error(`Insufficient balance (need ${totalAmount.toFixed(4)} ANC including 0.3% fee)`);
      }

      const signature = await transfer(recipientAddress, amount);
      console.log("Transfer successful:", signature);
      
      // Show success message (you might want to add a toast notification here)
      
      // Clear form
      setTransferAmount("");
      setRecipientAddress("");
    } catch (error: any) {
      setTransferError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Token Error Modal */}
      <TokenErrorModal 
        open={showTokenModal} 
        onOpenChange={setShowTokenModal}
        tokenAddress={tokenAddress}
        onGetToken={getToken}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center lg:justify-start gap-2">
              <Coins className="h-8 w-8 text-yellow-600" />
              {/* Anupam Coin Dashboard */}
             Anupam Coin Dashboard
            </h1>
            <p className="text-gray-600">Dynamic Reserve-Backed SPL Token Management</p>
          </div>
          <div className="w-full lg:w-80">
            <WalletButton />
          </div>
        </div>

        {/* Market Status Banner */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {marketCondition === "bull" ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : marketCondition === "bear" ? (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  ) : (
                    <BarChart3 className="h-5 w-5 text-gray-600" />
                  )}
                  <span className="font-semibold">Market Condition:</span>
                  <Badge
                    variant={
                      marketCondition === "bull" ? "default" : marketCondition === "bear" ? "destructive" : "secondary"
                    }
                  >
                    {marketCondition.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {liquidityPoolFrozen ? (
                    <Lock className="h-4 w-4 text-red-600" />
                  ) : (
                    <Unlock className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm">Liquidity Pool: {liquidityPoolFrozen ? "Frozen" : "Active"}</span>
                </div>
              </div>
              <Button
                onClick={() => setLiquidityPoolFrozen(!liquidityPoolFrozen)}
                variant={liquidityPoolFrozen ? "destructive" : "default"}
                size="sm"
              >
                {liquidityPoolFrozen ? "Unfreeze Pool" : "Freeze Pool"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="token-ops">Token Operations</TabsTrigger>
            <TabsTrigger value="reserves">Reserve Management</TabsTrigger>
            <TabsTrigger value="rebalancing">Rebalancing</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Supply</CardTitle>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {tokenCheckLoading ? (
                    <div className="text-2xl font-bold animate-pulse">Loading...</div>
                  ) : (
                    <div className="text-2xl font-bold">{connected ? (tokenSupply || 0).toLocaleString() : "0.0000"} ANC</div>
                  )}
                  <p className="text-xs text-muted-foreground">APM Coin tokens</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Your Balance</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {tokenCheckLoading ? (
                    <>
                      <div className="text-2xl font-bold animate-pulse">Loading...</div>
                      <p className="text-xs text-muted-foreground animate-pulse">Checking wallet...</p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {connected && hasToken ? (walletBalance || 0).toFixed(4) : "0.0000"} ANC
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ≈ ${connected && hasToken ? ((walletBalance || 0) * 1.25).toFixed(2) : "0.00"} USD
                      </p>
                      {connected && !hasToken && (
                        <p className="text-xs text-red-500 mt-1">
                          Token not found. <Button variant="link" className="h-auto p-0 text-xs text-blue-500" onClick={() => setShowTokenModal(true)}>Get token</Button>
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transfer Fee</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0.3%</div>
                  <p className="text-xs text-muted-foreground">Base transfer fee</p>
                </CardContent>
              </Card>

              <WalletStatus />
            </div>

            {/* Reserve Composition Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Current Reserve Composition</CardTitle>
                <CardDescription>Asset allocation backing Anupam Coin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Stablecoins</span>
                      <span>{reserveComposition.stablecoins.percentage}%</span>
                    </div>
                    <Progress value={reserveComposition.stablecoins.percentage} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Precious Metals</span>
                      <span>{reserveComposition.preciousMetals.percentage}%</span>
                    </div>
                    <Progress value={reserveComposition.preciousMetals.percentage} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Cryptocurrencies</span>
                      <span>{reserveComposition.cryptocurrencies.percentage}%</span>
                    </div>
                    <Progress value={reserveComposition.cryptocurrencies.percentage} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Oracle Prices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Live Oracle Prices</CardTitle>
                  <CardDescription>Real-time asset prices from Pyth Network</CardDescription>
                </div>
                <div className="flex gap-2">
                  {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                  >
                    {showDebugInfo ? "Hide Debug" : "Debug"}
                  </Button> */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshPriceData}
                    disabled={priceLoading}
                  >
                    {priceLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {priceError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      Failed to load price data: {priceError}. Using default values instead.
                    </AlertDescription>
                  </Alert>
                )}

                {showDebugInfo && priceData && (
                  <div className="mb-6 p-4 bg-gray-100 rounded-md border border-gray-300 overflow-auto text-xs">
                    <h4 className="font-semibold mb-2 text-sm">Debug Information</h4>
                    <div className="space-y-1">
                      <p><strong>Last Fetched:</strong> {lastUpdated || 'Never'}</p>
                      <p><strong>Price Count:</strong> {
                        (priceData.data.crypto?.length || 0) + 
                        (priceData.data.preciousMetals?.length || 0) + 
                        (priceData.data.stablecoins?.length || 0) + 
                        (priceData.data.forex?.length || 0)
                      } total prices</p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Crypto: {priceData.data.crypto?.length || 0}</li>
                        <li>Precious Metals: {priceData.data.preciousMetals?.length || 0}</li>
                        <li>Stablecoins: {priceData.data.stablecoins?.length || 0}</li>
                        <li>Forex: {priceData.data.forex?.length || 0}</li>
                      </ul>
                      <div>
                        <p className="font-semibold mt-2">Raw Data:</p>
                        <pre className="mt-1 bg-gray-200 p-2 rounded-md overflow-auto max-h-60">
                          {JSON.stringify(priceData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {priceLoading ? (
                    // Show skeleton loaders while loading
                    Array(8).fill(0).map((_, index) => (
                      <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                        <Skeleton className="h-4 w-16 mx-auto mb-2" />
                        <Skeleton className="h-6 w-24 mx-auto" />
                      </div>
                    ))
                  ) : (
                    // Show actual price data
                    Object.entries(Object.keys(formattedPrices).length > 0 ? formattedPrices : defaultPrices).map(([asset, price]) => (
                      <div key={asset} className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="font-semibold text-sm text-gray-600">{asset}</div>
                        <div className="text-lg font-bold">
                          {asset === "USD" || asset === "EUR" || asset === "GBP"
                            ? price.toFixed(4)
                            : `$${price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Operations Tab */}
          <TabsContent value="token-ops" className="space-y-6">
            {!connected && (
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>Please connect your Phantom wallet to perform token operations.</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mint Tokens */}
              <Card>
                <CardHeader>
                  <CardTitle>Mint Tokens</CardTitle>
                  <CardDescription>Create new Anupam Coin tokens (Governance controlled)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mint-amount">Amount to Mint</Label>
                    <Input id="mint-amount" placeholder="Enter amount" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mint-recipient">Recipient Address</Label>
                    <Input id="mint-recipient" placeholder="Solana wallet address" />
                  </div>
                  <Button className="w-full" disabled={!connected}>
                    <Coins className="h-4 w-4 mr-2" />
                    Mint Tokens
                  </Button>
                </CardContent>
              </Card>

              {/* Burn Tokens */}
              <Card>
                <CardHeader>
                  <CardTitle>Burn Tokens</CardTitle>
                  <CardDescription>Remove tokens from circulation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="burn-amount">Amount to Burn</Label>
                    <Input id="burn-amount" placeholder="Enter amount" type="number" />
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Burning tokens is irreversible and will reduce total supply.</AlertDescription>
                  </Alert>
                  <Button variant="destructive" className="w-full" disabled={!connected}>
                    <Shield className="h-4 w-4 mr-2" />
                    Burn Tokens
                  </Button>
                </CardContent>
              </Card>

              {/* Transfer Tokens */}
              <Card>
                <CardHeader>
                  <CardTitle>Transfer Tokens</CardTitle>
                  <CardDescription>Send tokens to another wallet (0.3% fee applies)</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTransfer} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transfer-amount">Amount</Label>
                      <div className="relative">
                        <Input
                          id="transfer-amount"
                          placeholder="Enter amount"
                          type="number"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          disabled={isTransferring || !connected}
                        />
                        <span className="absolute right-3 top-2 text-sm text-gray-500">
                          Balance: {walletBalance.toFixed(4)} ANC
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Fee: 0.3% ({transferAmount ? (parseFloat(transferAmount) * 0.003).toFixed(4) : '0'} ANC)
                        {transferAmount && <span className="ml-2">
                          Total: {(parseFloat(transferAmount) * 1.003).toFixed(4)} ANC
                        </span>}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="transfer-recipient">Recipient</Label>
                      <Input
                        id="transfer-recipient"
                        placeholder="Solana wallet address"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        disabled={isTransferring || !connected}
                      />
                    </div>
                    
                    {transferError && (
                      <Alert variant="destructive">
                        <AlertDescription>{transferError}</AlertDescription>
                      </Alert>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isTransferring || !connected || !hasToken}
                    >
                      {isTransferring ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                          <span>Transferring...</span>
                        </div>
                      ) : !hasToken ? (
                        <>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          No Tokens Available
                        </>
                      ) : (
                        <>
                          <ArrowUpDown className="h-4 w-4 mr-2" />
                          Transfer Tokens
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Swap Interface */}
              {/* <Card>
                <CardHeader>
                  <CardTitle>Swap Tokens</CardTitle>
                  <CardDescription>Exchange ANC for other SPL tokens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="swap-from">From</Label>
                    <Input id="swap-from" placeholder="ANC amount" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swap-to">To Token</Label>
                    <Input id="swap-to" placeholder="Select token" />
                  </div>
                  <div className="text-sm text-gray-600">Swap fee: 0.3% + network fees</div>
                  <Button className="w-full" disabled={!connected || liquidityPoolFrozen}>
                    {liquidityPoolFrozen ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Pool Frozen
                      </>
                    ) : (
                      <>
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Swap Tokens
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card> */}
            </div>
          </TabsContent>

          {/* Reserve Management Tab */}
          <TabsContent value="reserves" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Detailed Reserve Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Reserve Breakdown</CardTitle>
                  <CardDescription>Current asset allocation percentages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-blue-600">
                      Stablecoins ({reserveComposition.stablecoins.percentage}%)
                    </h4>
                    <div className="space-y-2 ml-4">
                      {Object.entries(reserveComposition.stablecoins.assets).map(([asset, percentage]) => (
                        <div key={asset} className="flex justify-between">
                          <span>{asset}</span>
                          <span>{percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-yellow-600">
                      Precious Metals ({reserveComposition.preciousMetals.percentage}%)
                    </h4>
                    <div className="space-y-2 ml-4">
                      {Object.entries(reserveComposition.preciousMetals.assets).map(([asset, percentage]) => (
                        <div key={asset} className="flex justify-between">
                          <span>{asset}</span>
                          <span>{percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-purple-600">
                      Cryptocurrencies ({reserveComposition.cryptocurrencies.percentage}%)
                    </h4>
                    <div className="space-y-2 ml-4">
                      {Object.entries(reserveComposition.cryptocurrencies.assets).map(([asset, percentage]) => (
                        <div key={asset} className="flex justify-between">
                          <span>{asset}</span>
                          <span>{percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Oracle Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Oracle Status</CardTitle>
                  <CardDescription>Price feed health and last update times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {priceLoading ? (
                      // Skeleton loaders for loading state
                      Array(6).fill(0).map((_, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))
                    ) : priceData ? (
                      // Combine all asset categories and display their status
                      [
                        ...(priceData.data.crypto || []),
                        ...(priceData.data.preciousMetals || []),
                        ...(priceData.data.stablecoins || []),
                        ...(priceData.data.forex || [])
                      ]
                      // Filter out USDC
                      .filter(item => !item.symbol.startsWith('USDC/'))
                      .map((item) => (
                        <div key={item.symbol} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{item.symbol}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Active</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Default fallback if no data is available
                      Object.keys(defaultPrices).map((asset) => (
                        <div key={asset} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{asset}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Using Default</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    Last updated: {lastUpdated 
                      ? new Date(lastUpdated).toLocaleString() 
                      : new Date().toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reserve Value Tracking */}
            <Card>
              <CardHeader>
                <CardTitle>Reserve Value Tracking</CardTitle>
                <CardDescription>Total value of backing assets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {tokenCheckLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `$${((tokenSupply || 0) * 1.25 * (reserveComposition.stablecoins.percentage / 100) / 1000000).toFixed(2)}M`
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Stablecoins Value</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {tokenCheckLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `$${((tokenSupply || 0) * 1.25 * (reserveComposition.preciousMetals.percentage / 100) / 1000000).toFixed(2)}M`
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Precious Metals Value</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {tokenCheckLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `$${((tokenSupply || 0) * 1.25 * (reserveComposition.cryptocurrencies.percentage / 100) / 1000000).toFixed(2)}M`
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Crypto Value</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-3xl font-bold">
                    {tokenCheckLoading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      `$${((tokenSupply || 0) * 1.25 / 1000000).toFixed(2)}M`
                    )}
                  </div>
                  <div className="text-gray-600">Total Reserve Value</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rebalancing Tab */}
          <TabsContent value="rebalancing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Volatility-Sensitive Rebalancing</CardTitle>
                <CardDescription>Automatic asset allocation adjustment based on market conditions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Current market condition: <strong>{marketCondition.toUpperCase()}</strong>
                    {marketCondition === "bull" && " - Increasing crypto allocation"}
                    {marketCondition === "bear" && " - Increasing stable asset allocation"}
                    {marketCondition === "neutral" && " - Maintaining balanced allocation"}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Rebalancing Rules</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span>Bull Market (+5%): Increase crypto to 30%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span>Bear Market (-5%): Increase stable assets to 90%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <span>Neutral: Maintain default allocation</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Rebalancing Controls</h4>
                    <div className="space-y-3">
                      <Button onClick={handleRebalance} disabled={rebalanceInProgress} className="w-full">
                        {rebalanceInProgress ? (
                          <>
                            <Settings className="h-4 w-4 mr-2 animate-spin" />
                            Rebalancing...
                          </>
                        ) : (
                          <>
                            <Settings className="h-4 w-4 mr-2" />
                            Trigger Rebalance
                          </>
                        )}
                      </Button>
                      <div className="text-sm text-gray-600">Last rebalance: 2 hours ago</div>
                    </div>
                  </div>
                </div>

                {/* Rebalancing History */}
                <div>
                  <h4 className="font-semibold mb-3">Recent Rebalancing Events</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Bull market detected - Increased crypto allocation</span>
                      </div>
                      <span className="text-xs text-gray-500">2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Bear market detected - Increased stable allocation</span>
                      </div>
                      <span className="text-xs text-gray-500">1 day ago</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Program Upgrade Controls</CardTitle>
                  <CardDescription>Governance-controlled smart contract upgrades</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upgrade-authority">Upgrade Authority</Label>
                    <Input id="upgrade-authority" value="Gov123...xyz" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-program">New Program Hash</Label>
                    <Input id="new-program" placeholder="Enter new program hash" />
                  </div>
                  <Button className="w-full" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Propose Upgrade
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fee Management</CardTitle>
                  <CardDescription>Adjust transfer and swap fees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="base-fee">Base Transfer Fee (%)</Label>
                    <Input id="base-fee" type="number" defaultValue="0.3" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swap-fee">Swap Fee (%)</Label>
                    <Input id="swap-fee" type="number" defaultValue="0.3" step="0.1" />
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Fee changes require governance approval and may auto-adjust based on inflation pressure.
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Propose Fee Change
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Emergency Controls</CardTitle>
                  <CardDescription>Critical system controls for emergency situations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant="destructive"
                      onClick={() => setLiquidityPoolFrozen(true)}
                      disabled={liquidityPoolFrozen}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Freeze Liquidity Pool
                    </Button>
                    <Button variant="outline">
                      <Shield className="h-4 w-4 mr-2" />
                      Pause Minting
                    </Button>
                    <Button variant="outline">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Emergency Stop
                    </Button>
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Emergency controls should only be used during critical situations like panic selling or security
                      threats.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
