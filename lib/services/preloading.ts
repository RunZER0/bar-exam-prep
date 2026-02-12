/**
 * Predictive Preloading Service
 * 
 * This service automatically pre-generates content (quizzes, study materials)
 * in the background so users don't have to wait for AI generation.
 * 
 * Features:
 * - Preloads next round of quizzes after quiz completion
 * - Predicts what content user will need next
 * - Manages cache expiration and cleanup
 * - Works in the background without blocking UI
 */

interface PreloadOptions {
  unitId?: string;
  topicId?: string;
  contentType?: 'quiz' | 'study';
  priority?: 'high' | 'normal' | 'low';
}

interface PreloadedContent {
  found: boolean;
  content?: any;
  preloadedAt?: string;
  message?: string;
}

class PreloadingService {
  private preloadQueue: PreloadOptions[] = [];
  private isProcessing = false;
  private authToken: string | null = null;

  /**
   * Set the authentication token for API calls
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Queue content for preloading
   */
  queuePreload(options: PreloadOptions) {
    // Avoid duplicates in queue
    const exists = this.preloadQueue.some(
      (item) =>
        item.unitId === options.unitId &&
        item.topicId === options.topicId &&
        item.contentType === options.contentType
    );

    if (!exists) {
      // Sort by priority
      if (options.priority === 'high') {
        this.preloadQueue.unshift(options);
      } else {
        this.preloadQueue.push(options);
      }
      this.processQueue();
    }
  }

  /**
   * Process the preload queue
   */
  private async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) return;
    if (!this.authToken) {
      console.warn('PreloadingService: No auth token set');
      return;
    }

    this.isProcessing = true;

    try {
      const item = this.preloadQueue.shift();
      if (item) {
        await this.preloadContent(item);
      }
    } catch (error) {
      console.error('PreloadingService: Error processing queue', error);
    } finally {
      this.isProcessing = false;
      // Continue processing if there are more items
      if (this.preloadQueue.length > 0) {
        // Small delay to avoid overwhelming the API
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Preload content for a specific unit/topic
   */
  async preloadContent(options: PreloadOptions): Promise<void> {
    if (!this.authToken) return;

    try {
      const response = await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'preload',
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Preload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('PreloadingService: Content preloaded', data);
    } catch (error) {
      console.error('PreloadingService: Preload error', error);
    }
  }

  /**
   * Get preloaded content if available
   */
  async getPreloadedContent(
    unitId?: string,
    topicId?: string,
    contentType: string = 'quiz'
  ): Promise<PreloadedContent> {
    if (!this.authToken) {
      return { found: false, message: 'Not authenticated' };
    }

    try {
      const params = new URLSearchParams();
      if (unitId) params.set('unitId', unitId);
      if (topicId) params.set('topicId', topicId);
      params.set('type', contentType);

      const response = await fetch(`/api/preload?${params}`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        return { found: false, message: 'Failed to fetch preloaded content' };
      }

      return await response.json();
    } catch (error) {
      console.error('PreloadingService: Get preloaded error', error);
      return { found: false, message: 'Error fetching preloaded content' };
    }
  }

  /**
   * Trigger predictive preloading based on user behavior
   */
  async triggerPredictivePreload(): Promise<void> {
    if (!this.authToken) return;

    try {
      const response = await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'preload_next',
        }),
      });

      if (!response.ok) {
        throw new Error(`Predictive preload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('PreloadingService: Predictive preload complete', data);
    } catch (error) {
      console.error('PreloadingService: Predictive preload error', error);
    }
  }

  /**
   * Called after quiz completion to preload next quiz
   */
  afterQuizCompletion(unitId: string, topicId?: string) {
    // Queue preload for same unit/topic (for retry)
    this.queuePreload({
      unitId,
      topicId,
      contentType: 'quiz',
      priority: 'high',
    });

    // Trigger predictive preloading in background
    setTimeout(() => {
      this.triggerPredictivePreload();
    }, 2000);
  }

  /**
   * Called when user navigates to study page
   */
  onStudyPageVisit(unitId: string) {
    // Preload quiz for this unit
    this.queuePreload({
      unitId,
      contentType: 'quiz',
      priority: 'normal',
    });
  }

  /**
   * Cleanup expired content
   */
  async cleanupExpired(): Promise<void> {
    if (!this.authToken) return;

    try {
      await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'cleanup',
        }),
      });
    } catch (error) {
      console.error('PreloadingService: Cleanup error', error);
    }
  }
}

// Singleton instance
export const preloadingService = new PreloadingService();

/**
 * React hook for using the preloading service
 */
export function usePreloading() {
  return {
    queuePreload: (options: PreloadOptions) => preloadingService.queuePreload(options),
    getPreloaded: (unitId?: string, topicId?: string, type?: string) =>
      preloadingService.getPreloadedContent(unitId, topicId, type),
    afterQuizCompletion: (unitId: string, topicId?: string) =>
      preloadingService.afterQuizCompletion(unitId, topicId),
    onStudyPageVisit: (unitId: string) => preloadingService.onStudyPageVisit(unitId),
    setAuthToken: (token: string) => preloadingService.setAuthToken(token),
  };
}
