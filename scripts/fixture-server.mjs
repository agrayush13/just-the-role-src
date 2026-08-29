import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const routes = new Map([
  ["/jobs/view/fixture", ["tests/fixtures/job-page.html", "text/html; charset=utf-8"]],
  ["/content.js", ["dist/content.js", "text/javascript; charset=utf-8"]],
  ["/content.css", ["dist/content.css", "text/css; charset=utf-8"]],
  ["/icon-32.png", ["assets/icons/icon-32.png", "image/png"]],
]);

createServer((request, response) => {
  const route = routes.get(request.url ?? "");
  if (!route) { response.writeHead(404).end("Not found"); return; }
  response.writeHead(200, { "content-type": route[1] });
  createReadStream(resolve(route[0])).pipe(response);
}).listen(4173, "127.0.0.1", () => {
  console.log("Fixture server listening on http://127.0.0.1:4173/jobs/view/fixture");
});
