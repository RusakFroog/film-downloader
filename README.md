# Film downloader
### Script written in JS (Node.js) that downloads movies by URLs from website **REZKA-HD** (all versions of REZKA)

---

## 📋 Requirements
#### Make sure you have **Node.js** installed on your computer.

---

## 🚀 Usage
#### First, clone the repository and navigate to the `film-downloader` directory:

#### Type next command in any terminals.
``` bash
cd path-to-downloaded-files/.../film-downloader
npm install
```

---
#### Open file `./src/index.js` in any text editor and add the URLs for the movies you wish to download in the array `urls`, separating each elements with a comma (___see example in the code___)
---

## After type next command
#### This script shall start your download process (by default with quality: 1080p and speed limit: 7 MB/s)
```bash
npm run start
```
#### This script shall start your download process with quality: 720p and speed limit: 10 MB/s
```bash
# Start with quality: 720p and speed limit: 10 MB/s
npm run start 720p 10
```

# 🎉 Happy downloading ;)