import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { circuitBreaker } from './emergency-breaker';
import swapIdl from '../../abi/swap.json';

// Circuit breaker integration for the swap contract
interface SwapCircuitBreakerConfig {
    swapProgramId: PublicKey;
    swapStateAccount: PublicKey;
    authorityKeypair: Keypair;
    connection: Connection;
    volatilityThresholdBps: number; // 2500 = 25%
    pauseDurationMinutes: number;   // 30 minutes default
    maxPauseDurationHours: number;  // 4 hours maximum
}

interface SwapPauseStatus {
    isPaused: boolean;
    pauseReason: string;
    pausedAt: number;
    resumeAt: number;
    canManualResume: boolean;
    currentVolatility?: number;
}

class SwapCircuitBreaker {
    private config: SwapCircuitBreakerConfig;
    private program: Program;
    private provider: AnchorProvider;
    private monitoringInterval?: NodeJS.Timeout;
    private lastPrices: Record<string, number> = {};
    private pauseStatus: SwapPauseStatus = {
        isPaused: false,
        pauseReason: '',
        pausedAt: 0,
        resumeAt: 0,
        canManualResume: true
    };

    constructor(config: SwapCircuitBreakerConfig) {
        this.config = config;
        
        // Set up Anchor provider and program
        this.provider = new AnchorProvider(
            config.connection,
            { publicKey: config.authorityKeypair.publicKey } as any,
            { commitment: 'confirmed' }
        );
        
        this.program = new Program(swapIdl as any, this.provider);
    }

    /**
     * Start monitoring price volatility and circuit breaker status
     */
    public startMonitoring(intervalMs: number = 30000): void {
        console.log('🚨 Starting Swap Circuit Breaker monitoring...');
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkAndHandleCircuitBreaker();
                await this.checkAutomaticResume();
            } catch (error) {
                console.error('❌ Error in circuit breaker monitoring:', error);
            }
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    public stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
            console.log('🛑 Stopped Swap Circuit Breaker monitoring');
        }
    }

    /**
     * Main circuit breaker check - monitors volatility and pauses if needed
     */
    private async checkAndHandleCircuitBreaker(): Promise<void> {
        // Skip if already paused
        if (this.pauseStatus.isPaused) {
            return;
        }

        // Get current state from the swap contract
        const swapState = await this.getSwapState();
        if (!swapState) {
            console.warn('⚠️ Could not fetch swap state');
            return;
        }

        // Check if emergency circuit breaker is triggered
        const circuitBreakerStatus = circuitBreaker.getStatus();
        if (circuitBreakerStatus.isActive) {
            console.log('🚨 Emergency circuit breaker is active - pausing swaps');
            await this.pauseSwapContract('EMERGENCY_CIRCUIT_BREAKER', 'Emergency circuit breaker triggered');
            return;
        }

        // Check price volatility
        const currentPrices = {
            'APM/USD': swapState.apmPrice / 1e9, // Convert from 9 decimal places
            'USDC/USD': swapState.usdcPrice / 1e9,
            'USDT/USD': swapState.usdtPrice / 1e9
        };

        await this.checkPriceVolatility(currentPrices);
    }

    /**
     * Check for extreme price volatility
     */
    private async checkPriceVolatility(currentPrices: Record<string, number>): Promise<void> {
        const now = Date.now();

        // Store first prices if not available
        if (Object.keys(this.lastPrices).length === 0) {
            this.lastPrices = { ...currentPrices };
            return;
        }

        // Check each asset for volatility
        for (const [symbol, currentPrice] of Object.entries(currentPrices)) {
            const previousPrice = this.lastPrices[symbol];
            if (!previousPrice || previousPrice === 0) continue;

            const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice * 100);
            const changePercentBps = changePercent * 100; // Convert to basis points

            console.log(`📊 ${symbol} price change: ${changePercent.toFixed(2)}% (${changePercentBps.toFixed(0)} bps)`);

            // Check if volatility exceeds threshold
            if (changePercentBps >= this.config.volatilityThresholdBps) {
                console.log(`🚨 EXTREME VOLATILITY DETECTED for ${symbol}: ${changePercent.toFixed(2)}%`);
                
                await this.pauseSwapContract(
                    'PRICE_VOLATILITY', 
                    `Extreme price volatility detected for ${symbol}: ${changePercent.toFixed(2)}% change`,
                    changePercent
                );
                
                // Update emergency circuit breaker with price anomaly
                circuitBreaker.checkPriceAnomalies(currentPrices);
                return;
            }
        }

        // Update last prices
        this.lastPrices = { ...currentPrices };
    }

    /**
     * Pause the swap contract by deactivating state
     */
    private async pauseSwapContract(
        reason: string, 
        message: string, 
        volatility?: number
    ): Promise<void> {
        try {
            console.log(`🚨 PAUSING SWAP CONTRACT: ${message}`);

            // The swap contract doesn't have a direct pause function, but we can:
            // 1. Set currentStateActive to false by expiring prices
            // 2. Set price expiration to past time to disable swaps
            
            // Method 1: Let prices expire naturally (they expire after 30 minutes)
            // Method 2: We could modify the contract to add a pause function
            // For now, we'll use a workaround by not updating prices

            const now = Date.now();
            this.pauseStatus = {
                isPaused: true,
                pauseReason: message,
                pausedAt: now,
                resumeAt: now + (this.config.pauseDurationMinutes * 60 * 1000),
                canManualResume: true,
                currentVolatility: volatility
            };

            // Log the pause event
            console.log('📋 Swap Contract Pause Details:');
            console.log(`   Reason: ${reason}`);
            console.log(`   Message: ${message}`);
            console.log(`   Paused At: ${new Date(this.pauseStatus.pausedAt).toISOString()}`);
            console.log(`   Resume At: ${new Date(this.pauseStatus.resumeAt).toISOString()}`);
            if (volatility) {
                console.log(`   Volatility: ${volatility.toFixed(2)}%`);
            }

            // Since the current contract design uses price expiration as the pause mechanism,
            // we'll avoid updating prices while paused and let them naturally expire
            // This effectively pauses swaps after the current price expiration (30 minutes)

        } catch (error) {
            console.error('❌ Failed to pause swap contract:', error);
        }
    }

    /**
     * Resume swap contract by reactivating prices
     */
    public async resumeSwapContract(manualResume: boolean = false, reason?: string): Promise<boolean> {
        try {
            if (!this.pauseStatus.isPaused) {
                console.log('⚠️ Swap contract is not currently paused');
                return false;
            }

            console.log(`✅ RESUMING SWAP CONTRACT${manualResume ? ' (Manual Override)' : ' (Automatic)'}`);
            if (reason) {
                console.log(`   Reason: ${reason}`);
            }

            // Resume by updating price expiration to extend the active period
            const tx = new Transaction();
            
            // Call updatePriceExpiration to extend swap availability
            const updatePriceExpirationIx = await this.program.methods
                .updatePriceExpiration()
                .accounts({
                    state: this.config.swapStateAccount,
                    authority: this.config.authorityKeypair.publicKey
                })
                .instruction();

            tx.add(updatePriceExpirationIx);

            // Send transaction
            const signature = await this.config.connection.sendTransaction(
                tx,
                [this.config.authorityKeypair],
                // { commitment: 'confirmed' }
            );

            console.log(`📋 Resume transaction signature: ${signature}`);

            // Reset pause status
            this.pauseStatus = {
                isPaused: false,
                pauseReason: '',
                pausedAt: 0,
                resumeAt: 0,
                canManualResume: true
            };

            console.log('🔓 Swap contract resumed successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to resume swap contract:', error);
            return false;
        }
    }

    /**
     * Check if automatic resume conditions are met
     */
    private async checkAutomaticResume(): Promise<void> {
        if (!this.pauseStatus.isPaused) {
            return;
        }

        const now = Date.now();

        // Check if pause duration has elapsed
        if (now >= this.pauseStatus.resumeAt) {
            // Check if circuit breaker is still active
            const circuitBreakerStatus = circuitBreaker.getStatus();
            
            if (!circuitBreakerStatus.isActive) {
                console.log('⏰ Automatic resume timer expired and circuit breaker is inactive');
                await this.resumeSwapContract(false, 'Automatic resume after pause duration elapsed');
            } else {
                console.log('⚠️ Pause timer expired but circuit breaker is still active - extending pause');
                // Extend pause duration
                this.pauseStatus.resumeAt = now + (this.config.pauseDurationMinutes * 60 * 1000);
            }
        }

        // Check for safety maximum pause duration
        const maxPauseDuration = this.config.maxPauseDurationHours * 60 * 60 * 1000;
        if (now - this.pauseStatus.pausedAt >= maxPauseDuration) {
            console.log('🚨 Maximum pause duration exceeded - forcing resume');
            await this.resumeSwapContract(false, 'Safety maximum pause duration exceeded');
        }
    }

    /**
     * Manual emergency resume (governance/admin only)
     */
    public async emergencyResume(authorityAddress: string, reason: string): Promise<boolean> {
        // Note: In production, you should verify the authority address against a governance list
        console.log(`🔧 Emergency manual resume requested by ${authorityAddress}: ${reason}`);
        
        return await this.resumeSwapContract(true, `Manual emergency resume by ${authorityAddress}: ${reason}`);
    }

    /**
     * Get current pause status
     */
    public getPauseStatus(): SwapPauseStatus {
        const now = Date.now();
        return {
            ...this.pauseStatus,
            // Add time remaining if paused
            ...(this.pauseStatus.isPaused ? {
                timeRemainingMs: Math.max(0, this.pauseStatus.resumeAt - now)
            } : {})
        } as SwapPauseStatus & { timeRemainingMs?: number };
    }

    /**
     * Get current swap state from the contract
     */
    private async getSwapState(): Promise<any> {
        try {
            const state = await this.program.account.swapState.fetch(this.config.swapStateAccount);
            return state;
        } catch (error) {
            console.error('Failed to fetch swap state:', error);
            return null;
        }
    }

    /**
     * Check if swaps are currently allowed (public method for integration)
     */
    public async areSwapsAllowed(): Promise<{
        allowed: boolean;
        reason?: string;
        pauseStatus?: SwapPauseStatus;
    }> {
        // Check local pause status first
        if (this.pauseStatus.isPaused) {
            return {
                allowed: false,
                reason: this.pauseStatus.pauseReason,
                pauseStatus: this.getPauseStatus()
            };
        }

        // Check contract state
        const swapState = await this.getSwapState();
        if (!swapState) {
            return {
                allowed: false,
                reason: 'Unable to fetch swap contract state'
            };
        }

        // Check if prices are expired (contract's built-in pause mechanism)
        const currentTime = Math.floor(Date.now() / 1000);
        if (!swapState.currentStateActive || currentTime >= swapState.priceUpdated) {
            return {
                allowed: false,
                reason: 'Swap prices have expired - contract is paused'
            };
        }

        // Check emergency circuit breaker
        const circuitBreakerStatus = circuitBreaker.getStatus();
        if (circuitBreakerStatus.isActive) {
            return {
                allowed: false,
                reason: `Emergency circuit breaker active: ${circuitBreakerStatus.trigger}`
            };
        }

        return { allowed: true };
    }
}

// Factory function to create and initialize the swap circuit breaker
export function createSwapCircuitBreaker(config: {
    swapProgramId: string;
    swapStateAccount: string;
    authorityPrivateKey: string; // Comma-separated array or base58 string
    rpcUrl: string;
    volatilityThresholdBps?: number;
    pauseDurationMinutes?: number;
    maxPauseDurationHours?: number;
}): SwapCircuitBreaker {
    
    // Parse private key
    let authorityKeypair: Keypair;
    try {
        if (config.authorityPrivateKey.includes(',')) {
            // Array format: "1,2,3,4..."
            const keyArray = config.authorityPrivateKey.split(',').map(num => parseInt(num.trim()));
            authorityKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } else {
            // Base58 format
            const keyBytes = Uint8Array.from(Buffer.from(config.authorityPrivateKey, 'base58'));
            authorityKeypair = Keypair.fromSecretKey(keyBytes);
        }
    } catch (error:any) {
        throw new Error(`Failed to parse authority private key: ${error.message}`);
    }

    const swapCircuitBreakerConfig: SwapCircuitBreakerConfig = {
        swapProgramId: new PublicKey(config.swapProgramId),
        swapStateAccount: new PublicKey(config.swapStateAccount),
        authorityKeypair,
        connection: new Connection(config.rpcUrl, 'confirmed'),
        volatilityThresholdBps: config.volatilityThresholdBps || 2500, // 25%
        pauseDurationMinutes: config.pauseDurationMinutes || 30,
        maxPauseDurationHours: config.maxPauseDurationHours || 4
    };

    return new SwapCircuitBreaker(swapCircuitBreakerConfig);
}

export { SwapCircuitBreaker };
export type { SwapCircuitBreakerConfig, SwapPauseStatus };
