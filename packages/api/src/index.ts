import { createApp } from "./routes.js";
import { apiListenPort } from "./urls.js";

const PORT = apiListenPort();
const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI SDLC DREAMTEAM API listening on PORT=${PORT} (see $API_URL)`);
});
