import { createApp } from "./routes.js";
import { apiListenPort, apiUrl } from "./urls.js";

const PORT = apiListenPort();
const app = createApp();

app.listen(PORT, () => {
  console.log(`AI SDLC DREAMTEAM API listening (PORT=${PORT}, API_URL=${apiUrl()})`);
});
