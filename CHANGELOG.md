# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial modular architecture implementation
- Complete core module extraction (types, storage, locators, messages, recording, replay, csv, orchestrator)
- React component library with 30+ reusable components
- Comprehensive test infrastructure with Vitest
- GitHub Actions CI/CD workflows
- TypeScript strict mode configuration
- ESLint flat config with import rules

### Changed
- Migrated from monolithic to modular architecture
- Updated to React 18.2 with concurrent features
- Migrated to Vite 5.4 build system
- Improved element finding with 9-tier fallback strategy

### Fixed
- Service worker lifecycle management
- Cross-origin iframe handling
- React controlled input bypass

## [1.0.0] - 2025-XX-XX

### Added
- 🎬 Recording Engine
  - Click, input, and keyboard event capture
  - 12+ label detection strategies
  - XPath and multi-strategy locator generation
  - Iframe and Shadow DOM support
  
- 🗺️ Field Mapper
  - CSV file upload and parsing
  - Auto-mapping with fuzzy matching (30% threshold)
  - Manual field mapping interface
  
- ▶️ Replay Engine
  - 9-tier element finding fallback
  - React-safe input handling
  - Configurable timeouts (2s default, 150ms retry)
  - Real-time progress tracking
  
- 📊 Test Management
  - Project-based organization
  - Test run history
  - Execution logs
  - Result export

- 🔧 Technical
  - Chrome Manifest V3 compliance
  - IndexedDB persistence (Dexie.js)
  - Service worker background script
  - React 18 UI framework

### Security
- Content Security Policy enforcement
- No external API calls
- Local-only data storage

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | TBD | Initial stable release |

---

## Migration Guides

### Upgrading to 1.0.0

This is the initial release. No migration required.

---

## Links

- [GitHub Releases](https://github.com/pharrisenterprises/Sammy/releases)
- [Issue Tracker](https://github.com/pharrisenterprises/Sammy/issues)
