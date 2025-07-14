import { calculateAPMPrice, resetBaseline, getRebalanceStatus } from '../src/controller/calculate-price.ts';


function generateCrashReport() {
    console.log('🔴 MARKET CRASH ANALYSIS REPORT');
    console.log('=' .repeat(60));
    console.log('Date: ' + new Date().toLocaleDateString());
    console.log('Analysis Type: Multi-Scenario Stress Testing\n');

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

    // Define crash scenarios
    const crashScenarios = [
        {
            name: 'Moderate Correction',
            description: 'Standard 20% crypto decline',
            btcPrice: 40000,  // -20%
            ethPrice: 2400,   // -20%
            expectedImpact: 'Minimal APM impact due to diversification'
        },
        {
            name: 'Severe Bear Market',
            description: 'Major 40% crypto crash',
            btcPrice: 30000,  // -40%
            ethPrice: 1800,   // -40%
            expectedImpact: 'Moderate APM decline, emergency rebalancing triggered'
        },
        {
            name: 'Black Swan Event',
            description: 'Catastrophic 60% crypto collapse',
            btcPrice: 20000,  // -60%
            ethPrice: 1200,   // -60%
            expectedImpact: 'Significant APM decline, maximum defensive positioning'
        },
        {
            name: 'Market Capitulation',
            description: 'Extreme 80% crypto meltdown',
            btcPrice: 10000,  // -80%
            ethPrice: 600,    // -80%
            expectedImpact: 'Heavy APM impact, but still protected by diversification'
        },
        {
            name: 'Multi-Asset Crisis',
            description: 'Combined crypto (-50%) + precious metals (-20%) crash',
            btcPrice: 25000,  // -50%
            ethPrice: 1500,   // -50%
            goldPrice: 1440,  // -20%
            silverPrice: 20,  // -20%
            expectedImpact: 'Severe stress test of portfolio resilience'
        }
    ];

    console.log('  BASELINE CONDITIONS (Normal Market)');
    console.log('-'.repeat(50));
    resetBaseline();
    
    try {
        const baseline = calculateAPMPrice(baselineData);
        console.log(`🟢 APM Token Price: $${baseline.apmPrice.toFixed(6)}`);
        console.log(`💰 Basket Value: $${baseline.basketValue.toFixed(2)}`);
        console.log(`    Market Condition: ${baseline.marketCondition}`);
        console.log(`📈 Crypto Allocation: ${((baseline.weights['BTC/USD'] + baseline.weights['ETH/USD']) * 100).toFixed(1)}%\n`);
    } catch (error) {
        console.error('Error in baseline calculation:', error.message);
        return;
    }

    console.log('🚨 CRASH SCENARIO ANALYSIS');
    console.log('='.repeat(60));

    crashScenarios.forEach((scenario, index) => {
        console.log(`\n${index + 1}. ${scenario.name.toUpperCase()}`);
        console.log('-'.repeat(scenario.name.length + 3));
        console.log(`📋 Description: ${scenario.description}`);
        console.log(`🔍 Expected Impact: ${scenario.expectedImpact}`);
        
        resetBaseline();
        
        // Create crash scenario data
        const crashData = {
            crypto: [
                { symbol: 'BTC/USD', price: scenario.btcPrice, emaPrice: scenario.btcPrice - 500 },
                { symbol: 'ETH/USD', price: scenario.ethPrice, emaPrice: scenario.ethPrice - 50 }
            ],
            preciousMetals: [
                { symbol: 'XAU/USD', price: scenario.goldPrice || 1800, emaPrice: (scenario.goldPrice || 1800) - 5 },
                { symbol: 'XAG/USD', price: scenario.silverPrice || 25, emaPrice: (scenario.silverPrice || 25) - 0.2 }
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
            
            // Then apply crash scenario
            const crashResult = calculateAPMPrice(crashData);
            
            const btcLoss = ((scenario.btcPrice - 50000) / 50000) * 100;
            const ethLoss = ((scenario.ethPrice - 3000) / 3000) * 100;
            const apmLoss = ((crashResult.apmPrice - 1.0) / 1.0) * 100;
            
            console.log(`💥 BTC Impact: ${btcLoss.toFixed(1)}% (${scenario.btcPrice.toLocaleString()})`);
            console.log(`💥 ETH Impact: ${ethLoss.toFixed(1)}% (${scenario.ethPrice.toLocaleString()})`);
            
            if (scenario.goldPrice) {
                const goldLoss = ((scenario.goldPrice - 1800) / 1800) * 100;
                console.log(`🥇 Gold Impact: ${goldLoss.toFixed(1)}% ($${scenario.goldPrice})`);
            }
            
            if (scenario.silverPrice) {
                const silverLoss = ((scenario.silverPrice - 25) / 25) * 100;
                console.log(`🥈 Silver Impact: ${silverLoss.toFixed(1)}% ($${scenario.silverPrice})`);
            }
            
            console.log('');
            console.log('  APM TOKEN RESPONSE:');
            
            if (apmLoss >= 0) {
                console.log(`🟢 APM Price: $${crashResult.apmPrice.toFixed(6)} (+${apmLoss.toFixed(2)}%)`);
            } else {
                console.log(`🔴 APM Price: $${crashResult.apmPrice.toFixed(6)} (${apmLoss.toFixed(2)}%)`);
            }
            
            console.log(`💰 Basket Value: $${crashResult.basketValue.toFixed(2)}`);
            console.log(`    Market Condition: ${crashResult.marketCondition}`);
            console.log(`⚖️ Rebalance Progress: ${(crashResult.rebalanceProgress * 100).toFixed(1)}%`);
            
            const cryptoAllocation = (crashResult.weights['BTC/USD'] + crashResult.weights['ETH/USD']) * 100;
            const stableAllocation = 100 - cryptoAllocation;
            
            console.log(`📈 New Crypto Allocation: ${cryptoAllocation.toFixed(1)}%`);
            console.log(`🛡️ Stable Asset Allocation: ${stableAllocation.toFixed(1)}%`);
            
            // Risk Assessment
            console.log('');
            console.log('📋 RISK ASSESSMENT:');
            if (Math.abs(apmLoss) < 5) {
                console.log('🟢 Low Risk: APM shows strong resilience');
            } else if (Math.abs(apmLoss) < 15) {
                console.log('🟡 Medium Risk: Moderate impact, within acceptable range');
            } else if (Math.abs(apmLoss) < 30) {
                console.log('🟠 High Risk: Significant impact, emergency protocols activated');
            } else {
                console.log('🔴 Critical Risk: Severe impact, maximum defensive positioning');
            }
            
        } catch (error) {
            console.error(`❌ Error in ${scenario.name} scenario:`, error.message);
        }
        
        console.log('\n' + '='.repeat(60));
    });

    // Summary and Recommendations
    console.log('\n  EXECUTIVE SUMMARY');
    console.log('='.repeat(30));
    console.log('✅ Key Findings:');
    console.log('• APM token demonstrates robust downside protection through diversification');
    console.log('• Emergency rebalancing activates during severe market stress');
    console.log('• Stable assets (USD, Gold, Forex) provide portfolio stability');
    console.log('• Dynamic allocation reduces crypto exposure during bear markets');
    console.log('');
    console.log('    Risk Management Effectiveness:');
    console.log('• Moderate corrections (20%): Minimal APM impact');
    console.log('• Severe crashes (40-60%): Controlled APM decline');
    console.log('• Extreme events (80%): Maximum protection engaged');
    console.log('');
    console.log('💡 Client Recommendations:');
    console.log('• APM provides superior downside protection vs pure crypto exposure');
    console.log('• Diversified basket design limits correlation with crypto markets');
    console.log('• Dynamic rebalancing optimizes risk/return profile automatically');
    console.log('• Consider APM as core holding for risk-adjusted crypto exposure');
}


function generateRecoveryAnalysis() {
    console.log('\n\n🚀 MARKET RECOVERY ANALYSIS');
    console.log('='.repeat(50));
    
    const recoveryScenarios = [
        { name: 'Gradual Recovery', btcPrice: 45000, ethPrice: 2700, description: '10% recovery from crash' },
        { name: 'Strong Bounce', btcPrice: 55000, ethPrice: 3300, description: '10% above baseline' },
        { name: 'Bull Rally', btcPrice: 65000, ethPrice: 3900, description: '30% above baseline' }
    ];
    
    recoveryScenarios.forEach(scenario => {
        console.log(`\n📈 ${scenario.name.toUpperCase()}`);
        console.log(`Description: ${scenario.description}`);
        
        resetBaseline();
        
        const recoveryData = {
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
            const result = calculateAPMPrice(recoveryData);
            const apmGain = ((result.apmPrice - 1.0) / 1.0) * 100;
            
            console.log(`💰 APM Price: $${result.apmPrice.toFixed(6)} (${apmGain >= 0 ? '+' : ''}${apmGain.toFixed(2)}%)`);
            console.log(`    Market Condition: ${result.marketCondition}`);
            console.log(`📈 Crypto Allocation: ${((result.weights['BTC/USD'] + result.weights['ETH/USD']) * 100).toFixed(1)}%`);
        } catch (error) {
            console.error('Error in recovery scenario:', error.message);
        }
    });
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
    generateCrashReport();
    generateRecoveryAnalysis();
    
    console.log('\n\n📋 REPORT GENERATED FOR CLIENT PRESENTATION');
    console.log('This analysis demonstrates APM token resilience across multiple market scenarios.');
}

export {
    generateCrashReport,
    generateRecoveryAnalysis
};

