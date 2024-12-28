const puppeteer = require('puppeteer');

async function takeScreenshot(url, path) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  console.log('Navigating to URL:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the network to be idle
  console.log('Waiting for network to be idle...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Wait for a specific DOM element to be visible
  console.log('Waiting for the user list to be visible...');
  await page.waitForSelector('.TopUsers_userList__PTsaG', { visible: true, timeout: 10000 });

  // Set the viewport to a higher resolution
  const viewportWidth = 1920;
  const viewportHeight = 1080;
  const deviceScaleFactor = 2; // Increase the device scale factor for better quality
  await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor });

  // Set the viewport to the full height of the page
  const bodyHandle = await page.$('body');
  const { height } = await bodyHandle.boundingBox();
  await page.setViewport({ width: viewportWidth, height: Math.ceil(height), deviceScaleFactor });
  await bodyHandle.dispose();

  console.log('Taking screenshot...');
  await page.screenshot({ path, fullPage: true });
  await browser.close();
  console.log('Screenshot saved to:', path);
}

module.exports = takeScreenshot;
