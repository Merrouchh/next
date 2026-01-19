import sharp from 'sharp';
// import fs from 'fs'; // Removed unused import
// import path from 'path'; // Removed unused import

// Social media metadata requirements
const SOCIAL_MEDIA_REQUIREMENTS = {
  maxFileSize: 270 * 1024, // 270KB for WhatsApp and other platforms
  maxWidth: 1200,
  maxHeight: 630,
  quality: 85,
  format: 'jpeg'
};

// Event image requirements (slightly larger for better quality)
const EVENT_IMAGE_REQUIREMENTS = {
  maxFileSize: 500 * 1024, // 500KB
  maxWidth: 1600,
  maxHeight: 900,
  quality: 90,
  format: 'jpeg'
};

/**
 * Compress and optimize image for social media metadata
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
export async function compressImageForSocialMedia(imageBuffer, options = {}) {
  const requirements = { ...SOCIAL_MEDIA_REQUIREMENTS, ...options };
  
  try {
    let compressedBuffer = imageBuffer;
    let currentQuality = requirements.quality;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      // Process image with Sharp
      let sharpInstance = sharp(compressedBuffer)
        .resize(requirements.maxWidth, requirements.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: currentQuality,
          progressive: true,
          mozjpeg: true
        });

      // Apply additional optimizations
      if (requirements.format === 'webp') {
        sharpInstance = sharpInstance.webp({ 
          quality: currentQuality,
          effort: 6
        });
      }

      compressedBuffer = await sharpInstance.toBuffer();

      // Check if file size is within limits
      if (compressedBuffer.length <= requirements.maxFileSize) {
        console.log(`Image compressed successfully: ${(compressedBuffer.length / 1024).toFixed(1)}KB (${currentQuality}% quality)`);
        return compressedBuffer;
      }

      // Reduce quality and try again
      currentQuality = Math.max(60, currentQuality - 10);
      attempts++;
      
      console.log(`Attempt ${attempts}: File size ${(compressedBuffer.length / 1024).toFixed(1)}KB, reducing quality to ${currentQuality}%`);
    }

    // If we still can't get under the limit, use the smallest result
    console.log(`Warning: Could not compress image below ${requirements.maxFileSize / 1024}KB. Using best available compression.`);
    return compressedBuffer;

  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error(`Image compression failed: ${error.message}`);
  }
}

/**
 * Compress event image with appropriate settings
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
export async function compressEventImage(imageBuffer, options = {}) {
  return compressImageForSocialMedia(imageBuffer, { ...EVENT_IMAGE_REQUIREMENTS, ...options });
}

/**
 * Get image metadata without processing
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} - Image metadata
 */
export async function getImageMetadata(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    console.error('Error getting image metadata:', error);
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
}

/**
 * Validate image file
 * @param {Object} file - File object from formidable
 * @returns {Object} - Validation result
 */
export function validateImageFile(file) {
  // Sharp supports HEIC/HEIF format, so we allow it (will be converted to JPEG)
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp', 
    'image/gif',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, WebP, GIF, and HEIC are allowed.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  }

  return { valid: true };
}

/**
 * Generate optimized filename
 * @param {string} originalName - Original filename
 * @param {string} prefix - File prefix
 * @param {string} format - Output format
 * @returns {string} - Optimized filename
 */
export function generateOptimizedFilename(originalName, prefix = 'optimized', format = 'jpg') {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomId}.${format}`;
}

/**
 * Create multiple sizes for responsive images
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<Object>} - Object with different image sizes
 */
export async function createResponsiveImages(imageBuffer) {
  const sizes = {
    thumbnail: { width: 300, height: 200 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 630 }
  };

  const results = {};

  for (const [size, dimensions] of Object.entries(sizes)) {
    try {
      const compressed = await sharp(imageBuffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      results[size] = compressed;
    } catch (error) {
      console.error(`Error creating ${size} image:`, error);
      results[size] = null;
    }
  }

  return results;
} 