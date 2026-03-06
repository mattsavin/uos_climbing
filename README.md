# University of Sheffield Climbing Club (USCC) Platform

Welcome to the USCC internal platform. This repository contains the source code for the club's website, membership management system, event calendar, gear rental, and gallery.

## Tech Stack
### Frontend
- **Framework & Bundler**: Vanilla TypeScript & HTML, managed via Vite. Multiple HTML entry points are used for page routing.
- **Styling**: Tailwind CSS
- **Media**: Browser-side image compression and photo cropping UI (via Canvas).

### Backend
- **Core**: Node.js, Express.js (REST API)
- **Database**: SQLite (via `sqlite3`) with schema migrations.
- **Security**: JWT for session auth, express-rate-limit, bcrypt for password hashing.
- **Media Processing**: Multer for multipart uploads and Sharp for image transcoding/compression.
- **Other**: Supabase (optional integration depending on environment needs), Nodemailer.

## Prerequisites
- Node.js (v18+ recommended)
- npm

## Local Setup

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd uos_climbing
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Environment Setup**
   Copy the example environment file and fill in the required values:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   *Note: Contact a committee member or repository admin for required secret keys if needed.*

## Running the Application

### Development
To run both the backend server and the frontend Vite dev server concurrently:
\`\`\`bash
npm run dev:all
\`\`\`

Alternatively, to run them separately:
- **Backend**: \`npm run server\` (Runs on \`http://localhost:3000\` by default)
- **Frontend**: \`npm run dev\` (Runs on \`http://localhost:5173\` by default)

### Production Build
To build the frontend and compile TypeScript:
\`\`\`bash
npm run build
\`\`\`
To start the compiled production server:
\`\`\`bash
npm start
\`\`\`

## Testing

The project uses two testing frameworks: one for the backend API and another for End-to-End browser validation.

### Backend Unit & Integration Tests (Vitest)
Tests the Express routes, SQLite database behavior, and utility functions.
\`\`\`bash
npm run test:backend
\`\`\`
To run backend tests and generate a coverage report:
\`\`\`bash
npm run test:coverage
\`\`\`

### End-to-End Tests (Playwright)
Tests user flows inside a real Chromium browser instance (login, gallery upload, committee role adjustments).
Make sure your development server (`npm run dev:all`) is running before executing these tests if configured that way, or let Playwright boot its own server via `playwright.config.ts`.
\`\`\`bash
npm run test:e2e
\`\`\`

To run both suites sequentially:
\`\`\`bash
npm run test
\`\`\`

## Project Structure
- `backend/`
  - `routes/`: Express route handlers (e.g., `auth.ts`, `users.ts`, `gallery.ts`, `committee.ts`).
  - `services/`: Core logic and helper abstractions (e.g., membership utils, email dispatchers).
  - `utils/`: Reusable server utilities (e.g., `upload.ts`, `response.ts`).
  - `middleware/`: Express middlewares (authentication verification, beta gating).
  - `server.ts`: The main Express application initialization file.
- `src/`
  - `lib/`: Frontend modules, API fetch wrappers, and specific UI component logic (e.g., `dashboard/profile.photoEditor.ts`).
  - `components/`: Reusable HTML string templates injected into the DOM.
  - `*.ts`: View-specific entry points matching the HTML files (e.g., `dashboard.ts`, `login.ts`).
  - `*.html`: The frontend templates served by Vite.
- `public/`
  - Static assets (images, fonts) directly served by Vite without processing.
- `tests/`
  - `backend/`: Vitest specifications testing Express routes.
  - `e2e/`: Playwright scripts testing browser functionality.
