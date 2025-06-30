"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { Connection, PublicKey, Transaction } from "@solana/web3.js";


import { 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
  createTransferCheckedInstruction as SplCreateTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getTransferFeeConfig,
  calculateFee
} from "@solana/spl-token";

// Define the correct Token-2022 program ID
const TOKEN_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "DsssD9w6g2M3HgTnrrq6zaZiYzTMDZeggCzma6NxAC6b";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.devnet.solana.com";

const connection:any = new Connection("https://api.devnet.solana.com", "confirmed");

// Phantom wallet types
interface PhantomWallet {
  isPhantom: boolean
  publicKey: PublicKey | null  // Change this to use PublicKey type directly
  isConnected: boolean
  connect(): Promise<{ publicKey: PublicKey }>
  disconnect(): Promise<void>
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
} 

interface TokenInfo {
  balance: number
  totalSupply: number
  decimals: number
}

interface WalletContextType {
  wallet: PhantomWallet | null
  connected: boolean
  connecting: boolean
  walletAddress : string | null
  balance: number
  totalSupply: number
  tokenAddress: string
  hasToken: boolean
  tokenCheckLoading: boolean
  showTokenModal: boolean
  setShowTokenModal: (show: boolean) => void
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  getToken: () => Promise<void>
  transfer: (recipientAddress: string, amount: number) => Promise<string>
  isTransferring: boolean
  error: string | null,
  connection : Connection,
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Token address from environment variables

  const [wallet, setWallet] = useState<PhantomWallet | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [totalSupply, setTotalSupply] = useState(0)
  const [hasToken, setHasToken] = useState(false)
  const [tokenCheckLoading, setTokenCheckLoading] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function to check if the wallet has the token and get token info


  async function getTokenBalance(walletAddress: string, mintAddress: string): Promise<number> {
    if (!walletAddress || !mintAddress) {
      console.error("Invalid wallet or token address");
      return 0;
    }

    try {
      const walletPubKey = new PublicKey(walletAddress);
      const mintPubKey = new PublicKey(mintAddress);

      // First get the mint info to get decimals
      try {
        const mintInfo = await getMint(
          connection,
          mintPubKey,
          'confirmed',
          TOKEN_PROGRAM_ID
        );

        // Use Token-2022 program ID when getting ATA
        const ata = getAssociatedTokenAddressSync(
          mintPubKey,
          walletPubKey,
          false,
          TOKEN_PROGRAM_ID
        );

        try {
          // Get account using Token-2022 program
          const tokenAccount = await getAccount(
            connection, 
            ata,
            'confirmed',
            TOKEN_PROGRAM_ID
          );

          const decimals = mintInfo.decimals;
          const rawAmount = Number(tokenAccount.amount);
          const adjustedAmount = rawAmount / Math.pow(10, decimals);
          
          console.log(`Token account found:
            Raw amount: ${rawAmount}
            Decimals: ${decimals}
            Adjusted amount: ${adjustedAmount}
            Mint: ${mintAddress}
            ATA: ${ata.toString()}`);

          return isNaN(adjustedAmount) ? 0 : adjustedAmount;
        } catch (error: any) {
          if (error.name === 'TokenAccountNotFoundError') {
            console.log(`No token account found for wallet ${walletAddress} and token ${mintAddress}`);
            return 0;
          }
          console.error("Error checking token account:", error);
          return 0;
        }
      } catch (mintError: any) {
        console.error(`Error getting mint info for token ${mintAddress}:`, mintError);
        console.log("Make sure this is a valid Token-2022 token address");
        return 0;
      }
    } catch (error) {
      console.error("Error in getTokenBalance:", error);
      return 0;
    }
  }

  const transfer = async (recipientAddress: string, amount: number): Promise<string> => {
    if (!wallet || !wallet.publicKey || !connected) {
      throw new Error("Wallet not connected");
    }
  
    setIsTransferring(true);
    try {
      const recipientPubKey = new PublicKey(recipientAddress);
      const tokenMintPubKey = new PublicKey(TOKEN_ADDRESS);
  
      // Get mint info for decimals
      const mintInfo = await getMint(
        connection,
        tokenMintPubKey,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
  
      const rawAmount = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));
      
      // Manual fee calculation for balance check
      const TRANSFER_FEE_BPS = 30;
      const feeAmount = (rawAmount * BigInt(TRANSFER_FEE_BPS)) / BigInt(10000);
      const totalAmountNeeded = rawAmount ;
  
      // Get ATAs
      const senderATA = getAssociatedTokenAddressSync(
        tokenMintPubKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
  
      const recipientATA = getAssociatedTokenAddressSync(
        tokenMintPubKey,
        recipientPubKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
  
      // Record balances BEFORE transfer
      const senderAccountBefore = await getAccount(
        connection,
        senderATA,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      
      let recipientAccountBefore;
      try {
        recipientAccountBefore = await getAccount(
          connection,
          recipientATA,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
      } catch {
        recipientAccountBefore = { amount: BigInt(0) };
      }
  
      console.log('BEFORE Transfer:', {
        senderBalance: senderAccountBefore.amount.toString(),
        recipientBalance: recipientAccountBefore.amount.toString(),
        transferAmount: rawAmount.toString(),
        calculatedFee: feeAmount.toString(),
        totalNeeded: totalAmountNeeded.toString()
      });
  
      // Check sufficient balance
      if (senderAccountBefore.amount < totalAmountNeeded) {
        const shortfall = totalAmountNeeded - senderAccountBefore.amount;
        const shortfallFormatted = Number(shortfall) / Math.pow(10, mintInfo.decimals);
        throw new Error(`Insufficient balance. Need ${shortfallFormatted.toFixed(mintInfo.decimals)} more tokens (including 0.3% fee)`);
      }
  
      // Check if recipient ATA exists
      let needsRecipientATA = false;
      try {
        await getAccount(connection, recipientATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
      } catch (error) {
        needsRecipientATA = true;
      }
  
      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
  
      // Add create ATA instruction if needed
      if (needsRecipientATA) {
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          recipientATA,
          recipientPubKey,
          tokenMintPubKey,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID      // the Associated Token program
        );
        transaction.add(createATAInstruction);
      }
  
      // Create transfer instruction - Token-2022 should handle fees automatically
      const transferInstruction = SplCreateTransferCheckedInstruction(
        senderATA,
        tokenMintPubKey,
        recipientATA,
        wallet.publicKey,
        rawAmount, // This is the amount recipient receives
        mintInfo.decimals,
        [],
        TOKEN_2022_PROGRAM_ID
      );
  
      transaction.add(transferInstruction);
  
      // Sign and send
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
  
      // Confirm transaction
      const confirmation = await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      }, 'confirmed');
  
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
  
      // Wait a moment for balances to update
      await new Promise(resolve => setTimeout(resolve, 2000));
  
      // Check balances AFTER transfer to verify fee deduction
      const senderAccountAfter = await getAccount(
        connection,
        senderATA,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
  
      const recipientAccountAfter = await getAccount(
        connection,
        recipientATA,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
  
      const actualSenderDeduction = senderAccountBefore.amount - senderAccountAfter.amount;
      const actualRecipientIncrease = recipientAccountAfter.amount - recipientAccountBefore.amount;
  
      console.log('AFTER Transfer:', {
        senderBalance: senderAccountAfter.amount.toString(),
        recipientBalance: recipientAccountAfter.amount.toString(),
        senderDeduction: actualSenderDeduction.toString(),
        recipientIncrease: actualRecipientIncrease.toString(),
        expectedTransfer: rawAmount.toString(),
        expectedFee: feeAmount.toString(),
        actualFeeDeducted: (actualSenderDeduction - actualRecipientIncrease).toString()
      });
  
      // Verify if fee was properly deducted
      const actualFee = actualSenderDeduction - actualRecipientIncrease;
      console.log('Fee Analysis:', {
        expectedFee: feeAmount.toString(),
        actualFee: actualFee.toString(),
        feeWasDeducted: actualFee > 0,
        feeMatches: actualFee === feeAmount
      });
  
      await checkTokenAndGetInfo(wallet.publicKey.toString());
      return signature;
  
    } catch (error: any) {
      console.error('Transfer error:', error);
      throw new Error(error.message || "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };
  const checkTokenAndGetInfo = async (walletAddress: string) => {
    if (!walletAddress) {
      if (hasToken || balance > 0) {  // Only update if needed
        setHasToken(false);
        setBalance(0);
      }
      setError("Invalid wallet address");
      return;
    }

    try {
      setTokenCheckLoading(true);
      setError(null);

      if (wallet?.isConnected && wallet?.publicKey) {
        // Log checking status
        console.log('Checking token status:', {
          wallet: walletAddress,
          token: TOKEN_ADDRESS,
          program: TOKEN_PROGRAM_ID.toString()
        });
        
        const tokenBalance = await getTokenBalance(walletAddress, TOKEN_ADDRESS);
        
        // Only update states if values have changed
        const hasTokens = tokenBalance > 0;
        if (hasTokens !== hasToken) {
          setHasToken(hasTokens);
        }
        if (tokenBalance !== balance) {
          setBalance(tokenBalance);
        }

        // Log final status
        console.log('Token check complete:', {
          wallet: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
          hasTokens,
          balance: tokenBalance
        });
      } else {
        if (hasToken || balance > 0) {  // Only update if needed
          setHasToken(false);
          setBalance(0);
        }
      }
    } catch (err) {
      console.error("Error checking token:", err);
      if (hasToken || balance > 0) {  // Only update if needed
        setHasToken(false);
        setBalance(0);
      }
      setError("Failed to check token in wallet");
    } finally {
      setTokenCheckLoading(false);
    }
  };

  // Function to get token (would typically redirect to a faucet or exchange)
  const getToken = async () => {
    console.log("Token acquisition not implemented");
  };

  // Check if Phantom wallet is available
  useEffect(() => {
    const getProvider = () => {
      if ("phantom" in window) {
        const provider = (window as any).phantom?.solana;
        if (provider?.isPhantom) {
          setWallet(provider);
          return provider;
        }
      }
      return null;
    };

    const provider = getProvider();

    // Setup event listeners
    if (provider) {
      // Check if already connected
      if (provider.isConnected && provider.publicKey) {
        setConnected(true);
        const address = provider.publicKey.toString();
        setPublicKey(address);
        setTimeout(() => {
          checkTokenAndGetInfo(address);
        }, 1000);
      }

      // Event listeners
      provider.on("connect", (publicKey: any) => {
        const address = publicKey.toString();
        setConnected(true);
        setPublicKey(address);
        setError(null);
        checkTokenAndGetInfo(address);
      });

      provider.on("disconnect", () => {
        setConnected(false);
        setPublicKey(null);
        setBalance(0);
        setHasToken(false);
      });

      provider.on("accountChanged", (publicKey: any) => {
        if (publicKey) {
          const address = publicKey.toString();
          setPublicKey(address);
          checkTokenAndGetInfo(address);
        } else {
          setConnected(false);
          setPublicKey(null);
          setBalance(0);
          setHasToken(false);
        }
      });
    }

    // Fetch total supply setup
    // Create a controller for the component lifetime
    const componentController = new AbortController();
    
    const fetchTotalSupply = async (abortController?: AbortController) => {
      const controller = abortController || new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${API_BASE_URL}/token/${TOKEN_ADDRESS}/total-supply`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (typeof data.totalSupply === 'number' && !isNaN(data.totalSupply)) {
          setTotalSupply(data.totalSupply);
          return;
        }
        throw new Error('Invalid total supply data from API');
      } catch (err) {
        clearTimeout(timeoutId);
        
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn("API request timed out, falling back to on-chain data");
        } else {
          console.warn("API error, falling back to on-chain data:", err);
        }
        
        if (!controller.signal.aborted) {
          try {
            const mintPubKey = new PublicKey(TOKEN_ADDRESS);
            const mintInfo = await getMint(
              connection,
              mintPubKey,
              'confirmed',
              TOKEN_PROGRAM_ID
            );
            
            const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
            console.log(`Retrieved on-chain total supply: ${totalSupply}`);
            setTotalSupply(totalSupply);
          } catch (fallbackErr) {
            console.error("Failed to fetch total supply from both API and chain:", fallbackErr);
            // Keep the last known total supply instead of setting to 0
            // Only set to 0 if we don't have any previous value
            if (totalSupply === 0) {
              setTotalSupply(0);
            }
          }
        }
      }
    };

    // Initial fetch and interval setup
    fetchTotalSupply(componentController);
    const interval = setInterval(() => fetchTotalSupply(componentController), 30000);

    // Cleanup function
    return () => {
      clearInterval(interval);
      componentController.abort(); // Abort any ongoing fetches
      if (provider) {
        provider.removeAllListeners();
      }
    };
  }, []);  // Empty dependency array since we want this to run once on mount

  const connectWallet = async () => {
    if (!wallet) {
      setError("Phantom wallet not found. Please install Phantom wallet extension.")
      return
    }

    try {
      setConnecting(true)
      setError(null)

      const response = await wallet.connect()
      const address = response.publicKey.toString()
      setConnected(true)
      setPublicKey(address)

      // Check if wallet has the token
      await checkTokenAndGetInfo(address)
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet")
      console.error("Wallet connection error:", err)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    if (!wallet) return

    try {
      await wallet.disconnect()
      setConnected(false)
      setPublicKey(null)
      setBalance(0)
      setHasToken(false)
      setShowTokenModal(false)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to disconnect wallet")
      console.error("Wallet disconnection error:", err)
    }
  }

  const value: WalletContextType = {
    wallet,
    connected,
    connecting,
    walletAddress : publicKey,
    balance,
    totalSupply,
    tokenAddress: TOKEN_ADDRESS,
    hasToken,
    tokenCheckLoading,
    showTokenModal,
    setShowTokenModal,
    connectWallet,
    disconnectWallet,
    getToken,
    transfer,         // Add this
    isTransferring,   // Add this
    error,
    connection,
    
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
