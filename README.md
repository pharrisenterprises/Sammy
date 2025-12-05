# Sammy Test Automation

<p align="center">
  <img src="public/icon/icon128.png" alt="Sammy Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Record, replay, and automate browser tests with CSV-driven data entry</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/React-18.2-blue" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## Overview

Sammy is a **Chrome browser extension** for end-to-end web automation. It enables you to:

- **🎬 Record** user interactions on any website (clicks, inputs, navigation)
- **🗺️ Map** recorded actions to CSV data fields for data-driven testing
- **▶️ Replay** automated test runs with multiple data rows
- **📊 Track** test results and execution history

Perfect for QA engineers, testers, and developers who need to automate repetitive browser tasks or create data-driven test suites.

---

## Features

### 🎬 Recording Engine
- Capture clicks, inputs, keyboard events, and navigation
- Intelligent label detection (12+ strategies including aria-label, placeholder, nearby text)
- Multi-strategy element locators (XPath, ID, name, CSS, data attributes)
- Full iframe and Shadow DOM support
- Works with React, Vue, Angular, and vanilla JavaScript sites

### 🗺️ Field Mapping
- Upload CSV files with test data
- Auto-map CSV columns to recorded steps (fuzzy matching)
- Manual mapping interface for fine-tuning
- Support for parameterized test execution

### ▶️ Replay Engine
- 9-tier element finding fallback strategy
- React-safe input handling (bypasses controlled inputs)
- Configurable timeouts and retry logic
- Real-time progress tracking
- Visual feedback during replay

### 📊 Test Management
- Project-based organization
- Test run history with pass/fail tracking
- Detailed execution logs
- Export results to CSV/Excel

---

## Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)
2. Click "Add to Chrome"
3. Confirm installation

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/pharrisenterprises/Sammy.git
cd Sammy

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top-right toggle)
# 3. Click "Load unpacked"
# 4. Select the `dist/` folder
```

---

## Quick Start

### 1. Create a Project

1. Click the Sammy extension icon
2. Click **"New Project"**
3. Enter a project name and target URL
4. Click **"Create"**

### 2. Record Actions

1. Open your project
2. Click **"Start Recording"**
3. Navigate to your target website
4. Perform the actions you want to automate
5. Click **"Stop Recording"**

### 3. Map CSV Data (Optional)

1. Go to **Field Mapper**
2. Upload your CSV file
3. Map columns to recorded steps
4. Save mappings

### 4. Run Tests

1. Go to **Test Runner**
2. Select data rows to execute
3. Click **"Run Test"**
4. Watch real-time progress
5. Review results

---

## Usage

### Recording Tips

- **Wait for page load**: Ensure the page is fully loaded before recording
- **Use consistent selectors**: Prefer elements with IDs or data attributes
- **Avoid dynamic content**: Elements that change on each page load may be unreliable
- **Test incrementally**: Record a few steps, then verify replay works

### Field Mapping

```csv
# Example CSV format
username,password,email
user1,pass123,user1@example.com
user2,pass456,user2@example.com
user3,pass789,user3@example.com
```

- Column headers are matched to step labels
- Use `{{column_name}}` syntax in step values
- Auto-mapping uses 30% similarity threshold

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Start/Stop Recording |
| `Ctrl+Shift+P` | Pause/Resume Replay |
| `Escape` | Stop current operation |

---

## Development

### Prerequisites

- **Node.js** 18.x or 20.x
- **npm** 9.x or higher
- **Chrome** 100 or higher

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
sammy-test-automation/
├── src/
│   ├── core/                 # Core modules
│   │   ├── types/           # TypeScript interfaces
│   │   ├── storage/         # IndexedDB layer
│   │   ├── locators/        # Element finding strategies
│   │   ├── messages/        # Message bus
│   │   ├── recording/       # Recording engine
│   │   ├── replay/          # Replay engine
│   │   ├── csv/             # CSV processing
│   │   └── orchestrator/    # Test orchestration
│   ├── background/          # Service worker
│   ├── contentScript/       # Content scripts
│   ├── components/          # React components
│   ├── pages/               # Page components
│   ├── hooks/               # Custom React hooks
│   ├── context/             # React context providers
│   └── test/                # Test utilities
├── public/                   # Static assets
├── scripts/                  # Build scripts
└── dist/                     # Build output
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run build:fast` | Build without type checking |
| `npm run type-check` | TypeScript validation |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run check-deps` | Check circular dependencies |
| `npm run clean` | Clean build artifacts |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Popup     │  │  Dashboard  │  │    Test Runner      │  │
│  │   (React)   │  │   (React)   │  │      (React)        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Background Service Worker                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │   Message   │  │     Tab     │  │    Script    │  │  │
│  │  │   Router    │  │   Manager   │  │   Injector   │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Content Script                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │  Recording  │  │   Replay    │  │    Iframe    │  │  │
│  │  │    Mode     │  │    Mode     │  │   Manager    │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    IndexedDB                          │  │
│  │  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │   Projects  │  │  Test Runs  │                    │  │
│  │  └─────────────┘  └─────────────┘                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Description |
|-----------|-------------|
| **Recording Engine** | Captures user interactions with 12+ label detection strategies |
| **Replay Engine** | Executes recorded steps with 9-tier element finding fallback |
| **Locator Strategy** | Multi-strategy element identification (XPath, ID, aria, etc.) |
| **Storage Layer** | IndexedDB persistence via Dexie.js |
| **Message Bus** | Chrome runtime messaging for cross-context communication |
| **Test Orchestrator** | Manages CSV-driven test execution |

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 100+ | ✅ Fully Supported |
| Edge | 100+ | ✅ Fully Supported |
| Brave | Latest | ✅ Fully Supported |
| Firefox | - | ❌ Not Supported (Manifest V3) |
| Safari | - | ❌ Not Supported |

---

## Troubleshooting

### Extension not loading

1. Ensure you're using Chrome 100+
2. Check that Developer Mode is enabled
3. Verify all files exist in `dist/`
4. Check the console for errors (chrome://extensions → "Errors")

### Recording not capturing events

1. Refresh the target page after loading the extension
2. Check if the site uses iframes (may need to record in iframe)
3. Verify content script is injected (check DevTools console)
4. Some sites block content scripts (try a different site)

### Replay failing to find elements

1. Ensure the page is fully loaded before replay
2. Check if element IDs or classes have changed
3. Try re-recording problematic steps
4. Use elements with stable identifiers (ID, name, data-*)

### Performance issues

1. Close unnecessary browser tabs
2. Disable other extensions during testing
3. Reduce CSV data rows for initial testing
4. Check for memory leaks in DevTools

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'feat: add my feature'`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icons

---

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/pharrisenterprises/Sammy/issues)
- 💬 [Discussions](https://github.com/pharrisenterprises/Sammy/discussions)

---

<p align="center">
  Made with ❤️ by the Sammy Team
</p>
