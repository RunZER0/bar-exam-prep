/**
 * Smart Predictive Preloading Service
 * 
 * This service pre-generates content (quizzes, exams, study materials)
 * in the background so users experience instant loading.
 * 
 * Key Features:
 * - Preloads exam questions BEFORE user starts exam
 * - Uses ChatGPT 5.2 Instant for fast generation
 * - Smart staleness detection - discards preloads if user progress changes
 * - While user takes current exam, preloads next likely exam
 * - Pipeline preloading: consume preload → start generating next
 */

export type ExamType = 'abcd' | 'cle';
export type PaperSize = 'mini' | 'semi' | 'full';

interface PreloadOptions {
  unitId?: string;
  topicId?: string;
  contentType?: 'quiz' | 'study' | 'exam';
  priority?: 'high' | 'normal' | 'low';
  // Exam-specific options
  examType?: ExamType;
  paperSize?: PaperSize;
}

interface PreloadedContent {
  found: boolean;
  content?: any;
  preloadedAt?: string;
  isStale?: boolean;
  message?: string;
}

interface ExamPreloadRequest {
  unitId: string;
  examType: ExamType;
  paperSize: PaperSize;
}

class PreloadingService {
  private preloadQueue: PreloadOptions[] = [];
  private isProcessing = false;
  private authToken: string | null = null;
  private currentExamContext: ExamPreloadRequest | null = null;

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
        item.contentType === options.contentType &&
        item.examType === options.examType &&
        item.paperSize === options.paperSize
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
        setTimeout(() => this.processQueue(), 500);
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
   * Checks staleness and returns null if data is stale
   */
  async getPreloadedContent(
    unitId?: string,
    topicId?: string,
    contentType: string = 'quiz',
    examType?: ExamType,
    paperSize?: PaperSize
  ): Promise<PreloadedContent> {
    if (!this.authToken) {
      return { found: false, message: 'Not authenticated' };
    }

    try {
      const params = new URLSearchParams();
      if (unitId) params.set('unitId', unitId);
      if (topicId) params.set('topicId', topicId);
      params.set('type', contentType);
      if (examType) params.set('examType', examType);
      if (paperSize) params.set('paperSize', paperSize);
      params.set('checkStaleness', 'true');

      const response = await fetch(`/api/preload?${params}`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        return { found: false, message: 'Failed to fetch preloaded content' };
      }

      const result = await response.json();
      
      // If content is stale, trigger regeneration
      if (result.isStale) {
        this.queuePreload({
          unitId,
          topicId,
          contentType: contentType as 'quiz' | 'study' | 'exam',
          examType,
          paperSize,
          priority: 'high',
        });
        return { found: false, isStale: true, message: 'Content was stale, regenerating' };
      }

      return result;
    } catch (error) {
      console.error('PreloadingService: Get preloaded error', error);
      return { found: false, message: 'Error fetching preloaded content' };
    }
  }

  // ================================================================
  // EXAM-SPECIFIC PRELOADING
  // ================================================================

  /**
   * Start preloading exam when user opens exam selection
   * Preloads most likely exam configurations
   */
  async preloadLikelyExams(): Promise<void> {
    if (!this.authToken) return;

    try {
      const response = await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'preload_likely_exams',
        }),
      });

      if (!response.ok) {
        throw new Error(`Exam preload failed: ${response.statusText}`);
      }

      console.log('PreloadingService: Likely exams preloaded');
    } catch (error) {
      console.error('PreloadingService: Exam preload error', error);
    }
  }

  /**
   * Get preloaded exam questions if available
   */
  async getPreloadedExam(
    unitId: string,
    examType: ExamType,
    paperSize: PaperSize
  ): Promise<PreloadedContent> {
    return this.getPreloadedContent(unitId, undefined, 'exam', examType, paperSize);
  }

  /**
   * Called when user starts an exam
   * Immediately start preloading the next likely exam
   */
  onExamStart(unitId: string, examType: ExamType, paperSize: PaperSize) {
    this.currentExamContext = { unitId, examType, paperSize };
    
    // Start preloading next likely exam in background
    setTimeout(() => {
      this.preloadNextExam();
    }, 3000); // Wait 3 seconds so current exam loads first
  }

  /**
   * Called when user completes an exam
   * Use feedback to preload next exam with updated weak areas
   */
  async onExamComplete(
    unitId: string,
    examType: ExamType,
    paperSize: PaperSize,
    feedback?: { challengingConcepts?: Array<{ topic: string }> }
  ) {
    this.currentExamContext = null;

    // Invalidate any preloaded content for this exam (it's now stale)
    await this.invalidatePreload(unitId, 'exam', examType, paperSize);

    // Queue preload for same exam (retry) with fresh data
    this.queuePreload({
      unitId,
      contentType: 'exam',
      examType,
      paperSize,
      priority: 'normal',
    });

    // Trigger predictive preloading based on feedback
    if (feedback?.challengingConcepts && feedback.challengingConcepts.length > 0) {
      // User struggled - preload study materials for weak areas
      this.queuePreload({
        unitId,
        contentType: 'study',
        priority: 'high',
      });
    }

    // Preload next likely exam configurations
    setTimeout(() => {
      this.preloadNextExam();
    }, 2000);
  }

  /**
   * Preload the next most likely exam based on user patterns
   */
  private async preloadNextExam(): Promise<void> {
    if (!this.authToken) return;

    try {
      const response = await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'preload_next_exam',
          currentContext: this.currentExamContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Next exam preload failed: ${response.statusText}`);
      }

      console.log('PreloadingService: Next exam preloaded');
    } catch (error) {
      console.error('PreloadingService: Next exam preload error', error);
    }
  }

  /**
   * Invalidate (mark as stale) specific preloaded content
   */
  private async invalidatePreload(
    unitId: string,
    contentType: string,
    examType?: ExamType,
    paperSize?: PaperSize
  ): Promise<void> {
    if (!this.authToken) return;

    try {
      await fetch('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          action: 'invalidate',
          unitId,
          contentType,
          examType,
          paperSize,
        }),
      });
    } catch (error) {
      console.error('PreloadingService: Invalidate error', error);
    }
  }

  // ================================================================
  // QUIZ PRELOADING (kept for compatibility)
  // ================================================================

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

    // Also preload exam for this unit
    this.queuePreload({
      unitId,
      contentType: 'exam',
      examType: 'abcd',
      paperSize: 'semi',
      priority: 'low',
    });
  }

  /**
   * Called when user visits exams page
   * Start preloading most likely exams
   */
  onExamsPageVisit() {
    this.preloadLikelyExams();
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
    // Basic methods
    queuePreload: (options: PreloadOptions) => preloadingService.queuePreload(options),
    getPreloaded: (unitId?: string, topicId?: string, type?: string) =>
      preloadingService.getPreloadedContent(unitId, topicId, type),
    setAuthToken: (token: string) => preloadingService.setAuthToken(token),
    
    // Quiz methods
    afterQuizCompletion: (unitId: string, topicId?: string) =>
      preloadingService.afterQuizCompletion(unitId, topicId),
    onStudyPageVisit: (unitId: string) => preloadingService.onStudyPageVisit(unitId),
    
    // Exam methods
    getPreloadedExam: (unitId: string, examType: ExamType, paperSize: PaperSize) =>
      preloadingService.getPreloadedExam(unitId, examType, paperSize),
    onExamsPageVisit: () => preloadingService.onExamsPageVisit(),
    onExamStart: (unitId: string, examType: ExamType, paperSize: PaperSize) =>
      preloadingService.onExamStart(unitId, examType, paperSize),
    onExamComplete: (
      unitId: string,
      examType: ExamType,
      paperSize: PaperSize,
      feedback?: { challengingConcepts?: Array<{ topic: string }> }
    ) => preloadingService.onExamComplete(unitId, examType, paperSize, feedback),
    preloadLikelyExams: () => preloadingService.preloadLikelyExams(),
    
    // Cleanup
    cleanupExpired: () => preloadingService.cleanupExpired(),
  };
}
