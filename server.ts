import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { DashboardData, ChartDataPoint, EtfInfo } from "./src/types";

// Properly get YahooFinance
import YahooFinance from 'yahoo-finance2';
import dashboardHandler from './api/dashboard';

const yf = new YahooFinance();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache to prevent hammering yahoo-finance
  let dashboardCache: { data: DashboardData | null, timestamp: number } = { data: null, timestamp: 0 };
  let newsCache: { data: any[] | null, timestamp: number } = { data: null, timestamp: 0 };
  const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  app.get("/api/news", async (req, res) => {
    try {
      const now = Date.now();
      if (newsCache.data && now - newsCache.timestamp < CACHE_TTL) {
        return res.json(newsCache.data);
      }
      const result = await yf.search('QQQ', { newsCount: 6 });
      newsCache.data = result.news || [];
      newsCache.timestamp = now;
      res.json(newsCache.data);
    } catch (e: any) {
      console.error("News fetch error", e.message);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const now = Date.now();
      if (dashboardCache.data && now - dashboardCache.timestamp < CACHE_TTL) {
        return res.json(dashboardCache.data);
      }

      // We'll hook the res.json to catch the data for the cache
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        if (!data.error) {
            dashboardCache.data = data;
            dashboardCache.timestamp = now;
        }
        return originalJson(data);
      };

      await dashboardHandler(req, res);
    } catch (error: any) {
      console.error("Dashboard hook error details:", error.stack);
      res.status(500).json({ error: "Failed to fetch market data", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
