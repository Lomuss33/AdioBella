export interface RandomSource {
  nextFloat(): number;
  nextInt(bound: number): number;
}

export class BrowserRandom implements RandomSource {
  nextFloat() {
    return Math.random();
  }

  nextInt(bound: number) {
    return Math.floor(this.nextFloat() * bound);
  }
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextFloat() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(bound: number) {
    return Math.floor(this.nextFloat() * bound);
  }
}
