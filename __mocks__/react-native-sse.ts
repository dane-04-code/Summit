/**
 * Manual mock for react-native-sse (jest picks this up for any test that
 * imports an adapter). Tests drive it by grabbing `MockEventSource.instances`
 * and calling `emit`.
 */

type Listener = (event: { data?: string | null }) => void;

export default class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Listener[]>();
  closed = false;

  constructor(
    public url: string,
    public options: { method?: string; headers?: Record<string, string>; body?: string },
  ) {
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, cb: Listener): void {
    const list = this.listeners.get(name) ?? [];
    list.push(cb);
    this.listeners.set(name, list);
  }

  emit(name: string, event: { data?: string | null }): void {
    for (const cb of this.listeners.get(name) ?? []) cb(event);
  }

  removeAllEventListeners(): void {
    this.listeners.clear();
  }

  close(): void {
    this.closed = true;
  }
}
