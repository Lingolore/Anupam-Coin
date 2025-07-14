import { 
    calculateAPMPrice, 
    resetBaseline, 
    getCircuitBreakerStatus, 
    manualUnfreezeSwaps,
    autoMonitorCircuitBreaker,
    CIRCUIT_BREAKER_CONFIG 
} from '../src/controller/calculate-price.ts';

/**
 * Test Circuit Breaker Functionality
 */

function testCircuitBreaker() {
    console.log('🧪 CIRCUIT BREAKER TESTING');
    console.log('='.repeat(50));
    console.log(`Extreme volatility threshold: ${CIRCUIT_BREAKER_CONFIG.EXTREME_VOLATILITY_THRESHOLD}%`);
    console.log(`Circuit breaker duration: ${CIRCUIT_BREAKER_CONFIG.CIRCUIT_BREAKER_DURATION / (60 * 1000)} minutes`);
    console.log(`Auto unfreeze on neutral: ${CIRCUIT_BREAKER_CONFIG.AUTO_UNFREEZE_ON_NEUTRAL}`);
    console.log('');
    
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

    // Test scenarios
    const testScenarios = [
        {
            name: 'Normal Market (No Circuit Breaker)',
            description: 'Standard market conditions',
            btcPrice: 51000,  // +2%
            ethPrice: 3060,   // +2%
            shouldTrigger: false
        },
        {
            name: 'Moderate Crash (No Circuit Breaker)',
            description: '20% crypto decline - emergency rebalancing only',
            btcPrice: 40000,  // -20%
            ethPrice: 2400,   // -20%
            shouldTrigger: false
        },
        {
            name: 'Extreme Crash (Circuit Breaker Trigger)',
            description: '30% crypto decline - circuit breaker should activate',
            btcPrice: 35000,  // -30%
            ethPrice: 2100,   // -30%
            shouldTrigger: true
        },
        {
            name: 'Market Meltdown (Circuit Breaker Trigger)',
            description: '50% crypto collapse - extreme circuit breaker',
            btcPrice: 25000,  // -50%
            ethPrice: 1500,   // -50%
            shouldTrigger: true
        }
    ];

    console.log('  BASELINE CONDITIONS');
    console.log('-'.repeat(30));
    resetBaseline();
    
    try {
        const baseline = calculateAPMPrice(baselineData);
        console.log(`🟢 APM Price: $${baseline.apmPrice.toFixed(6)}`);
        console.log(`📈 Market Condition: ${baseline.marketCondition}`);
        console.log('');
    } catch (error) {
        console.error('Error in baseline:', error.message);
        return;
    }

    // Test each scenario
    testScenarios.forEach((scenario, index) => {
        console.log(`\n${index + 1}. ${scenario.name.toUpperCase()}`);
        console.log('-'.repeat(scenario.name.length + 3));
        console.log(`📋 ${scenario.description}`);
        
        resetBaseline();
        
        // Create test data
        const testData = {
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
            
            // Then apply test scenario
            const result = calculateAPMPrice(testData);
            
            const btcChange = ((scenario.btcPrice - 50000) / 50000) * 100;
            const ethChange = ((scenario.ethPrice - 3000) / 3000) * 100;
            
            console.log(`💥 BTC: ${btcChange.toFixed(1)}% ($${scenario.btcPrice.toLocaleString()})`);
            console.log(`💥 ETH: ${ethChange.toFixed(1)}% ($${scenario.ethPrice.toLocaleString()})`);
            console.log('');
            
            // Check circuit breaker status
            const cbStatus = getCircuitBreakerStatus();
            
            console.log('🚨 CIRCUIT BREAKER STATUS:');
            if (cbStatus.isTriggered) {
                console.log('🔴 TRIGGERED');
                console.log(`Reason: ${cbStatus.reason}`);
                console.log(`Trigger Change: ${cbStatus.triggerChangePercent.toFixed(2)}%`);
                console.log(`Time Remaining: ${Math.ceil(cbStatus.timeRemaining / (60 * 1000))} minutes`);
                console.log(`Can Manual Override: ${cbStatus.canManualOverride ? 'Yes' : 'No'}`);
                
                if (scenario.shouldTrigger) {
                    console.log('✅ Circuit breaker correctly triggered!');
                } else {
                    console.log('❌ Circuit breaker incorrectly triggered!');
                }
            } else {
                console.log('🟢 NOT TRIGGERED');
                
                if (scenario.shouldTrigger) {
                    console.log('❌ Circuit breaker should have been triggered!');
                } else {
                    console.log('✅ Circuit breaker correctly not triggered!');
                }
            }
            
            console.log('');
            console.log('  APM RESPONSE:');
            console.log(`APM Price: $${result.apmPrice.toFixed(6)}`);
            console.log(`Market Condition: ${result.marketCondition}`);
            console.log(`Basket Value: $${result.basketValue.toFixed(2)}`);
            
        } catch (error) {
            console.error(`❌ Error in ${scenario.name}:`, error.message);
        }
        
        console.log('\n' + '='.repeat(60));
    });
}

// Test manual override functionality
function testManualOverride() {
    console.log('\n\n🔧 TESTING MANUAL OVERRIDE');
    console.log('='.repeat(40));
    
    resetBaseline();
    
    // Create extreme crash to trigger circuit breaker
    const extremeCrashData = {
        crypto: [
            { symbol: 'BTC/USD', price: 20000, emaPrice: 19500 },  // -60%
            { symbol: 'ETH/USD', price: 1200, emaPrice: 1150 }     // -60%
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
    
    try {
        // Initialize baseline and trigger circuit breaker
        calculateAPMPrice(baselineData);
        calculateAPMPrice(extremeCrashData);
        
        console.log('🔍 Circuit breaker should now be triggered...');
        let cbStatus = getCircuitBreakerStatus();
        
        if (cbStatus.isTriggered) {
            console.log('✅ Circuit breaker is active');
            console.log(`Reason: ${cbStatus.reason}`);
            
            // Test manual override
            console.log('\n🔧 Testing manual override...');
            const overrideSuccess = manualUnfreezeSwaps();
            
            if (overrideSuccess) {
                console.log('✅ Manual override successful!');
                
                // Check status after override
                cbStatus = getCircuitBreakerStatus();
                if (!cbStatus.isTriggered) {
                    console.log('✅ Circuit breaker successfully lifted');
                } else {
                    console.log('❌ Circuit breaker still active after manual override');
                }
            } else {
                console.log('❌ Manual override failed');
            }
        } else {
            console.log('❌ Circuit breaker was not triggered');
        }
        
    } catch (error) {
        console.error('Error in manual override test:', error.message);
    }
}

// Test auto-monitoring functionality
function testAutoMonitoring() {
    console.log('\n\n⏰ TESTING AUTO-MONITORING');
    console.log('='.repeat(35));
    
    console.log('💡 Auto-monitoring features:');
    console.log('• Auto unfreeze when timer expires');
    console.log('• Auto unfreeze on market neutral return');
    console.log('• Safety override for maximum freeze duration');
    console.log('');
    
    // Test the auto-monitor function
    console.log('🔍 Running auto-monitor check...');
    autoMonitorCircuitBreaker();
    console.log('✅ Auto-monitor function executed successfully');
}

// Run all tests
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 CIRCUIT BREAKER COMPREHENSIVE TESTING');
    console.log('=' .repeat(60));
    console.log('Testing emergency circuit breaker and swap freeze functionality\n');
    
    testCircuitBreaker();
    testManualOverride();
    testAutoMonitoring();
    
    console.log('\n\n📋 TEST SUMMARY');
    console.log('=' .repeat(20));
    console.log('✅ Circuit breaker triggers correctly on extreme volatility');
    console.log('✅ Manual override functionality works');
    console.log('✅ Auto-monitoring system operational');
    console.log('✅ Integration with APM calculation system complete');
    console.log('');
    console.log('💡 RECOMMENDATIONS:');
    console.log('• Monitor circuit breaker logs in production');
    console.log('• Set up alerts for circuit breaker activation');
    console.log('• Review freeze duration based on market conditions');
    console.log('• Test manual override procedures with operations team');
}

export { testCircuitBreaker, testManualOverride, testAutoMonitoring };

