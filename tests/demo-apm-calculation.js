import { calculateAPMPrice, resetBaseline, getRebalanceStatus } from '../src/controller/calculate-price.ts';

// Demo: Calculate APM token price with dynamic rebalancing

function demonstrateAPMCalculation() {
    console.log('🚀 APM Token Price Calculation Demo with Dynamic Rebalancing\n');
    
    // Reset the baseline for a fresh start
    resetBaseline();
    
    // Sample price data (you would get this from your price feeds)
    const currentPriceData = {
        crypto: [
            { symbol: 'BTC/USD', price: 52500, emaPrice: 52000 }, // +5%
            { symbol: 'ETH/USD', price: 3150, emaPrice: 3100 }     // +5%
        ],
        preciousMetals: [
            { symbol: 'XAU/USD', price: 1800, emaPrice: 1795 },
            { symbol: 'XAG/USD', price: 25, emaPrice: 24.8 }
        ],
        forex: [
            { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'EUR/USD', price: 1.08, emaPrice: 1.075 },
            { symbol: 'GBP/USD', price: 1.25, emaPrice: 1.248 }
        ]
    };
    
    console.log('  Input Price Data:');
    console.log('BTC/USD: $50,000');
    console.log('ETH/USD: $3,000');
    console.log('XAU/USD: $1,800');
    console.log('XAG/USD: $25');
    console.log('EUR/USD: $1.08');
    console.log('GBP/USD: $1.25\n');
    
    try {
        // Calculate the APM price
        const result = calculateAPMPrice(currentPriceData);
        
        console.log('✅ APM Calculation Results:');
        console.log(`📈 APM Token Price: $${result.apmPrice.toFixed(6)}`);
        console.log(`💰 Basket Value: $${result.basketValue.toFixed(2)}`);
        console.log(`    Market Condition: ${result.marketCondition}`);
        console.log(`⚖️ Rebalance Progress: ${(result.rebalanceProgress * 100).toFixed(1)}%`);
        console.log(`⏰ Next Rebalance Time: ${new Date(result.nextRebalanceTime).toLocaleString()}\n`);
        
        // Get detailed rebalance status
        const rebalanceStatus = getRebalanceStatus();
        console.log('🔄 Rebalance Status:');
        console.log(`Currently Rebalancing: ${rebalanceStatus.isRebalancing ? 'Yes' : 'No'}`);
        console.log(`Current Condition: ${rebalanceStatus.currentCondition}`);
        console.log(`Target Condition: ${rebalanceStatus.targetCondition}`);
        console.log(`Progress: ${(rebalanceStatus.progress * 100).toFixed(1)}%\n`);
        
        // Show current weights
        if (result.weights) {
            console.log('⚖️ Current Portfolio Weights:');
            Object.entries(result.weights).forEach(([asset, weight]) => {
                console.log(`${asset}: ${(weight * 100).toFixed(1)}%`);
            });
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error calculating APM price:', error.message);
        return null;
    }
}

// Demonstrate price changes and rebalancing
function demonstrateMarketChanges() {
    console.log('\n🎢 Demonstrating Market Changes and Dynamic Rebalancing\n');
    
    resetBaseline();
    
    // Scenario 1: Bull Market (crypto prices up 25%)
    console.log('📈 Scenario 1: Bull Market (+25% crypto)');
    const bullMarketData = {
        crypto: [
            { symbol: 'BTC/USD', price: 62500, emaPrice: 61500 },  // +25%
            { symbol: 'ETH/USD', price: 3750, emaPrice: 3700 }     // +25%
        ],
        preciousMetals: [
            { symbol: 'XAU/USD', price: 1800, emaPrice: 1795 },
            { symbol: 'XAG/USD', price: 25, emaPrice: 24.8 }
        ],
        forex: [
            { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'EUR/USD', price: 1.08, emaPrice: 1.075 },
            { symbol: 'GBP/USD', price: 1.25, emaPrice: 1.248 }
        ]
    };
    
    try {
        const bullResult = calculateAPMPrice(bullMarketData);
        console.log(`APM Price: $${bullResult.apmPrice.toFixed(6)}`);
        console.log(`Market Condition: ${bullResult.marketCondition}`);
        console.log(`Basket Value: $${bullResult.basketValue.toFixed(2)}\n`);
    } catch (error) {
        console.error('Error in bull market scenario:', error.message);
    }
    
    // Scenario 2: Bear Market (crypto prices down 30%)
    console.log('📉 Scenario 2: Bear Market (-30% crypto)');
    const bearMarketData = {
        crypto: [
            { symbol: 'BTC/USD', price: 25000, emaPrice: 24500 },  // -50%
            { symbol: 'ETH/USD', price: 1500, emaPrice: 1450 }     // -50%
        ],
        preciousMetals: [
            { symbol: 'XAU/USD', price: 1800, emaPrice: 1795 },
            { symbol: 'XAG/USD', price: 25, emaPrice: 24.8 }
        ],
        forex: [
            { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'EUR/USD', price: 1.08, emaPrice: 1.075 },
            { symbol: 'GBP/USD', price: 1.25, emaPrice: 1.248 }
        ]
    };
    
    try {
        const bearResult = calculateAPMPrice(bearMarketData);
        console.log(`APM Price: $${bearResult.apmPrice.toFixed(6)}`);
        console.log(`Market Condition: ${bearResult.marketCondition}`);
        console.log(`Basket Value: $${bearResult.basketValue.toFixed(2)}\n`);
    } catch (error) {
        console.error('Error in bear market scenario:', error.message);
    }
}

// Run the demonstrations
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateAPMCalculation();
    demonstrateMarketChanges();
    
    console.log('\n💡 Key Features Demonstrated:');
    console.log('• Dynamic portfolio rebalancing based on market conditions');
    console.log('• Real-time APM token price calculation');
    console.log('• Market condition detection (Bull/Bear/Neutral)');
    console.log('• Emergency rebalancing triggers');
    console.log('• Progressive weight transitions');
    console.log('• Comprehensive error handling');
}

export {
    demonstrateAPMCalculation,
    demonstrateMarketChanges
};

