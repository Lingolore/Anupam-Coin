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
import { useApi } from "@/hooks/use-api"
import { TokenErrorModal } from "@/components/TokenErrorModal"
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
  DollarSign,
} from "lucide-react"
import { io } from "socket.io-client"
import { WalletButton } from "@/components/wallet-button"
import { WalletStatus } from "@/components/wallet-status"
import { useWallet } from "@/contexts/wallet-context"
import { swapFromApm, swapToApm } from "@/helper/swap/swap-apm"
import { toast } from "sonner"

// Define TypeScript interface for price data
interface PriceData {
  success?: boolean
  data: {
    crypto?: Array<{ symbol: string; price: number; lastUpdated?: string }>
    preciousMetals?: Array<{ symbol: string; price: number; lastUpdated?: string }>
    stablecoins?: Array<{ symbol: string; price: number; lastUpdated?: string }>
    forex?: Array<{ symbol: string; price: number; lastUpdated?: string }>
  }
}

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
    isTransferring,
    wallet
  } = useWallet()

  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [marketCondition, setMarketCondition] = useState<"bull" | "bear" | "neutral">("neutral")
  const [liquidityPoolFrozen, setLiquidityPoolFrozen] = useState(false)
  const [reserveComposition, setReserveComposition] = useState(mockReserveComposition)
  const [rebalanceInProgress, setRebalanceInProgress] = useState(false)
  const [transferAmount, setTransferAmount] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [transferError, setTransferError] = useState<string | null>(null)
  const { data, loading, error, fetchData } = useApi()

  // States for price data
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [formattedPrices, setFormattedPrices] = useState<Record<string, number>>({})
  const [priceLoading, setPriceLoading] = useState(true)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [apmPrice, setApmPrice] = useState<any>()
  const [socketPriceLastUpdated, setSocketPriceLastUpdated] = useState<string | null>(null)

  // Swap-specific states
  const [swapDirection, setSwapDirection] = useState<'to-apm' | 'from-apm'>('to-apm')
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'USDT'>('USDC')
  const [inputAmount, setInputAmount] = useState('')
  const [outputAmount, setOutputAmount] = useState('0.00')
  const [swapInProgress, setSwapInProgress] = useState(false)
  const [swapFeeBps] = useState(30) // 0.3% fee in basis points
  const [swapError, setSwapError] = useState<string | null>(null)

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
    const socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    console.log("Connecting to Socket.IO server at", socketUrl)

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server at", socketUrl)
    })

    socket.on("connect_error", (error: any) => {
      console.error("Socket.IO connection error:", error.message)
    })

    socket.on("priceUpdate", (data: { apmPrice: number; timestamp: string; priceData: PriceData }) => {
      // console.log("Received priceUpdate:", JSON.stringify(data, null, 2))
      setApmPrice(data.apmPrice)
      setSocketPriceLastUpdated(data.timestamp)
      setPriceData(data.priceData)
      setFormattedPrices(formatApiPriceData(data.priceData))
    })

    socket.on("disconnect", (reason: any) => {
      console.log("Disconnected from Socket.IO server:", reason)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Function to format price data for UI display
  const formatApiPriceData = (apiData: PriceData | null) => {
    if (!apiData || !apiData.data) return {}

    const formatted: Record<string, number> = {}

    const categories = ["crypto", "preciousMetals", "stablecoins", "forex"]

    categories.forEach((category) => {
      if (apiData.data[category as keyof PriceData["data"]] && Array.isArray(apiData.data[category as keyof PriceData["data"]])) {
        apiData.data[category as keyof PriceData["data"]]!.forEach((item: any) => {
          const baseSymbol = item.symbol.split("/")[0]
          if (baseSymbol !== "USDC") {
            formatted[baseSymbol] = item.price
          }
        })
      }
    })

    return formatted
  }


  // const handleSwap =()=>{
  //   try{

  //   }
  //   catch(error:any){
  //     console.error("Error executing swap:", error)
  //     setSwapError(error.message || "Swap failed")
  //   }
  // }

  // Function to refresh price data
  const refreshPriceData = async () => {
    setPriceLoading(true)
    setPriceError(null)

    try {
      await fetchData("/api/contract/prices", "GET")
    } catch (err: any) {
      console.error("Error fetching price data:", err)
      setPriceError(err.message || "Failed to fetch price data")
      setPriceLoading(false)
    }
  }

  // Watch for changes in the data from useApi hook
  useEffect(() => {
    if (data && !loading && !error) {
      console.log("Response from API:", data)

      if (data.success) {
        setPriceData(data)
        setFormattedPrices(formatApiPriceData(data))
        const lastUpdateTime =
          data.data?.crypto?.[0]?.lastUpdated ||
          data.data?.preciousMetals?.[0]?.lastUpdated ||
          data.data?.stablecoins?.[0]?.lastUpdated ||
          data.data?.forex?.[0]?.lastUpdated
        setLastUpdated(lastUpdateTime || new Date().toISOString())
      } else {
        setPriceError("API response indicated failure")
      }
      setPriceLoading(false)
    } else if (error) {
      setPriceError(error || "Failed to fetch price data")
      setPriceLoading(false)
    }
  }, [data, loading, error])

  // Fetch price data on component mount
  useEffect(() => {
    refreshPriceData()
    const intervalId = setInterval(refreshPriceData, 30000)
    return () => clearInterval(intervalId)
  }, [])

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

  // Calculate swap output amount
  useEffect(() => {
    if (!inputAmount || isNaN(parseFloat(inputAmount))) {
      setOutputAmount('0.00')
      return
    }

    const amount = parseFloat(inputAmount)
    const fee = amount * (swapFeeBps / 10000)
    const amountAfterFee = amount - fee
    
    const stablecoinPrice = selectedToken === 'USDC' ? 1.0 : 1.0 // Assuming 1:1 peg for USDC/USDT
    let output: number

    console.log("*" ,swapDirection)

    const feeAdjustedAmount = Number(amountAfterFee);
    const stablePrice = Number(stablecoinPrice);
    const apmTokenPrice = Number(apmPrice);
    
 
      if (swapDirection === 'to-apm') {
        console.log("Calculating output for swap to APM");
        output = feeAdjustedAmount * (stablePrice / apmTokenPrice);
        console.log("Output amount (to APM):", output);
      } else {
        output = feeAdjustedAmount * (apmTokenPrice / stablePrice);
        console.log("Output amount (from APM):", output);
      }
    
    console.log("Output amount (from APM):", output)

    setOutputAmount(output.toFixed(6))
  }, [inputAmount, swapDirection, selectedToken, apmPrice, swapFeeBps])

  // Handle swap execution
  const handleSwap = async () => {
    if (!connected) {
      setSwapError('Please connect your wallet')
      return
    }

    if (!hasToken) {
      setSwapError('No APM tokens found in wallet')
      return
    }

    const amount = parseFloat(inputAmount)
    if (isNaN(amount) || amount <= 0) {
      setSwapError('Invalid amount')
      return
    }

    setSwapInProgress(true)
    setSwapError(null)

    try {
      // Simulate swap execution (replace with actual Solana transaction logic)
      let result : any ;
      if(swapDirection === 'to-apm' ) {

         result = await  swapToApm(wallet, amount, swapDirection === 'to-apm' ? 0 : 1)
        console.log("Swap result:", result)
        // await new Promise(resolve => setTimeout(resolve, 2000))
        
        toast.success(`Swap successful! ${amount} ${selectedToken}  APM ${result}`, {
          duration: 5000,
          position: 'top-right',
        })
      }else if (swapDirection === 'from-apm') {
         result = await swapFromApm(wallet, amount, swapDirection === 'from-apm' ? 0 : 1)
        console.log("Swap result:", result)
        // await new Promise(resolve => setTimeout(resolve, 2000))
        toast.success(`Swap successful! ${amount} APM swapped  ${selectedToken} ${result}`, {
          duration: 5000,
          position: 'top-right',
        })
      }

      console.log("Swap successful:", result)


      
      // Update wallet balance and other state as needed
      setInputAmount('')
      setOutputAmount('0.00')
    } catch (error: any) {
      setSwapError(error.message || 'Swap failed')
    } finally {
      setSwapInProgress(false)
    }
  }

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

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferError(null)

    try {
      if (!recipientAddress || !transferAmount) {
        throw new Error("Please fill in all fields")
      }

      try {
        new PublicKey(recipientAddress)
      } catch (err) {
        throw new Error("Invalid recipient address")
      }

      const amount = parseFloat(transferAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid amount")
      }

      if (amount < 0.000001) {
        throw new Error("Amount too small. Minimum transfer is 0.000001 ANC")
      }

      const totalAmount = amount * 1.003
      if (totalAmount > walletBalance) {
        throw new Error(`Insufficient balance (need ${totalAmount.toFixed(4)} ANC including 0.3% fee)`)
      }

      const signature = await transfer(recipientAddress, amount)
      console.log("Transfer successful:", signature)

      setTransferAmount("")
      setRecipientAddress("")
    } catch (error: any) {
      setTransferError(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
              Anupam Coin Dashboard
            </h1>
            <p className="text-gray-600">Dynamic Reserve-Backed SPL Token Management</p>
          </div>
          <div className="w-full lg:w-80">
            <WalletButton />
          </div>
        </div>

        {/* APM Price Card */}
        <Card>
          <CardHeader>
            <CardTitle>Anupam Coin Price</CardTitle>
            <CardDescription>Real-time price from Socket.IO feed</CardDescription>
          </CardHeader>
          <CardContent>
            {apmPrice === null ? (
              <div className="text-center">
                <Skeleton className="h-8 w-32 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Waiting for price update...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  ${apmPrice?.apmPrice.toFixed(4)} USD
                </div>
                <p className="text-sm text-gray-600">
                  Last updated: {socketPriceLastUpdated
                    ? new Date(socketPriceLastUpdated).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="token-ops">Token Operations</TabsTrigger>
            <TabsTrigger value="swap">Swap Token</TabsTrigger>
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
                        ≈ ${connected && hasToken ? ((walletBalance || 0) * (apmPrice || 1.25)).toFixed(2) : "0.00"} USD
                      </p>
                      {connected && !hasToken && (
                        <p className="text-xs text-red-500 mt-1">
                          Token not found.{" "}
                          <Button
                            variant="link"
                            className="h-auto p-0 text-xs text-blue-500"
                            onClick={() => setShowTokenModal(true)}
                          >
                            Get token
                          </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                  >
                    {showDebugInfo ? "Hide Debug" : "Debug"}
                  </Button>
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
                      <p>
                        <strong>Last Fetched:</strong> {lastUpdated || "Never"}
                      </p>
                      <p>
                        <strong>Price Count:</strong>{" "}
                        {(priceData.data?.crypto?.length || 0) +
                          (priceData.data?.preciousMetals?.length || 0) +
                          (priceData.data?.stablecoins?.length || 0) +
                          (priceData.data?.forex?.length || 0)}{" "}
                        total prices
                      </p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Crypto: {priceData.data?.crypto?.length || 0}</li>
                        <li>Precious Metals: {priceData.data?.preciousMetals?.length || 0}</li>
                        <li>Stablecoins: {priceData.data?.stablecoins?.length || 0}</li>
                        <li>Forex: {priceData.data?.forex?.length || 0}</li>
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
                    Array(8).fill(0).map((_, index) => (
                      <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                        <Skeleton className="h-4 w-16 mx-auto mb-2" />
                        <Skeleton className="h-6 w-24 mx-auto" />
                      </div>
                    ))
                  ) : (
                    Object.entries(Object.keys(formattedPrices).length > 0 ? formattedPrices : defaultPrices).map(
                      ([asset, price]) => (
                        <div key={asset} className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="font-semibold text-sm text-gray-600">{asset}</div>
                          <div className="text-lg font-bold">
                            {asset === "USD" || asset === "EUR" || asset === "GBP"
                              ? price.toFixed(4)
                              : `$${price.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`}
                          </div>
                        </div>
                      ),
                    )
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
                        Fee: 0.3% ({transferAmount ? (parseFloat(transferAmount) * 0.003).toFixed(4) : "0"} ANC)
                        {transferAmount && (
                          <span className="ml-2">Total: {(parseFloat(transferAmount) * 1.003).toFixed(4)} ANC</span>
                        )}
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

                    <Button type="submit" className="w-full" disabled={isTransferring || !connected || !hasToken}>
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
            </div>
          </TabsContent>

          {/* Swap Token Tab */}
          <TabsContent value="swap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Swap Interface</CardTitle>
                <CardDescription>Exchange USDC/USDT with APM tokens based on real-time prices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    Current APM Price: <strong>${apmPrice?.apmPrice.toFixed(4)} USD</strong>
                  </AlertDescription>
                </Alert>

                {swapError && (
                  <Alert variant="destructive">
                    <AlertDescription>{swapError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Swap Configuration</h4>
                    <div className="space-y-4">
                      {/* Swap Direction Toggle */}
                      <div className="flex items-center gap-2 p-3 border rounded-lg">
                        <Button
                          variant="outline"
                          onClick={() => setSwapDirection(swapDirection === 'to-apm' ? 'from-apm' : 'to-apm')}
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                          {swapDirection === 'to-apm' ? 'Buy APM' : 'Sell APM'}
                        </Button>
                      </div>

                      {/* Token Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {swapDirection === 'to-apm' ? 'Pay with:' : 'Receive:'}
                        </Label>
                        <select
                          value={selectedToken}
                          onChange={(e) => setSelectedToken(e.target.value as 'USDC' | 'USDT')}
                          className="w-full p-2 border rounded-lg"
                          disabled={swapInProgress}
                        >
                          <option value="USDC">USDC</option>
                          <option value="USDT">USDT</option>
                        </select>
                      </div>

                      {/* Amount Input */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {swapDirection === 'to-apm' ? `${selectedToken} Amount:` : 'APM Amount:'}
                        </Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={inputAmount}
                          onChange={(e) => setInputAmount(e.target.value)}
                          className="w-full"
                          disabled={swapInProgress}
                        />
                      </div>

                      {/* Output Display */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {swapDirection === 'to-apm' ? 'APM to Receive:' : `${selectedToken} to Receive:`}
                        </Label>
                        <Input
                          type="text"
                          value={outputAmount}
                          readOnly
                          className="w-full bg-gray-50"
                        />
                      </div>

                      {/* Fee Display */}
                      <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                        Swap Fee: {(swapFeeBps / 100).toFixed(2)}%
                        {inputAmount && ` (≈ ${((parseFloat(inputAmount) || 0) * swapFeeBps / 10000).toFixed(4)} ${swapDirection === 'to-apm' ? selectedToken : 'APM'})`}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Swap Controls</h4>
                    <div className="space-y-3">
                      <Button 
                        onClick={handleSwap} 
                        disabled={swapInProgress || !inputAmount || parseFloat(inputAmount) <= 0 || !connected || (swapDirection === 'from-apm' && !hasToken)} 
                        className="w-full"
                      >
                        {swapInProgress ? (
                          <>
                            <Settings className="h-4 w-4 mr-2 animate-spin" />
                            Swapping...
                          </>
                        ) : (
                          <>
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Execute Swap
                          </>
                        )}
                      </Button>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Exchange Rate:</span>
                          <span>
                            {swapDirection === 'to-apm' 
                              ? `1 ${selectedToken} = ${(1.0 / apmPrice?.apmPrice).toFixed(6)} APM`
                              : `1 APM = ${apmPrice?.apmPrice.toFixed(6)} ${selectedToken}`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price Impact:</span>
                          <span className="text-green-600">~0.1%</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        Last price update: {socketPriceLastUpdated ? new Date(socketPriceLastUpdated).toLocaleTimeString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Current Market Prices</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded text-center">
                      <div className="text-xs text-gray-500">USDC</div>
                      <div className="font-semibold">$1.0000</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded text-center">
                      <div className="text-xs text-gray-500">USDT</div>
                      <div className="font-semibold">$1.0000</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded text-center">
                      <div className="text-xs text-gray-500">APM</div>
                      <div className="font-semibold text-blue-600">${apmPrice?.apmPrice.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}