import logger from "../util/logger";

interface RateLimitConfig {
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  minMessageDelay: number; // milliseconds
  maxMessageDelay: number; // milliseconds
  maxConcurrentSending: number;
}

interface AccountRateLimit {
  hourlyCount: number;
  dailyCount: number;
  lastHourReset: Date;
  lastDailyReset: Date;
  lastMessageTime: Date;
  isSending: boolean;
}

export class RateLimiterService {
  private accountLimits: Map<string, AccountRateLimit> = new Map();
  private config: RateLimitConfig;
  private concurrentSendingCount = 0;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if account can send message now
   */
  canSendMessage(accountId: string): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    const limit = this.getOrCreateLimit(accountId);
    const now = new Date();

    // Reset hourly counter
    if (now.getTime() - limit.lastHourReset.getTime() > 3600000) {
      limit.hourlyCount = 0;
      limit.lastHourReset = now;
    }

    // Reset daily counter
    if (now.getTime() - limit.lastDailyReset.getTime() > 86400000) {
      limit.dailyCount = 0;
      limit.lastDailyReset = now;
    }

    // Check hourly limit
    if (limit.hourlyCount >= this.config.maxMessagesPerHour) {
      const waitTime =
        3600000 - (now.getTime() - limit.lastHourReset.getTime());
      return {
        allowed: false,
        reason: "Hourly rate limit exceeded",
        waitTime: Math.ceil(waitTime / 1000),
      };
    }

    // Check daily limit
    if (limit.dailyCount >= this.config.maxMessagesPerDay) {
      const waitTime =
        86400000 - (now.getTime() - limit.lastDailyReset.getTime());
      return {
        allowed: false,
        reason: "Daily rate limit exceeded",
        waitTime: Math.ceil(waitTime / 1000),
      };
    }

    // Check concurrent sending limit
    if (this.concurrentSendingCount >= this.config.maxConcurrentSending) {
      return {
        allowed: false,
        reason: "Too many concurrent sending operations",
        waitTime: 5,
      };
    }

    // Check minimum delay between messages
    const timeSinceLastMessage =
      now.getTime() - limit.lastMessageTime.getTime();
    if (timeSinceLastMessage < this.config.minMessageDelay) {
      const waitTime = this.config.minMessageDelay - timeSinceLastMessage;
      return {
        allowed: false,
        reason: "Too fast, wait before sending next message",
        waitTime: Math.ceil(waitTime / 1000),
      };
    }

    return { allowed: true };
  }

  /**
   * Record a message send
   */
  recordMessage(accountId: string): void {
    const limit = this.getOrCreateLimit(accountId);
    limit.hourlyCount++;
    limit.dailyCount++;
    limit.lastMessageTime = new Date();
    logger.debug(
      `Account ${accountId} - Hourly: ${limit.hourlyCount}/${this.config.maxMessagesPerHour}, Daily: ${limit.dailyCount}/${this.config.maxMessagesPerDay}`
    );
  }

  /**
   * Get random delay for natural behavior
   */
  getRandomDelay(): number {
    const min = this.config.minMessageDelay;
    const max = this.config.maxMessageDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Mark account as currently sending
   */
  startSending(accountId: string): void {
    const limit = this.getOrCreateLimit(accountId);
    limit.isSending = true;
    this.concurrentSendingCount++;
    logger.debug(`Concurrent sending count: ${this.concurrentSendingCount}`);
  }

  /**
   * Mark account as finished sending
   */
  finishSending(accountId: string): void {
    const limit = this.accountLimits.get(accountId);
    if (limit && limit.isSending) {
      limit.isSending = false;
      this.concurrentSendingCount--;
      logger.debug(`Concurrent sending count: ${this.concurrentSendingCount}`);
    }
  }

  /**
   * Get account statistics
   */
  getStats(accountId: string): {
    hourlyCount: number;
    dailyCount: number;
    hourlyLimit: number;
    dailyLimit: number;
  } {
    const limit = this.getOrCreateLimit(accountId);
    return {
      hourlyCount: limit.hourlyCount,
      dailyCount: limit.dailyCount,
      hourlyLimit: this.config.maxMessagesPerHour,
      dailyLimit: this.config.maxMessagesPerDay,
    };
  }

  /**
   * Reset stats for an account
   */
  resetStats(accountId: string): void {
    this.accountLimits.delete(accountId);
    logger.info(`Reset rate limit stats for account ${accountId}`);
  }

  private getOrCreateLimit(accountId: string): AccountRateLimit {
    if (!this.accountLimits.has(accountId)) {
      const now = new Date();
      this.accountLimits.set(accountId, {
        hourlyCount: 0,
        dailyCount: 0,
        lastHourReset: now,
        lastDailyReset: now,
        lastMessageTime: new Date(0), // epoch
        isSending: false,
      });
    }
    return this.accountLimits.get(accountId)!;
  }
}
