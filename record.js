const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');

puppeteer.use(StealthPlugin()); // Stealth 플러그인 사용

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('input url: ', async (url) => {
    rl.close();

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');

    let actions = [];

    console.log(`Navigating to: ${url}`);
    await page.goto(url);

    // 이벤트 기록을 위한 exposeFunction 등록 (새 탭에서도 실행해야 함)
    const registerExposeFunctions = async (p) => {
        await p.exposeFunction('recordClick', (x, y) => {
            actions.push({ type: 'click', x, y });
            console.log(`Click recorded: (${x}, ${y})`);
        });

        await p.exposeFunction('recordInput', (selector, value) => {
            actions.push({ type: 'input', selector, value });
            console.log(`Input recorded: ${selector} -> ${value}`);
        });

        await p.exposeFunction('recordKeyPress', (key) => {
            actions.push({ type: 'keypress', key });
            console.log(`Key Press recorded: ${key}`);
        });

        await p.exposeFunction('recordScroll', (scrollY) => {
            actions.push({ type: 'scroll', scrollY });
            console.log(`Scroll recorded: Y=${scrollY}`);
        });
    };

    await registerExposeFunctions(page);

    // 이벤트 리스너 등록 함수
    const attachListeners = async (p) => {
        await p.evaluate(() => {
            console.log("✅ Attaching event listeners...");

            // 클릭 이벤트 기록
            document.removeEventListener('click', window.recordClickEvent);
            window.recordClickEvent = (event) => {
                window.recordClick(event.clientX, event.clientY);
            };
            document.addEventListener('click', window.recordClickEvent);

            // 입력 이벤트 기록
            document.removeEventListener('input', window.recordInputEvent);
            window.recordInputEvent = (event) => {
                const inputField = document.activeElement;
                const fieldName = inputField.name || inputField.id || inputField.getAttribute('aria-label') || 'unknown';
                const value = inputField.value;
                window.recordInput(fieldName, value);
            };
            document.addEventListener('input', window.recordInputEvent);

            // 키 입력(엔터) 기록
            document.removeEventListener('keydown', window.recordKeyPressEvent);
            window.recordKeyPressEvent = (event) => {
                if (event.key === 'Enter') {
                    window.recordKeyPress(event.key);
                }
            };
            document.addEventListener('keydown', window.recordKeyPressEvent);

            // 스크롤 기록
            window.removeEventListener('scroll', window.recordScrollEvent);
            window.recordScrollEvent = () => {
                window.recordScroll(window.scrollY);
            };
            window.addEventListener('scroll', window.recordScrollEvent);

            console.log("🎥 Event listeners successfully attached.");
        });
    };

    await attachListeners(page);

    let lastNavigationTime = Date.now();


    console.log('Recording user actions... Close the browser to save.');

    browser.on('disconnected', () => {
        fs.writeFileSync('actions.json', JSON.stringify(actions, null, 2));
        console.log('User actions saved to actions.json');
    });
});
