/**
 * Bridges a callback-based SSE source (react-native-sse is push, not pull) into
 * an `AsyncIterable` the UI can `for await` over. Buffers events pushed before
 * the consumer asks, and parks the consumer when it's ahead of the producer.
 */
export class EventQueue<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private resolvers: ((result: IteratorResult<T>) => void)[] = [];
  private done = false;

  push(value: T): void {
    const resolve = this.resolvers.shift();
    if (resolve) resolve({ value, done: false });
    else this.values.push(value);
  }

  close(): void {
    this.done = true;
    let resolve = this.resolvers.shift();
    while (resolve) {
      resolve({ value: undefined, done: true });
      resolve = this.resolvers.shift();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const value = this.values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.resolvers.push(resolve));
      },
    };
  }
}
