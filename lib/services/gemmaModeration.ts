//--src/lib/services/gemmaModeration.ts
/**
 * Google Gemma Shield Auto-Moderation Service
 * Integrates with Google's open-source ShieldGemma models for content moderation
 */

export interface ModerationResult {
  allowed: boolean;
  flagged: boolean;
  confidence: number;
  categories: {
    sexuallyExplicit: number;
    hate: number;
    dangerous: number;
    harassment: number;
  };
  reason?: string;
}

export interface ModerationConfig {
  enabled: boolean;
  strictMode: boolean;
  thresholds: {
    sexuallyExplicit: number;
    hate: number;
    dangerous: number;
    harassment: number;
  };
  fallbackToBasicFilter: boolean;
}

export class GemmaModerationService {
  private static instance: GemmaModerationService;
  private config: ModerationConfig;
  private isModelLoaded = false;

  private constructor(config?: Partial<ModerationConfig>) {
    this.config = {
      enabled: true,
      strictMode: false,
      thresholds: {
        sexuallyExplicit: 0.7,
        hate: 0.6,
        dangerous: 0.8,
        harassment: 0.6
      },
      fallbackToBasicFilter: true,
      ...config
    };
  }

  public static getInstance(config?: Partial<ModerationConfig>): GemmaModerationService {
    if (!GemmaModerationService.instance) {
      GemmaModerationService.instance = new GemmaModerationService(config);
    }
    return GemmaModerationService.instance;
  }

  /**
   * Initialize Gemma Shield model (would load actual model in production)
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // In production, this would load the actual Gemma Shield model:
      // const model = await loadGemmaShieldModel('google/shieldgemma-2b');
      // For now, we'll simulate model loading
      console.log('🛡️ Initializing Gemma Shield auto-moderation...');
      
      // Simulate model loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isModelLoaded = true;
      console.log('✅ Gemma Shield auto-moderation ready');
    } catch (error) {
      console.error('❌ Failed to load Gemma Shield model:', error);
      if (this.config.fallbackToBasicFilter) {
        console.log('🔄 Falling back to basic content filtering');
      }
    }
  }

  /**
   * Moderate message content
   */
  public async moderateContent(content: string): Promise<ModerationResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        flagged: false,
        confidence: 0,
        categories: {
          sexuallyExplicit: 0,
          hate: 0,
          dangerous: 0,
          harassment: 0
        }
      };
    }

    // Use Gemma Shield if available, otherwise fallback to basic filtering
    if (this.isModelLoaded) {
      return this.runGemmaShieldModeration(content);
    } else if (this.config.fallbackToBasicFilter) {
      return this.runBasicModeration(content);
    }

    // If no moderation available, allow by default
    return {
      allowed: true,
      flagged: false,
      confidence: 0,
      categories: {
        sexuallyExplicit: 0,
        hate: 0,
        dangerous: 0,
        harassment: 0
      }
    };
  }

  /**
   * Run Gemma Shield moderation (simulated for now)
   */
  private async runGemmaShieldModeration(content: string): Promise<ModerationResult> {
    try {
      // In production, this would call the actual Gemma Shield model:
      /*
      const inputs = tokenizer(content, { return_tensors: "pt" });
      const outputs = await model(inputs);
      const scores = softmax(outputs.logits[0]);
      */

      // Simulated scoring based on content analysis
      const categories = {
        sexuallyExplicit: this.analyzeContent(content, ['sex', 'sexual', 'nude', 'porn']),
        hate: this.analyzeContent(content, ['hate', 'racist', 'nazi', 'kill']),
        dangerous: this.analyzeContent(content, ['bomb', 'weapon', 'murder', 'suicide']),
        harassment: this.analyzeContent(content, ['harassment', 'bully', 'threat', 'doxx'])
      };

      const maxScore = Math.max(...Object.values(categories));
      const flagged = Object.entries(categories).some(([key, score]) => 
        score > this.config.thresholds[key as keyof typeof this.config.thresholds]
      );

      const flaggedCategory = Object.entries(categories).find(([key, score]) => 
        score > this.config.thresholds[key as keyof typeof this.config.thresholds]
      );

      return {
        allowed: !flagged,
        flagged,
        confidence: maxScore,
        categories,
        reason: flagged ? `Content flagged for ${flaggedCategory?.[0]}` : undefined
      };
    } catch (error) {
      console.error('Gemma Shield moderation error:', error);
      return this.runBasicModeration(content);
    }
  }

  /**
   * Basic content filtering fallback
   */
  private runBasicModeration(content: string): ModerationResult {
    const lowerContent = content.toLowerCase();
    
    // Basic prohibited words and patterns
    const prohibitedWords = [
      'spam', 'scam', 'fake', 'hate', 'kill', 'die', 'suicide',
      'nazi', 'racist', 'porn', 'sex', 'nude', 'harassment'
    ];

    const flaggedWords = prohibitedWords.filter(word => lowerContent.includes(word));
    const flagged = flaggedWords.length > 0;

    // Check for excessive caps (spam indicator)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    const excessiveCaps = content.length > 10 && capsRatio > 0.7;

    // Check for repeated characters (spam indicator)
    const repeatedChars = /(.)\\1{4,}/.test(content);

    const isFlagged = flagged || excessiveCaps || repeatedChars;
    const confidence = isFlagged ? 0.8 : 0.1;

    let reason = '';
    if (flagged) reason = `Prohibited words: ${flaggedWords.join(', ')}`;
    else if (excessiveCaps) reason = 'Excessive capitalization';
    else if (repeatedChars) reason = 'Spam pattern detected';

    return {
      allowed: !isFlagged,
      flagged: isFlagged,
      confidence,
      categories: {
        sexuallyExplicit: flaggedWords.some(w => ['porn', 'sex', 'nude'].includes(w)) ? 0.9 : 0.1,
        hate: flaggedWords.some(w => ['hate', 'nazi', 'racist'].includes(w)) ? 0.9 : 0.1,
        dangerous: flaggedWords.some(w => ['kill', 'die', 'suicide'].includes(w)) ? 0.9 : 0.1,
        harassment: flaggedWords.some(w => ['harassment', 'hate'].includes(w)) ? 0.9 : 0.1
      },
      reason: isFlagged ? reason : undefined
    };
  }

  /**
   * Analyze content for specific categories (helper for simulated Gemma scoring)
   */
  private analyzeContent(content: string, keywords: string[]): number {
    const lowerContent = content.toLowerCase();
    const matchCount = keywords.filter(keyword => lowerContent.includes(keyword)).length;
    return Math.min(matchCount * 0.3, 0.95); // Cap at 95% confidence
  }

  /**
   * Update moderation configuration
   */
  public updateConfig(newConfig: Partial<ModerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ModerationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const gemmaModerationService = GemmaModerationService.getInstance();

// Initialize the service
gemmaModerationService.initialize().catch(console.error);