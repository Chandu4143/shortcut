// Capture the reel timeline as a numbered JPEG sequence over the Chrome DevTools Protocol.
// Usage: node render.mjs [outDir] [url] [startFrame]
// Requires: Chrome on --remote-debugging-port=9222, repo root served on :8126.

const fs = await import("node:fs");
const path = await import("node:path");

const FPS = 30;
const DURATION = 18.4;
const OUT = process.argv[2] || path.resolve("frames");
const URL = process.argv[3] || "http://localhost:8126/marketing/source/reel.html?render=1";
const START = Number(process.argv[4] || 0);

const targets = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("No Chrome page target found on :9222");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1080,
  height: 1920,
  deviceScaleFactor: 1,
  mobile: false,
});

fs.mkdirSync(OUT, { recursive: true });
await send("Page.navigate", { url: URL });
await send("Runtime.evaluate", {
  expression: "window.__ready.then(r => JSON.stringify(r))",
  awaitPromise: true,
  returnByValue: true,
});

const total = Math.round(DURATION * FPS);
for (let i = START; i < total; i++) {
  await send("Runtime.evaluate", {
    expression: `new Promise(r => { window.__render(${i / FPS}); requestAnimationFrame(() => requestAnimationFrame(() => r(1))); })`,
    awaitPromise: true,
    returnByValue: true,
  });
  const shot = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 96,
    fromSurface: true,
    optimizeForSpeed: true,
  });
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, "0")}.jpg`), Buffer.from(shot.data, "base64"));
  if (i % 60 === 0) console.log(`frame ${i}/${total}`);
}

console.log("done", total, "frames ->", OUT);
ws.close();
