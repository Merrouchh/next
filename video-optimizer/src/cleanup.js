const fs = require('fs');
const path = require('path');

function cleanupTempFiles() {
  const tempDir = path.join(__dirname, '../temp');
  
  if (!fs.existsSync(tempDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        // Remove directory and all contents
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        // Remove file
        fs.unlinkSync(filePath);
      }
    }
    
    console.log('Temp directory cleaned successfully');
  } catch (error) {
    console.error('Error cleaning temp directory:', error);
  }
}

module.exports = cleanupTempFiles; 