#!/usr/bin/env node

/**
 * Verification script for the comprehensive testing infrastructure
 * This script validates that all testing components are properly configured
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REQUIRED_FILES = [
  'jest.config.js',
  'jest.setup.js',
  'playwright.config.ts',
  'tests/utils/test-db.ts',
  'tests/utils/api-helpers.ts',
  'tests/setup/test-config.ts',
  'tests/e2e/global-setup.ts',
  'tests/e2e/global-teardown.ts',
  'tests/unit/db.test.ts',
  'tests/api/targets.test.ts',
  'tests/e2e/infrastructure.spec.ts',
  'tests/README.md',
  '.github/workflows/test.yml'
];

const REQUIRED_DEPENDENCIES = [
  'jest',
  '@jest/globals',
  '@types/jest',
  'jest-environment-node',
  'ts-jest',
  'supertest',
  '@types/supertest',
  '@playwright/test'
];

const REQUIRED_SCRIPTS = [
  'test',
  'test:watch',
  'test:coverage',
  'test:api',
  'test:unit',
  'test:e2e',
  'test:e2e:ui',
  'test:e2e:headed',
  'test:all',
  'test:runner'
];

function checkFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${filePath} - Missing`);
    return false;
  }
}

function checkDependency(dep) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (allDeps[dep]) {
      console.log(`✅ ${dep} (${allDeps[dep]})`);
      return true;
    } else {
      console.log(`❌ ${dep} - Not installed`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error checking dependency ${dep}: ${error.message}`);
    return false;
  }
}

function checkScript(script) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`✅ ${script}: ${packageJson.scripts[script]}`);
      return true;
    } else {
      console.log(`❌ ${script} - Script not found`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error checking script ${script}: ${error.message}`);
    return false;
  }
}

async function runCommand(command, args = []) {
  return new Promise((resolve) => {
    console.log(`🧪 Testing: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd()
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Command succeeded`);
        resolve(true);
      } else {
        console.log(`❌ Command failed with exit code ${code}`);
        console.log(`Output: ${output.slice(-200)}`); // Show last 200 chars
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.log(`❌ Command error: ${error.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🔍 Verifying Testing Infrastructure Setup\n');

  let allPassed = true;

  // Check required files
  console.log('📁 Checking Required Files:');
  for (const file of REQUIRED_FILES) {
    if (!checkFile(file)) {
      allPassed = false;
    }
  }

  console.log('\n📦 Checking Dependencies:');
  for (const dep of REQUIRED_DEPENDENCIES) {
    if (!checkDependency(dep)) {
      allPassed = false;
    }
  }

  console.log('\n📜 Checking NPM Scripts:');
  for (const script of REQUIRED_SCRIPTS) {
    if (!checkScript(script)) {
      allPassed = false;
    }
  }

  console.log('\n🧪 Running Test Commands:');
  
  // Test Jest configuration
  const jestPassed = await runCommand('npm', ['test', '--', '--passWithNoTests', '--silent']);
  if (!jestPassed) allPassed = false;

  // Test Playwright configuration (just check config)
  const playwrightPassed = await runCommand('npx', ['playwright', 'test', '--list']);
  if (!playwrightPassed) allPassed = false;

  console.log('\n📊 Summary:');
  if (allPassed) {
    console.log('🎉 All testing infrastructure components are properly configured!');
    console.log('\n📋 Available Commands:');
    console.log('  npm test                 - Run unit tests');
    console.log('  npm run test:coverage    - Run tests with coverage');
    console.log('  npm run test:e2e         - Run E2E tests');
    console.log('  npm run test:all         - Run all tests');
    console.log('  npm run test:runner all  - Run all tests with custom runner');
    console.log('\n📚 Documentation:');
    console.log('  tests/README.md          - Comprehensive testing guide');
    console.log('  .github/workflows/test.yml - CI/CD configuration');
  } else {
    console.log('❌ Some testing infrastructure components are missing or misconfigured.');
    console.log('Please review the errors above and fix the issues.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`❌ Verification failed: ${error.message}`);
  process.exit(1);
});