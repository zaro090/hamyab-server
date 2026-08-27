const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const users = new Map();

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
    "Cache-Control": "no-store",

    // جلوگیری از صفحه هشدار ngrok
    "ngrok-skip-browser-warning": "true"
  });

  res.end(typeof data === "string" ? data : JSON.stringify(data));
}

function cleanupUsers() {
  const now = Date.now();

  for (const [id, user] of users) {
    if (now - user.lastSeen > 30000) {
      users.delete(id);
    }
  }
}

setInterval(cleanupUsers, 5000);

const server = http.createServer((req, res) => {
  let url;

  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return send(res, 400, {
      ok: false,
      error: "آدرس نامعتبر است"
    });
  }

  // CORS / Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, ngrok-skip-browser-warning",
      "Access-Control-Max-Age": "86400",
      "ngrok-skip-browser-warning": "true"
    });

    return res.end();
  }

  // =========================
  // HEALTH
  // =========================

  if (req.method === "GET" && url.pathname === "/health") {
    cleanupUsers();

    return send(res, 200, {
      ok: true,
      service: "hamyab",
      users: users.size,
      time: new Date().toISOString()
    });
  }

  // =========================
  // USERS
  // =========================

  if (req.method === "GET" && url.pathname === "/api/users") {
    cleanupUsers();

    return send(res, 200, {
      ok: true,
      users: Array.from(users.values())
    });
  }

  // =========================
  // LOCATION UPDATE
  // =========================

  if (req.method === "POST" && url.pathname === "/api/location") {
    let body = "";
    let aborted = false;

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 10000) {
        aborted = true;
        req.destroy();
      }
    });

    req.on("end", () => {
      if (aborted) return;

      try {
        const data = JSON.parse(body);

        const id =
          typeof data.id === "string" && data.id.trim().length
            ? data.id.trim().slice(0, 100)
            : crypto.randomUUID();

        const name =
          typeof data.name === "string" && data.name.trim().length
            ? data.name.trim().slice(0, 40)
            : "کاربر";

        const lat = Number(data.lat);
        const lng = Number(data.lng);

        const accuracy =
          data.accuracy == null
            ? null
            : Number(data.accuracy);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return send(res, 400, {
            ok: false,
            error: "مختصات نامعتبر است"
          });
        }

        const user = {
          id,
          name,
          lat,
          lng,
          accuracy:
            Number.isFinite(accuracy)
              ? Math.max(0, accuracy)
              : null,
          lastSeen: Date.now()
        };

        users.set(id, user);

        return send(res, 200, {
          ok: true,
          user
        });

      } catch (err) {
        console.error("JSON ERROR:", err);

        return send(res, 400, {
          ok: false,
          error: "JSON نامعتبر است"
        });
      }
    });

    return;
  }

  // =========================
  // REMOVE USER
  // =========================

  if (
    req.method === "DELETE" &&
    url.pathname.startsWith("/api/location/")
  ) {
    const id = decodeURIComponent(
      url.pathname.substring("/api/location/".length)
    );

    users.delete(id);

    return send(res, 200, {
      ok: true
    });
  }

  // =========================
  // MAIN PAGE
  // =========================

  if (req.method === "GET" && url.pathname === "/") {
    const file = path.join(__dirname, "index.html");

    if (!fs.existsSync(file)) {
      return send(res, 404, {
        ok: false,
        error: "index.html پیدا نشد"
      });
    }

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "ngrok-skip-browser-warning": "true"
    });

    return fs.createReadStream(file).pipe(res);
  }

  // =========================
  // 404
  // =========================

  return send(res, 404, {
    ok: false,
    error: "Not Found"
  });
});

// =========================
// ERROR HANDLING
// =========================

server.on("error", err => {
  console.error("SERVER ERROR:", err);
});

// =========================
// START
// =========================

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
