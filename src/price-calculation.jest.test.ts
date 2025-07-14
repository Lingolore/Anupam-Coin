import {
    calculateAPMPrice,
    resetBaseline,
    getRebalanceStatus,
    validateMarketWeights,
    MARKET_WEIGHTS,
    REBALANCE_CONFIG,
    MARKET_DETECTION_CONFIG,
    INITIAL_BASKET_VALUE,
    INITIAL_APM_PRICE,
    PriceData,
    APMPriceResult,
    MarketCondition
} from './controller/calculate-price';

// Mock price data generators
function createMockPriceData(btcPrice: number = 50000, ethPrice: number = 3000): PriceData {
    return {
        crypto: [
            { symbol: 'BTC/USD', price: btcPrice, emaPrice: btcPrice * 0.98 },
            { symbol: 'ETH/USD', price: ethPrice, emaPrice: ethPrice * 0.98 },
        ],
        preciousMetals: [
            { symbol: 'XAU/USD', price: 1800, emaPrice: 1795 },
            { symbol: 'XAG/USD', price: 25, emaPrice: 24.5 },
        ],
        forex: [
            { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 },
            { symbol: 'EUR/USD', price: 1.08, emaPrice: 1.078 },
            { symbol: 'GBP/USD', price: 1.25, emaPrice: 1.248 },
        ]
    };
}

// Helper function to simulate time passing
function simulateTimePassing(milliseconds: number): void {
    const originalNow = Date.now;
    Date.now = () => originalNow() + milliseconds;
}

describe('APM Price Calculation and Rebalancing Tests', () => {
    beforeEach(() => {
        resetBaseline();
        // Reset Date.now to original implementation
        Date.now = () => new Date().getTime();
    });

    describe('Price Calculation Core Functionality', () => {
        test('should calculate initial APM price correctly', () => {
            const mockData = createMockPriceData();
            const result = calculateAPMPrice(mockData);
            
            expect(result).toBeInstanceOf(Object);
            expect(typeof result.apmPrice).toBe('number');
            expect(typeof result.basketValue).toBe('number');
            expect(typeof result.timestamp).toBe('number');
            expect(['BULL', 'BEAR', 'NEUTRAL']).toContain(result.marketCondition);
        });

        test('should validate market weights sum to 100%', () => {
            expect(() => validateMarketWeights()).not.toThrow();
            
            // Verify each market condition weights sum to 1.0
            Object.values(MARKET_WEIGHTS).forEach(weights => {
                const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
                expect(total).toBeCloseTo(1.0, 3);
            });
        });

        test('should maintain price consistency across identical inputs', () => {
            const mockData = createMockPriceData();
            const result1 = calculateAPMPrice(mockData);
            const result2 = calculateAPMPrice(mockData);
            
            expect(result1.apmPrice).toBe(result2.apmPrice);
            expect(result1.basketValue).toBe(result2.basketValue);
            expect(result1.marketCondition).toBe(result2.marketCondition);
        });
    });

    describe('Market Condition Detection', () => {
        test('should detect NEUTRAL market conditions', () => {
            const neutralData = createMockPriceData(50000, 3000);
            const result = calculateAPMPrice(neutralData);
            
            // With insufficient history, should default to NEUTRAL
            expect(result.marketCondition).toBe('NEUTRAL');
        });

        test('should handle price increases', () => {
            const baseData = createMockPriceData(50000, 3000);
            calculateAPMPrice(baseData);
            
            simulateTimePassing(MARKET_DETECTION_CONFIG.SHORT_TERM_WINDOW / 2);
            
            const bullData = createMockPriceData(60000, 3600); // +20%
            const result = calculateAPMPrice(bullData);
            
            expect(['BULL', 'NEUTRAL']).toContain(result.marketCondition);
            expect(typeof result.cryptoChangePercent).toBe('number');
        });

        test('should handle price decreases', () => {
            const baseData = createMockPriceData(50000, 3000);
            calculateAPMPrice(baseData);
            
            simulateTimePassing(MARKET_DETECTION_CONFIG.SHORT_TERM_WINDOW / 2);
            
            const bearData = createMockPriceData(40000, 2400); // -20%
            const result = calculateAPMPrice(bearData);
            
            expect(['BEAR', 'NEUTRAL']).toContain(result.marketCondition);
        });
    });

    describe('Rebalancing Mechanism', () => {
        test('should initialize with NEUTRAL weights', () => {
            const status = getRebalanceStatus();
            
            expect(status.isRebalancing).toBe(false);
            expect(status.progress).toBe(1.0);
            expect(status.currentCondition).toBe('NEUTRAL');
            expect(status.targetCondition).toBe('NEUTRAL');
        });

        test('should track rebalance progress over time', () => {
            const mockData = createMockPriceData();
            const result = calculateAPMPrice(mockData);
            
            expect(typeof result.rebalanceProgress).toBe('number');
            expect(result.rebalanceProgress).toBeGreaterThanOrEqual(0);
            expect(result.rebalanceProgress).toBeLessThanOrEqual(1);
        });

        test('should provide next rebalance time', () => {
            const mockData = createMockPriceData();
            const result = calculateAPMPrice(mockData);
            
            expect(typeof result.nextRebalanceTime).toBe('number');
            expect(result.nextRebalanceTime).toBeGreaterThan(Date.now());
        });
    });

    describe('Price Fluctuation Scenarios', () => {
        test('should handle gradual price increases', () => {
            const priceSteps = [
                createMockPriceData(50000, 3000),  // Base
                createMockPriceData(51000, 3060),  // +2%
                createMockPriceData(52000, 3120),  // +4%
                createMockPriceData(53000, 3180),  // +6%
                createMockPriceData(54000, 3240),  // +8%
            ];
            
            const results: APMPriceResult[] = [];
            
            priceSteps.forEach((data, index) => {
                if (index > 0) {
                    simulateTimePassing(30 * 60 * 1000); // 30 minutes
                }
                results.push(calculateAPMPrice(data));
            });
            
            const firstPrice = results[0].apmPrice;
            const lastPrice = results[results.length - 1].apmPrice;
            
            expect(lastPrice).toBeGreaterThan(firstPrice);
            
            results.forEach(result => {
                expect(typeof result.apmPrice).toBe('number');
                expect(result.apmPrice).toBeGreaterThan(0);
                expect(typeof result.basketValue).toBe('number');
                expect(result.basketValue).toBeGreaterThan(0);
            });
        });

        test('should handle volatile market conditions', () => {
            const volatileScenario = [
                createMockPriceData(50000, 3000),  // Base
                createMockPriceData(45000, 2700),  // -10% crash
                createMockPriceData(55000, 3300),  // +10% recovery
                createMockPriceData(42000, 2520),  // -16% crash
                createMockPriceData(60000, 3600),  // +20% pump
            ];
            
            const results: APMPriceResult[] = [];
            
            volatileScenario.forEach((data, index) => {
                if (index > 0) {
                    simulateTimePassing(60 * 60 * 1000); // 1 hour
                }
                results.push(calculateAPMPrice(data));
            });
            
            results.forEach((result, index) => {
                expect(typeof result.apmPrice).toBe('number');
                expect(result.apmPrice).toBeGreaterThan(0);
                expect(['BULL', 'BEAR', 'NEUTRAL']).toContain(result.marketCondition);
                
                console.log(`Step ${index}: Price ${result.apmPrice.toFixed(6)}, Condition: ${result.marketCondition}, Progress: ${(result.rebalanceProgress * 100).toFixed(1)}%`);
            });
        });

        test('should handle extreme market movements', () => {
            const extremeScenarios = [
                { name: 'Crypto Crash', data: createMockPriceData(25000, 1500) }, // -50%
                { name: 'Crypto Boom', data: createMockPriceData(100000, 6000) }, // +100%
                { name: 'Flash Crash', data: createMockPriceData(10000, 600) },   // -80%
            ];
            
            extremeScenarios.forEach(scenario => {
                resetBaseline();
                
                const result = calculateAPMPrice(scenario.data);
                
                expect(typeof result.apmPrice).toBe('number');
                expect(result.apmPrice).toBeGreaterThan(0);
                expect(typeof result.basketValue).toBe('number');
                
                console.log(`${scenario.name}: APM Price ${result.apmPrice.toFixed(6)}, Basket Value ${result.basketValue.toFixed(2)}`);
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle missing crypto data gracefully', () => {
            const incompletePriceData: PriceData = {
                crypto: [],
                preciousMetals: [
                    { symbol: 'XAU/USD', price: 1800, emaPrice: 1795 },
                    { symbol: 'XAG/USD', price: 25, emaPrice: 24.5 },
                ],
                forex: [
                    { symbol: 'USD/USD', price: 1.0, emaPrice: 1.0 },
                    { symbol: 'USDT/USD', price: 1.0, emaPrice: 1.0 },
                    { symbol: 'EUR/USD', price: 1.08, emaPrice: 1.08 },
                    { symbol: 'GBP/USD', price: 1.25, emaPrice: 1.25 },
                ]
            };
            
            // Should not throw and should handle missing BTC/ETH gracefully
            const result = calculateAPMPrice(incompletePriceData);
            expect(result).toBeDefined();
            expect(result.apmPrice).toBeGreaterThan(0);
        });

        test('should handle zero prices appropriately', () => {
            const zeroPriceData = createMockPriceData(0, 0);
            
            // Should not throw and should handle zero prices gracefully
            const result = calculateAPMPrice(zeroPriceData);
            expect(result).toBeDefined();
            expect(result.apmPrice).toBeGreaterThanOrEqual(0);
        });

        test('should maintain weights consistency during rebalancing', () => {
            const mockData = createMockPriceData();
            const result = calculateAPMPrice(mockData);
            
            const weightSum = Object.values(result.weights).reduce((sum, weight) => sum + weight, 0);
            expect(weightSum).toBeCloseTo(1.0, 3);
            
            const targetWeightSum = Object.values(result.targetWeights).reduce((sum, weight) => sum + weight, 0);
            expect(targetWeightSum).toBeCloseTo(1.0, 3);
        });
    });

    describe('Performance and Consistency', () => {
        test('should complete calculations within reasonable time', () => {
            const mockData = createMockPriceData();
            const startTime = Date.now();
            
            calculateAPMPrice(mockData);
            
            const executionTime = Date.now() - startTime;
            expect(executionTime).toBeLessThan(1000);
        });

        test('should produce consistent results for repeated calls', () => {
            const mockData = createMockPriceData();
            const results: APMPriceResult[] = [];
            
            for (let i = 0; i < 5; i++) {
                results.push(calculateAPMPrice(mockData));
            }
            
            for (let i = 1; i < results.length; i++) {
                expect(results[i].apmPrice).toBe(results[0].apmPrice);
                expect(results[i].basketValue).toBe(results[0].basketValue);
                expect(results[i].marketCondition).toBe(results[0].marketCondition);
            }
        });
    });
});

