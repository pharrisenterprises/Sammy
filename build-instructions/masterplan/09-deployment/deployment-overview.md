# Deployment Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Deployment Architecture
3. Chrome Extension Deployment
4. Web Portal Deployment
5. Supabase Setup
6. VDI Runner Deployment
7. Environment Configuration
8. CI/CD Pipeline
9. Release Management
10. Rollback Procedures
11. Monitoring & Alerts
12. Security Checklist

---

## 1. Overview

### 1.1 Purpose

This document provides comprehensive deployment procedures for all components of The Automater system. It covers initial setup, continuous deployment, and operational procedures.

### 1.2 Deployment Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT COMPONENTS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  COMPONENT           PLATFORM         DEPLOYMENT METHOD                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  Chrome Extension    Chrome Web Store Manual upload / API              │
│  Web Portal          Vercel           Git push (auto-deploy)            │
│  Supabase Backend    Supabase Cloud   Dashboard / CLI                  │
│  VDI Runner          Fly.io           flyctl deploy                     │
│  Cloud Browser VMs   Fly.io           flyctl deploy                     │
│                                                                         │
│  ENVIRONMENTS:                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  Development  →  Local machines, localhost                             │
│  Staging      →  testflow-staging.vercel.app, staging Supabase         │
│  Production   →  testflow.app, production Supabase                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Developer                                                              │
│      │                                                                  │
│      │ git push                                                         │
│      ▼                                                                  │
│  ┌─────────────────┐                                                    │
│  │  GitHub Repo    │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           │ Triggers                                                    │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      GitHub Actions                             │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │   │
│  │  │  Lint & Test  │→ │     Build     │→ │    Deploy     │      │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘      │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│           ┌─────────────────────┼─────────────────────┐                │
│           │                     │                     │                │
│           ▼                     ▼                     ▼                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │  Chrome Web     │  │     Vercel      │  │     Fly.io      │        │
│  │     Store       │  │    (Portal)     │  │  (VDI Runner)   │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Deployment Architecture

### 2.1 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION INFRASTRUCTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EDGE (CDN)                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Vercel Edge Network                                            │   │
│  │    └── Static assets, SSR pages, Edge Functions                 │   │
│  │    └── Automatic SSL/TLS                                        │   │
│  │    └── Global distribution (300+ edge locations)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                               ▼                                         │
│  APPLICATION LAYER                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Next.js Application (Vercel Serverless)                        │   │
│  │    └── API Routes (Node.js runtime)                             │   │
│  │    └── Server Components (Edge runtime)                         │   │
│  │    └── Static Generation (Build time)                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                               ▼                                         │
│  DATA LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Supabase (AWS us-east-1)                                       │   │
│  │    ├── PostgreSQL Database                                      │   │
│  │    ├── Auth (GoTrue)                                            │   │
│  │    ├── Realtime (WebSocket)                                     │   │
│  │    ├── Storage (S3-compatible)                                  │   │
│  │    └── Edge Functions (Deno runtime)                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                               ▼                                         │
│  COMPUTE LAYER                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Fly.io (Global regions)                                        │   │
│  │    ├── VDI Runner Pool (1-10 machines, auto-scaled)             │   │
│  │    └── Cloud Browser VMs (per-user, Business+ tier)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  CLIENT LAYER                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Chrome Extension (Chrome Web Store)                            │   │
│  │    └── Installed in user's Chrome browser                       │   │
│  │    └── Communicates with Supabase directly                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Domain Configuration

| Domain | Purpose | Provider |
|--------|---------|----------|
| `testflow.app` | Production portal | Vercel |
| `staging.testflow.app` | Staging portal | Vercel |
| `api.testflow.app` | API endpoints | Vercel (alias) |
| `*.supabase.co` | Database/Auth | Supabase |
| `*.fly.dev` | VDI runners | Fly.io |

---

## 3. Chrome Extension Deployment

### 3.1 Build Process

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# Output structure:
# dist/
# ├── manifest.json
# ├── background.js
# ├── content-script.js
# ├── popup/
# │   ├── index.html
# │   └── popup.js
# ├── assets/
# │   ├── icons/
# │   └── styles/
# └── _metadata/
#     └── verified_contents.json

# 3. Create ZIP for upload
cd dist && zip -r ../extension.zip . && cd ..
```

### 3.2 Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "TestFlow - Web Automation",
  "version": "1.0.0",
  "description": "Record and replay browser workflows with CSV data injection",
  
  "permissions": [
    "activeTab",
    "storage",
    "tabs",
    "scripting"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  
  "key": "MIIBIjANBgkqh..."
}
```

### 3.3 Chrome Web Store Upload

```bash
# Manual Upload Process:
# 1. Go to https://chrome.google.com/webstore/devconsole
# 2. Select your extension
# 3. Click "Package" tab
# 4. Upload extension.zip
# 5. Fill in store listing details
# 6. Submit for review

# Automated Upload (Chrome Web Store API):
# 1. Get OAuth2 access token
ACCESS_TOKEN=$(curl -s -X POST \
  -d "client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token" \
  https://oauth2.googleapis.com/token | jq -r '.access_token')

# 2. Upload new version
curl -X PUT \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -T extension.zip \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}"

# 3. Publish
curl -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -H "Content-Length: 0" \
  "https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish"
```

### 3.4 Version Management

```typescript
// scripts/bump-version.ts
import fs from 'fs';
import path from 'path';

type VersionType = 'major' | 'minor' | 'patch';

function bumpVersion(type: VersionType): void {
  const manifestPath = path.join(__dirname, '../src/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  
  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`Version bumped to ${newVersion}`);
}

// Usage: npx ts-node scripts/bump-version.ts patch
const type = process.argv[2] as VersionType || 'patch';
bumpVersion(type);
```

---

## 4. Web Portal Deployment

### 4.1 Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  
  "regions": ["iad1", "sfo1", "fra1"],
  
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  
  "redirects": [
    {
      "source": "/app",
      "destination": "/dashboard",
      "permanent": true
    }
  ],
  
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### 4.2 Deployment Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link to project (first time)
vercel link

# Deploy to staging (preview)
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs <deployment-url>

# Rollback to previous deployment
vercel rollback
```

### 4.3 Environment Variables (Vercel)

```bash
# Set environment variables via CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Or via dashboard:
# 1. Go to vercel.com/[team]/[project]/settings/environment-variables
# 2. Add each variable for Production/Preview/Development

# Required variables:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
# NEXTAUTH_SECRET=<random-32-char-string>
# NEXTAUTH_URL=https://testflow.app
```

### 4.4 Build Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Output standalone for Docker deployment (optional)
  output: 'standalone',
  
  // Image optimization
  images: {
    domains: ['xxx.supabase.co'],
    formats: ['image/avif', 'image/webp']
  },
  
  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false
      };
    }
    return config;
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

---

## 5. Supabase Setup

### 5.1 Project Creation

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to existing project
supabase link --project-ref <project-id>

# Or create new project via dashboard:
# 1. Go to supabase.com/dashboard
# 2. Click "New Project"
# 3. Select organization
# 4. Enter project name, database password, region
# 5. Wait for provisioning (~2 minutes)
```

### 5.2 Database Migrations

```bash
# Create new migration
supabase migration new create_projects_table

# Edit migration file: supabase/migrations/YYYYMMDDHHMMSS_create_projects_table.sql

# Apply migrations locally
supabase db reset

# Push migrations to production
supabase db push

# Generate TypeScript types
supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
```

### 5.3 Initial Schema Migration

```sql
-- supabase/migrations/00001_initial_schema.sql

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
  vm_id TEXT,
  vm_url TEXT,
  vm_status TEXT DEFAULT 'not_created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'complete')),
  recorded_steps JSONB DEFAULT '[]'::jsonb,
  parsed_fields JSONB DEFAULT '[]'::jsonb,
  csv_data JSONB DEFAULT '[]'::jsonb,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Test runs table
CREATE TABLE public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'running', 'completed', 'failed', 'cancelled')),
  runner_id TEXT,
  progress INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  passed_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,
  skipped_steps INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  passed_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  pass_rate DECIMAL(5,2) DEFAULT 0,
  step_results JSONB DEFAULT '[]'::jsonb,
  screenshot_urls TEXT[] DEFAULT '{}',
  logs TEXT[] DEFAULT '{}',
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_updated_date ON public.projects(updated_date DESC);
CREATE INDEX idx_test_runs_project_id ON public.test_runs(project_id);
CREATE INDEX idx_test_runs_status ON public.test_runs(status);
CREATE INDEX idx_test_runs_created_at ON public.test_runs(created_at DESC);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own test runs"
  ON public.test_runs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create test runs for own projects"
  ON public.test_runs FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Service role can update test runs (for VDI runner)
CREATE POLICY "Service role can update test runs"
  ON public.test_runs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER test_runs_updated_at
  BEFORE UPDATE ON public.test_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 5.4 Storage Setup

```sql
-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

-- Storage policies
CREATE POLICY "Anyone can view screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'screenshots');

CREATE POLICY "Service role can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Service role can delete screenshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'screenshots');
```

---

## 6. VDI Runner Deployment

### 6.1 Fly.io Setup

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Create new app
fly launch --name testflow-vdi-runner

# This creates fly.toml automatically
```

### 6.2 Fly.io Configuration

```toml
# fly.toml
app = "testflow-vdi-runner"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  HEADLESS = "true"
  POLL_INTERVAL_MS = "5000"
  STEP_TIMEOUT_MS = "30000"
  STEP_DELAY_MS = "1000"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  
  [http_service.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[services]]
  protocol = "tcp"
  internal_port = 8080
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = "15s"
    timeout = "5s"
    grace_period = "30s"
    method = "GET"
    path = "/health"

[metrics]
  port = 9091
  path = "/metrics"

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 2048
```

### 6.3 Secrets Configuration

```bash
# Set secrets (encrypted environment variables)
fly secrets set SUPABASE_URL=https://xxx.supabase.co
fly secrets set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# List secrets
fly secrets list

# Remove a secret
fly secrets unset SECRET_NAME
```

### 6.4 Deployment Commands

```bash
# Deploy to Fly.io
fly deploy

# View deployment status
fly status

# View logs
fly logs

# Scale runners
fly scale count 3

# Scale machine size
fly scale vm shared-cpu-2x

# SSH into running machine
fly ssh console

# Restart all machines
fly apps restart
```

---

## 7. Environment Configuration

### 7.1 Environment Files

```bash
# .env.local (development)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.staging
NEXT_PUBLIC_SUPABASE_URL=https://staging-xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 7.2 Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Supabase project URL | https://xxx.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Supabase anon/public key | eyJhbG... |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key | eyJhbG... |
| NEXTAUTH_SECRET | Yes | NextAuth.js secret | Random 32+ chars |
| NEXTAUTH_URL | Yes | App URL | https://testflow.app |
| FLY_API_TOKEN | CI/CD | Fly.io API token | fo1_xxx |
| CHROME_EXTENSION_ID | CI/CD | Extension ID | abcdef... |
| GOOGLE_CLIENT_ID | OAuth | Google OAuth | xxx.apps.googleusercontent.com |
| GOOGLE_CLIENT_SECRET | OAuth | Google OAuth secret | GOCSPX-xxx |

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm run test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build-extension:
    needs: lint-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build extension
        run: npm run build:extension
      
      - name: Create ZIP
        run: cd dist && zip -r ../extension.zip .
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension
          path: extension.zip

  deploy-portal:
    needs: lint-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-vdi-runner:
    needs: lint-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Fly.io
        uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  publish-extension:
    needs: build-extension
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && contains(github.event.head_commit.message, '[release]')
    steps:
      - uses: actions/checkout@v4
      
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: extension
      
      - name: Publish to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v4.0.1
        with:
          file-path: extension.zip
          extension-id: ${{ secrets.CHROME_EXTENSION_ID }}
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
```

### 8.2 Branch Protection Rules

```
# Settings > Branches > Branch protection rules

# Rule for 'main' branch:
# ✓ Require a pull request before merging
#   ✓ Require approvals: 1
#   ✓ Dismiss stale pull request approvals when new commits are pushed
# ✓ Require status checks to pass before merging
#   ✓ lint-and-test
# ✓ Require branches to be up to date before merging
# ✓ Do not allow bypassing the above settings
```

---

## 9. Release Management

### 9.1 Versioning Strategy

**Semantic Versioning: MAJOR.MINOR.PATCH**

- **MAJOR**: Breaking changes, major feature overhauls
- **MINOR**: New features, backward-compatible
- **PATCH**: Bug fixes, minor improvements

Examples:
- `1.0.0` → Initial release
- `1.1.0` → Added CSV import feature
- `1.1.1` → Fixed CSV parsing bug
- `2.0.0` → Complete UI redesign

### 9.2 Release Checklist

```markdown
## Release Checklist v[X.Y.Z]

### Pre-Release
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Version bumped in manifest.json

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Smoke tests on staging
- [ ] Performance check
- [ ] Security scan

### Production Deployment
- [ ] Merge to main branch
- [ ] Verify CI/CD pipeline success
- [ ] Verify Vercel deployment
- [ ] Verify Fly.io deployment
- [ ] Submit extension to Chrome Web Store

### Post-Release
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Announce release (if applicable)
- [ ] Tag release in GitHub
- [ ] Close related issues
```

---

## 10. Rollback Procedures

### 10.1 Vercel Rollback

```bash
# List recent deployments
vercel list

# Rollback to specific deployment
vercel rollback <deployment-url>

# Or via dashboard:
# 1. Go to vercel.com/[team]/[project]/deployments
# 2. Find previous working deployment
# 3. Click "..." → "Promote to Production"
```

### 10.2 Fly.io Rollback

```bash
# List recent releases
fly releases

# Rollback to previous release
fly deploy --image registry.fly.io/testflow-vdi-runner:v123

# Or scale down and redeploy
fly scale count 0
fly deploy
fly scale count 3
```

### 10.3 Supabase Rollback

```bash
# View migration history
supabase migration list

# Create rollback migration
supabase migration new rollback_feature_x

# Edit migration with reverse SQL
# Then push to apply
supabase db push

# For data issues, restore from backup:
# 1. Go to Supabase Dashboard
# 2. Settings > Database > Backups
# 3. Select backup point
# 4. Restore (creates new project)
```

---

## 11. Monitoring & Alerts

### 11.1 Monitoring Setup

| Service | Tool | Purpose |
|---------|------|---------|
| Portal | Vercel Analytics | Page performance, errors |
| Portal | Sentry | Error tracking |
| Database | Supabase Dashboard | Query performance, connections |
| VDI Runner | Fly.io Metrics | CPU, memory, health |
| All | Better Uptime | Uptime monitoring |

### 11.2 Alert Configuration

```yaml
# betteruptime/monitors.yml
monitors:
  - name: TestFlow Portal
    url: https://testflow.app
    check_frequency: 60
    alert_after: 2
    
  - name: TestFlow API
    url: https://testflow.app/api/health
    check_frequency: 60
    alert_after: 2
    
  - name: VDI Runner Health
    url: https://testflow-vdi-runner.fly.dev/health
    check_frequency: 60
    alert_after: 3

alerts:
  - type: email
    address: alerts@testflow.app
    
  - type: slack
    webhook: https://hooks.slack.com/services/xxx
```

---

## 12. Security Checklist

### 12.1 Pre-Deployment Security

```markdown
## Security Checklist

### Secrets Management
- [ ] All secrets stored in environment variables (not code)
- [ ] API keys rotated regularly
- [ ] Service role key only used server-side
- [ ] No secrets in git history

### Authentication
- [ ] Password requirements enforced
- [ ] Session timeout configured
- [ ] OAuth providers configured correctly
- [ ] Email verification enabled

### Authorization
- [ ] RLS policies on all tables
- [ ] Service role restricted to necessary operations
- [ ] API routes check authentication
- [ ] No sensitive data exposed to client

### Data Protection
- [ ] HTTPS enforced everywhere
- [ ] CORS configured correctly
- [ ] CSP headers set
- [ ] Input validation on all endpoints

### Infrastructure
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] Logging enabled
- [ ] Backup schedule configured
```

---

## Summary

Deployment Overview provides:

✅ Multi-platform deployment (Chrome Web Store, Vercel, Fly.io)  
✅ Supabase setup with migrations and RLS  
✅ CI/CD pipeline with GitHub Actions  
✅ Environment configuration for all stages  
✅ Release management process  
✅ Rollback procedures for each component  
✅ Monitoring and alerts setup  
✅ Security checklist for production  

This enables reliable, automated deployment of all system components.
