// Test target creation
// Note: This test file should be converted to TypeScript or use a proper build process
// For now, this is a placeholder that won't work directly
console.log('This test file needs to be run through a TypeScript compiler or converted to use compiled JS files');

try {
  console.log('Testing target creation...');
  const db = getDb();
  
  const targetData = {
    name: 'Test Target',
    requiresLogin: false,
    urls: [
      {
        name: 'Test Page',
        url: 'https://example.com'
      }
    ]
  };
  
  const target = db.createTarget(targetData);
  console.log('Target created successfully:', target);
  
} catch (error) {
  console.error('Target creation failed:', error);
}