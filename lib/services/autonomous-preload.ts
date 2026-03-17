/**
 * Autonomous Preloading System
 * 
 * This service runs background tasks to preload data BEFORE the user needs it.
 * Implements TikTok-style anticipatory loading.
 * 
 * Features:
 * - Auto-starts on app initialization (fires on login)
 * - Periodic refresh of recommendations (every 15 minutes)
 * - Preloads mastery plan + readiness so Hub loads instantly
 * - Preloads next likely content based on user behavior
 * - Runs silently in background without blocking UI
 * - Client-side cache for instant data on navigation
 * - Handles stale data refresh
 */

interface PreloadTask {
  id: string;
  type: 'recommendations' | 'quiz' | 'exam' | 'progress' | 'streak' | 'mastery_plan' | 'mastery_readiness';
  priority: number; // 1 = highest
  lastRun: number | null;
  intervalMs: number;
  endpoint: string;
  method: 'GET' | 'POST';
  cacheKey?: string; // If set, response is cached for instant access
}

const PRELOAD_TASKS: PreloadTask[] = [
  // === MASTERY ENGINE (highest priority — fires first on login) ===
  {
    id: 'mastery_plan',
    type: 'mastery_plan',
    priority: 0, // Highest — user lands here after login
    lastRun: null,
    intervalMs: 10 * 60 * 1000, // 10 minutes
    endpoint: '/api/mastery/plan',
    method: 'GET',
    cacheKey: 'mastery:plan',
  },
  {
    id: 'mastery_readiness',
    type: 'mastery_readiness',
    priority: 0,
    lastRun: null,
    intervalMs: 10 * 60 * 1000,
    endpoint: '/api/mastery/readiness',
    method: 'GET',
    cacheKey: 'mastery:readiness',
  },
  // === PROGRESS ===
  {
    id: 'progress',
    type: 'progress',
    priority: 2,
    lastRun: null,
    intervalMs: 30 * 60 * 1000, // 30 minutes
    endpoint: '/api/progress',
    method: 'GET',
  },
  {
    id: 'streak',
    type: 'streak',
    priority: 1,
    lastRun: null,
    intervalMs: 60 * 60 * 1000, // 1 hour
    endpoint: '/api/streaks',
    method: 'GET',
  },
];

// ──────────────────────────────────────────────
// CLIENT-SIDE CACHE (in-memory, survives navigation)
// ──────────────────────────────────────────────
interface CacheEntry {
  data: unknown;
  timestamp: number;
  maxAge: number; // ms
}

const dataCache = new Map<string, CacheEntry>();

/**
 * Get cached data if still fresh.
 * Returns null if stale or missing.
 */
export function getCachedData<T = unknown>(key: string): T | null {
  const entry = dataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.maxAge) {
    dataCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Manually set cache (e.g. after a page-level fetch that should benefit others)
 */
export function setCachedData(key: string, data: unknown, maxAgeMs = 10 * 60 * 1000) {
  dataCache.set(key, { data, timestamp: Date.now(), maxAge: maxAgeMs });
}

/**
 * Invalidate a cache key (e.g. after an attempt submission)
 */
export function invalidateCache(key: string) {
  dataCache.delete(key);
}

export function invalidateMasteryCache() {
  dataCache.delete('mastery:plan');
  dataCache.delete('mastery:readiness');
}

class AutonomousPreloadService {
  private authToken: string | null = null;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private taskStatus: Map<string, { lastRun: number; success: boolean }> = new Map();
  private onAuthTokenUpdate: (() => Promise<string | null>) | null = null;

  /**
   * Initialize the service with auth token getter
   */
  init(getAuthToken: () => Promise<string | null>) {
    this.onAuthTokenUpdate = getAuthToken;
    console.log('[AutonomousPreload] Initialized');
  }

  /**
   * Set current auth token
   */
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  /**
   * Start the autonomous preload loop
   */
  async start() {
    if (this.isRunning) {
      console.log('[AutonomousPreload] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[AutonomousPreload] Starting autonomous preload service');

    // Run initial preload immediately
    await this.runAllTasks();

    // Set up periodic refresh every 5 minutes (checks which tasks need to run)
    this.intervalId = setInterval(() => {
      this.runDueTasks();
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Also refresh when user returns to tab
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Stop the service
   */
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    console.log('[AutonomousPreload] Stopped');
  }

  /**
   * Handle visibility change - refresh when user returns
   */
  private handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      console.log('[AutonomousPreload] User returned to app, checking for stale data');
      await this.runDueTasks();
    }
  };

  /**
   * Get fresh auth token
   */
  private async getToken(): Promise<string | null> {
    if (this.onAuthTokenUpdate) {
      try {
        this.authToken = await this.onAuthTokenUpdate();
      } catch {
        // Token refresh failed
      }
    }
    return this.authToken;
  }

  /**
   * Run all preload tasks (initial load)
   */
  async runAllTasks() {
    const token = await this.getToken();
    if (!token) {
      console.log('[AutonomousPreload] No auth token, skipping preload');
      return;
    }

    console.log('[AutonomousPreload] Running all preload tasks');

    // NOTE: Trigger daily cron from client side as fire-and-forget.
    // The cron tick is idempotent (checks notification_log for already-sent entries)
    // and only fires once per day per client (localStorage flag).
    this.triggerDailyCron(token);
    
    // Sort by priority
    const sortedTasks = [...PRELOAD_TASKS].sort((a, b) => a.priority - b.priority);
    
    for (const task of sortedTasks) {
      await this.runTask(task, token);
      // Small delay between tasks to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Run only tasks that are due (based on interval)
   */
  private async runDueTasks() {
    const token = await this.getToken();
    if (!token) return;

    const now = Date.now();
    
    for (const task of PRELOAD_TASKS) {
      const status = this.taskStatus.get(task.id);
      const lastRun = status?.lastRun || 0;
      
      if (now - lastRun >= task.intervalMs) {
        await this.runTask(task, token);
      }
    }
  }

  /**
   * Run a single preload task
   */
  private async runTask(task: PreloadTask, token: string) {
    try {
      console.log(`[AutonomousPreload] Running task: ${task.id}`);
      
      const response = await fetch(task.endpoint, {
        method: task.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const success = response.ok;
      this.taskStatus.set(task.id, { lastRun: Date.now(), success });

      // Cache the response if the task has a cacheKey
      if (success && task.cacheKey) {
        try {
          const data = await response.json();
          setCachedData(task.cacheKey, data, task.intervalMs);
          console.log(`[AutonomousPreload] Cached ${task.cacheKey}`);
        } catch {
          // JSON parse failed — that's fine, we still preloaded on the server side
        }
      }
      
      if (success) {
        console.log(`[AutonomousPreload] Task ${task.id} completed successfully`);
      } else {
        console.warn(`[AutonomousPreload] Task ${task.id} failed with status ${response.status}`);
      }
    } catch (error) {
      console.error(`[AutonomousPreload] Task ${task.id} error:`, error);
      this.taskStatus.set(task.id, { lastRun: Date.now(), success: false });
    }
  }

  /**
   * Force refresh a specific task type
   */
  async forceRefresh(type: PreloadTask['type']) {
    const token = await this.getToken();
    if (!token) return;

    const task = PRELOAD_TASKS.find(t => t.type === type);
    if (task) {
      await this.runTask(task, token);
    }
  }

  /**
   * Preload specific content (e.g., next exam)
   */
  async preloadExam(unitId: string, examType: 'abcd' | 'cle', paperSize: 'mini' | 'semi' | 'full') {
    const token = await this.getToken();
    if (!token) return;

    try {
      console.log(`[AutonomousPreload] Preloading exam: ${unitId} ${examType} ${paperSize}`);
      
      await fetch('/api/preload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: 'exam',
          unitId,
          examType,
          paperSize,
          priority: 'high',
        }),
      });
    } catch (error) {
      console.error('[AutonomousPreload] Exam preload error:', error);
    }
  }

  /**
   * Get status of preload tasks
   */
  getStatus() {
    const status: Record<string, { lastRun: Date | null; success: boolean }> = {};
    
    for (const task of PRELOAD_TASKS) {
      const taskStatus = this.taskStatus.get(task.id);
      status[task.id] = {
        lastRun: taskStatus?.lastRun ? new Date(taskStatus.lastRun) : null,
        success: taskStatus?.success ?? false,
      };
    }
    
    return status;
  }

  /**
   * Fire the daily cron tick (fire-and-forget, idempotent).
   * This ensures daily reminder emails and push notifications go out
   * even without an external cron service.
   */
  private triggerDailyCron(token: string) {
    const cronKey = 'cron:last-tick';
    try {
      const lastTick = localStorage.getItem(cronKey);
      const today = new Date().toISOString().split('T')[0];
      if (lastTick === today) return; // Already triggered today

      console.log('[AutonomousPreload] Triggering daily cron tick');
      localStorage.setItem(cronKey, today);

      // Fire-and-forget — don't await, don't block preload
      fetch('/api/cron/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).then(res => {
        if (res.ok) console.log('[AutonomousPreload] Daily cron tick succeeded');
        else console.warn('[AutonomousPreload] Daily cron tick returned', res.status);
      }).catch(() => {
        // Remove today's flag so it retries on next session
        localStorage.removeItem(cronKey);
      });
    } catch {
      // localStorage not available (SSR)
    }
  }
}

// Singleton instance
export const autonomousPreload = new AutonomousPreloadService();
