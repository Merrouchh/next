import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read the index.html file from the voicehcat directory
    const htmlPath = path.join(process.cwd(), 'voicehcat', 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Add the <style> tag with your CSS to the <head> section of the HTML
    const style = `
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden; /* Prevent scrollbars on the iframe content */
        }
      </style>
    `;
    
    // Inject the style into the <head> section of the HTML content
    htmlContent = htmlContent.replace(/<\/head>/, `${style}</head>`);

    // Set proper headers to allow iframe embedding
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Allow all frames (not recommended for production)
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:3000;"); // Restrict to specific domains

    // Serve the HTML content
    res.status(200).send(htmlContent);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Error loading page');
  }
}
