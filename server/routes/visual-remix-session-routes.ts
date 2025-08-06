import { Express } from 'express';
import { visualRemixSessions, visualRemixGallery, type InsertVisualRemixSession, type InsertVisualRemixGallery } from '@shared/schema';
import { db } from '../db.js';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export default function visualRemixSessionRoutes(app: Express) {
  // Get all sessions for a user
  app.get('/api/visual-remix/sessions', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sessions = await db
        .select()
        .from(visualRemixSessions)
        .where(eq(visualRemixSessions.userId, userId))
        .orderBy(desc(visualRemixSessions.lastAccessedAt));

      res.json({ sessions });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  // Get a specific session
  app.get('/api/visual-remix/sessions/:id', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sessionId = parseInt(req.params.id);
      const [session] = await db
        .select()
        .from(visualRemixSessions)
        .where(and(
          eq(visualRemixSessions.id, sessionId),
          eq(visualRemixSessions.userId, userId)
        ));

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Update last accessed time
      await db
        .update(visualRemixSessions)
        .set({ lastAccessedAt: new Date() })
        .where(eq(visualRemixSessions.id, sessionId));

      res.json({ session });
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  // Create a new session
  app.post('/api/visual-remix/sessions', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { sessionName, sessionData, thumbnail } = req.body;

      const sessionToInsert: InsertVisualRemixSession = {
        userId,
        sessionName: sessionName || `Session ${new Date().toLocaleDateString()}`,
        sessionData: sessionData || {},
        thumbnail
      };

      const [newSession] = await db
        .insert(visualRemixSessions)
        .values(sessionToInsert)
        .returning();

      res.json({ session: newSession });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Update a session
  app.put('/api/visual-remix/sessions/:id', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sessionId = parseInt(req.params.id);
      const { sessionName, sessionData, thumbnail } = req.body;

      const [updatedSession] = await db
        .update(visualRemixSessions)
        .set({
          sessionName,
          sessionData,
          thumbnail,
          updatedAt: new Date()
        })
        .where(and(
          eq(visualRemixSessions.id, sessionId),
          eq(visualRemixSessions.userId, userId)
        ))
        .returning();

      if (!updatedSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ session: updatedSession });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  });

  // Delete a session
  app.delete('/api/visual-remix/sessions/:id', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sessionId = parseInt(req.params.id);

      // Also delete associated gallery items
      await db
        .delete(visualRemixGallery)
        .where(and(
          eq(visualRemixGallery.sessionId, sessionId),
          eq(visualRemixGallery.userId, userId)
        ));

      const result = await db
        .delete(visualRemixSessions)
        .where(and(
          eq(visualRemixSessions.id, sessionId),
          eq(visualRemixSessions.userId, userId)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  // Get gallery items for a user
  app.get('/api/visual-remix/gallery', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { type, sessionId } = req.query;
      
      let query = db
        .select()
        .from(visualRemixGallery)
        .where(eq(visualRemixGallery.userId, userId));

      if (type) {
        query = query.where(eq(visualRemixGallery.type, type as string));
      }

      if (sessionId) {
        query = query.where(eq(visualRemixGallery.sessionId, parseInt(sessionId as string)));
      }

      const items = await query.orderBy(desc(visualRemixGallery.createdAt));

      res.json({ items });
    } catch (error) {
      console.error('Error fetching gallery:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  });

  // Add item to gallery
  app.post('/api/visual-remix/gallery', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const galleryItem: InsertVisualRemixGallery = {
        ...req.body,
        userId
      };

      const [newItem] = await db
        .insert(visualRemixGallery)
        .values(galleryItem)
        .returning();

      res.json({ item: newItem });
    } catch (error) {
      console.error('Error adding to gallery:', error);
      res.status(500).json({ error: 'Failed to add to gallery' });
    }
  });

  // Delete gallery item
  app.delete('/api/visual-remix/gallery/:id', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const itemId = parseInt(req.params.id);

      await db
        .delete(visualRemixGallery)
        .where(and(
          eq(visualRemixGallery.id, itemId),
          eq(visualRemixGallery.userId, userId)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      res.status(500).json({ error: 'Failed to delete gallery item' });
    }
  });
}