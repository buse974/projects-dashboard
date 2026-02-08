const crypto = require("crypto");

const ERROR_PATTERNS = [
  { regex: /HTTP\/[\d.]+ [5]\d{2}/i, type: "http_5xx" },
  { regex: /\bFATAL\b/i, type: "fatal" },
  { regex: /\bError:\s+/i, type: "error" },
  { regex: /UnhandledPromiseRejection/i, type: "unhandled_rejection" },
  { regex: /ECONNREFUSED/i, type: "connection_refused" },
  { regex: /\bOOM\b|out of memory/i, type: "oom" },
  { regex: /\bENOMEM\b/i, type: "oom" },
  { regex: /\bSIGKILL\b|\bSIGSEGV\b/i, type: "signal" },
  { regex: /at\s+\S+\s+\(.*:\d+:\d+\)/i, type: "stack_trace" },
  { regex: /TypeError:|ReferenceError:|SyntaxError:/i, type: "js_error" },
  { regex: /\bpanic\b:/i, type: "panic" },
  { regex: /\bERROR\b\s+\d{4}/i, type: "error_log" },
];

// Dedup window: same hash within this period = skip
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

class ErrorDetector {
  constructor() {
    // In-memory dedup: hash → { count, firstSeen, lastSeen }
    this.seen = new Map();
  }

  /**
   * Check if a log line matches any error pattern.
   * Returns null if no match, or { type, hash, line, normalized } if match.
   */
  detect(line) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(line)) {
        const normalized = this._normalize(line);
        const hash = this._hash(normalized);
        return {
          type: pattern.type,
          hash,
          line,
          normalized,
        };
      }
    }
    return null;
  }

  /**
   * Check if this error is a duplicate (same hash within dedup window).
   * If not a duplicate, registers it and returns false.
   * If duplicate, increments count and returns true.
   */
  isDuplicate(hash) {
    const now = Date.now();
    const existing = this.seen.get(hash);

    if (existing && now - existing.lastSeen < DEDUP_WINDOW_MS) {
      existing.count++;
      existing.lastSeen = now;
      return true;
    }

    this.seen.set(hash, { count: 1, firstSeen: now, lastSeen: now });
    return false;
  }

  /**
   * Get dedup stats for a hash.
   */
  getStats(hash) {
    return this.seen.get(hash) || null;
  }

  /**
   * Get all recent errors (within dedup window).
   */
  getRecentErrors() {
    const now = Date.now();
    const result = [];
    for (const [hash, stats] of this.seen) {
      if (now - stats.lastSeen < DEDUP_WINDOW_MS) {
        result.push({ hash, ...stats });
      }
    }
    return result;
  }

  /**
   * Normalize a log line: remove timestamps, UUIDs, request IDs, etc.
   */
  _normalize(line) {
    return line
      // Remove ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z+-]*/g, "")
      // Remove unix timestamps
      .replace(/\b\d{10,13}\b/g, "")
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
      // Remove hex IDs (12+ chars)
      .replace(/\b[0-9a-f]{12,}\b/gi, "")
      // Remove IP:port
      .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  _hash(str) {
    return crypto.createHash("sha256").update(str).digest("hex").substring(0, 12);
  }

  /**
   * Clean up old entries from the dedup map.
   */
  cleanup() {
    const now = Date.now();
    for (const [hash, stats] of this.seen) {
      if (now - stats.lastSeen > DEDUP_WINDOW_MS * 2) {
        this.seen.delete(hash);
      }
    }
  }
}

module.exports = ErrorDetector;
