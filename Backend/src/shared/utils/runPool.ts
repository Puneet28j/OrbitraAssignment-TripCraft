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

/**
 * Map items with a concurrency limit and return results in order.
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  const limit = Math.max(1, concurrency);
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext()
  );
  await Promise.all(runners);
  return results;
}
