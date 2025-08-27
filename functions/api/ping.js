export async function onRequest() {
  return new Response("ok/pong", {
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
  });
}
