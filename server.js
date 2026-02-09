const { createServer } = require("https");
const { readFileSync } = require("fs");
const { parse } = require("url");
const next = require("next");

const app = next({ dev: false });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync("certs/key.pem"),
  cert: readFileSync("certs/cert.pem"),
};

const port = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    // HSTS: tell browsers to always use HTTPS for this domain
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains"
    );
    handle(req, res, parse(req.url, true));
  }).listen(port, "0.0.0.0", () => {
    console.log(`> HTTPS server listening on https://0.0.0.0:${port}`);
  });
});
