import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:5173');
  
  console.log('Navigated to localhost:5173');
  
  // Wait for the Play button and click it
  await page.waitForSelector('button');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Play Local Game')) {
      await btn.click();
      break;
    }
  }
  
  console.log('Clicked Play Local Game');
  
  // Wait for chessboard to render
  await new Promise(r => setTimeout(r, 2000));
  
  // Try to find pieces
  const pieces = await page.$$('[data-piece]');
  console.log('Found pieces:', pieces.length);
  
  // Find e2 pawn (White Pawn)
  // react-chessboard uses data-square="e2"
  const e2 = await page.$('[data-square="e2"]');
  if (e2) {
    console.log('Found e2 square');
    const box = await e2.boundingBox();
    console.log('e2 box:', box);
    
    // drag from e2 to e4
    const e4 = await page.$('[data-square="e4"]');
    const e4Box = await e4.boundingBox();
    
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(e4Box.x + e4Box.width / 2, e4Box.y + e4Box.height / 2, { steps: 10 });
    await page.mouse.up();
    
    console.log('Dragged from e2 to e4');
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));
    
    // Check fen or move history
    const history = await page.evaluate(() => {
      const h2 = document.querySelectorAll('h2');
      return document.body.innerHTML;
    });
    // Just search for "e4" in body
    console.log('Is e4 in history?', history.includes('e4'));
  }
  
  await browser.close();
})();
