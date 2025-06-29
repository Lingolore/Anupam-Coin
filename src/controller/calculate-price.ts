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
    apmPrice: number;
    cryptoChangePercent: number;
    weights: Record<string, number>;
    timestamp: number;
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

// Market-based weight configurations
const MARKET_WEIGHTS = {
    NEUTRAL: {
        'USD': 0.30,      // 30%
        'GBP/USD': 0.075, // 7.5%
        'EUR/USD': 0.075, // 7.5%
        'XAU/USD': 0.32,  // 32% Gold
        'XAG/USD': 0.05,  // 5% Silver
        'BTC/USD': 0.105, // 10.5%
        'ETH/USD': 0.075  // 7.5%
    },
    BULL: {
        'USD': 0.25,      // 25%
        'GBP/USD': 0.075, // 7.5%
        'EUR/USD': 0.075, // 7.5%
        'XAU/USD': 0.25,  // 25% Gold
        'XAG/USD': 0.05,  // 5% Silver
        'BTC/USD': 0.20,  // 20% (increased)
        'ETH/USD': 0.10   // 10% (increased)
    },
    BEAR: {
        'USD': 0.40,      // 40%
        'GBP/USD': 0.125, // 12.5%
        'EUR/USD': 0.125, // 12.5%
        'XAU/USD': 0.25,  // 25% Gold
        'XAG/USD': 0.05,  // 5% Silver
        'BTC/USD': 0.035, // 3.5% (decreased)
        'ETH/USD': 0.015  // 1.5% (decreased)
    }
};

// Configuration
const INITIAL_BASKET_VALUE = 10000; // USD
const INITIAL_APM_PRICE = 1.00; // USD

// Reference crypto values for market condition detection
const CRYPTO_REFERENCES = {
    'BTC/USD': 100000, // You can adjust this reference point
    'ETH/USD': 2300    // You can adjust this reference point
};

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


function detectMarketCondition(priceData: PriceData): { condition: MarketCondition; changePercent: number } {
    const { crypto } = priceData;
    
    const btcData = crypto.find((c: AssetPrice) => c.symbol === 'BTC/USD');
    const ethData = crypto.find((c: AssetPrice) => c.symbol === 'ETH/USD');
    
    if (!btcData || !ethData) {
        return { condition: 'NEUTRAL', changePercent: 0 };
    }
    
    // Calculate crypto performance vs reference values
    const btcChange = (btcData.price - CRYPTO_REFERENCES['BTC/USD']) / CRYPTO_REFERENCES['BTC/USD'];
    const ethChange = (ethData.price - CRYPTO_REFERENCES['ETH/USD']) / CRYPTO_REFERENCES['ETH/USD'];
    
    // Average crypto change percentage
    const avgChangePercent = ((btcChange + ethChange) / 2) * 100;
    
    console.log(`📈 BTC: $${btcData.price} vs ref $${CRYPTO_REFERENCES['BTC/USD']} = ${(btcChange * 100).toFixed(2)}%`);
    console.log(`📈 ETH: $${ethData.price} vs ref $${CRYPTO_REFERENCES['ETH/USD']} = ${(ethChange * 100).toFixed(2)}%`);
    console.log(`📈 Average crypto change: ${avgChangePercent.toFixed(2)}%`);
    
    let condition: MarketCondition;
    if (avgChangePercent >= 5) {
        condition = 'BULL';
    } else if (avgChangePercent <= -5) {
        condition = 'BEAR';
    } else {
        condition = 'NEUTRAL';
    }
    
    return { condition, changePercent: avgChangePercent };
}

/**
 * Calculate synthetic basket value using current market weights
 */
function calculateBasketValue(priceData: PriceData, marketCondition: MarketCondition): number {
    const priceMap = createPriceMap(priceData);
    const weights = MARKET_WEIGHTS[marketCondition];
    let basketValue = 0;
    
    console.log(`🔧 Calculating basket value for ${marketCondition} market:`);
    
    for (const [symbol, weight] of Object.entries(weights)) {
        const price = priceMap[symbol];
        
        if (!price) {
            throw new Error(`Price not found for ${symbol}`);
        }
        
        const contribution = weight * price;
        basketValue += contribution;
        
        console.log(`${symbol}: ${(weight * 100).toFixed(1)}% × $${price.toFixed(4)} = $${contribution.toFixed(4)}`);
    }
    
    console.log(`📊 Total basket value: $${basketValue.toFixed(4)}`);
    return basketValue;
}

/**
 * Calculate APM token price based on basket value
 */
function calculateAPMPrice(priceData: PriceData): APMPriceResult {
    // console.log('🔧 Calculating APM synthetic token price...');
    // console.log(`Initial basket value: $${INITIAL_BASKET_VALUE}`);
    // console.log(`Initial APM price: $${INITIAL_APM_PRICE}`);
    
    // Step 1: Detect market condition
    const { condition: marketCondition, changePercent: cryptoChangePercent } = detectMarketCondition(priceData);
    // console.log(`📈 Market condition: ${marketCondition}`);
    
    // Step 2: Calculate current basket value with appropriate weights
    const currentBasketValue = calculateBasketValue(priceData, marketCondition);
    
    // Step 3: Calculate APM price using the formula
    // APM Price = Initial APM Price × (Current Basket Value / Initial Basket Value)
    const apmPrice = INITIAL_APM_PRICE * (currentBasketValue / INITIAL_BASKET_VALUE);
    
    // console.log(`💰 APM Price = $${INITIAL_APM_PRICE} × ($${currentBasketValue.toFixed(4)} / $${INITIAL_BASKET_VALUE}) = $${apmPrice.toFixed(4)}`);
    
    return {
        basketValue: currentBasketValue,
        marketCondition,
        apmPrice,
        cryptoChangePercent,
        weights: MARKET_WEIGHTS[marketCondition],
        timestamp: Date.now()
    };
}

// async function calculateAPMPriceWithSampleData(): Promise<APMPriceResult> {
//     try {
//         const priceData: PriceData = await fetchPrices();
        
//         console.log('\n=== APM Price Calculation ===');
//         console.log('Current market data:');
        
//         // Log current prices for transparency
//         const priceMap = createPriceMap(priceData);
//         const importantAssets = ['BTC/USD', 'ETH/USD', 'XAU/USD', 'XAG/USD', 'EUR/USD', 'GBP/USD'];
        
//         for (const symbol of importantAssets) {
//             const price = priceMap[symbol];
//             if (price) {
//                 console.log(`${symbol}: $${price.toFixed(4)}`);
//             }
//         }
        
//         return calculateAPMPrice(priceData);
//     } catch (error) {
//         console.error('Error calculating APM price:', error);
//         throw error;
//     }
// }



// Exports
export {
    calculateAPMPrice,
    // calculateAPMPriceWithSampleData,
    MARKET_WEIGHTS,
    CRYPTO_REFERENCES,
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
    MarketCondition
};