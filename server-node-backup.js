const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3000;
const HOST = "0.0.0.0";
const users = new Map();

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  });
  res.end(typeof data === "string" ? data : JSON.stringify(data));
}

function cleanupUsers() {
  const now = Date.now();
  for (const [id, user] of users) {
    if (now - user.lastSeen > 30000) users.delete(id);
  }
}
setInterval(cleanupUsers, 5000);

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return send(res, 400, { ok: false, error: "آدرس نامعتبر است" });
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/health") {
    cleanupUsers();
    return send(res, 200, { ok: true, service: "hamyab", users: users.size, time: new Date().toISOString() });
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    cleanupUsers();
    return send(res, 200, { ok: true, users: Array.from(users.values()) });
  }

  if (req.method === "POST" && url.pathname === "/api/location") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const id = typeof data.id === "string" && data.id.trim() ? data.id.trim().slice(0, 100) : crypto.randomUUID();
        const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : "کاربر";
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return send(res, 400, { ok: false, error: "مختصات نامعتبر است" });
        }
        let accuracy = null;
        if (data.accuracy !== null && data.accuracy !== undefined) {
          const n = Number(data.accuracy);
          if (Number.isFinite(n)) accuracy = Math.max(0, n);
        }
        const user = { id, name, lat, lng, accuracy, lastSeen: Date.now() };
        users.set(id, user);
        send(res, 200, { ok: true, user });
      } catch {
        send(res, 400, { ok: false, error: "JSON نامعتبر است" });
      }
    });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/location/")) {
    const id = decodeURIComponent(url.pathname.substring("/api/location/".length));
    users.delete(id);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/") {
    const file = path.join(__dirname, "index.html");
    if (!fs.existsSync(file)) return send(res, 404, { ok: false, error: "index.html پیدا نشد" });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return fs.createReadStream(file).pipe(res);
  }

  send(res, 404, { ok: false, error: "Not Found" });
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("======================================");
  console.log("🚗 HAMYAB SERVER");
  console.log("======================================");
  console.log(`LOCAL:  http://127.0.0.1:${PORT}`);
  console.log(`HEALTH: http://127.0.0.1:${PORT}/health`);
  console.log(`USERS:  http://127.0.0.1:${PORT}/api/users`);
  console.log("======================================");
});
