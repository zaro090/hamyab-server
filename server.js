const users = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
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

export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      cleanupUsers();

      return json({
        ok: true,
        service: "hamyab",
        users: users.size,
        time: new Date().toISOString(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      cleanupUsers();

      return json({
        ok: true,
        users: Array.from(users.values()),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/location") {
      try {
        const data = await req.json();

        const id =
          typeof data.id === "string" && data.id.trim()
            ? data.id.trim().slice(0, 100)
            : crypto.randomUUID();

        const name =
          typeof data.name === "string" && data.name.trim()
            ? data.name.trim().slice(0, 40)
            : "کاربر";

        const lat = Number(data.lat);
        const lng = Number(data.lng);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return json(
            {
              ok: false,
              error: "مختصات نامعتبر است",
            },
            400,
          );
        }

        let accuracy = null;

        if (data.accuracy !== null && data.accuracy !== undefined) {
          const n = Number(data.accuracy);

          if (Number.isFinite(n)) {
            accuracy = Math.max(0, n);
          }
        }

        const user = {
          id,
          name,
          lat,
          lng,
          accuracy,
          lastSeen: Date.now(),
        };

        users.set(id, user);

        return json({
          ok: true,
          user,
        });
      } catch {
        return json(
          {
            ok: false,
            error: "JSON نامعتبر است",
          },
          400,
        );
      }
    }

    if (
      req.method === "DELETE" &&
      url.pathname.startsWith("/api/location/")
    ) {
      const id = decodeURIComponent(
        url.pathname.substring("/api/location/".length),
      );

      users.delete(id);

      return json({
        ok: true,
      });
    }

    if (req.method === "GET" && url.pathname === "/") {
      try {
        const html = await Deno.readTextFile("./index.html");

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } catch {
        return json(
          {
            ok: false,
            error: "index.html پیدا نشد",
          },
          404,
        );
      }
    }

    return json(
      {
        ok: false,
        error: "Not Found",
      },
      404,
    );
  },
};
