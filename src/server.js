import { createApp } from './app.js';
import { PORT } from './config.js';

const { server } = createApp();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Barbería Central disponible en http://127.0.0.1:${PORT}`);
});
