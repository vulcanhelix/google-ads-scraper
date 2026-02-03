export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

export function humanDelay(baseMs: number = 1000): Promise<void> {
  const variance = baseMs * 0.5;
  const ms = baseMs + (Math.random() - 0.5) * 2 * variance;
  return delay(Math.max(100, ms));
}
