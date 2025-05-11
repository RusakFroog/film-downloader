const puppeteer = require('puppeteer');
const axios = require('axios');
const { createWriteStream, existsSync } = require('fs');
const { join } = require('path');
const { Throttle } = require('stream-throttle');

async function setQualityAndReload(page, quality) {
    await page.evaluate((quality) => {
        localStorage.setItem('pljsquality', quality);
    }, quality);
    
    await page.reload({ waitUntil: 'domcontentloaded' });
}

function downloadFilm(url, quality, speedLimitMB) {
    return new Promise(async (resolve, reject) => {
        let foundedVideoURL = false;
        
        const browser = await puppeteer.launch({ headless: true });
        const page = (await browser.pages())[0];

        await page.setRequestInterception(true);

        page.on('request', async (request) => {
            if (foundedVideoURL) {
                return;
            }

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

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        console.log('Страница загружена!');

        await setQualityAndReload(page, quality);
        console.log('Качество установлено, страница перезагружена');

        await page.evaluate(async () => {
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
        writer.on('finish', () => { 
            resolve();
        });

        writer.on('error', reject);
    });
}

function extractTitle(content) {
    try {
        const title = (content.match(/<h1 itemprop="name">(.*?)<\/h1>/)[1]).replace(/["';:\/]/g, '');

        return title;
    } catch (error) {
        const title = (content.match(/<div class="b-post__origtitle">(.*?)<\/div>/)[1]).replace(/["';:\/]/g, '');

        return title;
    }
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
    // "https://rezka.ag/films/drama/1697-zodiak-2007.html",
    // "https://rezka.ag/films/drama/10806-krid-nasledie-rokki-2015.html",
    // "https://rezka.ag/films/thriller/78595-nastoyaschie-detektivy-2025.html",
    // "https://rezka.ag/series/thriller/1967-chernyy-spisok-2013.html#t:111-s:1-e:1",

    // "https://rezka-ua.in/series/adventures/53465-odni-iz-nas-2023-latest/111-hdrezka-studio/1-season/1-episode.html",

    // "https://rezka.ag/series/drama/34048-bandy-londona-2020.html#t:355-s:1-e:1",

    // "https://rezka.ag/films/action/1112-adrenalin-2006.html",
    // "https://rezka.ag/films/action/47246-bystree-puli-2022.html",
    // "https://rezka.ag/films/action/56394-tayler-reyk-operaciya-po-spaseniyu-2-2023.html",
    // "https://rezka.ag/films/thriller/1372-gorod-vorov-2010.html",
    // "https://rezka.ag/films/action/2923-ubit-billa-2003.html",
    // "https://rezka.ag/films/detective/32580-dostat-nozhi-2019.html",
    // "https://rezka.ag/films/detective/51890-dostat-nozhi-steklyannaya-lukovica-2022.html",
    // "https://rezka.ag/films/action/10762-levsha-2015.html",
    // "https://rezka.ag/films/action/57111-missiya-nevypolnima-smertelnaya-rasplata-chast-pervaya-2023.html",
    // "https://rezka.ag/films/thriller/10803-shpionskiy-most-2015.html",
    // "https://rezka.ag/films/action/703-temnyy-rycar-2008.html",
    // "https://rezka.ag/films/action/67133-dedpul-i-rosomaha-2024.html",
    // "https://rezka.ag/films/action/77796-opustoshenie-2025.html",
    // "https://rezka.ag/films/action/75950-novokain-2025-latest.html",
    // "https://rezka.ag/films/action/76772-master-2025.html",
    // "https://rezka.ag/films/action/1488-chelovek-pauk-2-2004.html",
    // "https://rezka.ag/films/action/1481-chelovek-pauk-2002.html",
    // "https://rezka.ag/films/drama/786-sem-zhizney-2008.html",
    // "https://rezka.ag/films/thriller/264-linkoln-dlya-advokata-2011.html",
    // "https://rezka.ag/films/action/1560-robokop-1987.html",
    // "https://rezka.ag/series/action/46126-dzhek-richer-2022.html#t:111-s:3-e:1",

    // "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:1",
    // "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:2",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:3",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:4",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:5",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:6",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:1-e:7",

    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:1",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:2",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:3",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:4",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:5",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:6",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:7",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:8",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:9",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:10",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:11",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:12",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:2-e:13",

    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:1",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:2",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:3",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:4",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:5",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:6",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:7",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:8",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:9",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:10",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:11",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:12",
    "https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008.html#t:56-s:3-e:13",

    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:1",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:2",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:3",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:4",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:5",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:6",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:7",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:8",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:9",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:10",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:11",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:12",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:13",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:14",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:15",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:16",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:17",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:18",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:19",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:20",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:21",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:22",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:23",
    "https://rezka.ag/series/detective/33272-goryachaya-tochka-2019.html#t:110-s:1-e:24",
];

const errorUrls = [];
let quality = process.argv[2];
let speedLimitMB = process.argv[3];

(async () => {
    quality ??= "1080p";
    speedLimitMB ??= 11;

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