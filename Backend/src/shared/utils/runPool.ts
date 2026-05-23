/**
 * Run async tasks with a concurrency limit (worker pool).
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  const limit = Math.max(1, concurrency);
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext()
  );
  await Promise.all(runners);
}
