const puppeteer = require('puppeteer');
const axios = require('axios');
const { createWriteStream, existsSync } = require('fs');
const { join } = require('path');
const { Throttle } = require('stream-throttle');

function downloadFilm(url, quality, speedLimitMB) {
    return new Promise(async (resolve, reject) => {
        let foundedVideoURL = false;
        
        const browser = await puppeteer.launch({ headless: true });
        const page = (await browser.pages())[0];

        await page.setRequestInterception(true);

        page.on('request', async (request) => {
            const requestURL = request.url();

            // Fast load without useless files and skip advertisement
            if (['image', 'stylesheet', 'font'].includes(request.resourceType()) || requestURL.endsWith(".mp4")) {
                request.abort();
            } else if (requestURL.includes(".mp4") && requestURL.includes(".ts")) {
                const videoUrl = requestURL.split('.mp4:')[0] + ".mp4";

                foundedVideoURL = true;

                await downloadVideo(page, videoUrl, speedLimitMB);
                await browser.close();

                resolve();
                
                request.abort();
            } else {
                request.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('pljsquality', quality);
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });

        await page.evaluate(() => {
            const video = document.querySelector('video');

            if (video) {
                video.play();
            }
        });

        setTimeout(() => {
            if (!foundedVideoURL) {
                browser.close();
                
                reject(`Не удалось найти ссылку на видео. URL: ${url}`);
            }
        }, 60_000);
    });
}

async function downloadVideo(page, videoUrl, speedLimitMB) {
    const content = await page.content();
    const title = extractTitle(content);
    const filePath = getUniqueFilePath(title);

    console.log(`Скачиваем видео — ${title}`);

    try {
        const response = await axios.get(videoUrl, { responseType: 'stream' });
        const totalBytes = parseInt(response.headers['content-length'], 10);
        const writer = createWriteStream(filePath);

        await downloadWithProgress(response, writer, totalBytes, title, speedLimitMB);

        console.log(`Скачивание завершено — ${title} ✅✅✅`);
    } catch (error) {
        console.error(`Ошибка при скачивании видео — ${title}`, error);
    }
}

async function downloadWithProgress(response, writer, totalBytes, title, speedLimitMB) {
    let downloadedBytes = 0;
    let latestProgress = 0;

    response.data
        .pipe(new Throttle({ rate: speedLimitMB * 1024 * 1024 }))
        .pipe(writer);

    response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;

        const progress = Math.floor((downloadedBytes / totalBytes) * 100);

        if (progress - latestProgress >= 10) {
            latestProgress = progress;

            console.log(`Прогресс (${title}): ${progress}% (${(downloadedBytes / (1024 * 1024)).toFixed(3)} MB / ${(totalBytes / (1024 * 1024)).toFixed(3)} MB)`);
        }
    });

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function extractTitle(content) {
    return (content.match(/<h1 itemprop="name">(.*?)<\/h1>/)[1]).replace(/["';:\/]/g, '');
}

function getUniqueFilePath(title) {
    const baseDir = join(__dirname, '../films');
    let filePath = join(baseDir, `${title}.mp4`);
    let counter = 1;

    while (existsSync(filePath)) {
        filePath = join(baseDir, `${title} (${counter++}).mp4`);
    }

    return filePath;
}

// Paste your URLs into this array
// Example: 

/*
const urls = [
    "https://rezka.ag/films/fiction/981-matrica-1999.html",
    "https://rezka.ag/films/fiction/981-matrica-1999.html"
]
*/

const urls = [
    
];

const errorUrls = [];
let quality = process.argv[2];
let speedLimitMB = process.argv[3];

(async () => {
    quality ??= "1080p";
    speedLimitMB ??= 7;

    console.log(`-------PARAMS--------`);
    console.log(`Quality: ${quality} \r\nSpeed limit: ${speedLimitMB} MB/s`);
    console.log(`---------------------\n`);

    for (const u of urls) {
        try {
            await downloadFilm(u, quality, speedLimitMB);
        } catch (err) {
            console.log(err);

            errorUrls.push(u);
        }
    }

    console.log("URLs не найдены:", errorUrls);
})();

//main();