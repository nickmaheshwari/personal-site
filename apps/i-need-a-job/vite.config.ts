import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const fn = (name: string) => fileURLToPath(new URL(`../../netlify/functions/${name}.mts`, import.meta.url));

/** Netlify Functions this app calls, served from the Vite dev server by path. */
const LOCAL_FUNCTIONS: Record<string, string> = {
  "/api/i-need-a-job/jobs": fn("i-need-a-job-jobs"),
  "/api/i-need-a-job/usajobs": fn("i-need-a-job-usajobs"),
};

/**
 * Serves the app's Netlify Functions from the Vite dev server, so `npm run dev`
 * works on its own without the Netlify CLI. Production uses the real functions.
 * Variables from the repo-root .env (e.g. USAJOBS_API_KEY) are passed through.
 */
function localFunctions(): Plugin {
  return {
    name: "local-netlify-functions",
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, REPO_ROOT, ""));
      for (const [path, file] of Object.entries(LOCAL_FUNCTIONS)) {
        server.middlewares.use(path, async (req, res) => {
          try {
            const { default: handler } = await server.ssrLoadModule(file);
            const response: Response = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`));
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            res.end(await response.text());
          } catch (err) {
            server.config.logger.error(String(err));
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Local function failed. See the terminal." }));
          }
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), localFunctions()],
  base: "/i-need-a-job/",
  build: {
    outDir: "../../dist/i-need-a-job",
    emptyOutDir: true,
  },
});
