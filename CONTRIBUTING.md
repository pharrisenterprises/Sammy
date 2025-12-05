# Contributing to Sammy Test Automation

Thank you for your interest in contributing to Sammy! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

---

## Code of Conduct

Please be respectful and inclusive. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm 9.x or higher
- Chrome 100 or higher
- Git

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/Sammy.git
cd Sammy

# Install dependencies
npm install

# Create a branch for your changes
git checkout -b feature/your-feature-name
```

---

## Development Workflow

### 1. Find or Create an Issue

- Check existing [issues](https://github.com/pharrisenterprises/Sammy/issues)
- Create a new issue for bugs or features
- Wait for issue to be assigned/approved before starting major work

### 2. Make Changes

```bash
# Start development server
npm run dev

# Make your changes...

# Run type checking
npm run type-check

# Run linting
npm run lint:fix

# Run tests
npm test
```

### 3. Test Your Changes

- Test in Chrome with the extension loaded
- Verify all existing tests pass
- Add new tests for new functionality

### 4. Submit a Pull Request

- Push your branch
- Open a PR against `develop` branch
- Fill out the PR template
- Wait for review

---

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// ✅ Good
interface User {
  id: number;
  name: string;
}

function getUser(id: number): User | null {
  // ...
}

// ❌ Bad
type User = {
  id: any;
  name: any;
};

function getUser(id) {
  // ...
}
```

### React

- Use functional components with hooks
- Prefer named exports
- Keep components small and focused
- Use TypeScript for props

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, disabled }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

### File Organization

- One component per file
- Group related files in directories
- Use barrel exports (index.ts)
- Maximum 400 lines per file
- Maximum 50 lines per function

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-profile.tsx` |
| Components | PascalCase | `UserProfile` |
| Functions | camelCase | `getUserById` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `UserProfile` |

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |

### Examples

```bash
# Feature
git commit -m "feat(recording): add shadow DOM support"

# Bug fix
git commit -m "fix(replay): handle missing elements gracefully"

# Documentation
git commit -m "docs: update installation instructions"

# Breaking change
git commit -m "feat(api)!: change message format

BREAKING CHANGE: Message payload structure has changed.
See migration guide for details."
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

### PR Requirements

1. **Title**: Follow commit message format
2. **Description**: Explain what and why
3. **Link Issues**: Reference related issues
4. **Screenshots**: Include for UI changes
5. **Testing**: Describe how to test

### Review Process

1. Automated checks run (CI)
2. Code review by maintainer
3. Address feedback
4. Approval and merge

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/core/storage/
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(<Button label="Click" onClick={onClick} />);
    
    await user.click(screen.getByRole('button'));
    
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Test Coverage Targets

| Layer | Target |
|-------|--------|
| Core modules | 80%+ |
| UI components | 70%+ |
| Hooks | 75%+ |
| Integration | 60%+ |

---

## Questions?

- Open a [Discussion](https://github.com/pharrisenterprises/Sammy/discussions)
- Check existing [Issues](https://github.com/pharrisenterprises/Sammy/issues)
- Review the [Documentation](docs/)

Thank you for contributing! 🎉
