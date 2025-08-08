import fs from 'fs/promises';
import path from 'path';

export interface ScreenshotInfo {
  filename: string;
  fullPath: string;
  date: string;
  timestamp: Date;
  targetName: string;
}

export async function getLatestSessionScreenshots(targetName: string): Promise<ScreenshotInfo[]> {
  try {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const sanitizedName = targetName
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();

    // Get all date directories
    const dateDirectories = await fs.readdir(screenshotsDir);
    const validDates = dateDirectories.filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
    
    if (validDates.length === 0) {
      return [];
    }

    // Sort by date descending (most recent first)
    validDates.sort().reverse();

    // Look for screenshots matching the target name and find the latest session
    for (const dateDir of validDates) {
      const datePath = path.join(screenshotsDir, dateDir);
      
      try {
        const files = await fs.readdir(datePath);
        const matchingFiles = files.filter(file => 
          file.startsWith(sanitizedName + '-') && file.endsWith('.png')
        );

        if (matchingFiles.length > 0) {
          // Sort by filename (which includes timestamp) descending
          matchingFiles.sort().reverse();
          
          // Extract timestamp from the latest file to identify the session
          const latestFile = matchingFiles[0];
          const timestampMatch = latestFile.match(/-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2})-\d{2}-\d{3}Z\.png$/);
          
          if (timestampMatch) {
            const latestTimePrefix = timestampMatch[1]; // YYYY-MM-DDTHH-MM
            
            // Find all files from the same session (same hour and minute)
            const sessionFiles = matchingFiles.filter(file => 
              file.includes(latestTimePrefix)
            );
            
            return sessionFiles.map(filename => ({
              filename,
              fullPath: path.join(datePath, filename),
              date: dateDir,
              timestamp: new Date(dateDir + 'T00:00:00'),
              targetName: sanitizedName,
            }));
          }
        }
      } catch {
        // Skip this directory if we can't read it
        continue;
      }
    }

    return [];
  } catch (error) {
    console.error('Error finding latest session screenshots:', error);
    return [];
  }
}

// Keep the old function for backward compatibility
export async function getLatestScreenshot(targetName: string): Promise<ScreenshotInfo | null> {
  const screenshots = await getLatestSessionScreenshots(targetName);
  return screenshots.length > 0 ? screenshots[0] : null;
}

export async function getAllScreenshotsForTarget(targetName: string): Promise<ScreenshotInfo[]> {
  try {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const sanitizedName = targetName
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();

    const screenshots: ScreenshotInfo[] = [];

    // Get all date directories
    const dateDirectories = await fs.readdir(screenshotsDir);
    const validDates = dateDirectories.filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));

    for (const dateDir of validDates) {
      const datePath = path.join(screenshotsDir, dateDir);
      
      try {
        const files = await fs.readdir(datePath);
        const matchingFiles = files.filter(file => 
          file.startsWith(sanitizedName + '-') && file.endsWith('.png')
        );

        for (const file of matchingFiles) {
          screenshots.push({
            filename: file,
            fullPath: path.join(datePath, file),
            date: dateDir,
            timestamp: new Date(dateDir + 'T00:00:00'),
            targetName: sanitizedName,
          });
        }
      } catch {
        // Skip this directory if we can't read it
        continue;
      }
    }

    // Sort by date and filename descending (most recent first)
    return screenshots.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.filename.localeCompare(a.filename);
    });
  } catch (error) {
    console.error('Error getting screenshots for target:', error);
    return [];
  }
}