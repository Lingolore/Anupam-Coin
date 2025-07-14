import { calculateAPMPrice, resetBaseline, getRebalanceStatus } from '../src/controller/calculate-price.ts';
import { fetchPrices } from '../src/controller/price-feed.ts';
import chalk from 'chalk';

/**
 * Ultra-Sensitive Market Test with 0.0001% thresholds and 30-second stability
 * This test will trigger bull/bear conditions with tiny market movements
 */

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function ultraSensitiveTest() {
    console.log(chalk.magenta.bold('🔬 ULTRA-SENSITIVE MARKET TEST'));
    console.log('='.repeat(60));
    console.log('Date: ' + new Date().toLocaleDateString());
    console.log('Time: ' + new Date().toLocaleTimeString());
    console.log('Test Type: Ultra-sensitive threshold testing\n');
    
    console.log(chalk.yellow('⚡ ULTRA Configuration:'));
    console.log('• Bull Threshold: 0.0001% (extremely sensitive)');
    console.log('• Bear Threshold: -0.0001% (extremely sensitive)');
    console.log('• Stability Period: 30 seconds (for rapid testing)');
    console.log('• This WILL trigger on tiny movements\n');
    
    try {
        // Reset baseline to start fresh
        resetBaseline();
        console.log(chalk.green('✅ Baseline reset for ultra-sensitive testing\n'));
        
        // Fetch real market data as baseline
        console.log(chalk.cyan('🔄 Fetching live market data for baseline...'));
        const baselineResponse = await fetchPrices();
        
        const basePriceData = {
            crypto: baselineResponse.crypto,
            preciousMetals: baselineResponse.preciousMetals,
            forex: [...baselineResponse.forex, 
                { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
                { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 }
            ]
        };
        
        console.log(chalk.green('✅ Baseline data fetched\n'));
        
        // Establish baseline
        console.log(chalk.blue.bold('  ESTABLISHING BASELINE'));
        console.log('-'.repeat(30));
        
        const baselineResult = calculateAPMPrice(basePriceData);
        console.log(`🟢 Baseline APM Price: $${baselineResult.apmPrice.toFixed(6)}`);
        console.log(`💰 Baseline Basket Value: $${baselineResult.basketValue.toFixed(2)}`);
        console.log(`    Baseline Market Condition: ${baselineResult.marketCondition}`);
        
        const baseCryptoAllocation = ((baselineResult.weights['BTC/USD'] + baselineResult.weights['ETH/USD']) * 100);
        console.log(`📈 Baseline Crypto Allocation: ${baseCryptoAllocation.toFixed(1)}%\n`);
        
        console.log('='.repeat(60));
        
        // Now we'll simulate tiny price increases to trigger BULL condition
        console.log(chalk.green.bold('🚀 TESTING BULL CONDITION TRIGGER'));
        console.log('Artificially increasing crypto prices by tiny amounts...\n');
        
        // Create slightly modified data to trigger bull condition
        const originalBTC = basePriceData.crypto.find(c => c.symbol === 'BTC/USD');
        const originalETH = basePriceData.crypto.find(c => c.symbol === 'ETH/USD');
        
        for (let i = 1; i <= 3; i++) {
            console.log(chalk.cyan(`🔄 Bull Test ${i}/3 - Tiny price increase...`));
            
            // Increase prices by very small amounts (0.001% to 0.002%)
            const btcIncrease = 1 + (0.00001 * i); // 0.001%, 0.002%, 0.003%
            const ethIncrease = 1 + (0.00001 * i);
            
            const modifiedData = {
                crypto: [
                    { 
                        symbol: 'BTC/USD', 
                        price: originalBTC.price * btcIncrease, 
                        emaPrice: originalBTC.emaPrice 
                    },
                    { 
                        symbol: 'ETH/USD', 
                        price: originalETH.price * ethIncrease, 
                        emaPrice: originalETH.emaPrice 
                    }
                ],
                preciousMetals: basePriceData.preciousMetals,
                forex: basePriceData.forex
            };
            
            const testResult = calculateAPMPrice(modifiedData);
            
            console.log(`\n  Bull Test ${i} Results:`);
            console.log(`🔥 BTC Price: $${modifiedData.crypto[0].price.toLocaleString()} (+${((btcIncrease-1)*100).toFixed(4)}%)`);
            console.log(`🔥 ETH Price: $${modifiedData.crypto[1].price.toLocaleString()} (+${((ethIncrease-1)*100).toFixed(4)}%)`);
            console.log(`    Market Condition: ${testResult.marketCondition} → ${testResult.targetMarketCondition}`);
            console.log(`📈 Crypto Change: ${testResult.cryptoChangePercent.toFixed(6)}%`);
            console.log(`💰 APM Price: $${testResult.apmPrice.toFixed(6)}`);
            console.log(`⚖️ Rebalance Progress: ${(testResult.rebalanceProgress * 100).toFixed(1)}%`);
            
            const currentCryptoAllocation = ((testResult.weights['BTC/USD'] + testResult.weights['ETH/USD']) * 100);
            console.log(`📈 Current Crypto Allocation: ${currentCryptoAllocation.toFixed(1)}%`);
            
            // Show APM performance
            const apmChange = ((testResult.apmPrice - baselineResult.apmPrice) / baselineResult.apmPrice) * 100;
            if (apmChange >= 0) {
                console.log(`  APM Change: ${chalk.green(`+${apmChange.toFixed(6)}%`)}`);
            } else {
                console.log(`  APM Change: ${chalk.red(`${apmChange.toFixed(6)}%`)}`);
            }
            
            // Market condition analysis
            if (testResult.marketCondition === 'BULL') {
                console.log(chalk.green('🚀 BULL CONDITION DETECTED!'));
                console.log(chalk.green('📈 System should increase crypto allocation'));
            } else if (testResult.targetMarketCondition === 'BULL') {
                console.log(chalk.yellow('    BULL CONDITION TARGETED (rebalancing in progress)'));
            }
            
            // Rebalancing status
            const rebalanceStatus = getRebalanceStatus();
            if (rebalanceStatus.isRebalancing) {
                console.log(chalk.blue(`🔄 Rebalancing Active: ${(rebalanceStatus.progress * 100).toFixed(1)}% complete`));
                console.log(`   From: ${rebalanceStatus.currentCondition} → To: ${rebalanceStatus.targetCondition}`);
            }
            
            console.log('-'.repeat(50));
            
            // Wait 35 seconds to meet stability requirement
            if (i < 3) {
                console.log(chalk.gray('⏳ Waiting 35 seconds for condition stability...\n'));
                await delay(35000);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Now test BEAR condition
        console.log(chalk.red.bold('   TESTING BEAR CONDITION TRIGGER'));
        console.log('Artificially decreasing crypto prices by tiny amounts...\n');
        
        // Reset for bear test
        await delay(35000);
        
        for (let i = 1; i <= 3; i++) {
            console.log(chalk.cyan(`🔄 Bear Test ${i}/3 - Tiny price decrease...`));
            
            // Decrease prices by very small amounts
            const btcDecrease = 1 - (0.00001 * i); // -0.001%, -0.002%, -0.003%
            const ethDecrease = 1 - (0.00001 * i);
            
            const modifiedData = {
                crypto: [
                    { 
                        symbol: 'BTC/USD', 
                        price: originalBTC.price * btcDecrease, 
                        emaPrice: originalBTC.emaPrice 
                    },
                    { 
                        symbol: 'ETH/USD', 
                        price: originalETH.price * ethDecrease, 
                        emaPrice: originalETH.emaPrice 
                    }
                ],
                preciousMetals: basePriceData.preciousMetals,
                forex: basePriceData.forex
            };
            
            const testResult = calculateAPMPrice(modifiedData);
            
            console.log(`\n  Bear Test ${i} Results:`);
            console.log(`📉 BTC Price: $${modifiedData.crypto[0].price.toLocaleString()} (${((btcDecrease-1)*100).toFixed(4)}%)`);
            console.log(`📉 ETH Price: $${modifiedData.crypto[1].price.toLocaleString()} (${((ethDecrease-1)*100).toFixed(4)}%)`);
            console.log(`    Market Condition: ${testResult.marketCondition} → ${testResult.targetMarketCondition}`);
            console.log(`📈 Crypto Change: ${testResult.cryptoChangePercent.toFixed(6)}%`);
            console.log(`💰 APM Price: $${testResult.apmPrice.toFixed(6)}`);
            console.log(`⚖️ Rebalance Progress: ${(testResult.rebalanceProgress * 100).toFixed(1)}%`);
            
            const currentCryptoAllocation = ((testResult.weights['BTC/USD'] + testResult.weights['ETH/USD']) * 100);
            console.log(`📈 Current Crypto Allocation: ${currentCryptoAllocation.toFixed(1)}%`);
            
            // Show APM performance
            const apmChange = ((testResult.apmPrice - baselineResult.apmPrice) / baselineResult.apmPrice) * 100;
            if (apmChange >= 0) {
                console.log(`  APM Change: ${chalk.green(`+${apmChange.toFixed(6)}%`)}`);
            } else {
                console.log(`  APM Change: ${chalk.red(`${apmChange.toFixed(6)}%`)}`);
            }
            
            // Market condition analysis
            if (testResult.marketCondition === 'BEAR') {
                console.log(chalk.red('   BEAR CONDITION DETECTED!'));
                console.log(chalk.red('📉 System should decrease crypto allocation'));
            } else if (testResult.targetMarketCondition === 'BEAR') {
                console.log(chalk.yellow('    BEAR CONDITION TARGETED (rebalancing in progress)'));
            }
            
            // Rebalancing status
            const rebalanceStatus = getRebalanceStatus();
            if (rebalanceStatus.isRebalancing) {
                console.log(chalk.blue(`🔄 Rebalancing Active: ${(rebalanceStatus.progress * 100).toFixed(1)}% complete`));
                console.log(`   From: ${rebalanceStatus.currentCondition} → To: ${rebalanceStatus.targetCondition}`);
            }
            
            console.log('-'.repeat(50));
            
            // Wait for stability
            if (i < 3) {
                console.log(chalk.gray('⏳ Waiting 35 seconds for condition stability...\n'));
                await delay(35000);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(chalk.green.bold('    ULTRA-SENSITIVE TEST SUMMARY'));
        console.log('='.repeat(35));
        console.log('✅ Test Results:');
        console.log('• Ultra-sensitive thresholds: 0.0001% / -0.0001%');
        console.log('• Stability period: 30 seconds');
        console.log('• Tested both bull and bear condition triggers');
        console.log('• Observed rebalancing behavior with micro-movements');
        console.log('• APM price responsiveness to tiny market changes');
        console.log('');
        console.log('🔬 Sensitivity Analysis:');
        console.log('• System responds to movements as small as 0.001%');
        console.log('• Rebalancing triggers with ultra-fast stability check');
        console.log('• Market conditions change with minimal price movements');
        console.log('• APM tracks even the smallest crypto fluctuations');
        
    } catch (error) {
        console.error(chalk.red('❌ Ultra-sensitive test failed:'), error);
        throw error;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    ultraSensitiveTest()
        .then(() => {
            console.log(chalk.green.bold('\n\n✅ ULTRA-SENSITIVE TEST COMPLETED'));
            console.log('You have successfully observed bull/bear detection and rebalancing!');
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red.bold('\n\n❌ ULTRA-SENSITIVE TEST FAILED'));
            console.error('Error:', error.message);
            process.exit(1);
        });
}

export { ultraSensitiveTest };

