import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error("DIQQAT: JWT_SECRET .env faylida topilmadi!");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});