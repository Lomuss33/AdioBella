interface PendingTimer {
  remainingMs: number;
  scheduledAt: number;
  timeoutId: number;
  callback: () => void;
}

/** Deadlines use normal-speed time, so changing speed preserves phase progress. */
export class PlaybackClock {
  private timers = new Set<PendingTimer>();

  constructor(private rate = 1) {}

  schedule(ms: number, callback: () => void) {
    const timer: PendingTimer = { remainingMs: ms, scheduledAt: 0, timeoutId: 0, callback };
    this.timers.add(timer);
    this.arm(timer);
    // Finish this one wait immediately without affecting any other deadline.
    return () => {
      if (!this.timers.delete(timer)) return;
      window.clearTimeout(timer.timeoutId);
      timer.callback();
    };
  }

  setRate(rate: number) {
    if (rate === this.rate) return;
    const now = performance.now();
    this.timers.forEach(timer => {
      timer.remainingMs = Math.max(0, timer.remainingMs - (now - timer.scheduledAt) * this.rate);
      window.clearTimeout(timer.timeoutId);
    });
    this.rate = rate;
    this.timers.forEach(timer => this.arm(timer));
  }

  clear() {
    this.timers.forEach(timer => window.clearTimeout(timer.timeoutId));
    this.timers.clear();
  }

  private arm(timer: PendingTimer) {
    timer.scheduledAt = performance.now();
    timer.timeoutId = window.setTimeout(() => {
      if (this.timers.delete(timer)) timer.callback();
    }, timer.remainingMs / this.rate);
  }
}
