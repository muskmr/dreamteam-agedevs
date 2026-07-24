import { createApp } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(PORT, () => {
  console.log(`AI SDLC DREAMTEAM API running on http://localhost:${PORT}`);
});
