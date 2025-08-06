#!/usr/bin/env tsx

import { configDotenv } from 'dotenv';
import { createEmergencyPriceService } from './controller/emergency-price-service';
import { circuitBreaker } from './controller/emergency-breaker';

// Load environment variables
configDotenv();

/**
 * Emergency Circuit Breaker System Startup Script
 * 
 * This script initializes and starts the complete emergency protection system:
 * 1. Emergency circuit breaker for price anomaly detection
 * 2. Swap contract pause/resume functionality
 * 3. Automated price monitoring and safety checks
 * 4. Health monitoring and alerting
 */

class EmergencySystemManager {
    private emergencyPriceService?: any;
    private isRunning: boolean = false;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor() {
        // Setup graceful shutdown
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught Exception:', error);
            this.emergencyShutdown();
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }

    /**
     * Initialize and start the emergency system
     */
    public async start(): Promise<void> {
        try {
            console.log('🚀 Starting Emergency Circuit Breaker System...');
            console.log('📅 Timestamp:', new Date().toISOString());
            console.log('🔗 RPC URL:', process.env.RPC_URL || 'https://api.devnet.solana.com');
            console.log('📄 Swap Contract:', process.env.SWAP_CONTRACT_ADDRESS);
            console.log('🗂️  Swap State:', process.env.SWAP_CONTRACT_STATE);

            // Validate required environment variables
            await this.validateEnvironment();

            // Initialize emergency price service
            console.log('\n📡 Initializing Emergency Price Service...');
            this.emergencyPriceService = createEmergencyPriceService();
            await this.emergencyPriceService.initialize();

            // Configure emergency circuit breaker with governance addresses
            // Note: In production, add actual governance addresses
            const governanceAddresses = [
                process.env.GOVERNANCE_ADDRESS_1 || 'HvRZWbReRzrK52DoLxa5bpeWnEH2LJ6kvx5DuFvzxN8H',
                // Add more governance addresses as needed
            ];

            console.log('🏛️  Governance addresses configured:', governanceAddresses.length);

            // Start the emergency price service
            this.emergencyPriceService.start();

            // Start health monitoring
            this.startHealthMonitoring();

            this.isRunning = true;
            console.log('\n✅ Emergency Circuit Breaker System is now active!');
            console.log('🛡️  Protection Features:');
            console.log('   • Price volatility monitoring (25% threshold)');
            console.log('   • Automatic swap contract pausing');
            console.log('   • Emergency governance controls');
            console.log('   • Auto-recovery after 30 minutes');
            console.log('   • Maximum 4-hour safety pause');
            console.log('   • Real-time health monitoring');
            
            // Display current status
            await this.displaySystemStatus();

        } catch (error) {
            console.error('❌ Failed to start Emergency Circuit Breaker System:', error);
            process.exit(1);
        }
    }

    /**
     * Validate required environment variables
     */
    private async validateEnvironment(): Promise<void> {
        const required = [
            'SWAP_CONTRACT_ADDRESS',
            'SWAP_CONTRACT_STATE', 
            'PRIVATE_KEY',
            'RPC_URL'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        // Validate private key format
        const privateKey = process.env.PRIVATE_KEY!;
        if (!privateKey.includes(',') && privateKey.length < 32) {
            throw new Error('PRIVATE_KEY must be either comma-separated array or valid base58 string');
        }

        console.log('✅ Environment validation passed');
    }

    /**
     * Start health monitoring with periodic checks
     */
    private startHealthMonitoring(): void {
        console.log('🏥 Starting health monitoring...');
        
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.emergencyPriceService.healthCheck();
                
                if (!health.healthy) {
                    console.warn('⚠️ System Health Issues Detected:');
                    health.issues.forEach((issue:any) => console.warn(`   ❌ ${issue}`));
                }

                if (health.warnings.length > 0) {
                    console.warn('⚠️ System Warnings:');
                    health.warnings.forEach((warning:any) => console.warn(`   ⚠️  ${warning}`));
                }

                // Log periodic status (every 5 minutes)
                if (Date.now() % (5 * 60 * 1000) < 60000) {
                    console.log('\n📊 Periodic Status Update:');
                    const status = this.emergencyPriceService.getSystemStatus();
                    console.log(`   Price Service: ${status.priceService.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
                    console.log(`   Emergency CB: ${status.emergencyCircuitBreaker.isActive ? '🚨 Active' : '🟢 Normal'}`);
                    console.log(`   APM CB: ${status.apmCircuitBreaker.isTriggered ? '🚨 Triggered' : '🟢 Normal'}`);
                    console.log(`   Swap Status: ${status.swapStatus?.isPaused ? '⏸️ Paused' : '🟢 Active'}`);
                    
                    const timeSince = Math.floor(status.priceService.timeSinceLastUpdate / 1000);
                    console.log(`   Last Update: ${timeSince}s ago`);
                }

            } catch (error) {
                console.error('❌ Health check failed:', error);
            }
        }, 60000); // Check every minute
    }

    /**
     * Display current system status
     */
    private async displaySystemStatus(): Promise<void> {
        try {
            console.log('\n📊 Current System Status:');
            const status = this.emergencyPriceService.getSystemStatus();
            
            console.log('┌─ Emergency Circuit Breaker ─┐');
            console.log(`│ Active: ${status.emergencyCircuitBreaker.isActive ? '🚨 YES' : '🟢 NO'}`);
            if (status.emergencyCircuitBreaker.isActive) {
                console.log(`│ Trigger: ${status.emergencyCircuitBreaker.trigger}`);
                console.log(`│ Time Remaining: ${Math.ceil(status.emergencyCircuitBreaker.timeRemaining / 60000)}min`);
            }
            console.log('└──────────────────────────────┘');
            
            console.log('┌─ APM Circuit Breaker ────────┐');
            console.log(`│ Triggered: ${status.apmCircuitBreaker.isTriggered ? '🚨 YES' : '🟢 NO'}`);
            if (status.apmCircuitBreaker.isTriggered) {
                console.log(`│ Reason: ${status.apmCircuitBreaker.reason}`);
                console.log(`│ Time Remaining: ${Math.ceil(status.apmCircuitBreaker.timeRemaining / 60000)}min`);
            }
            console.log('└──────────────────────────────┘');

            if (status.swapStatus) {
                console.log('┌─ Swap Contract Status ───────┐');
                console.log(`│ Paused: ${status.swapStatus.isPaused ? '⏸️ YES' : '🟢 NO'}`);
                if (status.swapStatus.isPaused) {
                    console.log(`│ Reason: ${status.swapStatus.pauseReason}`);
                    console.log(`│ Resume At: ${new Date(status.swapStatus.resumeAt).toLocaleTimeString()}`);
                }
                console.log('└──────────────────────────────┘');
            }

        } catch (error) {
            console.error('Failed to display system status:', error);
        }
    }

    /**
     * Manual emergency pause command
     */
    public async emergencyPause(reason: string): Promise<void> {
        if (!this.emergencyPriceService) {
            console.error('❌ Emergency service not initialized');
            return;
        }

        console.log(`🚨 MANUAL EMERGENCY PAUSE: ${reason}`);
        const authority = process.env.GOVERNANCE_ADDRESS_1 || 'MANUAL_OVERRIDE';
        const success = await this.emergencyPriceService.emergencyPause(reason, authority);
        
        if (success) {
            console.log('✅ Emergency pause activated');
        } else {
            console.log('❌ Emergency pause failed');
        }
    }

    /**
     * Manual emergency resume command
     */
    public async emergencyResume(reason: string): Promise<void> {
        if (!this.emergencyPriceService) {
            console.error('❌ Emergency service not initialized');
            return;
        }

        console.log(`🔧 MANUAL EMERGENCY RESUME: ${reason}`);
        const authority = process.env.GOVERNANCE_ADDRESS_1 || 'MANUAL_OVERRIDE';
        const success = await this.emergencyPriceService.emergencyResume(reason, authority);
        
        if (success) {
            console.log('✅ Emergency resume activated');
        } else {
            console.log('❌ Emergency resume failed');
        }
    }

    /**
     * Get detailed system status for external monitoring
     */
    public async getStatus(): Promise<any> {
        if (!this.emergencyPriceService) {
            return { error: 'Service not initialized' };
        }

        const health = await this.emergencyPriceService.healthCheck();
        const status = this.emergencyPriceService.getSystemStatus();
        
        return {
            healthy: health.healthy,
            issues: health.issues,
            warnings: health.warnings,
            status,
            uptime: process.uptime(),
            timestamp: Date.now()
        };
    }

    /**
     * Graceful shutdown
     */
    private async gracefulShutdown(signal: string): Promise<void> {
        console.log(`\n🛑 Received ${signal} - Starting graceful shutdown...`);
        
        if (this.emergencyPriceService) {
            console.log('📡 Stopping Emergency Price Service...');
            this.emergencyPriceService.stop();
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.isRunning = false;
        console.log('✅ Emergency Circuit Breaker System shutdown complete');
        process.exit(0);
    }

    /**
     * Emergency shutdown for critical errors
     */
    private emergencyShutdown(): void {
        console.log('🚨 EMERGENCY SHUTDOWN - Critical error detected');
        
        if (this.emergencyPriceService) {
            try {
                this.emergencyPriceService.stop();
            } catch (error) {
                console.error('Error stopping emergency service:', error);
            }
        }

        process.exit(1);
    }
}

// Main execution
async function main() {
    const manager = new EmergencySystemManager();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'pause' && args[1]) {
        console.log('🚨 Manual Emergency Pause Requested');
        await manager.start();
        await manager.emergencyPause(args[1]);
        return;
    }
    
    if (command === 'resume' && args[1]) {
        console.log('🔧 Manual Emergency Resume Requested');
        await manager.start();
        await manager.emergencyResume(args[1]);
        return;
    }
    
    if (command === 'status') {
        console.log('📊 System Status Check');
        await manager.start();
        const status = await manager.getStatus();
        console.log(JSON.stringify(status, null, 2));
        return;
    }

    // Default: start the system
    await manager.start();
    
    // Keep the process running
    console.log('\n💡 Emergency System Commands:');
    console.log('   npm run emergency:pause "reason"   - Manual emergency pause');
    console.log('   npm run emergency:resume "reason"  - Manual emergency resume');
    console.log('   npm run emergency:status           - Check system status');
    console.log('   Ctrl+C                             - Graceful shutdown');
}

// Handle direct execution
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

export { EmergencySystemManager };
