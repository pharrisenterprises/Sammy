/**
 * API Documentation Generator
 * @module scripts/generate-api-docs
 * @version 1.0.0
 * 
 * Generates API documentation from TypeScript source files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');
const docsDir = path.resolve(__dirname, '../docs/api');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODULES = [
  { name: 'Types', path: 'core/types', description: 'TypeScript interfaces and type definitions' },
  { name: 'Storage', path: 'core/storage', description: 'IndexedDB persistence layer' },
  { name: 'Locators', path: 'core/locators', description: 'Element finding strategies' },
  { name: 'Messages', path: 'core/messages', description: 'Chrome runtime messaging' },
  { name: 'Recording', path: 'core/recording', description: 'Event capture engine' },
  { name: 'Replay', path: 'core/replay', description: 'Action execution engine' },
  { name: 'CSV', path: 'core/csv', description: 'CSV parsing and field mapping' },
  { name: 'Orchestrator', path: 'core/orchestrator', description: 'Test execution coordination' },
  { name: 'Hooks', path: 'hooks', description: 'React custom hooks' },
  { name: 'Context', path: 'context', description: 'React context providers' },
  { name: 'Components', path: 'components', description: 'UI components' },
  { name: 'Pages', path: 'pages', description: 'Page components' },
];

// ============================================================================
// GENERATORS
// ============================================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractExports(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const exports = [];

  // Match export statements
  const patterns = [
    /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
    /export\s+\{\s*([^}]+)\s*\}/g,
    /export\s+type\s+\{\s*([^}]+)\s*\}/g,
    /export\s+default\s+(?:class|function)?\s*(\w+)?/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        const names = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
        exports.push(...names.filter(n => n && n !== 'default'));
      }
    }
  }

  return [...new Set(exports)];
}

function generateModuleDoc(module) {
  const indexPath = path.resolve(srcDir, module.path, 'index.ts');
  const exports = extractExports(indexPath);

  let doc = `# ${module.name}\n\n`;
  doc += `${module.description}\n\n`;
  doc += `**Path:** \`src/${module.path}\`\n\n`;

  if (exports.length > 0) {
    doc += `## Exports\n\n`;
    doc += `| Name | Type |\n`;
    doc += `|------|------|\n`;

    for (const exportName of exports.sort()) {
      // Guess type from naming convention
      let type = 'unknown';
      if (exportName.startsWith('use')) type = 'Hook';
      else if (exportName.endsWith('Provider')) type = 'Component';
      else if (exportName.endsWith('Context')) type = 'Context';
      else if (exportName.endsWith('Strategy')) type = 'Class';
      else if (exportName.endsWith('Handler')) type = 'Class';
      else if (exportName.endsWith('Manager')) type = 'Class';
      else if (exportName.endsWith('Service')) type = 'Class';
      else if (exportName.endsWith('Engine')) type = 'Class';
      else if (exportName.match(/^[A-Z]/)) type = 'Class/Component';
      else type = 'Function/Constant';

      doc += `| \`${exportName}\` | ${type} |\n`;
    }
  }

  doc += `\n## Usage\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `import { ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? ', ...' : ''} } from '@/${module.path}';\n`;
  doc += `\`\`\`\n`;

  return doc;
}

function generateIndexDoc() {
  let doc = `# Sammy API Documentation\n\n`;
  doc += `Auto-generated API reference for the Sammy test automation extension.\n\n`;
  doc += `## Modules\n\n`;

  for (const module of MODULES) {
    doc += `- [${module.name}](./${module.name.toLowerCase()}.md) - ${module.description}\n`;
  }

  doc += `\n## Quick Start\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `// Import from core\n`;
  doc += `import { RecordingEngine, ReplayEngine, ProjectRepository } from '@/core';\n\n`;
  doc += `// Import hooks\n`;
  doc += `import { useProjects, useRecording, useReplay } from '@/hooks';\n\n`;
  doc += `// Import components\n`;
  doc += `import { Button, LoadingSpinner, ErrorBoundary } from '@/components';\n`;
  doc += `\`\`\`\n`;

  return doc;
}

function main() {
  console.log('Generating API documentation...\n');

  ensureDir(docsDir);

  // Generate index
  const indexDoc = generateIndexDoc();
  fs.writeFileSync(path.resolve(docsDir, 'README.md'), indexDoc);
  console.log('✅ Generated docs/api/README.md');

  // Generate module docs
  for (const module of MODULES) {
    const doc = generateModuleDoc(module);
    const filename = `${module.name.toLowerCase()}.md`;
    fs.writeFileSync(path.resolve(docsDir, filename), doc);
    console.log(`✅ Generated docs/api/${filename}`);
  }

  console.log(`\n✨ Generated ${MODULES.length + 1} documentation files`);
}

main();
