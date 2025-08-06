import { 
    getCircuitBreakerStatus, 
    autoMonitorCircuitBreaker, 
    manualUnfreezeSwaps,
    CIRCUIT_BREAKER_CONFIG 
} from '../controller/calculate-price';

/**
 * Swap Management System
 * Handles automatic monitoring and management of swap freeze/unfreeze operations
 */

interface SwapManagerConfig {
    monitoringInterval: number; // milliseconds
    alertingEnabled: boolean;
    logLevel: 'info' | 'warn' | 'error';
    autoUnfreezeEnabled: boolean;
}

interface SwapStatus {
    isSwapAllowed: boolean;
    reason: string;
    timeUntilUnfreeze?: number;
    lastChecked: number;
}

class SwapManager {
    private config: SwapManagerConfig;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private isMonitoring: boolean = false;
    private alertCallbacks: Array<(status: SwapStatus) => void> = [];

    constructor(config: Partial<SwapManagerConfig> = {}) {
        this.config = {
            monitoringInterval: 30 * 1000, // 30 seconds
            alertingEnabled: true,
            logLevel: 'info',
            autoUnfreezeEnabled: true,
            ...config
        };
    }

    /**
     * Start automatic monitoring of swap status
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            this.log('warn', 'Swap monitoring is already running');
            return;
        }

        this.log('info', '🚀 Starting swap freeze/unfreeze monitoring system');
        this.log('info', `Monitoring interval: ${this.config.monitoringInterval / 1000} seconds`);
        
        this.isMonitoring = true;
        
        this.monitoringInterval = setInterval(() => {
            this.checkAndUpdateSwapStatus();
        }, this.config.monitoringInterval);

        // Run initial check
        this.checkAndUpdateSwapStatus();
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            this.log('warn', 'Swap monitoring is not running');
            return;
        }

        this.log('info', '📍 Stopping swap monitoring system');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.isMonitoring = false;
    }

    /**
     * Check current swap status and perform automatic actions
     */
    private checkAndUpdateSwapStatus(): void {
        try {
            // Run auto-monitor function to handle automatic unfreezing
            if (this.config.autoUnfreezeEnabled) {
                autoMonitorCircuitBreaker();
            }

            const cbStatus = getCircuitBreakerStatus();
            const swapStatus = this.getSwapStatus();

            // Log status periodically
            if (cbStatus.isTriggered) {
                this.log('warn', `🚨 Swaps frozen: ${swapStatus.reason}`);
                this.log('info', `Time remaining: ${Math.ceil((swapStatus.timeUntilUnfreeze || 0) / (60 * 1000))} minutes`);
            } else {
                this.log('info', '🟢 Swaps operational - Circuit breaker inactive');
            }

            // Trigger alerts if enabled
            if (this.config.alertingEnabled) {
                this.triggerAlerts(swapStatus);
            }

        } catch (error:any) {
            this.log('error', `Error in swap status monitoring: ${error.message}`);
        }
    }

    /**
     * Get current swap status
     */
    getSwapStatus(): SwapStatus {
        const cbStatus = getCircuitBreakerStatus();
        
        return {
            isSwapAllowed: !cbStatus.isTriggered,
            reason: cbStatus.isTriggered ? cbStatus.reason : 'Normal operations',
            timeUntilUnfreeze: cbStatus.isTriggered ? cbStatus.timeRemaining : undefined,
            lastChecked: Date.now()
        };
    }

    /**
     * Manual emergency unfreeze (admin function)
     */
    emergencyUnfreeze(): boolean {
        this.log('warn', '🚨 Emergency manual unfreeze initiated');
        
        const success = manualUnfreezeSwaps();
        
        if (success) {
            this.log('info', '✅ Emergency unfreeze successful');
            
            // Trigger alert for manual override
            const status: SwapStatus = {
                isSwapAllowed: true,
                reason: 'Manual emergency override',
                lastChecked: Date.now()
            };
            this.triggerAlerts(status);
        } else {
            this.log('error', '❌ Emergency unfreeze failed');
        }
        
        return success;
    }

    /**
     * Add alert callback function
     */
    onStatusChange(callback: (status: SwapStatus) => void): void {
        this.alertCallbacks.push(callback);
    }

    /**
     * Remove alert callback
     */
    removeStatusCallback(callback: (status: SwapStatus) => void): void {
        const index = this.alertCallbacks.indexOf(callback);
        if (index > -1) {
            this.alertCallbacks.splice(index, 1);
        }
    }

    /**
     * Trigger alerts to all registered callbacks
     */
    private triggerAlerts(status: SwapStatus): void {
        this.alertCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error: any) {
                this.log('error', `Error in alert callback: ${error.message}`);
            }
        });
    }

    /**
     * Log messages with timestamp and level
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [SWAP-MANAGER]`;
        
        switch (level) {
            case 'info':
                if (this.config.logLevel === 'info') {
                    console.log(`${prefix} 📝 ${message}`);
                }
                break;
            case 'warn':
                if (this.config.logLevel === 'info' || this.config.logLevel === 'warn') {
                    console.warn(`${prefix} ⚠️ ${message}`);
                }
                break;
            case 'error':
                console.error(`${prefix} ❌ ${message}`);
                break;
        }
    }

    /**
     * Get monitoring configuration
     */
    getConfig(): SwapManagerConfig {
        return { ...this.config };
    }

    /**
     * Update monitoring configuration
     */
    updateConfig(newConfig: Partial<SwapManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.log('info', 'Configuration updated');
        
        // Restart monitoring with new config if currently running
        if (this.isMonitoring) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    /**
     * Check if swaps are currently allowed (blocking function)
     */
    isSwapAllowed(): boolean {
        const status = this.getSwapStatus();
        return status.isSwapAllowed;
    }

    /**
     * Get system health status
     */
    getHealthStatus(): {
        isMonitoring: boolean;
        swapStatus: SwapStatus;
        circuitBreakerConfig: typeof CIRCUIT_BREAKER_CONFIG;
        uptime: number;
    } {
        return {
            isMonitoring: this.isMonitoring,
            swapStatus: this.getSwapStatus(),
            circuitBreakerConfig: CIRCUIT_BREAKER_CONFIG,
            uptime: process.uptime()
        };
    }
}

// Singleton instance for global use
let globalSwapManager: SwapManager | null = null;

/**
 * Get or create global swap manager instance
 */
export function getSwapManager(config?: Partial<SwapManagerConfig>): SwapManager {
    if (!globalSwapManager) {
        globalSwapManager = new SwapManager(config);
    }
    return globalSwapManager;
}

/**
 * Initialize swap management system
 */
export function initializeSwapManager(config?: Partial<SwapManagerConfig>): SwapManager {
    const manager = getSwapManager(config);
    manager.startMonitoring();
    return manager;
}

/**
 * Quick check if swaps are allowed (convenience function)
 */
export function canSwap(): boolean {
    const manager = getSwapManager();
    return manager.isSwapAllowed();
}

/**
 * Emergency unfreeze function (convenience function)
 */
export function emergencyUnfreeze(): boolean {
    const manager = getSwapManager();
    return manager.emergencyUnfreeze();
}

export { SwapManager };
export type { SwapManagerConfig, SwapStatus };

