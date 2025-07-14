import { PublicKey } from '@solana/web3.js';

// Types for circuit breaker system
interface CircuitBreakerState {
    isActive: boolean;
    trigger: string;
    triggeredAt: number;
    triggeredBy: string;
    autoResetTime?: number;
    manualOverride: boolean;
}

interface PriceAnomalyData {
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    changePercent: number;
    timestamp: number;
}

interface VolumeData {
    symbol: string;
    currentVolume: number;
    averageVolume: number;
    volumeSpike: number;
    timestamp: number;
}

interface RebalanceMetrics {
    frequency: number;
    totalValueMoved: number;
    largestSingleMove: number;
    timeWindow: number;
}

interface CircuitBreakerConfig {
    // Price anomaly thresholds
    MAX_PRICE_CHANGE_5MIN: number;
    MAX_PRICE_CHANGE_1HOUR: number;
    MAX_PRICE_CHANGE_24HOUR: number;
    
    // Volume spike detection
    VOLUME_SPIKE_THRESHOLD: number;
    MIN_VOLUME_SAMPLE_SIZE: number;
    
    // Rebalancing limits
    MAX_REBALANCES_PER_DAY: number;
    MAX_REBALANCES_PER_HOUR: number;
    MAX_VALUE_MOVED_PER_DAY: number;
    MAX_SINGLE_REBALANCE_SIZE: number;
    
    // Oracle validation
    MAX_ORACLE_DEVIATION: number;
    MIN_ORACLE_SOURCES: number;
    ORACLE_STALENESS_THRESHOLD: number;
    
    // System health
    MAX_CONSECUTIVE_FAILURES: number;
    MIN_LIQUIDITY_THRESHOLD: number;
    
    // Auto-reset timers
    AUTO_RESET_DELAY: number;
    MANUAL_OVERRIDE_TIMEOUT: number;
    
    // Governance
    GOVERNANCE_ADDRESSES: string[];
    EMERGENCY_PAUSE_DURATION: number;
}

// Default configuration
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    // Price anomaly thresholds (in percentage)
    MAX_PRICE_CHANGE_5MIN: 3.0,     // 3% in 5 minutes
    MAX_PRICE_CHANGE_1HOUR: 8.0,    // 8% in 1 hour
    MAX_PRICE_CHANGE_24HOUR: 25.0,  // 25% in 24 hours
    
    // Volume spike detection
    VOLUME_SPIKE_THRESHOLD: 5.0,    // 5x average volume
    MIN_VOLUME_SAMPLE_SIZE: 10,     // Minimum samples for volume average
    
    // Rebalancing limits
    MAX_REBALANCES_PER_DAY: 6,      // Maximum 6 rebalances per day
    MAX_REBALANCES_PER_HOUR: 2,     // Maximum 2 rebalances per hour
    MAX_VALUE_MOVED_PER_DAY: 500000, // $500K maximum daily movement
    MAX_SINGLE_REBALANCE_SIZE: 100000, // $100K maximum single rebalance
    
    // Oracle validation
    MAX_ORACLE_DEVIATION: 2.0,      // 2% maximum deviation between oracles
    MIN_ORACLE_SOURCES: 3,          // Minimum 3 oracle sources
    ORACLE_STALENESS_THRESHOLD: 300000, // 5 minutes staleness
    
    // System health
    MAX_CONSECUTIVE_FAILURES: 5,    // Maximum 5 consecutive failures
    MIN_LIQUIDITY_THRESHOLD: 10000, // Minimum $10K liquidity
    
    // Auto-reset timers
    AUTO_RESET_DELAY: 30 * 60 * 1000,        // 30 minutes
    MANUAL_OVERRIDE_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    
    // Governance
    GOVERNANCE_ADDRESSES: [],
    EMERGENCY_PAUSE_DURATION: 6 * 60 * 60 * 1000, // 6 hours
};

// Global state
let CIRCUIT_BREAKER_STATE: CircuitBreakerState = {
    isActive: false,
    trigger: '',
    triggeredAt: 0,
    triggeredBy: '',
    manualOverride: false
};

let PRICE_HISTORY_SHORT: Array<{timestamp: number, prices: Record<string, number>}> = [];
let VOLUME_HISTORY: Array<{timestamp: number, volumes: Record<string, number>}> = [];
let REBALANCE_HISTORY: Array<{timestamp: number, valueMoved: number, trigger: string}> = [];
let ORACLE_FAILURE_COUNT = 0;
let SYSTEM_FAILURE_COUNT = 0;

class EmergencyCircuitBreaker {
    private config: CircuitBreakerConfig;
    
    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    }
    
    /**
     * Main circuit breaker check - called before any critical operation
     */
    public checkCircuitBreaker(operation: string, context: any = {}): boolean {
        // Check if already triggered
        if (CIRCUIT_BREAKER_STATE.isActive) {
            console.log(`🚨 Circuit breaker active - blocking ${operation}`);
            return false;
        }
        
        // Check auto-reset conditions
        this.checkAutoReset();
        
        // If still active after auto-reset check, block operation
        if (CIRCUIT_BREAKER_STATE.isActive) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check for price anomalies that should trigger circuit breaker
     */
    public checkPriceAnomalies(currentPrices: Record<string, number>): boolean {
        const now = Date.now();
        
        // Store current prices
        PRICE_HISTORY_SHORT.push({ timestamp: now, prices: currentPrices });
        
        // Clean old data (keep last 24 hours)
        const cutoff = now - 24 * 60 * 60 * 1000;
        PRICE_HISTORY_SHORT = PRICE_HISTORY_SHORT.filter(entry => entry.timestamp > cutoff);
        
        // Check each asset for anomalies
        for (const [symbol, currentPrice] of Object.entries(currentPrices)) {
            // Skip stablecoins
            if (symbol === 'USD') continue;
            
            const anomalies = this.detectPriceAnomalies(symbol, currentPrice);
            if (anomalies.length > 0) {
                this.triggerCircuitBreaker(
                    `Price anomaly detected for ${symbol}`,
                    `PRICE_ANOMALY_${symbol}`,
                    anomalies
                );
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detect price anomalies for a specific asset
     */
    private detectPriceAnomalies(symbol: string, currentPrice: number): PriceAnomalyData[] {
        const anomalies: PriceAnomalyData[] = [];
        const now = Date.now();
        
        // Check 5-minute change
        const price5MinAgo = this.getPriceAtTime(symbol, now - 5 * 60 * 1000);
        if (price5MinAgo) {
            const change5Min = Math.abs((currentPrice - price5MinAgo) / price5MinAgo * 100);
            if (change5Min > this.config.MAX_PRICE_CHANGE_5MIN) {
                anomalies.push({
                    symbol,
                    currentPrice,
                    previousPrice: price5MinAgo,
                    changePercent: change5Min,
                    timestamp: now
                });
            }
        }
        
        // Check 1-hour change
        const price1HourAgo = this.getPriceAtTime(symbol, now - 60 * 60 * 1000);
        if (price1HourAgo) {
            const change1Hour = Math.abs((currentPrice - price1HourAgo) / price1HourAgo * 100);
            if (change1Hour > this.config.MAX_PRICE_CHANGE_1HOUR) {
                anomalies.push({
                    symbol,
                    currentPrice,
                    previousPrice: price1HourAgo,
                    changePercent: change1Hour,
                    timestamp: now
                });
            }
        }
        
        // Check 24-hour change
        const price24HourAgo = this.getPriceAtTime(symbol, now - 24 * 60 * 60 * 1000);
        if (price24HourAgo) {
            const change24Hour = Math.abs((currentPrice - price24HourAgo) / price24HourAgo * 100);
            if (change24Hour > this.config.MAX_PRICE_CHANGE_24HOUR) {
                anomalies.push({
                    symbol,
                    currentPrice,
                    previousPrice: price24HourAgo,
                    changePercent: change24Hour,
                    timestamp: now
                });
            }
        }
        
        return anomalies;
    }
    
    /**
     * Check volume spikes that might indicate manipulation
     */
    public checkVolumeSpikes(currentVolumes: Record<string, number>): boolean {
        const now = Date.now();
        
        // Store current volumes
        VOLUME_HISTORY.push({ timestamp: now, volumes: currentVolumes });
        
        // Clean old data (keep last 24 hours)
        const cutoff = now - 24 * 60 * 60 * 1000;
        VOLUME_HISTORY = VOLUME_HISTORY.filter(entry => entry.timestamp > cutoff);
        
        // Check for volume spikes
        for (const [symbol, currentVolume] of Object.entries(currentVolumes)) {
            const averageVolume = this.calculateAverageVolume(symbol);
            if (averageVolume > 0) {
                const volumeSpike = currentVolume / averageVolume;
                if (volumeSpike > this.config.VOLUME_SPIKE_THRESHOLD) {
                    this.triggerCircuitBreaker(
                        `Volume spike detected for ${symbol}: ${volumeSpike.toFixed(2)}x average`,
                        `VOLUME_SPIKE_${symbol}`,
                        { symbol, currentVolume, averageVolume, volumeSpike, timestamp: now }
                    );
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check rebalancing frequency and size limits
     */
    public checkRebalancingLimits(valueMoved: number, trigger: string): boolean {
        const now = Date.now();
        
        // Store rebalance record
        REBALANCE_HISTORY.push({ timestamp: now, valueMoved, trigger });
        
        // Clean old data
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        
        REBALANCE_HISTORY = REBALANCE_HISTORY.filter(entry => entry.timestamp > oneDayAgo);
        
        // Check single rebalance size
        if (valueMoved > this.config.MAX_SINGLE_REBALANCE_SIZE) {
            this.triggerCircuitBreaker(
                `Single rebalance size exceeded: $${valueMoved.toLocaleString()}`,
                'REBALANCE_SIZE_EXCEEDED',
                { valueMoved, limit: this.config.MAX_SINGLE_REBALANCE_SIZE }
            );
            return true;
        }
        
        // Check daily rebalance frequency
        const dailyRebalances = REBALANCE_HISTORY.length;
        if (dailyRebalances > this.config.MAX_REBALANCES_PER_DAY) {
            this.triggerCircuitBreaker(
                `Daily rebalance limit exceeded: ${dailyRebalances} rebalances`,
                'DAILY_REBALANCE_LIMIT',
                { count: dailyRebalances, limit: this.config.MAX_REBALANCES_PER_DAY }
            );
            return true;
        }
        
        // Check hourly rebalance frequency
        const hourlyRebalances = REBALANCE_HISTORY.filter(entry => entry.timestamp > oneHourAgo).length;
        if (hourlyRebalances > this.config.MAX_REBALANCES_PER_HOUR) {
            this.triggerCircuitBreaker(
                `Hourly rebalance limit exceeded: ${hourlyRebalances} rebalances`,
                'HOURLY_REBALANCE_LIMIT',
                { count: hourlyRebalances, limit: this.config.MAX_REBALANCES_PER_HOUR }
            );
            return true;
        }
        
        // Check daily value moved
        const dailyValueMoved = REBALANCE_HISTORY.reduce((sum, entry) => sum + entry.valueMoved, 0);
        if (dailyValueMoved > this.config.MAX_VALUE_MOVED_PER_DAY) {
            this.triggerCircuitBreaker(
                `Daily value moved limit exceeded: $${dailyValueMoved.toLocaleString()}`,
                'DAILY_VALUE_LIMIT',
                { valueMoved: dailyValueMoved, limit: this.config.MAX_VALUE_MOVED_PER_DAY }
            );
            return true;
        }
        
        return false;
    }
    
    /**
     * Validate oracle data for manipulation
     */
    public validateOracleData(oracleData: Array<{source: string, price: number, timestamp: number}>): boolean {
        if (oracleData.length < this.config.MIN_ORACLE_SOURCES) {
            this.incrementFailureCount('oracle');
            return false;
        }
        
        const now = Date.now();
        const validSources = oracleData.filter(data => 
            (now - data.timestamp) < this.config.ORACLE_STALENESS_THRESHOLD
        );
        
        if (validSources.length < this.config.MIN_ORACLE_SOURCES) {
            this.incrementFailureCount('oracle');
            return false;
        }
        
        // Check for price deviation between sources
        const prices = validSources.map(data => data.price);
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        for (const price of prices) {
            const deviation = Math.abs((price - avgPrice) / avgPrice * 100);
            if (deviation > this.config.MAX_ORACLE_DEVIATION) {
                this.triggerCircuitBreaker(
                    `Oracle price deviation exceeded: ${deviation.toFixed(2)}%`,
                    'ORACLE_DEVIATION',
                    { deviation, limit: this.config.MAX_ORACLE_DEVIATION, prices }
                );
                return false;
            }
        }
        
        // Reset failure count on success
        ORACLE_FAILURE_COUNT = 0;
        return true;
    }
    
    /**
     * Manual emergency pause (governance only)
     */
    public emergencyPause(authorityAddress: string, reason: string): boolean {
        if (!this.config.GOVERNANCE_ADDRESSES.includes(authorityAddress)) {
            console.log(`🚫 Unauthorized emergency pause attempt by ${authorityAddress}`);
            return false;
        }
        
        this.triggerCircuitBreaker(
            `Manual emergency pause: ${reason}`,
            'MANUAL_EMERGENCY_PAUSE',
            { authorityAddress, reason },
            this.config.EMERGENCY_PAUSE_DURATION
        );
        
        return true;
    }
    
    /**
     * Manual override to reset circuit breaker (governance only)
     */
    public manualOverride(authorityAddress: string, reason: string): boolean {
        if (!this.config.GOVERNANCE_ADDRESSES.includes(authorityAddress)) {
            console.log(`🚫 Unauthorized manual override attempt by ${authorityAddress}`);
            return false;
        }
        
        console.log(`🔧 Manual override activated by ${authorityAddress}: ${reason}`);
        
        CIRCUIT_BREAKER_STATE = {
            isActive: false,
            trigger: '',
            triggeredAt: 0,
            triggeredBy: '',
            manualOverride: true
        };
        
        // Set timeout for manual override
        setTimeout(() => {
            CIRCUIT_BREAKER_STATE.manualOverride = false;
            console.log('🔧 Manual override timeout expired');
        }, this.config.MANUAL_OVERRIDE_TIMEOUT);
        
        return true;
    }
    
    /**
     * Get current circuit breaker status
     */
    public getStatus(): {
        isActive: boolean;
        trigger: string;
        triggeredAt: number;
        timeRemaining: number;
        recentMetrics: {
            rebalanceCount24h: number;
            totalValueMoved24h: number;
            oracleFailures: number;
            systemFailures: number;
        };
    } {
        const now = Date.now();
        const timeRemaining = CIRCUIT_BREAKER_STATE.autoResetTime ? 
            Math.max(0, CIRCUIT_BREAKER_STATE.autoResetTime - now) : 0;
        
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const recentRebalances = REBALANCE_HISTORY.filter(entry => entry.timestamp > oneDayAgo);
        
        return {
            isActive: CIRCUIT_BREAKER_STATE.isActive,
            trigger: CIRCUIT_BREAKER_STATE.trigger,
            triggeredAt: CIRCUIT_BREAKER_STATE.triggeredAt,
            timeRemaining,
            recentMetrics: {
                rebalanceCount24h: recentRebalances.length,
                totalValueMoved24h: recentRebalances.reduce((sum, entry) => sum + entry.valueMoved, 0),
                oracleFailures: ORACLE_FAILURE_COUNT,
                systemFailures: SYSTEM_FAILURE_COUNT
            }
        };
    }
    
    // Private helper methods
    
    private triggerCircuitBreaker(
        message: string, 
        trigger: string, 
        context: any = {}, 
        duration?: number
    ): void {
        const now = Date.now();
        
        console.log(`🚨 CIRCUIT BREAKER TRIGGERED: ${message}`);
        console.log(`🔍 Context:`, context);
        
        CIRCUIT_BREAKER_STATE = {
            isActive: true,
            trigger,
            triggeredAt: now,
            triggeredBy: message,
            autoResetTime: duration ? now + duration : now + this.config.AUTO_RESET_DELAY,
            manualOverride: false
        };

        
        
        // Log to external monitoring system
        this.logToMonitoring(message, trigger, context);
    }
    
    private checkAutoReset(): void {
        if (!CIRCUIT_BREAKER_STATE.isActive || CIRCUIT_BREAKER_STATE.manualOverride) {
            return;
        }
        
        const now = Date.now();
        if (CIRCUIT_BREAKER_STATE.autoResetTime && now >= CIRCUIT_BREAKER_STATE.autoResetTime) {
            console.log('🔄 Circuit breaker auto-reset triggered');
            
            CIRCUIT_BREAKER_STATE = {
                isActive: false,
                trigger: '',
                triggeredAt: 0,
                triggeredBy: '',
                manualOverride: false
            };
            
            // Reset failure counts
            ORACLE_FAILURE_COUNT = 0;
            SYSTEM_FAILURE_COUNT = 0;
        }
    }
    
    private getPriceAtTime(symbol: string, targetTime: number): number | null {
        let closestEntry = null;
        let minTimeDiff = Infinity;
        
        for (const entry of PRICE_HISTORY_SHORT) {
            const timeDiff = Math.abs(entry.timestamp - targetTime);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestEntry = entry;
            }
        }
        
        return closestEntry?.prices[symbol] || null;
    }
    
    private calculateAverageVolume(symbol: string): number {
        const volumes = VOLUME_HISTORY
            .map(entry => entry.volumes[symbol])
            .filter(vol => vol !== undefined);
        
        if (volumes.length < this.config.MIN_VOLUME_SAMPLE_SIZE) {
            return 0;
        }
        
        return volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    }
    
    private incrementFailureCount(type: 'oracle' | 'system'): void {
        if (type === 'oracle') {
            ORACLE_FAILURE_COUNT++;
            if (ORACLE_FAILURE_COUNT >= this.config.MAX_CONSECUTIVE_FAILURES) {
                this.triggerCircuitBreaker(
                    `Oracle failure threshold exceeded: ${ORACLE_FAILURE_COUNT} failures`,
                    'ORACLE_FAILURE_THRESHOLD',
                    { failureCount: ORACLE_FAILURE_COUNT }
                );
            }
        } else {
            SYSTEM_FAILURE_COUNT++;
            if (SYSTEM_FAILURE_COUNT >= this.config.MAX_CONSECUTIVE_FAILURES) {
                this.triggerCircuitBreaker(
                    `System failure threshold exceeded: ${SYSTEM_FAILURE_COUNT} failures`,
                    'SYSTEM_FAILURE_THRESHOLD',
                    { failureCount: SYSTEM_FAILURE_COUNT }
                );
            }
        }
    }
    
    private logToMonitoring(message: string, trigger: string, context: any): void {
        // Implementation for external monitoring/alerting
        console.log('📡 Sending alert to monitoring system:', {
            timestamp: new Date().toISOString(),
            message,
            trigger,
            context
        });
    }
}

// Export singleton instance
export const circuitBreaker = new EmergencyCircuitBreaker();

// Export configuration for customization
export { DEFAULT_CIRCUIT_BREAKER_CONFIG, EmergencyCircuitBreaker };

// Export types
export type {
    CircuitBreakerState,
    CircuitBreakerConfig,
    PriceAnomalyData,
    VolumeData,
    RebalanceMetrics
};