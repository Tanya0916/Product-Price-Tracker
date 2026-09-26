const { sleep } = require('../utils/sleep');
const logger = require('../utils/logger');

/**
 * Checks if an error is considered retryable
 * @param {Error|any} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (!error) return false;
  
  // Status code based check
  const status = error.status || error.response?.status;
  if (status) {
    if (status === 404) return false; // 404 Product not found shouldn't retry
    if (status === 400 || status === 401 || status === 403) return false; // Auth / Bad Request
    if (status === 429) return true;  // Rate limit
    if (status >= 500) return true;  // Server error
  }

  // Network / timeout strings
  const msg = (error.message || '').toLowerCase();
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('retrying') ||
    msg.includes('failed to fetch') ||
    msg.includes('target closed') ||
    msg.includes('execution context was destroyed')
  ) {
    return true;
  }

  // Default to retrying for scraper transient issues unless explicitly 404
  return true;
}

/**
 * Execute an operation with exponential backoff and jitter
 * @param {Function} operation Async function (attemptNumber) => Promise<T>
 * @param {Object} options
 * @param {number} options.maxRetries Maximum retry attempts (default 3)
 * @param {number} options.baseDelayMs Initial delay in ms (default 1500)
 * @param {number} options.maxDelayMs Max delay cap in ms (default 10000)
 * @param {number} options.jitterRatio Random variation ratio (0.2 = ±20%)
 * @param {Function} options.onAttempt Log or callback for each attempt
 * @returns {Promise<{ result: any, attempts: number, durationMs: number }>}
 */
async function executeWithRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1500,
    maxDelayMs = 10000,
    jitterRatio = 0.2,
    onAttempt = null
  } = options;

  let attempt = 1;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    const attemptStart = Date.now();
    try {
      if (onAttempt) {
        onAttempt({ attempt, maxRetries, phase: 'START', duration: 0 });
      }

      const result = await operation(attempt);

      if (onAttempt) {
        onAttempt({
          attempt,
          maxRetries,
          phase: 'SUCCESS',
          duration: Date.now() - attemptStart
        });
      }

      return {
        result,
        attempts: attempt,
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      const duration = Date.now() - attemptStart;
      const retryable = isRetryableError(err);

      if (attempt >= maxRetries || !retryable) {
        if (onAttempt) {
          onAttempt({
            attempt,
            maxRetries,
            phase: 'FAILED',
            duration,
            error: err
          });
        }
        err.attemptsCount = attempt;
        err.totalDurationMs = Date.now() - startTime;
        throw err;
      }

      // Calculate exponential backoff delay with jitter
      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = expDelay * jitterRatio * (Math.random() * 2 - 1);
      const delayMs = Math.max(200, Math.round(expDelay + jitter));

      if (onAttempt) {
        onAttempt({
          attempt,
          maxRetries,
          phase: 'RETRIED',
          duration,
          error: err,
          nextDelayMs: delayMs
        });
      }

      logger.retry(attempt, maxRetries, delayMs, err.message || 'Transient error');
      await sleep(delayMs);
      attempt++;
    }
  }
}

module.exports = {
  executeWithRetry,
  isRetryableError
};
