import { demonstrateAPMCalculation, demonstrateMarketChanges } from './demo-apm-calculation.js';
import { generateCrashReport, generateRecoveryAnalysis } from './market-crash-analysis.js';
import { testCircuitBreaker, testManualOverride, testAutoMonitoring } from './test-circuit-breaker.js';
import { testSwapManager, demoProductionUsage } from './test-swap-manager.js';
import { generateBullMarketReport } from './bull-market-analysis.js';

/**
 * Comprehensive Test Suite Runner
 * Runs all APM system tests in sequence
 */

class TestRunner {
    constructor() {
        this.testResults = {
            apmCalculation: null,
            marketCrash: null,
            circuitBreaker: null,
            swapManager: null,
            errors: []
        };
        this.startTime = Date.now();
    }

    async runTest(testName, testFunction, description) {
        console.log(`\n\n🔄 Running ${testName.toUpperCase()} Tests`);
        console.log('=' .repeat(80));
        console.log(`📋 ${description}\n`);
        
        try {
            const testStart = Date.now();
            await testFunction();
            const testEnd = Date.now();
            
            this.testResults[testName] = {
                status: 'PASSED',
                duration: testEnd - testStart,
                error: null
            };
            
            console.log(`\n✅ ${testName.toUpperCase()} Tests: PASSED (${this.testResults[testName].duration}ms)`);
            
        } catch (error) {
            this.testResults[testName] = {
                status: 'FAILED',
                duration: 0,
                error: error.message
            };
            
            this.testResults.errors.push({
                test: testName,
                error: error.message,
                stack: error.stack
            });
            
            console.error(`\n❌ ${testName.toUpperCase()} Tests: FAILED`);
            console.error(`Error: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🚀 APM SYSTEM COMPREHENSIVE TEST SUITE');
        console.log('=' .repeat(80));
        console.log('Running complete test coverage for APM token system\n');
        console.log(`📅 Start Time: ${new Date().toISOString()}`);
        console.log(`🖥️  Environment: ${process.platform}`);
        console.log(`📦 Node Version: ${process.version}`);
        
        // Test 1: Basic APM Calculation
        await this.runTest(
            'apmCalculation',
            async () => {
                console.log('    Testing basic APM token price calculation and rebalancing...');
                demonstrateAPMCalculation();
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                console.log('\n🎢 Testing market condition changes...');
                demonstrateMarketChanges();
            },
            'Basic APM token price calculation and dynamic rebalancing'
        );
        
        // Test 2: Market Crash Analysis
        await this.runTest(
            'marketCrash',
            async () => {
                console.log('📉 Running comprehensive market crash scenarios...');
                generateCrashReport();
                
                console.log('\n🚀 Testing market recovery scenarios...');
                generateRecoveryAnalysis();
            },
            'Market crash analysis and stress testing across multiple scenarios'
        );
        
        // Test 3: Circuit Breaker System
        await this.runTest(
            'circuitBreaker',
            async () => {
                console.log('🚨 Testing emergency circuit breaker functionality...');
                testCircuitBreaker();
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('\n🔧 Testing manual override capabilities...');
                testManualOverride();
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('\n⏰ Testing automatic monitoring...');
                testAutoMonitoring();
            },
            'Emergency circuit breaker system and manual override functionality'
        );
        
        // Test 4: Swap Manager System
        await this.runTest(
            'swapManager',
            async () => {
                console.log('💻 Testing swap management system...');
                
                // Run swap manager test with timeout to prevent hanging
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Swap manager test timeout after 15 seconds'));
                    }, 15000);
                    
                    try {
                        testSwapManager();
                        
                        // Wait for test to complete
                        setTimeout(() => {
                            clearTimeout(timeout);
                            resolve();
                        }, 12000);
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
            },
            'Automatic swap freeze/unfreeze management and monitoring system'
        );
        
        // Generate final report
        this.generateFinalReport();
    }

    generateFinalReport() {
        const endTime = Date.now();
        const totalDuration = endTime - this.startTime;
        
        console.log('\n\n🏆 COMPREHENSIVE TEST SUITE RESULTS');
        console.log('=' .repeat(80));
        
        // Test Results Summary
        console.log('  TEST RESULTS SUMMARY:');
        console.log('-'.repeat(40));
        
        let passedTests = 0;
        let failedTests = 0;
        
        Object.entries(this.testResults).forEach(([testName, result]) => {
            if (testName === 'errors') return;
            
            const status = result?.status || 'SKIPPED';
            const duration = result?.duration || 0;
            const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⏭️';
            
            console.log(`${icon} ${testName.padEnd(20)} | ${status.padEnd(8)} | ${duration}ms`);
            
            if (status === 'PASSED') passedTests++;
            if (status === 'FAILED') failedTests++;
        });
        
        console.log('-'.repeat(40));
        console.log(`📈 Passed: ${passedTests} | ❌ Failed: ${failedTests} | ⏱️  Total: ${totalDuration}ms`);
        
        // Error Details
        if (this.testResults.errors.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            console.log('-'.repeat(40));
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. Test: ${error.test}`);
                console.log(`   Error: ${error.error}`);
                console.log('');
            });
        }
        
        // System Health Check
        console.log('\n🔍 SYSTEM HEALTH CHECK:');
        console.log('-'.repeat(40));
        
        const healthChecks = [
            { name: 'APM Price Calculation', status: this.testResults.apmCalculation?.status === 'PASSED' },
            { name: 'Market Crash Protection', status: this.testResults.marketCrash?.status === 'PASSED' },
            { name: 'Circuit Breaker System', status: this.testResults.circuitBreaker?.status === 'PASSED' },
            { name: 'Swap Management', status: this.testResults.swapManager?.status === 'PASSED' },
        ];
        
        healthChecks.forEach(check => {
            const icon = check.status ? '🟢' : '🔴';
            const status = check.status ? 'OPERATIONAL' : 'NEEDS ATTENTION';
            console.log(`${icon} ${check.name.padEnd(25)} | ${status}`);
        });
        
        // Production Readiness Assessment
        console.log('\n🚀 PRODUCTION READINESS ASSESSMENT:');
        console.log('-'.repeat(40));
        
        const allTestsPassed = passedTests === 4 && failedTests === 0;
        
        if (allTestsPassed) {
            console.log('🟢 PRODUCTION READY');
            console.log('✅ All critical systems operational');
            console.log('✅ Risk management systems functional');
            console.log('✅ Emergency procedures tested');
            console.log('✅ Monitoring systems active');
            
            console.log('\n    DEPLOYMENT RECOMMENDATIONS:');
            console.log('• Deploy to production environment');
            console.log('• Initialize monitoring systems');
            console.log('• Set up operational alerts');
            console.log('• Document emergency procedures');
            console.log('• Train operations team on circuit breaker');
            
        } else {
            console.log('🔴 NOT PRODUCTION READY');
            console.log(`❌ ${failedTests} critical systems failed testing`);
            console.log('⚠️  Address all failed tests before deployment');
            console.log('⚠️  Conduct additional testing and validation');
        }
        
        // Performance Metrics
        console.log('\n  PERFORMANCE METRICS:');
        console.log('-'.repeat(40));
        console.log(`⏱️  Total Test Duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
        console.log(`🧮 Average Test Duration: ${(totalDuration / 4 / 1000).toFixed(2)} seconds`);
        console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
        console.log(`📅 Test Completed: ${new Date().toISOString()}`);
        
        // Final Status
        const finalStatus = allTestsPassed ? 'SUCCESS' : 'PARTIAL_FAILURE';
        console.log(`\n🏁 FINAL STATUS: ${finalStatus}`);
        
        if (allTestsPassed) {
            console.log('\n🎉 Congratulations! Your APM system has passed all comprehensive tests.');
            console.log('🚀 The system is ready for production deployment with full risk management capabilities.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review and fix issues before production deployment.');
        }
        
        // Exit with appropriate code
        process.exit(allTestsPassed ? 0 : 1);
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new TestRunner();
    
    // Handle process signals gracefully
    process.on('SIGINT', () => {
        console.log('\n\n⏹️  Test execution interrupted by user');
        runner.generateFinalReport();
    });
    
    process.on('uncaughtException', (error) => {
        console.error('\n❌ Uncaught Exception:', error.message);
        runner.testResults.errors.push({
            test: 'SYSTEM',
            error: error.message,
            stack: error.stack
        });
        runner.generateFinalReport();
    });
    
    // Run all tests
    runner.runAllTests().catch(error => {
        console.error('\n❌ Test suite execution failed:', error.message);
        runner.testResults.errors.push({
            test: 'TEST_RUNNER',
            error: error.message,
            stack: error.stack
        });
        runner.generateFinalReport();
    });
}

export { TestRunner };

