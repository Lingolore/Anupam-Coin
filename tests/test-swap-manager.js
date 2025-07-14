import { 
    initializeSwapManager, 
    getSwapManager, 
    canSwap, 
    emergencyUnfreeze 
} from '../src/utils/swap-manager.ts';
import { 
    calculateAPMPrice, 
    resetBaseline 
} from '../src/controller/calculate-price.ts';

/**
 * Test Swap Manager Functionality
 * Demonstrates automatic monitoring and management of swap operations
 */

function testSwapManager() {
    console.log('💻 SWAP MANAGER TESTING');
    console.log('='.repeat(50));
    
    // Initialize swap manager with custom config
    const swapManager = initializeSwapManager({
        monitoringInterval: 5000, // 5 seconds for testing
        alertingEnabled: true,
        logLevel: 'info',
        autoUnfreezeEnabled: true
    });
    
    console.log('✅ Swap manager initialized and monitoring started');
    
    // Set up alert callback
    swapManager.onStatusChange((status) => {
        console.log(`🚨 ALERT: Swap status changed`);
        console.log(`  - Swaps allowed: ${status.isSwapAllowed}`);
        console.log(`  - Reason: ${status.reason}`);
        if (status.timeUntilUnfreeze) {
            console.log(`  - Time until unfreeze: ${Math.ceil(status.timeUntilUnfreeze / (60 * 1000))} minutes`);
        }
    });
    
    // Test baseline conditions
    console.log('\n📋 Testing normal operations...');
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
    
    resetBaseline();
    calculateAPMPrice(baselineData);
    
    console.log(`🔍 Can swap: ${canSwap()}`);
    
    // Wait a moment for monitoring
    setTimeout(() => {
        console.log('\n💥 Triggering circuit breaker with extreme crash...');
        
        const crashData = {
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
        
        calculateAPMPrice(crashData);
        
        console.log(`🔍 Can swap after crash: ${canSwap()}`);
        
        // Test health status
        const health = swapManager.getHealthStatus();
        console.log('\n📋 System Health Status:');
        console.log(`  - Monitoring active: ${health.isMonitoring}`);
        console.log(`  - Swaps allowed: ${health.swapStatus.isSwapAllowed}`);
        console.log(`  - Uptime: ${Math.round(health.uptime)} seconds`);
        console.log(`  - Circuit breaker threshold: ${health.circuitBreakerConfig.EXTREME_VOLATILITY_THRESHOLD}%`);
        
        // Test emergency unfreeze after a delay
        setTimeout(() => {
            console.log('\n🚨 Testing emergency unfreeze...');
            const unfreezeResult = emergencyUnfreeze();
            console.log(`Emergency unfreeze result: ${unfreezeResult}`);
            console.log(`Can swap after emergency unfreeze: ${canSwap()}`);
            
            // Stop monitoring after test
            setTimeout(() => {
                console.log('\n📍 Stopping swap manager monitoring...');
                swapManager.stopMonitoring();
                console.log('✅ Test completed successfully');
            }, 2000);
        }, 3000);
    }, 2000);
}

// Demo production usage
function demoProductionUsage() {
    console.log('\n\n🏭 PRODUCTION USAGE DEMO');
    console.log('='.repeat(40));
    
    // Example of how to integrate with your trading system
    console.log('💡 Example integration with trading system:');
    
    const productionCode = `
// In your trading/swap endpoint:
function handleSwapRequest(fromToken, toToken, amount) {
    // Check if swaps are allowed before processing
    if (!canSwap()) {
        const manager = getSwapManager();
        const status = manager.getSwapStatus();
        
        return {
            success: false,
            error: 'Swaps temporarily frozen',
            reason: status.reason,
            retryAfter: status.timeUntilUnfreeze
        };
    }
    
    // Proceed with normal swap logic
    return processSwap(fromToken, toToken, amount);
}

// In your application startup:
initializeSwapManager({
    monitoringInterval: 30000, // 30 seconds
    alertingEnabled: true,
    logLevel: 'warn' // Only show warnings and errors in production
});

// Set up alerting to your monitoring system
const manager = getSwapManager();
manager.onStatusChange((status) => {
    if (!status.isSwapAllowed) {
        // Send alert to Slack, Discord, email, etc.
        notifyOpsTeam({
            message: 'APM swaps frozen due to circuit breaker',
            reason: status.reason,
            timeUntilUnfreeze: status.timeUntilUnfreeze
        });
    }
});
    `;
    
    console.log(productionCode);
    
    console.log('📋 Key Features for Production:');
    console.log('• Automatic monitoring every 30 seconds');
    console.log('• Auto-unfreeze when conditions normalize');
    console.log('• Manual emergency override for admins');
    console.log('• Real-time status checking for swap requests');
    console.log('• Configurable logging levels');
    console.log('• Health status endpoint for monitoring');
    console.log('• Alert callbacks for external notifications');
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 SWAP MANAGER COMPREHENSIVE TESTING');
    console.log('='.repeat(60));
    console.log('Testing automatic swap freeze/unfreeze management system\n');
    
    testSwapManager();
    
    // Show production demo after test completes
    setTimeout(() => {
        demoProductionUsage();
        
        console.log('\n\n🏆 FINAL RECOMMENDATIONS:');
        console.log('='.repeat(30));
        console.log('✅ Circuit breaker implementation: COMPLETE');
        console.log('✅ Automatic swap management: COMPLETE');
        console.log('✅ Emergency override system: COMPLETE');

        
        process.exit(0);
    }, 10000);
}

export { testSwapManager, demoProductionUsage };

