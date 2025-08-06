import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock user ID for demo purposes
  const DEMO_USER_ID = 1;

  // Test database connection before proceeding
  try {
    console.log("Testing database connection...");
    await storage.getUserSettings(DEMO_USER_ID);
    console.log("Database connection successful");
  } catch (dbError) {
    console.error("Database connection failed:", dbError);
    console.log("Continuing with limited functionality...");
  }

  // Basic health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // User settings endpoint
  app.get('/api/user-settings', async (req: Request, res: Response) => {
    try {
      const settings = await storage.getUserSettings(DEMO_USER_ID);
      res.json(settings || {});
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Failed to fetch user settings' });
    }
  });

  // Basic workflow endpoints
  app.get('/api/workflows', async (req: Request, res: Response) => {
    try {
      const workflows = await storage.getWorkflowsByUserId(DEMO_USER_ID);
      res.json(workflows);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ error: 'Failed to fetch workflows' });
    }
  });

  const server = createServer(app);
  return server;
}