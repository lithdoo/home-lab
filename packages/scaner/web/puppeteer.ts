import puppeteer from 'puppeteer';
import * as cp from 'child_process';
import * as path from 'path';
import fetch from 'node-fetch';
import m3u8ToMp4 from 'm3u8-to-mp4'
const converter = new m3u8ToMp4();

export const downloadM3U8 = async (url: string, filePath: string) => {
    await converter
        .setInputFile(url)  // .m3u8 URL 或本地路径
        .setOutputFile(filePath)  // 输出 MP4 路径
        .start();

    console.log('转换完成');
    await new Promise(res => setTimeout(res, 3000))
}



export const shutdownChrome = () => new Promise(res => {
    // const e = cp.exec('taskkill /F /IM "chrome.exe"')
    // e.on('exit', () => res(null))
})



export const openChrome = () => new Promise(async res => {
    // const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // || puppeteer.executablePath()
    // const cmd = `"${chromePath}" --remote-debugging-port=9222 --user-data-dir="C:\\Temp\\EdgeProfile"`;
    // console.log(cmd);
    // const e = cp.exec(cmd);
    // e.on('exit', () => res(null))
    // return
    return res(true)
})

export const openChrome2 = () => new Promise(async (res) => {
    // await shutdownChrome()
    // const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'  // || puppeteer.executablePath()
    // console.log('Puppeteer 内置 Chromium 路径:', chromePath);
    // const user = path.resolve(__dirname, 'ChromeData') || 'C:\\Temp\\EdgeProfile'
    // const chrome = cp.spawn(
    //     chromePath,
    //     ['--remote-debugging-port=9222', `--user-data-dir=${user}`],
    // );

    // setTimeout(() => { res(null) }, 5000)
    // chrome.on('exit', () => { res(null) })
    return res(true)
})



// 1. 启动浏览器
const browser = puppeteer.launch({
    headless: false, // 有界面模式，设为 true 则无头模式
    defaultViewport: null, // 使用默认视口大小
    args: ['--start-maximized'] // 启动时最大化窗口
});

export const getChromePage = async () => {

    // const version = await fetch('http://127.0.0.1:9222/json/version')
    // const json = await version.text()
    // console.log(json)
    // const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    // const page = await browser.newPage();
    // await page.evaluateOnNewDocument(() => {
    //     Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // });
    // return page



    // 2. 创建新页面
    const page = await (await browser).newPage();
    await waitSec(1)
    return page
}


export const waitSec = async (sec: number) => {
    return new Promise<void>((res) => {
        setTimeout(() => {
            res()
        }, sec * 1000)
    })
}