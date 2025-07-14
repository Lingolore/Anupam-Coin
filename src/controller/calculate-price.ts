import { Connection, PublicKey } from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import { fetchPrices } from './price-feed';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Types
interface AssetPrice {
    symbol: string;
    price: number;
    emaPrice: number;
}

interface PriceData {
    crypto: AssetPrice[];
    preciousMetals: AssetPrice[];
    forex: AssetPrice[];
}

interface APMPriceResult {
    basketValue: number;
    marketCondition: MarketCondition;
    targetMarketCondition: MarketCondition;
    apmPrice: number;
    cryptoChangePercent: number;
    weights: Record<string, number>;
    targetWeights: Record<string, number>;
    rebalanceProgress: number;
    timestamp: number;
    nextRebalanceTime: number;
}

interface MarketConditionHistory {
    condition: MarketCondition;
    timestamp: number;
    changePercent: number;
}

interface RebalanceState {
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    lastRebalanceTime: number;
    rebalanceStartTime: number;
    isRebalancing: boolean;
    conditionHistory: MarketConditionHistory[];
}

interface OnChainPrice {
    price: number;
    lastUpdated: Date;
    authority: string;
}

interface UpdateResult {
    success: boolean;
    pricing?: APMPriceResult;
    txSignature?: string;
    error?: string;
}

interface PriceService {
    stop: () => void;
}

interface Wallet {
    publicKey: PublicKey;
}

type MarketCondition = 'BULL' | 'BEAR' | 'NEUTRAL';

// Load environment variables with fallbacks
function getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseFloat(value) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

// Market-based weight configurations (configurable via environment)
const MARKET_WEIGHTS = {
    NEUTRAL: {
        'USD': getEnvNumber('APM_NEUTRAL_USD', 30) / 100,
        'GBP/USD': getEnvNumber('APM_NEUTRAL_GBP', 7.5) / 100,
        'EUR/USD': getEnvNumber('APM_NEUTRAL_EUR', 7.5) / 100,
        'XAU/USD': getEnvNumber('APM_NEUTRAL_GOLD', 32) / 100,
        'XAG/USD': getEnvNumber('APM_NEUTRAL_SILVER', 5) / 100,
        'BTC/USD': getEnvNumber('APM_NEUTRAL_BTC', 10.5) / 100,
        'ETH/USD': getEnvNumber('APM_NEUTRAL_ETH', 7.5) / 100
    },
    BULL: {
        'USD': getEnvNumber('APM_BULL_USD', 25) / 100,
        'GBP/USD': getEnvNumber('APM_BULL_GBP', 7.5) / 100,
        'EUR/USD': getEnvNumber('APM_BULL_EUR', 7.5) / 100,
        'XAU/USD': getEnvNumber('APM_BULL_GOLD', 25) / 100,
        'XAG/USD': getEnvNumber('APM_BULL_SILVER', 5) / 100,
        'BTC/USD': getEnvNumber('APM_BULL_BTC', 20) / 100,
        'ETH/USD': getEnvNumber('APM_BULL_ETH', 10) / 100
    },
    BEAR: {
        'USD': getEnvNumber('APM_BEAR_USD', 35) / 100,
        'GBP/USD': getEnvNumber('APM_BEAR_GBP', 12.5) / 100,
        'EUR/USD': getEnvNumber('APM_BEAR_EUR', 12.5) / 100,
        'XAU/USD': getEnvNumber('APM_BEAR_GOLD', 25) / 100,
        'XAG/USD': getEnvNumber('APM_BEAR_SILVER', 5) / 100,
        'BTC/USD': getEnvNumber('APM_BEAR_BTC', 7) / 100,
        'ETH/USD': getEnvNumber('APM_BEAR_ETH', 3) / 100
    }
};

// Configuration
const INITIAL_BASKET_VALUE = 10000; // USD
const INITIAL_APM_PRICE = 1.00; // USD

// Circuit Breaker Configuration (configurable via environment)
const CIRCUIT_BREAKER_CONFIG = {
    EXTREME_VOLATILITY_THRESHOLD: getEnvNumber('APM_CIRCUIT_BREAKER_THRESHOLD', 25),
    CIRCUIT_BREAKER_DURATION: getEnvNumber('APM_CIRCUIT_BREAKER_DURATION_MINUTES', 30) * 60 * 1000,
    MAX_FREEZE_DURATION: getEnvNumber('APM_MAX_FREEZE_HOURS', 4) * 60 * 60 * 1000,
    AUTO_UNFREEZE_ON_NEUTRAL: getEnvBoolean('APM_AUTO_UNFREEZE_ON_NEUTRAL', true),
    MANUAL_OVERRIDE_ENABLED: getEnvBoolean('APM_MANUAL_OVERRIDE_ENABLED', true)
};

// Rebalancing Configuration (configurable via environment)
const REBALANCE_CONFIG = {
    REBALANCE_DURATION: getEnvNumber('APM_REBALANCE_DURATION_HOURS', 24) * 60 * 60 * 1000,
    MIN_REBALANCE_INTERVAL: getEnvNumber('APM_MIN_REBALANCE_INTERVAL_HOURS', 6) * 60 * 60 * 1000,
    CONDITION_STABILITY_PERIOD: getEnvNumber('APM_CONDITION_STABILITY_HOURS', 2) * 60 * 60 * 1000,
    MAX_HISTORY_SIZE: getEnvNumber('APM_MAX_HISTORY_SIZE', 100),
    EMERGENCY_REBALANCE_THRESHOLD: getEnvNumber('APM_EMERGENCY_REBALANCE_THRESHOLD', 15),
    GRADUAL_REBALANCE_STEPS: 48 // Number of steps for gradual rebalancing (30 min intervals)
};

// Time-based market condition detection (configurable via environment)
const MARKET_DETECTION_CONFIG = {
    SHORT_TERM_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
    MEDIUM_TERM_WINDOW: 7 * 24 * 60 * 60 * 1000, // 7 days
    BULL_THRESHOLD: getEnvNumber('APM_BULL_THRESHOLD', 5),
    BEAR_THRESHOLD: getEnvNumber('APM_BEAR_THRESHOLD', -5),
    WEIGHTED_AVERAGE: {
        SHORT_TERM: 0.7, // 70% weight to 24h change
        MEDIUM_TERM: 0.3  // 30% weight to 7d change
    }
};

// Store initial prices for basket calculation
let INITIAL_PRICES: Record<string, number> | null = null;

// Store price history for time-based calculations
let PRICE_HISTORY: Array<{ timestamp: number; prices: Record<string, number> }> = [];

// Circuit Breaker State
interface CircuitBreakerState {
    isTriggered: boolean;
    triggeredAt: number;
    reason: string;
    triggerChangePercent: number;
    autoUnfreezeTime: number;
    manualOverride: boolean;
}

let CIRCUIT_BREAKER_STATE: CircuitBreakerState = {
    isTriggered: false,
    triggeredAt: 0,
    reason: '',
    triggerChangePercent: 0,
    autoUnfreezeTime: 0,
    manualOverride: false
};

// Store rebalance state
let REBALANCE_STATE: RebalanceState = {
    currentWeights: { ...MARKET_WEIGHTS.NEUTRAL },
    targetWeights: { ...MARKET_WEIGHTS.NEUTRAL },
    lastRebalanceTime: 0,
    rebalanceStartTime: 0,
    isRebalancing: false,
    conditionHistory: []
};

/**
 * Validate that market weights sum to 100%
 */
function validateMarketWeights(): void {
    Object.entries(MARKET_WEIGHTS).forEach(([market, weights]) => {
        const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(total - 1.0) > 0.001) {
            throw new Error(`Market weights for ${market} don't sum to 100%: ${(total * 100).toFixed(2)}%`);
        }
        
        const cryptoTotal = (weights['BTC/USD'] + weights['ETH/USD']) * 100;
        console.log(`${market} market - Crypto allocation: ${cryptoTotal.toFixed(1)}%`);
    });
}

/**
 * Create price lookup map from fetched data
 */
function createPriceMap(priceData: PriceData): Record<string, number> {
    const { crypto, preciousMetals, forex } = priceData;
    const priceMap: Record<string, number> = {};
    
    // Add USD as base currency
    priceMap['USD'] = 1.00;
    
    // Add all other assets
    [...crypto, ...preciousMetals, ...forex].forEach((asset: AssetPrice) => {
        priceMap[asset.symbol] = asset.price;
    });
    
    return priceMap;
}

/**
 * Initialize baseline prices for basket calculation
 */
function initializeBaseline(priceData: PriceData): void {
    if (!INITIAL_PRICES) {
        INITIAL_PRICES = createPriceMap(priceData);
        console.log('  Initialized baseline prices:');
        Object.entries(INITIAL_PRICES).forEach(([symbol, price]) => {
            console.log(`${symbol}: $${price.toFixed(4)}`);
        });
    }
}

/**
 * Store price history for time-based calculations
 */
function storePriceHistory(priceData: PriceData): void {
    const currentPrices = createPriceMap(priceData);
    const timestamp = Date.now();
    
    PRICE_HISTORY.push({
        timestamp,
        prices: currentPrices
    });
    
    // Remove old entries (keep data for medium-term window + buffer)
    const cutoffTime = timestamp - (MARKET_DETECTION_CONFIG.MEDIUM_TERM_WINDOW + 24 * 60 * 60 * 1000);
    PRICE_HISTORY = PRICE_HISTORY.filter(entry => entry.timestamp > cutoffTime);
    
    console.log(`📈 Price history entries: ${PRICE_HISTORY.length}`);
}

/**
 * Calculate price change over a specific time window
 */
function calculatePriceChange(symbol: string, windowMs: number): number {
    const now = Date.now();
    const targetTime = now - windowMs;
    
    // Find the closest historical price to the target time
    let closestEntry = null;
    let minTimeDiff = Infinity;
    
    for (const entry of PRICE_HISTORY) {
        const timeDiff = Math.abs(entry.timestamp - targetTime);
        if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestEntry = entry;
        }
    }
    
    if (!closestEntry || !closestEntry.prices[symbol]) {
        return 0; // No historical data available
    }
    
    // Get current price
    const currentPrice = PRICE_HISTORY[PRICE_HISTORY.length - 1]?.prices[symbol];
    if (!currentPrice) {
        return 0;
    }
    
    // Calculate percentage change
    const historicalPrice = closestEntry.prices[symbol];
    const changePercent = ((currentPrice - historicalPrice) / historicalPrice) * 100;
    
    console.log(`  ${symbol} change over ${windowMs / (60 * 60 * 1000)}h: ${changePercent.toFixed(2)}%`);
    
    return changePercent;
}

/**
 * Detect market condition based on time-weighted crypto performance
 */
function detectMarketCondition(priceData: PriceData): { condition: MarketCondition; changePercent: number } {
    // Store current prices for history
    storePriceHistory(priceData);
    
    // Need at least some historical data for time-based detection
    if (PRICE_HISTORY.length < 2) {
        console.warn('Insufficient price history for time-based detection');
        return { condition: 'NEUTRAL', changePercent: 0 };
    }
    
    // Calculate BTC and ETH changes over different time windows
    const btcShortChange = calculatePriceChange('BTC/USD', MARKET_DETECTION_CONFIG.SHORT_TERM_WINDOW);
    const btcMediumChange = calculatePriceChange('BTC/USD', MARKET_DETECTION_CONFIG.MEDIUM_TERM_WINDOW);
    
    const ethShortChange = calculatePriceChange('ETH/USD', MARKET_DETECTION_CONFIG.SHORT_TERM_WINDOW);
    const ethMediumChange = calculatePriceChange('ETH/USD', MARKET_DETECTION_CONFIG.MEDIUM_TERM_WINDOW);
    
    // Calculate weighted average for each crypto
    const btcWeightedChange = 
        (btcShortChange * MARKET_DETECTION_CONFIG.WEIGHTED_AVERAGE.SHORT_TERM) +
        (btcMediumChange * MARKET_DETECTION_CONFIG.WEIGHTED_AVERAGE.MEDIUM_TERM);
    
    const ethWeightedChange = 
        (ethShortChange * MARKET_DETECTION_CONFIG.WEIGHTED_AVERAGE.SHORT_TERM) +
        (ethMediumChange * MARKET_DETECTION_CONFIG.WEIGHTED_AVERAGE.MEDIUM_TERM);
    
    // Average crypto change
    const avgChangePercent = (btcWeightedChange + ethWeightedChange) / 2;
    
    console.log(`🔍 Time-based market analysis:`);
    console.log(`BTC: 24h ${btcShortChange.toFixed(2)}%, 7d ${btcMediumChange.toFixed(2)}%, weighted ${btcWeightedChange.toFixed(2)}%`);
    console.log(`ETH: 24h ${ethShortChange.toFixed(2)}%, 7d ${ethMediumChange.toFixed(2)}%, weighted ${ethWeightedChange.toFixed(2)}%`);
    console.log(`Average weighted change: ${avgChangePercent.toFixed(2)}%`);
    
    // Determine market condition
    let condition: MarketCondition;
    if (avgChangePercent >= MARKET_DETECTION_CONFIG.BULL_THRESHOLD) {
        condition = 'BULL';
    } else if (avgChangePercent <= MARKET_DETECTION_CONFIG.BEAR_THRESHOLD) {
        condition = 'BEAR';
    } else {
        condition = 'NEUTRAL';
    }
    
    // Store in condition history
    REBALANCE_STATE.conditionHistory.push({
        condition,
        timestamp: Date.now(),
        changePercent: avgChangePercent
    });
    
    // Trim history
    if (REBALANCE_STATE.conditionHistory.length > REBALANCE_CONFIG.MAX_HISTORY_SIZE) {
        REBALANCE_STATE.conditionHistory = REBALANCE_STATE.conditionHistory.slice(-REBALANCE_CONFIG.MAX_HISTORY_SIZE);
    }
    
    return { condition, changePercent: avgChangePercent };
}

/**
 * Check if market condition has been stable for required period
 */
function isMarketConditionStable(targetCondition: MarketCondition): boolean {
    const now = Date.now();
    const stabilityPeriod = REBALANCE_CONFIG.CONDITION_STABILITY_PERIOD;
    const recentHistory = REBALANCE_STATE.conditionHistory.filter(
        entry => entry.timestamp > (now - stabilityPeriod)
    );
    
    if (recentHistory.length === 0) {
        return false;
    }
    
    // Check if all recent conditions match the target
    const isStable = recentHistory.every(entry => entry.condition === targetCondition);
    
    console.log(`🔍 Market condition stability check: ${isStable ? 'STABLE' : 'UNSTABLE'} (${recentHistory.length} recent entries)`);
    
    return isStable;
}

/**
 * Interpolate between two weight configurations
 */
function interpolateWeights(
    fromWeights: Record<string, number>,
    toWeights: Record<string, number>,
    progress: number
): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const symbol in fromWeights) {
        const fromWeight = fromWeights[symbol];
        const toWeight = toWeights[symbol];
        result[symbol] = fromWeight + (toWeight - fromWeight) * progress;
    }
    
    return result;
}

/**
 * Calculate rebalancing progress and current weights
 */
function calculateRebalanceProgress(): { weights: Record<string, number>; progress: number; isComplete: boolean } {
    const now = Date.now();
    
    if (!REBALANCE_STATE.isRebalancing) {
        return {
            weights: { ...REBALANCE_STATE.currentWeights },
            progress: 1.0,
            isComplete: true
        };
    }
    
    const elapsed = now - REBALANCE_STATE.rebalanceStartTime;
    const progress = Math.min(elapsed / REBALANCE_CONFIG.REBALANCE_DURATION, 1.0);
    
    const currentWeights = interpolateWeights(
        REBALANCE_STATE.currentWeights,
        REBALANCE_STATE.targetWeights,
        progress
    );
    
    const isComplete = progress >= 1.0;
    
    if (isComplete && REBALANCE_STATE.isRebalancing) {
        console.log('✅ Rebalancing completed');
        REBALANCE_STATE.currentWeights = { ...REBALANCE_STATE.targetWeights };
        REBALANCE_STATE.isRebalancing = false;
        REBALANCE_STATE.lastRebalanceTime = now;
    }
    
    return { weights: currentWeights, progress, isComplete };
}

/**
 * Initiate rebalancing to new target weights
 */
function initiateRebalance(newTargetCondition: MarketCondition, isEmergency: boolean = false): void {
    const now = Date.now();
    const timeSinceLastRebalance = now - REBALANCE_STATE.lastRebalanceTime;
    
    // Check minimum interval (unless emergency)
    if (!isEmergency && timeSinceLastRebalance < REBALANCE_CONFIG.MIN_REBALANCE_INTERVAL) {
        console.log(`⏳ Rebalancing on cooldown. ${Math.ceil((REBALANCE_CONFIG.MIN_REBALANCE_INTERVAL - timeSinceLastRebalance) / (60 * 1000))} minutes remaining`);
        return;
    }
    
    const newTargetWeights:any = MARKET_WEIGHTS[newTargetCondition];
    
    // Check if we're already targeting this condition
    const isSameTarget = JSON.stringify(REBALANCE_STATE.targetWeights) === JSON.stringify(newTargetWeights);
    if (isSameTarget && REBALANCE_STATE.isRebalancing) {
        console.log(`🔄 Already rebalancing to ${newTargetCondition} condition`);
        return;
    }
    
    console.log(`🚀 Initiating ${isEmergency ? 'EMERGENCY ' : ''}rebalance to ${newTargetCondition} condition`);
    
    // Update rebalance state
    REBALANCE_STATE.targetWeights = { ...newTargetWeights };
    REBALANCE_STATE.isRebalancing = true;
    REBALANCE_STATE.rebalanceStartTime = now;
    
    // Log the transition
    console.log('  Weight transition:');
    Object.keys(newTargetWeights).forEach(symbol => {
        const from = (REBALANCE_STATE.currentWeights[symbol] * 100).toFixed(1);
        const to = (newTargetWeights[symbol] * 100).toFixed(1);
        console.log(`${symbol}: ${from}% → ${to}%`);
    });
}

/**
 * Update rebalancing state based on market conditions
 */
function updateRebalanceState(marketCondition: MarketCondition, changePercent: number): void {
    const now = Date.now();
    
    // Check for emergency rebalancing
    if (Math.abs(changePercent) >= REBALANCE_CONFIG.EMERGENCY_REBALANCE_THRESHOLD) {
        console.log(`🚨 Emergency rebalancing triggered: ${changePercent.toFixed(2)}% change`);
        initiateRebalance(marketCondition, true);
        return;
    }
    
    // Check if we should start rebalancing to new condition
    const currentTargetCondition = Object.keys(MARKET_WEIGHTS).find(condition => 
        JSON.stringify(MARKET_WEIGHTS[condition as MarketCondition]) === JSON.stringify(REBALANCE_STATE.targetWeights)
    ) as MarketCondition || 'NEUTRAL';
    
    if (marketCondition !== currentTargetCondition) {
        // New market condition detected - check if it's stable
        if (isMarketConditionStable(marketCondition)) {
            console.log(`✅ Market condition stable: ${marketCondition}`);
            initiateRebalance(marketCondition, false);
        } else {
            console.log(`⏳ Market condition unstable: ${marketCondition} (waiting for stability)`);
        }
    }
}

/**
 * Calculate synthetic basket value using current rebalanced weights
 */
function calculateBasketValue(priceData: PriceData): number {
    const currentPrices = createPriceMap(priceData);
    const { weights } = calculateRebalanceProgress();
    
    if (!INITIAL_PRICES) {
        throw new Error('Initial prices not set. Call initializeBaseline first.');
    }
    
    let basketValue = 0;
    
    for (const [symbol, weight] of Object.entries(weights)) {
        const currentPrice = currentPrices[symbol];
        const initialPrice = INITIAL_PRICES[symbol];
        
        if (!currentPrice || !initialPrice || currentPrice === 0 || initialPrice === 0) {
            // For missing or zero prices, assume no change (ratio = 1.0)
            console.warn(`Price not found or zero for ${symbol}, assuming no change`);
            const contribution = weight * INITIAL_BASKET_VALUE;
            basketValue += contribution;
        } else {
            const priceRatio = currentPrice / initialPrice;
            const contribution = weight * INITIAL_BASKET_VALUE * priceRatio;
            basketValue += contribution;
        }
    }
    
    return basketValue;
}

/**
 * Check if circuit breaker should be triggered
 */
function checkCircuitBreaker(changePercent: number): void {
    const now = Date.now();
    
    // Skip if already triggered and still within duration
    if (CIRCUIT_BREAKER_STATE.isTriggered) {
        if (now < CIRCUIT_BREAKER_STATE.autoUnfreezeTime && !CIRCUIT_BREAKER_STATE.manualOverride) {
            console.log(`🚨 Circuit breaker active: ${Math.ceil((CIRCUIT_BREAKER_STATE.autoUnfreezeTime - now) / (60 * 1000))} minutes remaining`);
            return;
        } else if (CIRCUIT_BREAKER_CONFIG.AUTO_UNFREEZE_ON_NEUTRAL && Math.abs(changePercent) < 5) {
            // Auto unfreeze if market returns to neutral
            unfreezeSwaps('Market returned to neutral conditions');
            return;
        }
    }
    
    // Check if extreme volatility threshold is exceeded
    if (Math.abs(changePercent) >= CIRCUIT_BREAKER_CONFIG.EXTREME_VOLATILITY_THRESHOLD) {
        const reason = `Extreme volatility detected: ${changePercent.toFixed(2)}% change`;
        freezeSwaps(reason, changePercent);
    }
}

/**
 * Freeze swaps due to circuit breaker trigger
 */
function freezeSwaps(reason: string, changePercent: number): void {
    const now = Date.now();
    
    CIRCUIT_BREAKER_STATE = {
        isTriggered: true,
        triggeredAt: now,
        reason,
        triggerChangePercent: changePercent,
        autoUnfreezeTime: now + CIRCUIT_BREAKER_CONFIG.CIRCUIT_BREAKER_DURATION,
        manualOverride: false
    };
    
    console.log('🚨🚨🚨 CIRCUIT BREAKER TRIGGERED 🚨🚨🚨');
    console.log(`Reason: ${reason}`);
    console.log(`Auto unfreeze in: ${CIRCUIT_BREAKER_CONFIG.CIRCUIT_BREAKER_DURATION / (60 * 1000)} minutes`);
    console.log('🔒 SWAPS FROZEN - All trading operations halted');
}

/**
 * Unfreeze swaps (manual or automatic)
 */
function unfreezeSwaps(reason: string): void {
    if (!CIRCUIT_BREAKER_STATE.isTriggered) {
        console.log('⚠️ Swaps are not currently frozen');
        return;
    }
    
    CIRCUIT_BREAKER_STATE = {
        isTriggered: false,
        triggeredAt: 0,
        reason: '',
        triggerChangePercent: 0,
        autoUnfreezeTime: 0,
        manualOverride: false
    };
    
    console.log('✅ CIRCUIT BREAKER LIFTED');
    console.log(`Reason: ${reason}`);
    console.log('🔓 SWAPS UNFROZEN - Trading operations resumed');
}

/**
 * Manual override to unfreeze swaps (admin function)
 */
function manualUnfreezeSwaps(): boolean {
    if (!CIRCUIT_BREAKER_CONFIG.MANUAL_OVERRIDE_ENABLED) {
        console.log('❌ Manual override is disabled');
        return false;
    }
    
    if (!CIRCUIT_BREAKER_STATE.isTriggered) {
        console.log('⚠️ Circuit breaker is not active');
        return false;
    }
    
    CIRCUIT_BREAKER_STATE.manualOverride = true;
    unfreezeSwaps('Manual override by administrator');
    return true;
}

/**
 * Get circuit breaker status
 */
function getCircuitBreakerStatus(): {
    isTriggered: boolean;
    reason: string;
    triggeredAt: number;
    triggerChangePercent: number;
    timeRemaining: number;
    canManualOverride: boolean;
} {
    const now = Date.now();
    const timeRemaining = CIRCUIT_BREAKER_STATE.isTriggered 
        ? Math.max(0, CIRCUIT_BREAKER_STATE.autoUnfreezeTime - now)
        : 0;
    
    return {
        isTriggered: CIRCUIT_BREAKER_STATE.isTriggered,
        reason: CIRCUIT_BREAKER_STATE.reason,
        triggeredAt: CIRCUIT_BREAKER_STATE.triggeredAt,
        triggerChangePercent: CIRCUIT_BREAKER_STATE.triggerChangePercent,
        timeRemaining,
        canManualOverride: CIRCUIT_BREAKER_CONFIG.MANUAL_OVERRIDE_ENABLED
    };
}

/**
 * Auto-monitor circuit breaker and handle automatic unfreezing
 */
function autoMonitorCircuitBreaker(): void {
    if (!CIRCUIT_BREAKER_STATE.isTriggered) {
        return;
    }
    
    const now = Date.now();
    
    // Auto unfreeze if time has elapsed
    if (now >= CIRCUIT_BREAKER_STATE.autoUnfreezeTime) {
        unfreezeSwaps('Auto unfreeze timer elapsed');
    }
    
    // Check if maximum freeze duration exceeded (safety mechanism)
    if (now - CIRCUIT_BREAKER_STATE.triggeredAt >= CIRCUIT_BREAKER_CONFIG.MAX_FREEZE_DURATION) {
        unfreezeSwaps('Maximum freeze duration exceeded - safety override');
    }
}

/**
 * Calculate APM token price with dynamic rebalancing
 */
function calculateAPMPrice(priceData: PriceData): APMPriceResult {
    try {
        // Initialize baseline prices on first calculation
        initializeBaseline(priceData);
        
        // Validate weights
        validateMarketWeights();
        
        // Step 1: Detect market condition
        const { condition: marketCondition, changePercent: cryptoChangePercent } = detectMarketCondition(priceData);
        
        // Step 2: Check circuit breaker for extreme volatility
        checkCircuitBreaker(cryptoChangePercent);
        
        // Step 2.1: Auto-monitor circuit breaker status
        autoMonitorCircuitBreaker();
        
        // Step 3: Update rebalancing state (only if swaps not frozen)
        if (!CIRCUIT_BREAKER_STATE.isTriggered) {
            updateRebalanceState(marketCondition, cryptoChangePercent);
        } else {
            console.log('⚠️ Rebalancing suspended due to circuit breaker activation');
        }
        
        // Step 3: Calculate current weights and progress
        const { weights: currentWeights, progress: rebalanceProgress } = calculateRebalanceProgress();
        
        // Step 4: Calculate current basket value with rebalanced weights
        const currentBasketValue = calculateBasketValue(priceData);
        
        // Step 5: Calculate APM price
        const apmPrice = INITIAL_APM_PRICE * (currentBasketValue / INITIAL_BASKET_VALUE);
        
        // Get target condition for display
        const targetCondition = Object.keys(MARKET_WEIGHTS).find(condition => 
            JSON.stringify(MARKET_WEIGHTS[condition as MarketCondition]) === JSON.stringify(REBALANCE_STATE.targetWeights)
        ) as MarketCondition || 'NEUTRAL';
        
        console.log(`  APM Price Calculation:`);
        console.log(`Market: ${marketCondition} → ${targetCondition} (${(rebalanceProgress * 100).toFixed(1)}% complete)`);
        console.log(`Basket: $${currentBasketValue.toFixed(2)} | APM: $${apmPrice.toFixed(6)}`);
        
        return {
            basketValue: currentBasketValue,
            marketCondition,
            targetMarketCondition: targetCondition,
            apmPrice,
            cryptoChangePercent,
            weights: currentWeights,
            targetWeights: REBALANCE_STATE.targetWeights,
            rebalanceProgress,
            timestamp: Date.now(),
            nextRebalanceTime: Math.max(Date.now() + 1000, REBALANCE_STATE.lastRebalanceTime + REBALANCE_CONFIG.MIN_REBALANCE_INTERVAL)
        };
        
    } catch (error) {
        console.error('Error calculating APM price:', error);
        throw error;
    }
}

/**
 * Reset baseline prices and rebalance state
 */
function resetBaseline(): void {
    INITIAL_PRICES = null;
    PRICE_HISTORY = [];
    REBALANCE_STATE = {
        currentWeights: { ...MARKET_WEIGHTS.NEUTRAL },
        targetWeights: { ...MARKET_WEIGHTS.NEUTRAL },
        lastRebalanceTime: 0,
        rebalanceStartTime: 0,
        isRebalancing: false,
        conditionHistory: []
    };
    console.log('🔄 Baseline and rebalance state reset');
}

/**
 * Get current rebalancing status
 */
function getRebalanceStatus(): {
    isRebalancing: boolean;
    progress: number;
    currentCondition: MarketCondition;
    targetCondition: MarketCondition;
    nextRebalanceTime: number;
} {
    const { progress } = calculateRebalanceProgress();
    
    const currentCondition = Object.keys(MARKET_WEIGHTS).find(condition => 
        JSON.stringify(MARKET_WEIGHTS[condition as MarketCondition]) === JSON.stringify(REBALANCE_STATE.currentWeights)
    ) as MarketCondition || 'NEUTRAL';
    
    const targetCondition = Object.keys(MARKET_WEIGHTS).find(condition => 
        JSON.stringify(MARKET_WEIGHTS[condition as MarketCondition]) === JSON.stringify(REBALANCE_STATE.targetWeights)
    ) as MarketCondition || 'NEUTRAL';
    
    return {
        isRebalancing: REBALANCE_STATE.isRebalancing,
        progress,
        currentCondition,
        targetCondition,
        nextRebalanceTime: Math.max(Date.now() + 1000, REBALANCE_STATE.lastRebalanceTime + REBALANCE_CONFIG.MIN_REBALANCE_INTERVAL)
    };
}

// Initialize validation on module load
try {
    validateMarketWeights();
    console.log('✅ Market weight validation passed');
} catch (error) {
    console.error('❌ Market weight validation failed:', error);
}

// Exports
export {
    calculateAPMPrice,
    validateMarketWeights,
    resetBaseline,
    getRebalanceStatus,
    // Circuit Breaker Functions
    getCircuitBreakerStatus,
    manualUnfreezeSwaps,
    freezeSwaps,
    unfreezeSwaps,
    autoMonitorCircuitBreaker,
    // Constants
    MARKET_WEIGHTS,
    REBALANCE_CONFIG,
    MARKET_DETECTION_CONFIG,
    CIRCUIT_BREAKER_CONFIG,
    INITIAL_BASKET_VALUE,
    INITIAL_APM_PRICE
};

export type {
    AssetPrice,
    PriceData,
    APMPriceResult,
    OnChainPrice,
    UpdateResult,
    PriceService,
    Wallet,
    MarketCondition,
    RebalanceState,
    MarketConditionHistory
};

// import { Connection, PublicKey } from '@solana/web3.js';
// import { BN, Program } from '@coral-xyz/anchor';
// import { fetchPrices } from './price-feed';

// const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// // Types
// interface AssetPrice {
//     symbol: string;
//     price: number;
//     emaPrice: number;
// }

// interface PriceData {
//     crypto: AssetPrice[];
//     preciousMetals: AssetPrice[];
//     forex: AssetPrice[];
// }

// interface APMPriceResult {
//     basketValue: number;
//     marketCondition: MarketCondition;
//     apmPrice: number;
//     cryptoChangePercent: number;
//     weights: Record<string, number>;
//     timestamp: number;
// }

// interface OnChainPrice {
//     price: number;
//     lastUpdated: Date;
//     authority: string;
// }

// interface UpdateResult {
//     success: boolean;
//     pricing?: APMPriceResult;
//     txSignature?: string;
//     error?: string;
// }

// interface PriceService {
//     stop: () => void;
// }

// interface Wallet {
//     publicKey: PublicKey;
// }

// type MarketCondition = 'BULL' | 'BEAR' | 'NEUTRAL';

// // Market-based weight configurations
// const MARKET_WEIGHTS = {
//     NEUTRAL: {
//         'USD': 0.30,      // 30%
//         'GBP/USD': 0.075, // 7.5%
//         'EUR/USD': 0.075, // 7.5%
//         'XAU/USD': 0.32,  // 32% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.105, // 10.5%
//         'ETH/USD': 0.075  // 7.5%
//     },
//     BULL: {
//         'USD': 0.25,      // 25%
//         'GBP/USD': 0.075, // 7.5%
//         'EUR/USD': 0.075, // 7.5%
//         'XAU/USD': 0.25,  // 25% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.20,  // 20%
//         'ETH/USD': 0.10   // 10%
//     },
//     BEAR: {
//         'USD': 0.35,      // 35%
//         'GBP/USD': 0.125, // 12.5%
//         'EUR/USD': 0.125, // 12.5%
//         'XAU/USD': 0.25,  // 25% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.07,  // 7%
//         'ETH/USD': 0.03   // 3%
//     }
// };

// // Configuration
// const INITIAL_BASKET_VALUE = 10000; // USD
// const INITIAL_APM_PRICE = 1.00; // USD

// // Reference crypto values for market condition detection
// const CRYPTO_REFERENCES = {
//     'BTC/USD': 100000, // Reference point for BTC
//     'ETH/USD': 2300    // Reference point for ETH
// };

// // Store initial prices for basket calculation
// let INITIAL_PRICES: Record<string, number> | null = null;

// /**
//  * Validate that market weights sum to 100%
//  */
// function validateMarketWeights(): void {
//     Object.entries(MARKET_WEIGHTS).forEach(([market, weights]) => {
//         const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
//         if (Math.abs(total - 1.0) > 0.001) {
//             throw new Error(`Market weights for ${market} don't sum to 100%: ${(total * 100).toFixed(2)}%`);
//         }
        
//         const cryptoTotal = (weights['BTC/USD'] + weights['ETH/USD']) * 100;
//         console.log(`${market} market - Crypto allocation: ${cryptoTotal.toFixed(1)}%`);
//     });
// }

// /**
//  * Create price lookup map from fetched data
//  */
// function createPriceMap(priceData: PriceData): Record<string, number> {
//     const { crypto, preciousMetals, forex } = priceData;
//     const priceMap: Record<string, number> = {};
    
//     // Add USD as base currency
//     priceMap['USD'] = 1.00;
    
//     // Add all other assets
//     [...crypto, ...preciousMetals, ...forex].forEach((asset: AssetPrice) => {
//         priceMap[asset.symbol] = asset.price;
//     });
    
//     return priceMap;
// }

// /**
//  * Initialize baseline prices for basket calculation
//  */
// function initializeBaseline(priceData: PriceData): void {
//     if (!INITIAL_PRICES) {
//         INITIAL_PRICES = createPriceMap(priceData);
//         console.log('  Initialized baseline prices:');
//         Object.entries(INITIAL_PRICES).forEach(([symbol, price]) => {
//             console.log(`${symbol}: $${price.toFixed(4)}`);
//         });
//     }
// }

// /**
//  * Detect market condition based on crypto performance
//  */
// function detectMarketCondition(priceData: PriceData): { condition: MarketCondition; changePercent: number } {
//     const { crypto } = priceData;
    
//     const btcData = crypto.find((c: AssetPrice) => c.symbol === 'BTC/USD');
//     const ethData = crypto.find((c: AssetPrice) => c.symbol === 'ETH/USD');
    
//     if (!btcData || !ethData) {
//         console.warn('Missing BTC or ETH data for market condition detection');
//         return { condition: 'NEUTRAL', changePercent: 0 };
//     }
    
//     // Calculate crypto performance vs reference values
//     const btcChange = (btcData.price - CRYPTO_REFERENCES['BTC/USD']) / CRYPTO_REFERENCES['BTC/USD'];
//     const ethChange = (ethData.price - CRYPTO_REFERENCES['ETH/USD']) / CRYPTO_REFERENCES['ETH/USD'];
    
//     // Average crypto change percentage
//     const avgChangePercent = ((btcChange + ethChange) / 2) * 100;
    
//     console.log(`📈 BTC: $${btcData.price} vs ref $${CRYPTO_REFERENCES['BTC/USD']} = ${(btcChange * 100).toFixed(2)}%`);
//     console.log(`📈 ETH: $${ethData.price} vs ref $${CRYPTO_REFERENCES['ETH/USD']} = ${(ethChange * 100).toFixed(2)}%`);
//     console.log(`📈 Average crypto change: ${avgChangePercent.toFixed(2)}%`);
    
//     let condition: MarketCondition;
//     if (avgChangePercent >= 5) {
//         condition = 'BULL';
//     } else if (avgChangePercent <= -5) {
//         condition = 'BEAR';
//     } else {
//         condition = 'NEUTRAL';
//     }
    
//     return { condition, changePercent: avgChangePercent };
// }

// /**
//  * Calculate synthetic basket value using price changes from baseline
//  */
// function calculateBasketValue(priceData: PriceData, marketCondition: MarketCondition): number {
//     const currentPrices = createPriceMap(priceData);
//     const weights = MARKET_WEIGHTS[marketCondition];
    
//     if (!INITIAL_PRICES) {
//         throw new Error('Initial prices not set. Call initializeBaseline first.');
//     }
    
//     let basketValue = 0;
//     console.log(`🔧 Calculating basket value for ${marketCondition} market:`);
    
//     for (const [symbol, weight] of Object.entries(weights)) {
//         const currentPrice = currentPrices[symbol];
//         const initialPrice = INITIAL_PRICES[symbol];
        
//         if (!currentPrice || !initialPrice) {
//             throw new Error(`Price not found for ${symbol}`);
//         }
        
//         // Calculate the weighted contribution based on price change
//         // Each asset contributes: weight * initial_basket_value * (current_price / initial_price)
//         const priceRatio = currentPrice / initialPrice;
//         const contribution = weight * INITIAL_BASKET_VALUE * priceRatio;
//         basketValue += contribution;
        
//         console.log(`${symbol}: ${(weight * 100).toFixed(1)}% × $${INITIAL_BASKET_VALUE} × ${priceRatio.toFixed(4)} = $${contribution.toFixed(2)}`);
//     }
    
//     console.log(`  Total basket value: $${basketValue.toFixed(2)}`);
//     return basketValue;
// }

// /**
//  * Calculate APM token price based on basket value
//  */
// function calculateAPMPrice(priceData: PriceData): APMPriceResult {
//     try {
//         // Initialize baseline prices on first calculation
//         initializeBaseline(priceData);
        
//         // Validate weights
//         validateMarketWeights();
        
//         // Step 1: Detect market condition
//         const { condition: marketCondition, changePercent: cryptoChangePercent } = detectMarketCondition(priceData);
//         console.log(`📈 Market condition: ${marketCondition}`);
        
//         // Step 2: Calculate current basket value with appropriate weights
//         const currentBasketValue = calculateBasketValue(priceData, marketCondition);
        
//         // Step 3: Calculate APM price using the formula
//         // APM Price = Initial APM Price × (Current Basket Value / Initial Basket Value)
//         const apmPrice = INITIAL_APM_PRICE * (currentBasketValue / INITIAL_BASKET_VALUE);
        
//         console.log(`💰 APM Price = $${INITIAL_APM_PRICE} × ($${currentBasketValue.toFixed(2)} / $${INITIAL_BASKET_VALUE}) = $${apmPrice.toFixed(6)}`);
        
//         return {
//             basketValue: currentBasketValue,
//             marketCondition,
//             apmPrice,
//             cryptoChangePercent,
//             weights: MARKET_WEIGHTS[marketCondition],
//             timestamp: Date.now()
//         };
        
//     } catch (error) {
//         console.error('Error calculating APM price:', error);
//         throw error;
//     }
// }

// /**
//  * Reset baseline prices (useful for testing or recalibration)
//  */
// function resetBaseline(): void {
//     INITIAL_PRICES = null;
//     console.log('🔄 Baseline prices reset');
// }

// // Initialize validation on module load
// try {
//     validateMarketWeights();
//     console.log('✅ Market weight validation passed');
// } catch (error) {
//     console.error('❌ Market weight validation failed:', error);
// }

// // Exports
// export {
//     calculateAPMPrice,
//     validateMarketWeights,
//     resetBaseline,
//     MARKET_WEIGHTS,
//     CRYPTO_REFERENCES,
//     INITIAL_BASKET_VALUE,
//     INITIAL_APM_PRICE
// };

// export type {
//     AssetPrice,
//     PriceData,
//     APMPriceResult,
//     OnChainPrice,
//     UpdateResult,
//     PriceService,
//     Wallet,
//     MarketCondition
// };

// import { Connection, PublicKey } from '@solana/web3.js';
// import { BN, Program } from '@coral-xyz/anchor';
// import { fetchPrices } from './price-feed';

// const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// // Types
// interface AssetPrice {
//     symbol: string;
//     price: number;
//     emaPrice: number;
// }

// interface PriceData {
//     crypto: AssetPrice[];
//     preciousMetals: AssetPrice[];
//     forex: AssetPrice[];
// }

// interface APMPriceResult {
//     basketValue: number;
//     marketCondition: MarketCondition;
//     apmPrice: number;
//     cryptoChangePercent: number;
//     weights: Record<string, number>;
//     timestamp: number;
// }

// interface OnChainPrice {
//     price: number;
//     lastUpdated: Date;
//     authority: string;
// }

// interface UpdateResult {
//     success: boolean;
//     pricing?: APMPriceResult;
//     txSignature?: string;
//     error?: string;
// }

// interface PriceService {
//     stop: () => void;
// }

// interface Wallet {
//     publicKey: PublicKey;
// }

// type MarketCondition = 'BULL' | 'BEAR' | 'NEUTRAL';

// // Market-based weight configurations (FIXED)
// const MARKET_WEIGHTS = {
//     NEUTRAL: {
//         'USD': 0.30,      // 30%
//         'GBP/USD': 0.075, // 7.5%
//         'EUR/USD': 0.075, // 7.5%
//         'XAU/USD': 0.32,  // 32% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.105, // 10.5%
//         'ETH/USD': 0.075  // 7.5%
//         // Total: Crypto 18%, Stable 82%
//     },
//     BULL: {
//         'USD': 0.25,      // 25%
//         'GBP/USD': 0.075, // 7.5%
//         'EUR/USD': 0.075, // 7.5%
//         'XAU/USD': 0.25,  // 25% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.20,  // 20%
//         'ETH/USD': 0.10   // 10%
//         // Total: Crypto 30%, Stable 70%
//     },
//     BEAR: {
//         'USD': 0.35,      // 35% (FIXED: reduced from 40%)
//         'GBP/USD': 0.125, // 12.5%
//         'EUR/USD': 0.125, // 12.5%
//         'XAU/USD': 0.25,  // 25% Gold
//         'XAG/USD': 0.05,  // 5% Silver
//         'BTC/USD': 0.07,  // 7% (FIXED: increased from 3.5%)
//         'ETH/USD': 0.03   // 3% (FIXED: increased from 1.5%)
//         // Total: Crypto 10%, Stable 90%
//     }
// };

// // Configuration
// const INITIAL_BASKET_VALUE = 10000; // USD
// const INITIAL_APM_PRICE = 1.00; // USD

// // Reference crypto values for market condition detection
// const CRYPTO_REFERENCES = {
//     'BTC/USD': 100000, // You can adjust this reference point
//     'ETH/USD': 2300    // You can adjust this reference point
// };

// /**
//  * Validate that market weights sum to 100%
//  */
// function validateMarketWeights(): void {
//     Object.entries(MARKET_WEIGHTS).forEach(([market, weights]) => {
//         const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
//         if (Math.abs(total - 1.0) > 0.001) { // Allow small floating point errors
//             throw new Error(`Market weights for ${market} don't sum to 100%: ${(total * 100).toFixed(2)}%`);
//         }
        
//         // Validate crypto allocation percentages
//         const cryptoTotal = (weights['BTC/USD'] + weights['ETH/USD']) * 100;
//         console.log(`${market} market - Crypto allocation: ${cryptoTotal.toFixed(1)}%`);
//     });
// }

// /**
//  * Create price lookup map from fetched data
//  */
// function createPriceMap(priceData: PriceData): Record<string, number> {
//     const { crypto, preciousMetals, forex } = priceData;
//     const priceMap: Record<string, number> = {};
    
//     // Add USD as base currency
//     priceMap['USD'] = 1.00;
    
//     // Add all other assets
//     [...crypto, ...preciousMetals, ...forex].forEach((asset: AssetPrice) => {
//         priceMap[asset.symbol] = asset.price;
//     });
    
//     return priceMap;
// }

// /**
//  * Detect market condition based on crypto performance
//  */
// function detectMarketCondition(priceData: PriceData): { condition: MarketCondition; changePercent: number } {
//     const { crypto } = priceData;
    
//     const btcData = crypto.find((c: AssetPrice) => c.symbol === 'BTC/USD');
//     const ethData = crypto.find((c: AssetPrice) => c.symbol === 'ETH/USD');
    
//     if (!btcData || !ethData) {
//         console.warn('Missing BTC or ETH data for market condition detection');
//         return { condition: 'NEUTRAL', changePercent: 0 };
//     }
    
//     // Calculate crypto performance vs reference values
//     const btcChange = (btcData.price - CRYPTO_REFERENCES['BTC/USD']) / CRYPTO_REFERENCES['BTC/USD'];
//     const ethChange = (ethData.price - CRYPTO_REFERENCES['ETH/USD']) / CRYPTO_REFERENCES['ETH/USD'];
    
//     // Average crypto change percentage
//     const avgChangePercent = ((btcChange + ethChange) / 2) * 100;
    
//     console.log(`📈 BTC: $${btcData.price} vs ref $${CRYPTO_REFERENCES['BTC/USD']} = ${(btcChange * 100).toFixed(2)}%`);
//     console.log(`📈 ETH: $${ethData.price} vs ref $${CRYPTO_REFERENCES['ETH/USD']} = ${(ethChange * 100).toFixed(2)}%`);
//     console.log(`📈 Average crypto change: ${avgChangePercent.toFixed(2)}%`);
    
//     let condition: MarketCondition;
//     if (avgChangePercent >= 5) {
//         condition = 'BULL';
//     } else if (avgChangePercent <= -5) {
//         condition = 'BEAR';
//     } else {
//         condition = 'NEUTRAL';
//     }
    
//     return { condition, changePercent: avgChangePercent };
// }

// /**
//  * Calculate synthetic basket value using current market weights
//  */
// function calculateBasketValue(priceData: PriceData, marketCondition: MarketCondition): number {
//     const priceMap = createPriceMap(priceData);
//     const weights = MARKET_WEIGHTS[marketCondition];
//     let basketValue = 0;
    
//     console.log(`🔧 Calculating basket value for ${marketCondition} market:`);
    
//     for (const [symbol, weight] of Object.entries(weights)) {
//         const price = priceMap[symbol];
        
//         if (!price) {
//             throw new Error(`Price not found for ${symbol}`);
//         }
        
//         const contribution = weight * price;
//         basketValue += contribution;
        
//         console.log(`${symbol}: ${(weight * 100).toFixed(1)}% × $${price.toFixed(4)} = $${contribution.toFixed(4)}`);
//     }
    
//     console.log(`  Total basket value: $${basketValue.toFixed(4)}`);
//     return basketValue;
// }

// /**
//  * Calculate APM token price based on basket value
//  */
// function calculateAPMPrice(priceData: PriceData): APMPriceResult {
//     try {
//         // Validate weights on first run
//         validateMarketWeights();
        
//         // Step 1: Detect market condition
//         const { condition: marketCondition, changePercent: cryptoChangePercent } = detectMarketCondition(priceData);
//         console.log(`📈 Market condition: ${marketCondition}`);
        
//         // Step 2: Calculate current basket value with appropriate weights
//         const currentBasketValue = calculateBasketValue(priceData, marketCondition);
        
//         // Step 3: Calculate APM price using the formula
//         // APM Price = Initial APM Price × (Current Basket Value / Initial Basket Value)
//         const apmPrice = INITIAL_APM_PRICE * (currentBasketValue / INITIAL_BASKET_VALUE);
        
//         console.log(`💰 APM Price = $${INITIAL_APM_PRICE} × ($${currentBasketValue.toFixed(4)} / $${INITIAL_BASKET_VALUE}) = $${apmPrice.toFixed(6)}`);
        
//         return {
//             basketValue: currentBasketValue,
//             marketCondition,
//             apmPrice,
//             cryptoChangePercent,
//             weights: MARKET_WEIGHTS[marketCondition],
//             timestamp: Date.now()
//         };
        
//     } catch (error) {
//         console.error('Error calculating APM price:', error);
//         throw error;
//     }
// }

// // Initialize validation on module load
// try {
//     validateMarketWeights();
//     console.log('✅ Market weight validation passed');
// } catch (error) {
//     console.error('❌ Market weight validation failed:', error);
// }

// // Exports
// export {
//     calculateAPMPrice,
//     validateMarketWeights,
//     MARKET_WEIGHTS,
//     CRYPTO_REFERENCES,
//     INITIAL_BASKET_VALUE,
//     INITIAL_APM_PRICE
// };

// export type {
//     AssetPrice,
//     PriceData,
//     APMPriceResult,
//     OnChainPrice,
//     UpdateResult,
//     PriceService,
//     Wallet,
//     MarketCondition
// };

// // import { Connection, PublicKey } from '@solana/web3.js';
// // import { BN, Program } from '@coral-xyz/anchor';
// // import { fetchPrices } from './price-feed';

// // const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// // // Types
// // interface AssetPrice {
// //     symbol: string;
// //     price: number;
// //     emaPrice: number;
// // }

// // interface PriceData {
// //     crypto: AssetPrice[];
// //     preciousMetals: AssetPrice[];
// //     forex: AssetPrice[];
// // }

// // interface APMPriceResult {
// //     basketValue: number;
// //     marketCondition: MarketCondition;
// //     apmPrice: number;
// //     cryptoChangePercent: number;
// //     weights: Record<string, number>;
// //     timestamp: number;
// // }

// // interface OnChainPrice {
// //     price: number;
// //     lastUpdated: Date;
// //     authority: string;
// // }

// // interface UpdateResult {
// //     success: boolean;
// //     pricing?: APMPriceResult;
// //     txSignature?: string;
// //     error?: string;
// // }

// // interface PriceService {
// //     stop: () => void;
// // }

// // interface Wallet {
// //     publicKey: PublicKey;
// // }

// // type MarketCondition = 'BULL' | 'BEAR' | 'NEUTRAL';

// // // Market-based weight configurations
// // const MARKET_WEIGHTS = {
// //     NEUTRAL: {
// //         'USD': 0.30,      // 30%
// //         'GBP/USD': 0.075, // 7.5%
// //         'EUR/USD': 0.075, // 7.5%
// //         'XAU/USD': 0.32,  // 32% Gold
// //         'XAG/USD': 0.05,  // 5% Silver
// //         'BTC/USD': 0.105, // 10.5%
// //         'ETH/USD': 0.075  // 7.5%
// //     },
// //     BULL: {
// //         'USD': 0.25,      // 25%
// //         'GBP/USD': 0.075, // 7.5%
// //         'EUR/USD': 0.075, // 7.5%
// //         'XAU/USD': 0.25,  // 25% Gold
// //         'XAG/USD': 0.05,  // 5% Silver
// //         'BTC/USD': 0.20,  // 20% (increased)
// //         'ETH/USD': 0.10   // 10% (increased)
// //     },
// //     BEAR: {
// //         'USD': 0.40,      // 40%
// //         'GBP/USD': 0.125, // 12.5%
// //         'EUR/USD': 0.125, // 12.5%
// //         'XAU/USD': 0.25,  // 25% Gold
// //         'XAG/USD': 0.05,  // 5% Silver
// //         'BTC/USD': 0.035, // 3.5% (decreased)
// //         'ETH/USD': 0.015  // 1.5% (decreased)
// //     }
// // };

// // // Configuration
// // const INITIAL_BASKET_VALUE = 10000; // USD
// // const INITIAL_APM_PRICE = 1.00; // USD

// // // Reference crypto values for market condition detection
// // const CRYPTO_REFERENCES = {
// //     'BTC/USD': 100000, // You can adjust this reference point
// //     'ETH/USD': 2300    // You can adjust this reference point
// // };

// // /**
// //  * Create price lookup map from fetched data
// //  */
// // function createPriceMap(priceData: PriceData): Record<string, number> {
// //     const { crypto, preciousMetals, forex } = priceData;
// //     const priceMap: Record<string, number> = {};
    
// //     // Add USD as base currency
// //     priceMap['USD'] = 1.00;
    
// //     // Add all other assets
// //     [...crypto, ...preciousMetals, ...forex].forEach((asset: AssetPrice) => {
// //         priceMap[asset.symbol] = asset.price;
// //     });
    
// //     return priceMap;
// // }


// // function detectMarketCondition(priceData: PriceData): { condition: MarketCondition; changePercent: number } {
// //     const { crypto } = priceData;
    
// //     const btcData = crypto.find((c: AssetPrice) => c.symbol === 'BTC/USD');
// //     const ethData = crypto.find((c: AssetPrice) => c.symbol === 'ETH/USD');
    
// //     if (!btcData || !ethData) {
// //         return { condition: 'NEUTRAL', changePercent: 0 };
// //     }
    
// //     // Calculate crypto performance vs reference values
// //     const btcChange = (btcData.price - CRYPTO_REFERENCES['BTC/USD']) / CRYPTO_REFERENCES['BTC/USD'];
// //     const ethChange = (ethData.price - CRYPTO_REFERENCES['ETH/USD']) / CRYPTO_REFERENCES['ETH/USD'];
    
// //     // Average crypto change percentage
// //     const avgChangePercent = ((btcChange + ethChange) / 2) * 100;
    
// //     console.log(`📈 BTC: $${btcData.price} vs ref $${CRYPTO_REFERENCES['BTC/USD']} = ${(btcChange * 100).toFixed(2)}%`);
// //     console.log(`📈 ETH: $${ethData.price} vs ref $${CRYPTO_REFERENCES['ETH/USD']} = ${(ethChange * 100).toFixed(2)}%`);
// //     console.log(`📈 Average crypto change: ${avgChangePercent.toFixed(2)}%`);
    
// //     let condition: MarketCondition;
// //     if (avgChangePercent >= 5) {
// //         condition = 'BULL';
// //     } else if (avgChangePercent <= -5) {
// //         condition = 'BEAR';
// //     } else {
// //         condition = 'NEUTRAL';
// //     }
    
// //     return { condition, changePercent: avgChangePercent };
// // }

// // /**
// //  * Calculate synthetic basket value using current market weights
// //  */
// // function calculateBasketValue(priceData: PriceData, marketCondition: MarketCondition): number {
// //     const priceMap = createPriceMap(priceData);
// //     const weights = MARKET_WEIGHTS[marketCondition];
// //     let basketValue = 0;
    
// //     console.log(`🔧 Calculating basket value for ${marketCondition} market:`);
    
// //     for (const [symbol, weight] of Object.entries(weights)) {
// //         const price = priceMap[symbol];
        
// //         if (!price) {
// //             throw new Error(`Price not found for ${symbol}`);
// //         }
        
// //         const contribution = weight * price;
// //         basketValue += contribution;
        
// //         console.log(`${symbol}: ${(weight * 100).toFixed(1)}% × $${price.toFixed(4)} = $${contribution.toFixed(4)}`);
// //     }
    
// //     console.log(`  Total basket value: $${basketValue.toFixed(4)}`);
// //     return basketValue;
// // }

// // /**
// //  * Calculate APM token price based on basket value
// //  */
// // function calculateAPMPrice(priceData: PriceData): APMPriceResult {
// //     // console.log('🔧 Calculating APM synthetic token price...');
// //     // console.log(`Initial basket value: $${INITIAL_BASKET_VALUE}`);
// //     // console.log(`Initial APM price: $${INITIAL_APM_PRICE}`);
    
// //     // Step 1: Detect market condition
// //     const { condition: marketCondition, changePercent: cryptoChangePercent } = detectMarketCondition(priceData);
// //     // console.log(`📈 Market condition: ${marketCondition}`);
    
// //     // Step 2: Calculate current basket value with appropriate weights
// //     const currentBasketValue = calculateBasketValue(priceData, marketCondition);
    
// //     // Step 3: Calculate APM price using the formula
// //     // APM Price = Initial APM Price × (Current Basket Value / Initial Basket Value)
// //     const apmPrice = INITIAL_APM_PRICE * (currentBasketValue / INITIAL_BASKET_VALUE);
    
// //     // console.log(`💰 APM Price = $${INITIAL_APM_PRICE} × ($${currentBasketValue.toFixed(4)} / $${INITIAL_BASKET_VALUE}) = $${apmPrice.toFixed(4)}`);
    
// //     return {
// //         basketValue: currentBasketValue,
// //         marketCondition,
// //         apmPrice,
// //         cryptoChangePercent,
// //         weights: MARKET_WEIGHTS[marketCondition],
// //         timestamp: Date.now()
// //     };
// // }

// // // async function calculateAPMPriceWithSampleData(): Promise<APMPriceResult> {
// // //     try {
// // //         const priceData: PriceData = await fetchPrices();
        
// // //         console.log('\n=== APM Price Calculation ===');
// // //         console.log('Current market data:');
        
// // //         // Log current prices for transparency
// // //         const priceMap = createPriceMap(priceData);
// // //         const importantAssets = ['BTC/USD', 'ETH/USD', 'XAU/USD', 'XAG/USD', 'EUR/USD', 'GBP/USD'];
        
// // //         for (const symbol of importantAssets) {
// // //             const price = priceMap[symbol];
// // //             if (price) {
// // //                 console.log(`${symbol}: $${price.toFixed(4)}`);
// // //             }
// // //         }
        
// // //         return calculateAPMPrice(priceData);
// // //     } catch (error) {
// // //         console.error('Error calculating APM price:', error);
// // //         throw error;
// // //     }
// // // }



// // // Exports
// // export {
// //     calculateAPMPrice,
// //     // calculateAPMPriceWithSampleData,
// //     MARKET_WEIGHTS,
// //     CRYPTO_REFERENCES,
// //     INITIAL_BASKET_VALUE,
// //     INITIAL_APM_PRICE
// // };

// // export type {
// //     AssetPrice,
// //     PriceData,
// //     APMPriceResult,
// //     OnChainPrice,
// //     UpdateResult,
// //     PriceService,
// //     Wallet,
// //     MarketCondition
// // };