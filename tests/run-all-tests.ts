import { generateBullMarketReport } from './bull-market-analysis.js';
import { generateMarketCrashReport } from './market-crash-analysis.js';
import { realMarketTest } from './real-market-test.js';
import { ultraSensitiveTest } from './ultra-sensitive-test.js';
import { testCircuitBreaker } from './test-circuit-breaker.js';
import chalk from 'chalk';

async function runAllTests() {
    console.log(chalk.bold.blue('🚀 RUNNING ALL TESTS 🚀'));
    console.log('='.repeat(80));

    try {
        console.log(chalk.yellow('\n[1/5] BULL MARKET ANALYSIS TEST')); 
        generateBullMarketReport();
        console.log(chalk.green('✅ Bull Market Analysis Complete\n'));

        console.log(chalk.yellow('[2/5] MARKET CRASH ANALYSIS TEST'));
        generateMarketCrashReport();
        console.log(chalk.green('✅ Market Crash Analysis Complete\n'));

        console.log(chalk.yellow('[3/5] REAL MARKET TEST'));
        await realMarketTest();
        console.log(chalk.green('✅ Real Market Test Complete\n'));

        console.log(chalk.yellow('[4/5] ULTRA-SENSITIVE TEST'));
        await ultraSensitiveTest();
        console.log(chalk.green('✅ Ultra-Sensitive Test Complete\n'));

        console.log(chalk.yellow('[5/5] CIRCUIT BREAKER TEST'));
        testCircuitBreaker();
        console.log(chalk.green('✅ Circuit Breaker Test Complete\n'));

        console.log(chalk.bold.green('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉'));
    } catch (error:any) {
        console.error(chalk.red(`❌ Error during tests: ${error.message}`));
    }
}

// Run all tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(error => console.error(error));
}

export { runAllTests };

