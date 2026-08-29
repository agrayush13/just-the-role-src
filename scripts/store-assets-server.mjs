import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const routes = new Map([
  ["/jobs/view/showcase", ["store-assets/job-showcase.html", "text/html; charset=utf-8"]],
  ["/content.js", ["dist/content.js", "text/javascript; charset=utf-8"]],
  ["/content.css", ["dist/content.css", "text/css; charset=utf-8"]],
  ["/options.html", ["dist/options.html", "text/html; charset=utf-8"]],
  ["/options.css", ["dist/options.css", "text/css; charset=utf-8"]],
  ["/options.js", ["dist/options.js", "text/javascript; charset=utf-8"]],
  ["/privacy.html", ["dist/privacy.html", "text/html; charset=utf-8"]],
  ["/promo.html", ["store-assets/promo.html", "text/html; charset=utf-8"]],
  ["/icon-source.png", ["assets/icons/icon-source.png", "image/png"]],
  ["/icon-128.png", ["assets/icons/icon-128.png", "image/png"]],
]);

createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const route = routes.get(requestUrl.pathname);
  if (!route) { response.writeHead(404).end("Not found"); return; }
  response.writeHead(200, { "content-type": route[1], "cache-control": "no-store" });
  createReadStream(resolve(route[0])).pipe(response);
}).listen(4174, "127.0.0.1", () => {
  console.log("Store asset server listening on http://127.0.0.1:4174/jobs/view/showcase");
});
