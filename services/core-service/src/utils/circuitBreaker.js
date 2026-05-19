/**
 * core-service/src/utils/circuitBreaker.js
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 */
class CircuitBreaker {
  constructor({ failureThreshold = 10, recoveryTimeMs = 30_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeMs   = recoveryTimeMs;
    this.failureCount     = 0;
    this.state            = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.lastFailureTime  = null;
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error(`[CircuitBreaker] OPEN — refusing call`);
      }
    }
    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState() { return this.state; }
  getFailureCount() { return this.failureCount; }
}

module.exports = CircuitBreaker;
