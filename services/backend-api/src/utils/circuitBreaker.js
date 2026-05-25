/**
 * backend-api/src/utils/circuitBreaker.js
 * Bảo vệ Facebook Graph API calls
 */
const { createLogger } = require("./logger");
const logger = createLogger("circuit-breaker");

class CircuitBreaker {
  constructor({ failureThreshold = 10, recoveryTimeMs = 30_000, name = "default" } = {}) {
    this.name             = name;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeMs   = recoveryTimeMs;
    this.failureCount     = 0;
    this.state            = "CLOSED";
    this.lastFailureTime  = null;
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
        this.state = "HALF_OPEN";
        logger.warn(`[${this.name}] Circuit HALF_OPEN — testing recovery`);
      } else {
        throw new Error(`CircuitBreaker[${this.name}] OPEN — call rejected`);
      }
    }
    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === "HALF_OPEN") logger.info(`[${this.name}] Circuit CLOSED — recovered`);
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  _onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold && this.state !== "OPEN") {
      this.state = "OPEN";
      logger.error(`[${this.name}] Circuit OPEN after ${this.failureCount} failures: ${err.message}`);
    }
  }

  getState()        { return this.state; }
  getFailureCount() { return this.failureCount; }
}

module.exports = CircuitBreaker;
