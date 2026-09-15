
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

(async () => {
  console.log('Starting server...');
  const server = spawn('npm.cmd', ['run', 'preview'], { stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4173');
    await page.waitForSelector('.lucide-settings', { timeout: 5000 });
    console.log('Opening settings...');
    await page.click('.lucide-settings');
    let ls = await page.evaluate(() => localStorage.getItem('michess_settings'));
    console.log('Initial localStorage:', ls);
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const woodBtn = buttons.find(b => b.textContent.includes('Wood'));
      if(woodBtn) woodBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    ls = await page.evaluate(() => localStorage.getItem('michess_settings'));
    console.log('After clicking Wood, localStorage:', ls);
    console.log('Test completed successfully!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
})();
