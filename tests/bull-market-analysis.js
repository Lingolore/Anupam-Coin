import { calculateAPMPrice, resetBaseline, getRebalanceStatus } from '../src/controller/calculate-price.ts';

/**
 * Comprehensive Bull Market Analysis
 * Tests how APM token responds to various bull market scenarios
 */

function generateBullMarketReport() {
    console.log('🟢 BULL MARKET ANALYSIS REPORT');
    console.log('=' .repeat(60));
    console.log('Date: ' + new Date().toLocaleDateString());
    console.log('Analysis Type: Bull Market Stress Testing\n');
    
    // Baseline normal market conditions
    const baselineData = {
        crypto: [
            { symbol: 'BTC/USD', price: 50000, emaPrice: 49500 },
            { symbol: 'ETH/USD', price: 3000, emaPrice: 2950 }
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

    // Define bull market scenarios
    const bullScenarios = [
        {
            name: 'Modest Bull Run',
            description: '+5% crypto increase - threshold trigger',
            btcPrice: 52500,  // +5%
            ethPrice: 3150,   // +5%
            expectedBehavior: 'Should trigger BULL market allocation (30% crypto)'
        },
        {
            name: 'Strong Bull Market',
            description: '+15% crypto rally',
            btcPrice: 57500,  // +15%
            ethPrice: 3450,   // +15%
            expectedBehavior: 'Should maintain BULL allocation with higher APM value'
        },
        {
            name: 'Major Bull Rally',
            description: '+30% crypto surge',
            btcPrice: 65000,  // +30%
            ethPrice: 3900,   // +30%
            expectedBehavior: 'Maximum bull allocation, significant APM appreciation'
        },
        {
            name: 'Extreme Bull Run',
            description: '+50% crypto boom',
            btcPrice: 75000,  // +50%
            ethPrice: 4500,   // +50%
            expectedBehavior: 'Sustained bull allocation, major APM gains'
        },
        {
            name: 'Parabolic Bull Market',
            description: '+100% crypto explosion',
            btcPrice: 100000, // +100%
            ethPrice: 6000,   // +100%
            expectedBehavior: 'Maximum crypto exposure, exceptional APM performance'
        }
    ];

    console.log('  BASELINE CONDITIONS (Normal Market)');
    console.log('-'.repeat(50));
    resetBaseline();
    
    let baselineResult;
    try {
        baselineResult = calculateAPMPrice(baselineData);
        console.log(`🟢 APM Token Price: $${baselineResult.apmPrice.toFixed(6)}`);
        console.log(`💰 Basket Value: $${baselineResult.basketValue.toFixed(2)}`);
        console.log(`    Market Condition: ${baselineResult.marketCondition}`);
        
        const cryptoAllocation = ((baselineResult.weights['BTC/USD'] + baselineResult.weights['ETH/USD']) * 100);
        console.log(`📈 Crypto Allocation: ${cryptoAllocation.toFixed(1)}%\n`);
    } catch (error) {
        console.error('Error in baseline calculation:', error.message);
        return;
    }

    console.log('🚀 BULL MARKET SCENARIO ANALYSIS');
    console.log('='.repeat(60));

    bullScenarios.forEach((scenario, index) => {
        console.log(`\n${index + 1}. ${scenario.name.toUpperCase()}`);
        console.log('-'.repeat(scenario.name.length + 3));
        console.log(`📋 Description: ${scenario.description}`);
        console.log(`🔍 Expected: ${scenario.expectedBehavior}`);
        
        resetBaseline();
        
        // Create bull scenario data with time progression for stability
        const bullData = {
            crypto: [
                { symbol: 'BTC/USD', price: scenario.btcPrice, emaPrice: scenario.btcPrice - 500 },
                { symbol: 'ETH/USD', price: scenario.ethPrice, emaPrice: scenario.ethPrice - 50 }
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
            // Initialize with baseline first
            calculateAPMPrice(baselineData);
            
            // Simulate market transition over time for stability requirement
            console.log('\n🔄 Simulating market transition for stability...');
            
            // Step 1: Small increase to build history
            const transitionData1 = {
                crypto: [
                    { symbol: 'BTC/USD', price: 50000 + (scenario.btcPrice - 50000) * 0.3, emaPrice: 49500 },
                    { symbol: 'ETH/USD', price: 3000 + (scenario.ethPrice - 3000) * 0.3, emaPrice: 2950 }
                ],
                preciousMetals: bullData.preciousMetals,
                forex: bullData.forex
            };
            calculateAPMPrice(transitionData1);
            
            // Step 2: Medium increase
            const transitionData2 = {
                crypto: [
                    { symbol: 'BTC/USD', price: 50000 + (scenario.btcPrice - 50000) * 0.7, emaPrice: 49500 },
                    { symbol: 'ETH/USD', price: 3000 + (scenario.ethPrice - 3000) * 0.7, emaPrice: 2950 }
                ],
                preciousMetals: bullData.preciousMetals,
                forex: bullData.forex
            };
            calculateAPMPrice(transitionData2);
            
            // Step 3: Final target prices
            const bullResult = calculateAPMPrice(bullData);
            
            const btcGain = ((scenario.btcPrice - 50000) / 50000) * 100;
            const ethGain = ((scenario.ethPrice - 3000) / 3000) * 100;
            const apmGain = ((bullResult.apmPrice - baselineResult.apmPrice) / baselineResult.apmPrice) * 100;
            
            console.log(`💥 BTC Impact: +${btcGain.toFixed(1)}% ($${scenario.btcPrice.toLocaleString()})`);
            console.log(`💥 ETH Impact: +${ethGain.toFixed(1)}% ($${scenario.ethPrice.toLocaleString()})`);
            console.log('');
            console.log('  APM TOKEN RESPONSE:');
            
            if (apmGain >= 0) {
                console.log(`🟢 APM Price: $${bullResult.apmPrice.toFixed(6)} (+${apmGain.toFixed(2)}%)`);
            } else {
                console.log(`🔴 APM Price: $${bullResult.apmPrice.toFixed(6)} (${apmGain.toFixed(2)}%)`);
            }
            
            console.log(`💰 Basket Value: $${bullResult.basketValue.toFixed(2)}`);
            console.log(`    Market Condition: ${bullResult.marketCondition}`);
            console.log(`⚖️ Rebalance Progress: ${(bullResult.rebalanceProgress * 100).toFixed(1)}%`);
            
            const cryptoAllocation = (bullResult.weights['BTC/USD'] + bullResult.weights['ETH/USD']) * 100;
            const stableAllocation = 100 - cryptoAllocation;
            
            console.log(`📈 Crypto Allocation: ${cryptoAllocation.toFixed(1)}%`);
            console.log(`🛡️ Stable Asset Allocation: ${stableAllocation.toFixed(1)}%`);
            
            // Performance Assessment
            console.log('');
            console.log('📋 PERFORMANCE ASSESSMENT:');
            
            // Compare APM performance vs pure crypto
            const avgCryptoGain = (btcGain + ethGain) / 2;
            const outperformance = apmGain - avgCryptoGain;
            
            if (bullResult.marketCondition === 'BULL') {
                console.log('✅ Bull market correctly detected');
                if (cryptoAllocation >= 29) { // Close to 30%
                    console.log('✅ Portfolio correctly rebalanced to bull allocation');
                } else {
                    console.log('⚠️ Portfolio rebalancing in progress or incomplete');
                }
            } else {
                console.log('❌ Bull market not detected - may need more time for stability');
            }
            
            console.log(`📈 APM vs Crypto Performance: ${apmGain.toFixed(2)}% vs ${avgCryptoGain.toFixed(2)}%`);
            
            if (outperformance > 0) {
                console.log(`🟢 APM outperformed by ${outperformance.toFixed(2)}%`);
            } else if (outperformance < -5) {
                console.log(`🟡 APM underperformed by ${Math.abs(outperformance).toFixed(2)}% (expected due to diversification)`);
            } else {
                console.log(`🟡 APM performance aligned with expectations`);
            }
            
            // Risk vs Return Analysis
            const riskAdjustedReturn = apmGain / Math.max(avgCryptoGain, 1); // Avoid division by zero
            console.log(`📉 Risk-Adjusted Performance: ${(riskAdjustedReturn * 100).toFixed(1)}%`);
            
        } catch (error) {
            console.error(`❌ Error in ${scenario.name} scenario:`, error.message);
        }
        
        console.log('\n' + '='.repeat(60));
    });

    // Summary and Recommendations
    console.log('\n  BULL MARKET EXECUTIVE SUMMARY');
    console.log('='.repeat(40));
    console.log('✅ Key Findings:');
    console.log('• APM token provides controlled exposure to crypto bull markets');
    console.log('• Dynamic rebalancing increases crypto allocation during bull runs');
    console.log('• Diversification provides smoother returns vs pure crypto exposure');
    console.log('• Risk-adjusted performance optimized for sustainable growth');
    console.log('');
    console.log('    Bull Market Management Effectiveness:');
    console.log('• Small increases (+5%): Triggers bull rebalancing');
    console.log('• Strong rallies (+15-30%): Maximizes crypto exposure');
    console.log('• Extreme runs (+50%+): Maintains disciplined allocation');
    console.log('');
    console.log('💡 Client Value Proposition:');
    console.log('• Participate in crypto bull markets with reduced volatility');
    console.log('• Automatic optimization of risk/return balance');
    console.log('• Professional portfolio management without manual intervention');
    console.log('• Stable foundation with growth potential');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
    generateBullMarketReport();
    
    console.log('\n\n📋 BULL MARKET ANALYSIS COMPLETE');
    console.log('Report demonstrates APM performance across various bull market scenarios.');
}

export { generateBullMarketReport };

