export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

const H = { "content-type": "application/json" };
export const post = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "POST", headers: H, body: JSON.stringify(body) });
export const put = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "PUT", headers: H, body: JSON.stringify(body) });
export const patch = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "PATCH", headers: H, body: JSON.stringify(body) });
export const del = <T = unknown>(url: string) => api<T>(url, { method: "DELETE" });

/** Чтение SSE-потока от сервера. */
export async function streamSse(url: string, body: unknown, onEvent: (e: Record<string, unknown> & { type: string }) => void | Promise<void>, signal?: AbortSignal) {
  const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) throw new Error(`Ошибка ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (line) {
        try {
          await onEvent(JSON.parse(line.slice(5).trim()));
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }
}
