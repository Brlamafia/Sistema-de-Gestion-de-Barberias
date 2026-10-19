import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'barberia.db');
export const PORT = Number(process.env.PORT || 3000);
export const SESSION_HOURS = 12;
export const SLOT_MINUTES = 30;
