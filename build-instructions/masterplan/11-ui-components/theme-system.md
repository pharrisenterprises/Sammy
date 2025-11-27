# Theme System
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. CSS Variables
3. Tailwind Configuration
4. Theme Provider
5. Color Schemes
6. Dark Mode
7. Typography
8. Spacing & Layout
9. Animation
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The theme system provides consistent visual styling across the application through CSS variables, Tailwind configuration, and a theme provider for light/dark mode switching.

### 1.2 File Location
```
src/
├── styles/
│   └── globals.css          # CSS variables and base styles
├── lib/
│   └── utils.ts              # cn() utility function
├── tailwind.config.ts        # Tailwind configuration
└── components/
    └── theme-provider.tsx    # Theme context provider
```

### 1.3 Design Principles

- CSS variables for runtime theme switching
- Tailwind for utility-first styling
- Semantic color naming (primary, secondary, etc.)
- Dark mode support via class strategy

---

## 2. CSS Variables

### 2.1 Global Variables
```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    /* Card colors */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    /* Popover colors */
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Primary colors */
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    /* Secondary colors */
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    /* Muted colors */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Accent colors */
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    /* Destructive colors */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Border and input */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    /* Radius */
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

---

## 3. Tailwind Configuration

### 3.1 Tailwind Config
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    './index.html'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
```

---

## 4. Theme Provider

### 4.1 Theme Provider Implementation
```typescript
// src/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'test-recorder-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    }
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
```

### 4.2 Theme Provider Usage
```typescript
// src/App.tsx
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="test-recorder-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
```

---

## 5. Color Schemes

### 5.1 Semantic Colors
```typescript
// Color usage guidelines
const colorUsage = {
  // Primary - main actions, links
  primary: 'Buttons, links, focus rings, active states',

  // Secondary - less prominent actions
  secondary: 'Secondary buttons, tags, subtle highlights',

  // Muted - subdued content
  muted: 'Disabled states, placeholders, secondary text',

  // Accent - highlights, hover states
  accent: 'Hover backgrounds, selected items',

  // Destructive - errors, dangerous actions
  destructive: 'Delete buttons, error states, warnings',

  // Background/Foreground - base colors
  background: 'Page backgrounds, card backgrounds',
  foreground: 'Primary text, icons'
};
```

### 5.2 Status Colors
```css
/* Additional status colors */
:root {
  /* Success */
  --success: 142.1 76.2% 36.3%;
  --success-foreground: 355.7 100% 97.3%;

  /* Warning */
  --warning: 32.8 94.6% 44.1%;
  --warning-foreground: 26 83.3% 14.1%;

  /* Info */
  --info: 199.4 95.5% 53.8%;
  --info-foreground: 0 0% 100%;
}
```

---

## 6. Dark Mode

### 6.1 Theme Toggle Component
```typescript
// src/components/theme-toggle.tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 6.2 System Preference Detection
```typescript
// Listen for system theme changes
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = () => {
    if (theme === 'system') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}, [theme]);
```

---

## 7. Typography

### 7.1 Font Configuration
```css
/* src/styles/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

body {
  font-family: var(--font-sans);
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}

code, pre {
  font-family: var(--font-mono);
}
```

### 7.2 Typography Scale
```typescript
// Tailwind typography classes
const typographyScale = {
  'text-xs': '0.75rem',      // 12px
  'text-sm': '0.875rem',     // 14px
  'text-base': '1rem',       // 16px
  'text-lg': '1.125rem',     // 18px
  'text-xl': '1.25rem',      // 20px
  'text-2xl': '1.5rem',      // 24px
  'text-3xl': '1.875rem',    // 30px
  'text-4xl': '2.25rem'      // 36px
};

// Usage
<h1 className="text-3xl font-bold">Heading</h1>
<p className="text-base">Body text</p>
<span className="text-sm text-muted-foreground">Label</span>
<code className="text-xs font-mono">Code</code>
```

---

## 8. Spacing & Layout

### 8.1 Spacing Scale
```typescript
// Tailwind spacing (4px base)
const spacingScale = {
  '0': '0',
  '1': '0.25rem',    // 4px
  '2': '0.5rem',     // 8px
  '3': '0.75rem',    // 12px
  '4': '1rem',       // 16px
  '5': '1.25rem',    // 20px
  '6': '1.5rem',     // 24px
  '8': '2rem',       // 32px
  '10': '2.5rem',    // 40px
  '12': '3rem',      // 48px
  '16': '4rem',      // 64px
  '20': '5rem',      // 80px
  '24': '6rem'       // 96px
};
```

### 8.2 Container Configuration
```typescript
// tailwind.config.ts
container: {
  center: true,
  padding: {
    DEFAULT: '1rem',
    sm: '2rem',
    lg: '4rem',
    xl: '5rem',
    '2xl': '6rem'
  },
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1400px'
  }
}
```

---

## 9. Animation

### 9.1 Animation Utilities
```css
/* Tailwind animate plugin */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInFromTop {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideInFromBottom {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 9.2 Animation Classes
```typescript
// Usage examples
<div className="animate-fade-in">Fade in</div>
<div className="animate-slide-in">Slide from top</div>
<div className="animate-pulse">Pulsing element</div>
<div className="animate-spin">Spinning loader</div>

// Custom duration
<div className="animate-fade-in duration-500">Slow fade</div>

// With delay
<div className="animate-slide-in delay-200">Delayed slide</div>
```

### 9.3 Transition Utilities
```typescript
// Transition classes
<button className="transition-colors hover:bg-gray-100">
  Color transition
</button>

<div className="transition-transform hover:scale-105">
  Scale on hover
</div>

<div className="transition-opacity hover:opacity-50">
  Opacity transition
</div>

<div className="transition-all duration-300 ease-in-out">
  All properties
</div>
```

---

## 10. Testing Strategy

### 10.1 Theme Tests
```typescript
describe('ThemeProvider', () => {
  it('defaults to light theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <div>Test</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('switches to dark theme', () => {
    const TestComponent = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>Toggle</button>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Toggle'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists theme preference', () => {
    render(
      <ThemeProvider storageKey="test-theme">
        <div>Test</div>
      </ThemeProvider>
    );

    expect(localStorage.getItem('test-theme')).toBeDefined();
  });
});

describe('CSS Variables', () => {
  it('applies correct color values', () => {
    const root = document.documentElement;
    const primaryColor = getComputedStyle(root).getPropertyValue('--primary');

    expect(primaryColor.trim()).toBe('221.2 83.2% 53.3%');
  });
});
```

---

## Summary

Theme System provides:
- ✅ **CSS variables** for all semantic colors
- ✅ **Tailwind configuration** with custom colors/radius
- ✅ **ThemeProvider** with context API
- ✅ **Light/Dark/System** mode support
- ✅ **Theme toggle** component
- ✅ **System preference** detection
- ✅ **Typography scale** with Inter font
- ✅ **Spacing scale** (4px base)
- ✅ **Animation utilities** (fade, slide, pulse, spin)
- ✅ **Testing strategy** for theme switching

Provides consistent, themeable styling.
