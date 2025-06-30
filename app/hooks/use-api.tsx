import { useState, useCallback } from "react";

type Method = "GET" | "POST";
const BASE_URL = process.env.NEXT_PUBLIC_URI

interface UseApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetchData: (url: string, method?: Method, body?: any) => Promise<void>;
}

export function useApi<T = any>(): UseApiResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (url: string, method: Method = "GET", body?: any) => {
      try {
        setLoading(true);
        setError(null);

        const options: RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json"
          },
        };

        if (method === "POST" && body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${url}`, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, fetchData };
}




// import { useState, useEffect, useCallback } from "react";

// // Define types for the API response
// export interface PriceData {
//   symbol: string;
//   price: number;
//   confidence: string;
//   emaPrice: number;
//   lastUpdated: string;
//   decimalPlaces: number;
// }

// export interface PriceResponse {
//   crypto: PriceData[];
//   preciousMetals: PriceData[];
//   stablecoins: PriceData[];
//   forex: PriceData[];
// }

// export interface ApiResponse {
//   success: boolean;
//   data: PriceResponse;
//   timestamp: number;
//   error?: string;
// }

// // Format the API data to match the expected format in the dashboard
// export function formatPriceData(data: PriceResponse): Record<string, number> {
//   const formattedPrices: Record<string, number> = {};
  
//   // Process each category of price data
//   [
//     ...data.crypto,
//     ...data.preciousMetals,
//     ...data.stablecoins,
//     ...data.forex
//   ].forEach(item => {
//     formattedPrices[item.symbol] = item.price;
//   });
  
//   return formattedPrices;
// }

// export function usePriceData(refreshInterval = 30000) {
//   const [data, setData] = useState<Record<string, number>>({});
//   const [rawData, setRawData] = useState<PriceResponse | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [lastFetched, setLastFetched] = useState<Date | null>(null);
//   const [priceCount, setPriceCount] = useState<Record<string, number>>({});
  
//   // Function to fetch the price data
//   const fetchPriceData = useCallback(async () => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       const response = await fetch('/api/contract/prices');
      
//       if (!response.ok) {
//         throw new Error(`API responded with status: ${response.status}`);
//       }
      
//       const result: ApiResponse = await response.json();
      
//       if (!result.success) {
//         throw new Error(result.error || 'Failed to fetch price data');
//       }
      
//       // Log the raw API response for debugging
//       console.log('API Response:', result);
      
//       // Set timestamp for when data was fetched
//       setLastFetched(new Date());
      
//       // Count the number of prices in each category
//       const counts = {
//         crypto: result.data.crypto.length,
//         preciousMetals: result.data.preciousMetals.length,
//         stablecoins: result.data.stablecoins.length,
//         forex: result.data.forex.length,
//         total: result.data.crypto.length + 
//                result.data.preciousMetals.length + 
//                result.data.stablecoins.length + 
//                result.data.forex.length
//       };
//       setPriceCount(counts);
      
//       setRawData(result.data);
//       setData(formatPriceData(result.data));
//       setLoading(false);
//     } catch (err) {
//       console.error('Error fetching price data:', err);
//       setError(err instanceof Error ? err.message : 'An unknown error occurred');
//       setLoading(false);
//     }
//   }, []);
  
//   // Fetch data when component mounts
//   useEffect(() => {
//     fetchPriceData();
    
//     // Set up the refresh interval
//     if (refreshInterval > 0) {
//       const intervalId = setInterval(fetchPriceData, refreshInterval);
      
//       // Clean up interval on unmount
//       return () => clearInterval(intervalId);
//     }
//   }, [fetchPriceData, refreshInterval]);
  
//   return {
//     data,
//     rawData,
//     loading,
//     error,
//     lastFetched,
//     priceCount,
//     refetch: fetchPriceData
//   };
// }

