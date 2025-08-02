# Orbis

A local web-based tool for managing website screenshot targets and taking automated screenshots using Playwright.

## Features

- **Web UI** built with Next.js, Tailwind CSS, and shadcn/ui components
- **Manage screenshot targets** with a clean interface
- **Login support** for authenticated websites
- **Automated screenshots** using Playwright
- **Local storage** with SQLite database
- **Environment-based credentials** for secure login handling

## Getting Started

1. **Install dependencies:**
```bash
npm install
```

2. **Install Playwright browsers:**
```bash
npx playwright install
```

3. **Set up environment variables:**
Copy `.env.example` to `.env` and add your login credentials:
```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:
```env
USERNAME_EXAMPLE=your_username_here
PASSWORD_EXAMPLE=your_password_here
```

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Adding Screenshot Targets

1. Click "Add Target" to create a new screenshot target
2. Fill in the required fields:
   - **Name**: A descriptive name for the target
   - **URL**: The website URL to capture
   - **Requires Login**: Toggle if the site needs authentication

### For Login-Required Sites

When "Requires Login" is enabled, provide:
- **Login URL**: The login page URL
- **CSS Selectors**: For username, password, and submit button fields
- **Environment Variables**: Keys for credentials stored in `.env`

### Taking Screenshots

- Click "Run Screenshots" to capture all targets
- Screenshots are saved to `/screenshots/YYYY-MM-DD/` folders
- Files are named based on the target name and timestamp

## Project Structure

```
├── app/
│   ├── api/targets/          # CRUD API for targets
│   ├── api/screenshot/run/   # Screenshot execution API
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main dashboard
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── target-form.tsx      # Target creation/editing form
├── lib/
│   ├── db.ts               # SQLite database management
│   └── screenshot.ts       # Playwright screenshot service
├── data/                   # SQLite database files
└── screenshots/            # Generated screenshot files
```

## Environment Variables

Store sensitive login credentials in `.env`:

```env
# Format: USERNAME_[SITENAME] and PASSWORD_[SITENAME]
USERNAME_EXAMPLE=your_username
PASSWORD_EXAMPLE=your_password

USERNAME_MYSITE=another_username  
PASSWORD_MYSITE=another_password
```

## Technology Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **SQLite** with better-sqlite3 for data storage
- **Playwright** for browser automation
- **Lucide React** for icons

## Notes

- Screenshots are organized by date in YYYY-MM-DD folders
- The app runs locally and is designed for macOS
- All data is stored locally - no external services required
- Login credentials are never stored in the database, only in environment variables