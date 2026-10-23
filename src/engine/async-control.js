export function aborted(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException('Canceled', 'AbortError');
}
export function abortable(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const clean = () => signal.removeEventListener('abort', stop);
    const stop = () => { clean(); reject(signal.reason || new DOMException('Canceled', 'AbortError')); };
    Promise.resolve(promise).then(value => { clean(); resolve(value); }, error => { clean(); reject(error); });
    if (signal.aborted) { stop(); return; }
    signal.addEventListener('abort', stop, { once: true });
  });
}
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    const stop = () => { clean(); reject(signal.reason || new DOMException('Canceled', 'AbortError')); };
    if (signal?.aborted) { stop(); return; }
    signal?.addEventListener('abort', stop, { once: true });
    timer = setTimeout(() => { clean(); resolve(); }, Math.max(0, ms));
  });
}
export async function fetchRemote({ endpoint, body, timeoutMs, signal }) {
  aborted(signal);
  if (!/^https:\/\//i.test(endpoint || '')) throw new Error('Remote endpoint must be HTTPS');
  const controller = new AbortController();
  const stop = () => controller.abort(signal.reason || new DOMException('Canceled', 'AbortError'));
  signal?.addEventListener('abort', stop, { once: true });
  const ms = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 8000;
  const timer = setTimeout(() => {
    const error = new Error(`Timed out after ${ms}ms`); error.name = 'TimeoutError'; controller.abort(error);
  }, ms);
  try {
    aborted(signal);
    const response = await abortable(fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal
    }), controller.signal);
    aborted(controller.signal);
    if (!response.ok) throw new Error(`Remote provider failed with ${response.status}`);
    const data = await abortable(response.json(), controller.signal);
    aborted(controller.signal);
    return data;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', stop);
  }
}
