import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const JOBS_FUNCTION = fileURLToPath(new URL("../../netlify/functions/i-need-a-job-jobs.mts", import.meta.url));

/**
 * Serves the jobs Netlify Function from the Vite dev server, so `npm run dev`
 * works on its own without the Netlify CLI. Production uses the real function.
 */
function localJobsApi(): Plugin {
  return {
    name: "local-jobs-api",
    configureServer(server) {
      server.middlewares.use("/api/i-need-a-job/jobs", async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule(JOBS_FUNCTION);
          const response: Response = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.end(await response.text());
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Local jobs API failed. See the terminal." }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localJobsApi()],
  base: "/i-need-a-job/",
  build: {
    outDir: "../../dist/i-need-a-job",
    emptyOutDir: true,
  },
});
