import { Router, Request, Response } from 'express';
import { getPrices } from '../controller/price-feed';
// import {
//   initializeContract,
//   updatePrice,
//   mintTokens,
//   burnTokens,
//   transferWithFee,
//   pauseContract,
//   resumeContract,
// } from '../controller/contractController';

const router = Router();

/**
 * @route   GET /prices
 * @desc    Get latest prices from Pyth Network
 * @access  Public
 */
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const result = await getPrices();
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: Date.now()
    });
  }
});

// router.post('/initialize', initializeContract);
// // router.post('/update-price', updatePrice);
// // router.post('/mint', mintTokens);
// // router.post('/burn', burnTokens);
// // router.post('/transfer', transferWithFee);
// // router.post('/pause', pauseContract);
// // router.post('/resume', resumeContract);

// Export the router object
export default router;
