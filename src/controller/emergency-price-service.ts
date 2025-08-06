import { circuitBreaker } from './emergency-breaker';
import { createSwapCircuitBreaker, SwapCircuitBreaker } from './swap-circuit-breaker';
import { calculateAPMPrice, resetBaseline, getCircuitBreakerStatus } from './calculate-price';
import { fetchPrices, PriceResponse } from './price-feed';

interface EmergencyPriceServiceConfig {
    swapProgramId: string;
    swapStateAccount: string;
    authorityPrivateKey: string;
    rpcUrl: string;
    priceUpdateInterval: number; // milliseconds
    volatilityCheckEnabled: boolean;
    autoResumeEnabled: boolean;
}

interface PriceUpdateResult {
    success: boolean;
    prices?: any;
    error?: string;
    circuitBreakerTriggered?: boolean;
    swapsPaused?: boolean;
    message?: string;
}

class EmergencyPriceService {
    private config: EmergencyPriceServiceConfig;
    private swapCircuitBreaker?: SwapCircuitBreaker;
    private priceUpdateInterval?: NodeJS.Timeout;
    private lastSuccessfulUpdate: number = 0;
    private consecutiveFailures: number = 0;
    private isRunning: boolean = false;

    constructor(config: EmergencyPriceServiceConfig) {
        this.config = config;
    }

    /**
     * Initialize the emergency price service
     */
    public async initialize(): Promise<void> {
        try {
            console.log('🚀 Initializing Emergency Price Service...');

            // Initialize swap circuit breaker
            this.swapCircuitBreaker = createSwapCircuitBreaker({
                swapProgramId: this.config.swapProgramId,
                swapStateAccount: this.config.swapStateAccount,
                authorityPrivateKey: this.config.authorityPrivateKey,
                rpcUrl: this.config.rpcUrl,
                volatilityThresholdBps: 2500, // 25%
                pauseDurationMinutes: 30,
                maxPauseDurationHours: 4
            });

            // Start swap circuit breaker monitoring
            this.swapCircuitBreaker.startMonitoring();

            console.log('✅ Emergency Price Service initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Emergency Price Service:', error);
            throw error;
        }
    }

    /**
     * Start the emergency price service with automatic updates
     */
    public start(): void {
        if (this.isRunning) {
            console.log('⚠️ Emergency Price Service is already running');
            return;
        }

        console.log(`🔄 Starting Emergency Price Service with ${this.config.priceUpdateInterval / 1000}s intervals...`);
        this.isRunning = true;

        // Start price update loop
        this.priceUpdateInterval = setInterval(async () => {
            try {
                await this.updatePricesWithSafety();
            } catch (error) {
                console.error('❌ Error in price update loop:', error);
                this.handleUpdateFailure();
            }
        }, this.config.priceUpdateInterval);

        // Run initial update
        this.updatePricesWithSafety().catch(console.error);
    }

    /**
     * Stop the emergency price service
     */
    public stop(): void {
        if (!this.isRunning) {
            console.log('⚠️ Emergency Price Service is not running');
            return;
        }

        console.log('🛑 Stopping Emergency Price Service...');
        this.isRunning = false;

        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
            this.priceUpdateInterval = undefined;
        }

        if (this.swapCircuitBreaker) {
            this.swapCircuitBreaker.stopMonitoring();
        }

        console.log('✅ Emergency Price Service stopped');
    }

    /**
     * Update prices with safety checks and circuit breaker integration
     */
    private async updatePricesWithSafety(): Promise<PriceUpdateResult> {
        try {
            // Check if emergency circuit breaker is active
            const emergencyStatus = circuitBreaker.getStatus();
            if (emergencyStatus.isActive) {
                console.log('🚨 Emergency circuit breaker is active - skipping price update');
                return {
                    success: false,
                    circuitBreakerTriggered: true,
                    message: `Emergency circuit breaker active: ${emergencyStatus.trigger}`
                };
            }

            // Check if swaps are allowed
            if (this.swapCircuitBreaker) {
                const swapStatus = await this.swapCircuitBreaker.areSwapsAllowed();
                if (!swapStatus.allowed) {
                    console.log('🚫 Swaps are not allowed - checking if we should resume');
                    
                    // If swaps are paused due to price expiration (not volatility), we can update prices to resume
                    if (swapStatus.reason?.includes('expired')) {
                        console.log('💡 Attempting to resume swaps by updating prices');
                    } else {
                        return {
                            success: false,
                            swapsPaused: true,
                            message: swapStatus.reason || 'Swaps are paused'
                        };
                    }
                }
            }

            // Fetch latest prices from oracles
            console.log('📊 Fetching latest price data...');
            const priceData = await fetchPrices();

            // Validate price data quality
            const validationResult = this.validatePriceData(priceData);
            if (!validationResult.valid) {
                throw new Error(`Price data validation failed: ${validationResult.reason}`);
            }

            // Check for price anomalies before updating
            if (this.config.volatilityCheckEnabled) {
                const priceMap = this.createPriceMap(priceData);
                const hasAnomalies = circuitBreaker.checkPriceAnomalies(priceMap);
                
                if (hasAnomalies) {
                    console.log('🚨 Price anomalies detected - emergency circuit breaker triggered');
                    return {
                        success: false,
                        circuitBreakerTriggered: true,
                        message: 'Price anomalies detected - updates halted for safety'
                    };
                }
            }

            // Calculate APM price with current data
            const apmPricing = calculateAPMPrice(priceData);
            
            // Check APM-specific circuit breaker conditions
            const apmCircuitBreakerStatus = getCircuitBreakerStatus();
            if (apmCircuitBreakerStatus.isTriggered) {
                console.log('🚨 APM circuit breaker is triggered - swaps frozen');
                return {
                    success: false,
                    prices: apmPricing,
                    circuitBreakerTriggered: true,
                    message: `APM circuit breaker triggered: ${apmCircuitBreakerStatus.reason}`
                };
            }

            // Update successful
            this.lastSuccessfulUpdate = Date.now();
            this.consecutiveFailures = 0;

            console.log('✅ Price update successful');
            console.log(`💰 APM Price: $${apmPricing.apmPrice.toFixed(6)}`);
            console.log(`📈 Market Condition: ${apmPricing.marketCondition}`);
            console.log(`🔄 Rebalance Progress: ${(apmPricing.rebalanceProgress * 100).toFixed(1)}%`);

            return {
                success: true,
                prices: apmPricing,
                circuitBreakerTriggered: false,
                swapsPaused: false
            };

        } catch (error:any) {
            console.error('❌ Error updating prices:', error);
            this.handleUpdateFailure();
            
            return {
                success: false,
                error: error.message,
                message: 'Price update failed'
            };
        }
    }

    /**
     * Manual price update (can be called externally)
     */
    public async forceUpdatePrices(): Promise<PriceUpdateResult> {
        console.log('🔧 Manual price update requested');
        return await this.updatePricesWithSafety();
    }

    /**
     * Emergency pause swaps (manual override)
     */
    public async emergencyPause(reason: string, authorityAddress: string): Promise<boolean> {
        console.log(`🚨 Emergency pause requested: ${reason}`);
        
        // Trigger emergency circuit breaker
        const emergencyPauseResult = circuitBreaker.emergencyPause(authorityAddress, reason);
        
        if (emergencyPauseResult && this.swapCircuitBreaker) {
            // Also pause the swap contract
            return await this.swapCircuitBreaker.emergencyResume(authorityAddress, reason);
        }
        
        return emergencyPauseResult;
    }

    /**
     * Emergency resume swaps (manual override)
     */
    public async emergencyResume(reason: string, authorityAddress: string): Promise<boolean> {
        console.log(`🔧 Emergency resume requested: ${reason}`);
        
        // Reset emergency circuit breaker
        const emergencyResumeResult = circuitBreaker.manualOverride(authorityAddress, reason);
        
        if (emergencyResumeResult && this.swapCircuitBreaker) {
            // Also resume the swap contract
            return await this.swapCircuitBreaker.emergencyResume(authorityAddress, reason);
        }
        
        return emergencyResumeResult;
    }

    /**
     * Get comprehensive system status
     */
    public getSystemStatus(): {
        emergencyCircuitBreaker: ReturnType<typeof circuitBreaker.getStatus>;
        apmCircuitBreaker: ReturnType<typeof getCircuitBreakerStatus>;
        swapStatus?: any;
        priceService: {
            isRunning: boolean;
            lastSuccessfulUpdate: number;
            consecutiveFailures: number;
            timeSinceLastUpdate: number;
        };
    } {
        return {
            emergencyCircuitBreaker: circuitBreaker.getStatus(),
            apmCircuitBreaker: getCircuitBreakerStatus(),
            swapStatus: this.swapCircuitBreaker?.getPauseStatus(),
            priceService: {
                isRunning: this.isRunning,
                lastSuccessfulUpdate: this.lastSuccessfulUpdate,
                consecutiveFailures: this.consecutiveFailures,
                timeSinceLastUpdate: Date.now() - this.lastSuccessfulUpdate
            }
        };
    }

    /**
     * Health check for monitoring systems
     */
    public async healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
        warnings: string[];
        status: any;
    }> {
        const issues: string[] = [];
        const warnings: string[] = [];
        const status = this.getSystemStatus();

        // Check if service is running
        if (!this.isRunning) {
            issues.push('Emergency Price Service is not running');
        }

        // Check for stale price data
        const timeSinceUpdate = Date.now() - this.lastSuccessfulUpdate;
        if (timeSinceUpdate > this.config.priceUpdateInterval * 3) {
            issues.push('Price data is stale (no successful updates recently)');
        }

        // Check consecutive failures
        if (this.consecutiveFailures >= 3) {
            issues.push(`High number of consecutive failures: ${this.consecutiveFailures}`);
        }

        // Check emergency circuit breaker
        if (status.emergencyCircuitBreaker.isActive) {
            warnings.push(`Emergency circuit breaker is active: ${status.emergencyCircuitBreaker.trigger}`);
        }

        // Check APM circuit breaker
        if (status.apmCircuitBreaker.isTriggered) {
            warnings.push(`APM circuit breaker is triggered: ${status.apmCircuitBreaker.reason}`);
        }

        return {
            healthy: issues.length === 0,
            issues,
            warnings,
            status
        };
    }

    // Private helper methods

    private validatePriceData(priceData: PriceResponse): { valid: boolean; reason?: string } {
        // Check if we have minimum required data
        if (!priceData.crypto || priceData.crypto.length === 0) {
            return { valid: false, reason: 'No crypto price data available' };
        }

        if (!priceData.preciousMetals || priceData.preciousMetals.length === 0) {
            return { valid: false, reason: 'No precious metals price data available' };
        }

        // Check for required assets
        const requiredCrypto = ['BTC/USD', 'ETH/USD'];
        const requiredMetals = ['XAU/USD', 'XAG/USD'];

        for (const required of requiredCrypto) {
            if (!priceData.crypto.find(asset => asset.symbol === required)) {
                return { valid: false, reason: `Missing required crypto asset: ${required}` };
            }
        }

        for (const required of requiredMetals) {
            if (!priceData.preciousMetals.find(asset => asset.symbol === required)) {
                return { valid: false, reason: `Missing required metal asset: ${required}` };
            }
        }

        return { valid: true };
    }

    private createPriceMap(priceData: PriceResponse): Record<string, number> {
        const priceMap: Record<string, number> = {};
        
        [...priceData.crypto, ...priceData.preciousMetals, ...priceData.forex].forEach(asset => {
            const baseSymbol = asset.symbol.split('/')[0];
            priceMap[baseSymbol] = asset.price;
        });

        return priceMap;
    }

    private handleUpdateFailure(): void {
        this.consecutiveFailures++;
        console.warn(`⚠️ Price update failure #${this.consecutiveFailures}`);

        // Trigger emergency circuit breaker if too many consecutive failures
        if (this.consecutiveFailures >= 5) {
            console.error('🚨 Too many consecutive price update failures - triggering emergency circuit breaker');
            circuitBreaker.checkCircuitBreaker('PRICE_UPDATE_FAILURES', {
                consecutiveFailures: this.consecutiveFailures
            });
        }
    }
}

// Factory function to create the service with environment variables
export function createEmergencyPriceService(): EmergencyPriceService {
    const config: EmergencyPriceServiceConfig = {
        swapProgramId: process.env.SWAP_CONTRACT_ADDRESS || '',
        swapStateAccount: process.env.SWAP_CONTRACT_STATE || '',
        authorityPrivateKey: process.env.PRIVATE_KEY || '',
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        priceUpdateInterval: 30000, // 30 seconds
        volatilityCheckEnabled: true,
        autoResumeEnabled: true
    };

    // Validate required environment variables
    if (!config.swapProgramId) {
        throw new Error('SWAP_CONTRACT_ADDRESS environment variable is required');
    }
    if (!config.swapStateAccount) {
        throw new Error('SWAP_CONTRACT_STATE environment variable is required');
    }
    if (!config.authorityPrivateKey) {
        throw new Error('PRIVATE_KEY environment variable is required');
    }

    return new EmergencyPriceService(config);
}

export { EmergencyPriceService };
export type { EmergencyPriceServiceConfig, PriceUpdateResult };
