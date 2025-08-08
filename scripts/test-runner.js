#!/usr/bin/env node

/**
 * Test runner script for Orbis screenshot manager
 * Provides a unified interface for running different types of tests
 */

const { spawn } = require('child_process');
const path = require('path');

const COMMANDS = {
  unit: 'npm run test:unit',
  api: 'npm run test:api',
  e2e: 'npm run test:e2e',
  coverage: 'npm run test:coverage',
  watch: 'npm run test:watch',
  all: 'npm run test:all'
};

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Command completed successfully`);
        resolve(code);
      } else {
        console.log(`❌ Command failed with exit code ${code}`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error running command: ${error.message}`);
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  if (!COMMANDS[testType]) {
    console.error(`❌ Unknown test type: ${testType}`);
    console.log('Available test types:');
    Object.keys(COMMANDS).forEach(type => {
      console.log(`  - ${type}: ${COMMANDS[type]}`);
    });
    process.exit(1);
  }

  try {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    console.log(`🧪 Starting ${testType} tests...`);
    
    if (testType === 'all') {
      // Run unit and API tests first
      await runCommand('npm', ['run', 'test:coverage']);
      
      // Then run E2E tests
      await runCommand('npm', ['run', 'test:e2e']);
      
      console.log('🎉 All tests completed successfully!');
    } else {
      const command = COMMANDS[testType];
      const [cmd, ...cmdArgs] = command.split(' ');
      await runCommand(cmd, cmdArgs);
    }
    
  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test execution terminated');
  process.exit(1);
});

main().catch(error => {
  console.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
});