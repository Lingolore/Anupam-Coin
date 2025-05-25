import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import contractRoutes from './src/routes/routes';
// import routes from './routes';
// import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';

// Load environment variables
dotenv.config();


// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

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
// app.use('/api', routes);

// Health check endpoint


app.use('/api/contract', contractRoutes);
app.get('/health', (req, res) => {
res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
});
});

// app.use(notFoundHandler);
// app.use(errorHandler);


if (require.main === module) {
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
}

export default app;

