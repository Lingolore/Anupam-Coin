import { calculateAPMPrice, resetBaseline, getRebalanceStatus } from '../src/controller/calculate-price.js';
import { fetchPrices, PriceResponse } from '../src/controller/price-feed.js';
import chalk from 'chalk';

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

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Real Market Test with Live Data
 * Tests live market data with current threshold configuration
 */
export async function realMarketTest(): Promise<void> {
    console.log(chalk.cyan.bold('🌍 REAL MARKET TEST - LIVE DATA'));
    console.log('='.repeat(60));
    console.log('Date: ' + new Date().toLocaleDateString());
    console.log('Time: ' + new Date().toLocaleTimeString());
    console.log('Test Type: Live Market Data with Current Thresholds\n');
    
    console.log(chalk.yellow('📊 Configuration:'));
    console.log('• Bull Threshold: 0.0001% (ULTRA sensitive)');
    console.log('• Bear Threshold: -0.0001% (ULTRA sensitive)');
    console.log('• This will detect the tiniest market micro-movements\n');
    
    try {
        // Reset baseline to start fresh
        resetBaseline();
        console.log(chalk.green('✅ Baseline reset for fresh start\n'));
        
        // Fetch real market data
        console.log(chalk.cyan('🔄 Fetching live market data...'));
        const priceResponse: PriceResponse = await fetchPrices();
        
        // Convert price response to the format expected by calculateAPMPrice
        const priceData: PriceData = {
            crypto: priceResponse.crypto,
            preciousMetals: priceResponse.preciousMetals,
            forex: [...priceResponse.forex, 
                { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
                { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 }
            ]
        };
        
        console.log(chalk.green('✅ Live market data fetched successfully\n'));
        
        // Display current market prices
        console.log(chalk.magenta.bold('💰 CURRENT MARKET PRICES'));
        console.log('-'.repeat(40));
        
        console.log(chalk.yellow('🟡 Cryptocurrencies:'));
        priceData.crypto.forEach(asset => {
            console.log(`  ${asset.symbol}: $${asset.price.toLocaleString()} (EMA: $${asset.emaPrice.toLocaleString()})`);
        });
        
        console.log(chalk.yellow('\n🥇 Precious Metals:'));
        priceData.preciousMetals.forEach(asset => {
            console.log(`  ${asset.symbol}: $${asset.price.toLocaleString()} (EMA: $${asset.emaPrice.toLocaleString()})`);
        });
        
        console.log(chalk.yellow('\n💱 Forex:'));
        priceData.forex.forEach(asset => {
            if (asset.symbol !== 'USD/USD' && asset.symbol !== 'USDT/USD') {
                console.log(`  ${asset.symbol}: $${asset.price.toFixed(4)} (EMA: $${asset.emaPrice.toFixed(4)})`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        // First calculation to establish baseline
        console.log(chalk.blue.bold('📊 ESTABLISHING BASELINE'));
        console.log('-'.repeat(30));
        
        const baselineResult = calculateAPMPrice(priceData);
        
        console.log(`🟢 Initial APM Price: $${baselineResult.apmPrice.toFixed(6)}`);
        console.log(`💰 Initial Basket Value: $${baselineResult.basketValue.toFixed(2)}`);
        console.log(`🎯 Initial Market Condition: ${baselineResult.marketCondition}`);
        
        const initialCryptoAllocation = ((baselineResult.weights['BTC/USD'] + baselineResult.weights['ETH/USD']) * 100);
        console.log(`📈 Initial Crypto Allocation: ${initialCryptoAllocation.toFixed(1)}%`);
        
        console.log('\n' + '='.repeat(60));
        
        // Now let's simulate monitoring over time to see how sensitive the system is
        console.log(chalk.green.bold('⏰ REAL-TIME MONITORING SIMULATION'));
        console.log('Fetching market data every 30 seconds to observe sensitivity...\n');
        
        for (let i = 1; i <= 5; i++) {
            console.log(chalk.cyan(`🔄 Update ${i}/5 - Fetching fresh market data...`));
            
            try {
                // Fetch fresh market data
                const freshPriceResponse: PriceResponse = await fetchPrices();
                const freshPriceData: PriceData = {
                    crypto: freshPriceResponse.crypto,
                    preciousMetals: freshPriceResponse.preciousMetals,
                    forex: [...freshPriceResponse.forex, 
                        { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
                        { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 }
                    ]
                };
                
                // Calculate with fresh data
                const currentResult = calculateAPMPrice(freshPriceData);
                
                console.log(`\n📊 Update ${i} Results:`);
                console.log(`🎯 Market Condition: ${currentResult.marketCondition} → ${currentResult.targetMarketCondition}`);
                console.log(`📈 Crypto Change: ${currentResult.cryptoChangePercent.toFixed(4)}%`);
                console.log(`💰 APM Price: $${currentResult.apmPrice.toFixed(6)}`);
                console.log(`⚖️ Rebalance Progress: ${(currentResult.rebalanceProgress * 100).toFixed(1)}%`);
                
                const currentCryptoAllocation = ((currentResult.weights['BTC/USD'] + currentResult.weights['ETH/USD']) * 100);
                console.log(`📈 Current Crypto Allocation: ${currentCryptoAllocation.toFixed(1)}%`);
                
                // Show price changes from baseline
                const apmChange = ((currentResult.apmPrice - baselineResult.apmPrice) / baselineResult.apmPrice) * 100;
                if (apmChange >= 0) {
                    console.log(`📊 APM Change from Baseline: ${chalk.green(`+${apmChange.toFixed(4)}%`)}`);
                } else {
                    console.log(`📊 APM Change from Baseline: ${chalk.red(`${apmChange.toFixed(4)}%`)}`);
                }
                
                // Market condition analysis
                if (currentResult.marketCondition !== 'NEUTRAL') {
                    console.log(chalk.yellow(`🚨 Market condition detected: ${currentResult.marketCondition}`));
                    if (currentResult.marketCondition === 'BULL') {
                        console.log(chalk.green('📈 System should increase crypto allocation'));
                    } else {
                        console.log(chalk.red('📉 System should decrease crypto allocation'));
                    }
                }
                
                // Rebalancing status
                const rebalanceStatus = getRebalanceStatus();
                if (rebalanceStatus.isRebalancing) {
                    console.log(chalk.blue(`🔄 Rebalancing in progress: ${rebalanceStatus.progress * 100}% complete`));
                    console.log(`   From: ${rebalanceStatus.currentCondition} → To: ${rebalanceStatus.targetCondition}`);
                } else {
                    console.log(chalk.gray('⏸️ No active rebalancing'));
                }
                
                console.log('-'.repeat(50));
                
            } catch (error: any) {
                console.error(chalk.red(`❌ Error in update ${i}:`), error.message);
            }
            
            // Wait 30 seconds before next update (except for last iteration)
            if (i < 5) {
                console.log(chalk.gray('⏳ Waiting 30 seconds for next update...\n'));
                await delay(30000); // 30 seconds
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(chalk.green.bold('📊 REAL MARKET TEST SUMMARY'));
        console.log('='.repeat(30));
        console.log('✅ Key Observations:');
        console.log('• Tested with ultra-sensitive thresholds (0.0001% / -0.0001%)');
        console.log('• Monitored real market data over 2.5 minutes');
        console.log('• Observed market condition detection sensitivity');
        console.log('• Tracked rebalancing behavior with live data');
        console.log('• APM price responsiveness to market micro-movements');
        console.log('');
        console.log('🎯 Market Sensitivity Analysis:');
        console.log('• System will react to even tiny crypto price movements');
        console.log('• Frequent condition changes expected with these thresholds');
        console.log('• Rebalancing may be more active than with 5%/-5% thresholds');
        console.log('• Consider if this sensitivity level suits your strategy');
        
    } catch (error: any) {
        console.error(chalk.red('❌ Real market test failed:'), error);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    realMarketTest()
        .then(() => {
            console.log(chalk.green.bold('\n\n✅ REAL MARKET TEST COMPLETED SUCCESSFULLY'));
            console.log('The system has been tested with live market data and updated thresholds.');
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n\n❌ REAL MARKET TEST FAILED'));
            console.error('Error:', error.message);
            process.exit(1);
        });
}

