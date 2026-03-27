const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error));

    await page.goto('http://127.0.0.1:5500/badminton-game/index.html');
    await page.waitForTimeout(500);

    // click start game
    await page.click('#start-btn');
    console.log('Clicked start button');
    
    await page.waitForTimeout(200);

    // press J to serve
    await page.keyboard.press('KeyJ');
    console.log('Pressed J');
    
    await page.waitForTimeout(200);

    // get output variables
    const state = await page.evaluate(() => {
        return {
            ballDead: window.shuttle ? window.shuttle.y >= 442 : null,
            shuttlePos: window.shuttle ? {x: window.shuttle.x, y: window.shuttle.y, vx: window.shuttle.vx, vy: window.shuttle.vy} : null,
            hasHit: window.player ? window.player.hasHit : null
        };
    });
    console.log('After J:', state);
    
    await browser.close();
})();
