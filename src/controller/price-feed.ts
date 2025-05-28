import { HermesClient } from '@pythnetwork/hermes-client';
import chalk from 'chalk';

// Define interfaces for type safety
export interface PriceData {
  symbol: string;
  price: number;
  confidence: string;
  emaPrice: number;
  lastUpdated: string;
  decimalPlaces: number;
}

export interface PriceResponse {
  crypto: PriceData[];
  preciousMetals: PriceData[];
  stablecoins: PriceData[];
  forex: PriceData[];
}

export async function fetchPrices(): Promise<PriceResponse> {
    // Price feed mappings (stored without 0x prefix)
    const FEEDS = {
        'BTC/USD': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'XAU/USD': '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
        'XAG/USD': 'f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
        'USDC/USD': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
        'USDT/USD': '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
        'EUR/USD': 'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
        'GBP/USD': '84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1'
    };

    // Define decimal places for each asset
    const DECIMALS:any = {
        'BTC/USD': 2,
        'ETH/USD': 2,
        'XAU/USD': 2,
        'XAG/USD': 2,
        'USDC/USD': 4,
        'USDT/USD': 4,
        'EUR/USD': 4,  // Using 4 decimal places like other forex pairs
        'GBP/USD': 4
    };

    // Define price multipliers for correct scaling
    const PRICE_MULTIPLIERS:any = {
        'BTC/USD': 1,       // BTC price is already correct
        'ETH/USD': 1,  // ETH price needs to be multiplied by 10^5 because exponent is -8
        'XAU/USD': 1,       // Gold price already correct with exponent -8, no additional multiplier needed
        'XAG/USD': 1,       // Silver has exponent -5 (not -8), which already yields correct USD value
        'USDC/USD': 1,      // Stablecoin price format similar to BTC
        'USDT/USD': 1,      // Stablecoin price format similar to BTC
        'EUR/USD': 1,       // Standard multiplier for forex pairs
        'GBP/USD': 1        // Forex price format similar to BTC
    };
    
    // Define asset categories for grouping and styling
    const ASSET_CATEGORIES = {
        'CRYPTO': ['BTC/USD', 'ETH/USD'],
        'PRECIOUS_METALS': ['XAU/USD', 'XAG/USD'],
        'STABLECOINS': ['USDC/USD', 'USDT/USD'],
        'FOREX': ['EUR/USD', 'GBP/USD']
    };
    
    // Define chalk colors and styles for each asset
    const ASSET_STYLES = {
        'BTC/USD': chalk.hex('#F7931A').bold,      // Bitcoin orange
        'ETH/USD': chalk.hex('#627EEA').bold,      // Ethereum blue
        'XAU/USD': chalk.yellow.bold,              // Gold yellow
        'XAG/USD': chalk.gray.bold,                // Silver gray
        'USDC/USD': chalk.hex('#2775CA').bold,     // USDC blue
        'USDT/USD': chalk.hex('#26A17B').bold,     // Tether green
        'EUR/USD': chalk.hex('#003399').bold,      // EU blue color
        'GBP/USD': chalk.hex('#012169').bold       // British blue
    };

    console.log(chalk.cyan.bold('🔄 Connecting to Pyth Network...'));
    const client = new HermesClient('https://hermes.pyth.network');

    try {
        console.log(chalk.cyan('\nFetching prices for:'), chalk.white.bold(Object.keys(FEEDS).join(', ')));
        // Add 0x prefix for API call
        const feedIds = Object.values(FEEDS).map(id => `0x${id}`);
        const priceUpdates = await client.getLatestPriceUpdates(feedIds);
        
        if (!priceUpdates?.parsed?.length) {
            throw new Error('No price data received from API');
        }
        
        // Process all price updates and store results for organized response
        const priceResults: PriceResponse = {
            crypto: [],
            preciousMetals: [],
            stablecoins: [],
            forex: []
        };

        for (const update of priceUpdates.parsed) {
            // Remove 0x prefix for comparison
            const updateId = update.id.toLowerCase().replace('0x', '');
            
            // Find matching symbol
            const symbol = Object.entries(FEEDS).find(([_, id]) => 
                id.toLowerCase() === updateId)?.[0];

            if (!symbol) {
                console.log(`Warning: No matching symbol found for ID ${update.id}`);
                continue;
            }

            try {
                const expo = update.price.expo;  // Use the API's exponent
                const rawPrice = update.price.price;
                const decimalPlaces = DECIMALS[symbol] || 2;
                
                // Calculate prices with appropriate multiplier
                
                // Calculate prices with appropriate multiplier
                const multiplier = PRICE_MULTIPLIERS[symbol] || 1;
                const price = Number(rawPrice) * Math.pow(10, expo) * multiplier;
                const adjustedPrice = price; // Price already in dollars after applying exponent
                
                // Calculate confidence only if available
                let confidenceStr = 'N/A';
                if (update.price.confidence) {
                    const confidence = Number(update.price.confidence) * Math.pow(10, expo) * multiplier;
                    confidenceStr = `±$${confidence.toLocaleString('en-US', {
                        minimumFractionDigits: decimalPlaces,
                        maximumFractionDigits: decimalPlaces
                    })}`;
                }
                
                const emaPrice = Number(update.ema_price.price) * Math.pow(10, expo) * multiplier;
                
                // Format the price data for API response

                // Format the price data for API response
                const formattedPrice: PriceData = {
                    symbol: symbol,
                    price: adjustedPrice,
                    confidence: confidenceStr,
                    emaPrice: emaPrice,
                    lastUpdated: new Date(update.price.publish_time * 1000).toISOString(),
                    decimalPlaces: decimalPlaces
                };
                
                // Store in appropriate category
                if (ASSET_CATEGORIES.CRYPTO.includes(symbol)) {
                    priceResults.crypto.push(formattedPrice);
                } else if (ASSET_CATEGORIES.PRECIOUS_METALS.includes(symbol)) {
                    priceResults.preciousMetals.push(formattedPrice);
                } else if (ASSET_CATEGORIES.STABLECOINS.includes(symbol)) {
                    priceResults.stablecoins.push(formattedPrice);
                } else if (ASSET_CATEGORIES.FOREX.includes(symbol)) {
                    priceResults.forex.push(formattedPrice);
                }
            } catch (error) {
                console.error(chalk.red(`Error processing ${symbol} price:`), error);
            }
        }

        // Return the results
        return priceResults;

    } catch (error) {
        console.error('❌ Error fetching prices:', error);
        throw error;
    }
}

// Create a price controller function for the API
export async function getPrices() {
    try {
        const prices = await fetchPrices();
        return {
            success: true,
            data: prices,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('Error in getPrices controller:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            timestamp: Date.now()
        };
    }
}
