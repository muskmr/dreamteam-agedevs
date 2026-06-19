import { api } from "encore.dev/api";
import { appMeta } from "encore.dev";
import { getAuthData } from "~encore/auth";

// Landing page with usage instructions.
export const index = api.raw(
  { expose: true, method: "GET", path: "/" },
  async (req, resp) => {
    const baseUrl = appMeta().apiBaseUrl;
    resp.setHeader("Content-Type", "text/html");
    resp.end(landingPage.replaceAll("{{baseUrl}}", baseUrl));
  },
);

const landingPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello World</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; color: #fff; }
    h2 { font-size: 1.1rem; margin-top: 2rem; margin-bottom: 0.75rem; color: #fff; }
    p { margin-bottom: 1rem; color: #a3a3a3; }
    code { background: #1a1a1a; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; color: #e5e5e5; }
    pre { background: #1a1a1a; border: 1px solid #262626; border-radius: 8px; padding: 1rem; overflow-x: auto; margin-bottom: 1rem; }
    pre code { background: none; padding: 0; }
    .endpoint { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .method { font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace; }
    .get { background: #15803d; color: #fff; }
    .post { background: #1d4ed8; color: #fff; }
    .path { font-family: monospace; color: #e5e5e5; }
    .desc { color: #737373; font-size: 0.9rem; margin-bottom: 1.25rem; }
    a { color: #60a5fa; }
    .badge { display: inline-block; background: #1d4ed8; color: #fff; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; margin-left: 0.5rem; font-weight: 600; vertical-align: middle; position: relative; top: -0.15em; }
  </style>
</head>
<body>
  <h1>Hello World <span class="badge">Encore.ts</span></h1>
  <p>A simple REST API to get you started with Encore. This is the simplest possible Encore app, with a single endpoint that returns a greeting.</p>

  <p>Explore and test endpoints in the <a href="http://localhost:9400/">Local Dashboard</a> when running locally. When deployed to <a href="https://app.encore.cloud">Encore Cloud</a>, use the Service Catalog to call endpoints and view traces to see how requests flow between services.</p>

  <h2>Try it</h2>

  <div class="endpoint">
    <span class="method get">GET</span>
    <span class="path">/hello/:name</span>
    <code>hello.get</code>
  </div>
  <p class="desc">Returns a personalized greeting (public).</p>
  <pre><code>curl {{baseUrl}}/hello/World</code></pre>

  <h2>Authentication</h2>
  <p>Log in to get a JWT, then call protected endpoints with the <code>Authorization</code> header.</p>

  <div class="endpoint">
    <span class="method post">POST</span>
    <span class="path">/auth/login</span>
    <code>auth.login</code>
  </div>
  <p class="desc">Returns a JWT token. Demo: <code>demo@example.com</code> / <code>password123</code></p>
  <pre><code>curl -X POST {{baseUrl}}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"demo@example.com","password":"password123"}'</code></pre>

  <div class="endpoint">
    <span class="method get">GET</span>
    <span class="path">/auth/profile</span>
    <code>auth.profile</code>
  </div>
  <p class="desc">Returns the authenticated user's profile (requires token).</p>
  <pre><code>curl {{baseUrl}}/auth/profile \\
  -H "Authorization: Bearer YOUR_TOKEN"</code></pre>

  <div class="endpoint">
    <span class="method get">GET</span>
    <span class="path">/hello/me</span>
    <code>hello.me</code>
  </div>
  <p class="desc">Returns a personalized greeting for the logged-in user (requires token).</p>
  <pre><code>curl {{baseUrl}}/hello/me \\
  -H "Authorization: Bearer YOUR_TOKEN"</code></pre>

  <h2>Next steps</h2>
  <p>Check out these topics to keep building:</p>
  <p>
    <a href="https://encore.dev/docs/ts/tutorials/rest-api">Building a REST API</a> ·
    <a href="https://encore.dev/docs/ts/primitives/services">Creating Services</a> ·
    <a href="https://encore.dev/docs/ts/primitives/databases">Using SQL Databases</a> ·
    <a href="https://encore.dev/docs/ts/primitives/pubsub">Using Pub/Sub</a>
  </p>
</body>
</html>`;

// Returns a personalized greeting.
export const get = api(
  { expose: true, method: "GET", path: "/hello/:name" },
  async ({ name }: { name: string }): Promise<Response> => {
    const msg = `Hello ${name}!`;
    return { message: msg };
  }
);

interface Response {
  message: string;
}

// Returns a greeting for the authenticated user.
export const me = api(
  { expose: true, method: "GET", path: "/hello/me", auth: true },
  async (): Promise<Response> => {
    const auth = getAuthData()!;
    return { message: `Hello ${auth.email}!` };
  },
);

// ==================================================================

// Encore comes with a built-in development dashboard for
// exploring your API, viewing documentation, debugging with
// distributed tracing, and more. Visit your API URL in the browser:
//
//     http://localhost:9400
//

// ==================================================================

// Next steps
//
// 1. Deploy your application to the cloud
//
//     git add -A .
//     git commit -m 'Commit message'
//     git push encore
//
// 2. To continue exploring Encore, check out these topics in docs:
//
//    Building a REST API:   https://encore.dev/docs/ts/tutorials/rest-api
//    Creating Services:      https://encore.dev/docs/ts/primitives/services
//    Creating APIs:         https://encore.dev/docs/ts/primitives/defining-apis
//    Using SQL Databases:        https://encore.dev/docs/ts/primitives/databases
//    Using Pub/Sub:         https://encore.dev/docs/ts/primitives/pubsub
//    Authenticating users:  https://encore.dev/docs/ts/develop/auth
//    Using Cron Jobs: https://encore.dev/docs/ts/primitives/cron-jobs
//    Using Secrets: https://encore.dev/docs/ts/primitives/secrets
