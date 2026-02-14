const express = require("express");
const compression = require("compression");
const next = require("next");
const path = require("path");
const { parse } = require("url");

const app = next({ dev: false });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(() => {
  const server = express();
  server.use(compression());

  // Request timing log
  server.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      if (ms > 100 || !req.url.startsWith("/_next/static")) {
        console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
      }
    });
    next();
  });

  // Serve Next.js static assets through express (enables compression)
  server.use(
    "/_next/static",
    express.static(path.join(__dirname, ".next/static"), {
      maxAge: "365d",
      immutable: true,
    })
  );

  // Everything else goes through Next.js
  server.all("/{*splat}", (req, res) => handle(req, res, parse(req.url, true)));
  server.listen(port, "0.0.0.0", () => {
    console.log(`> Server listening on http://0.0.0.0:${port}`);
  });
});
