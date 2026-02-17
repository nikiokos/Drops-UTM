const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'https://utm.drops.eu';
const SCREENSHOTS_DIR = path.join(__dirname, 'images');

const screenshots = [
  { name: '01-login', path: '/login', waitFor: 'form' },
  { name: '02-dashboard', path: '/dashboard', waitFor: '.space-y-6', auth: true },
  { name: '03-control-center', path: '/dashboard/control', waitFor: '.leaflet-container', auth: true },
  { name: '04-missions', path: '/dashboard/missions', waitFor: 'table', auth: true },
  { name: '05-flights', path: '/dashboard/flights', waitFor: 'table', auth: true },
  { name: '06-drones', path: '/dashboard/drones', waitFor: 'table', auth: true },
  { name: '07-hubs', path: '/dashboard/hubs', waitFor: '.leaflet-container', auth: true },
  { name: '08-airspace', path: '/dashboard/airspace', waitFor: 'table', auth: true },
  { name: '09-emergency', path: '/dashboard/emergency', waitFor: '.space-y-6', auth: true },
  { name: '10-weather', path: '/dashboard/weather', waitFor: '.space-y-6', auth: true },
  { name: '11-fleet', path: '/dashboard/fleet', waitFor: '.space-y-6', auth: true },
  { name: '12-connectivity', path: '/dashboard/connectivity', waitFor: '.space-y-6', auth: true },
];

async function captureScreenshots() {
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let isLoggedIn = false;

  for (const screenshot of screenshots) {
    try {
      console.log(`Capturing: ${screenshot.name}...`);

      // Login if needed
      if (screenshot.auth && !isLoggedIn) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.type('input[type="email"]', 'admin@drops.eu');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        isLoggedIn = true;
        console.log('  Logged in successfully');
      }

      await page.goto(`${BASE_URL}${screenshot.path}`, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for specific element
      try {
        await page.waitForSelector(screenshot.waitFor, { timeout: 10000 });
      } catch (e) {
        console.log(`  Warning: Could not find ${screenshot.waitFor}, taking screenshot anyway`);
      }

      // Extra wait for animations/maps to load
      await new Promise(r => setTimeout(r, 2000));

      const filePath = path.join(SCREENSHOTS_DIR, `${screenshot.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`  Saved: ${filePath}`);
    } catch (error) {
      console.error(`  Error capturing ${screenshot.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to:', SCREENSHOTS_DIR);
}

captureScreenshots().catch(console.error);
