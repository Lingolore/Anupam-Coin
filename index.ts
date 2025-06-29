import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import contractRoutes from './src/routes/routes';
import { calculateAPMPrice } from './src/controller/calculate-price';
import { fetchPrices } from './src/controller/price-feed';
import { updateContractPrices } from './cmd/swap-job';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Routes
app.use('/api/contract', contractRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket:any) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Simple robust price fetching with error handling
async function fetchPricesWithRetry() {
    try {
        const priceData = await fetchPrices();
        const apmPrice = calculateAPMPrice(priceData);
        
        
        // Send price to all connected clients
        io.emit('priceUpdate', {
            apmPrice: apmPrice,
            timestamp: new Date().toISOString(),
            priceData: priceData
        });
        
        console.log(`[${new Date().toISOString()}] APM Price: ${apmPrice}`);
        
    } catch (error:any) {
        console.error(`[${new Date().toISOString()}] Price fetch failed:`, error.message);
        // Don't crash - just log and continue
    } finally {
        // Schedule next execution after current one completes
        if (!isShuttingDown) {
            priceTimeout = setTimeout(fetchPricesWithRetry, 500);
        }
    }
}

async function updatePrices() {
    try {
        const priceData = await fetchPrices();
        const apmPrice = calculateAPMPrice(priceData);
       const result =  updateContractPrices(priceData);

       console.log("Price Updated ")
    }
    catch (error:any) {
        console.error(`[${new Date().toISOString()}] Price update failed:`, error.message);
        // Don't crash - just log and continue
    }finally{
        // Schedule next execution after current one completes
        if (!isShuttingDown) {
            priceTimeout = setTimeout(updatePrices, 60 * 1000); // Update every minute
        }
    }
}


updatePrices()

// Control variables
let priceTimeout :any;
let isShuttingDown = false;

// Start price fetching
fetchPricesWithRetry();

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// Graceful shutdown
function shutdown() {
    console.log('Shutting down gracefully...');
    isShuttingDown = true;
    if (priceTimeout) {
        clearTimeout(priceTimeout);
    }
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const httpServer = server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

export default app;

// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import rateLimit from 'express-rate-limit';
// import dotenv from 'dotenv';
// import contractRoutes from './src/routes/routes';
// import { calculateAPMPrice } from './src/controller/calculate-price';
// import { fetchPrices } from './src/controller/price-feed';
// // import routes from './routes';
// // import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';

// // Load environment variables
// dotenv.config();

// // Initialize express app
// const app = express();
// const PORT = process.env.PORT || 3000;

// // Security middleware
// app.use(helmet());
// app.use(cors({
//     origin: process.env.CORS_ORIGIN || '*',
//     credentials: true
// }));

// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, 
//     max: 100, 
//     standardHeaders: true,
//     legacyHeaders: false,
// });
// app.use(limiter);

// app.use(express.json({ limit: '10kb' }));
// app.use(express.urlencoded({ extended: true }));

// if (process.env.NODE_ENV === 'development') {
//     app.use(morgan('dev'));
// } else {
//     app.use(morgan('combined'));
// }

// // Routes
// // app.use('/api', routes);

// // Health check endpoint
// app.use('/api/contract', contractRoutes);
// app.get('/health', (req, res) => {
//     res.status(200).json({
//         status: 'success',
//         message: 'Server is healthy',
//         environment: process.env.NODE_ENV,
//         timestamp: new Date().toISOString()
//     });
// });


// setInterval(async () => {

//     let priceData = await fetchPrices()
//     calculateAPMPrice(priceData)
// }, 1000); // Keep the server alive


// // app.use(notFoundHandler);
// // app.use(errorHandler);

// // if (require.main === module) {
//     app.listen(PORT, () => {
//         console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
//     });
// // }



// export default app;