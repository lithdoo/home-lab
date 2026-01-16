
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { promisify } from 'util';
import { waitSec } from './puppeteer';
import { exec } from 'child_process';
import { dir } from 'console';
import { pipeline } from 'stream';

const mkdirAsync = promisify(fs.mkdir);
const execAsync = promisify(exec);

export interface M3U8Info {
    encryption: {
        method: string;
        keyUri: string;
        iv: string
    } | null
    segmentUrls: string[]
}

/**
 * 获取 URL 内容的辅助函数（支持 http/https）
 */
function fetchContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; M3U8-Downloader/1.0)'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * 下载 URL 内容并流式写入到文件
 * @param urlStr - 要下载的 URL
 * @param filePath - 本地文件路径
 * @returns Promise<void> - 下载完成时 resolve，出错时 reject
 */
function downloadFile(urlStr: string, filePath: string, idx: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {

        if (idx >= 100) {
            reject(new Error(`重试次数超过 100; file:${filePath} url:${urlStr}`))
        } else if (idx > 0) {
            console.log(`重试下载 idx:${idx} file:${filePath} url:${urlStr}`)
        }
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
        const parsedUrl = new URL(urlStr);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        // 创建文件写入流
        const writeStream = fs.createWriteStream(filePath);
        writeStream.on('error', reject);
        writeStream.on('finish', () => resolve()); // 文件写入完成

        const req = client.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            timeout: 1000 * 60 * 1,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; M3U8-Downloader/1.0)'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                writeStream.destroy(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            // 将响应流管道到文件流
            res.pipe(writeStream);
        });

        req.on('error', (err) => {
            writeStream.destroy(err);
            console.warn(err.message)
            resolve(downloadToFile(urlStr, filePath, idx + 1))
        });
        req.end();
    });
}

const streamPipeline = promisify(pipeline);

export async function downloadToFile(urlStr: string, filePath: string, idx: number = 0) {
    if (idx >= 20) {
        throw new Error(`重试次数超过 20; file:${filePath} url:${urlStr}`)
    } else if (idx > 0) {
        console.log(`重试下载 idx:${idx} file:${filePath} url:${urlStr}`)
    }
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
    try {
        const controller = new AbortController();
        const signal = controller.signal;

        const timeout = setTimeout(() => {

        }, 1000 * 60 * 4);


        await Promise.race([
            Promise.resolve()
                .then(async () => {
                    const response = await fetch(urlStr, { signal });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    console.log('http请求成功:', urlStr);
                    // 创建可写流
                    const dest = fs.createWriteStream(filePath);
                    console.log('开始下载文件:', filePath);
                    // 使用管道将响应流传输到文件
                    await streamPipeline(response.body, dest);
                    console.log('文件下载完成:', filePath);
                }),
            
            Promise.resolve()
                .then(async () => {
                    await waitSec(2 * 60)
                    controller.abort()
                    throw new Error(`请求超时：${urlStr}`)
                })
        ])

        clearTimeout(timeout)
    } catch (error) {
        console.error('下载失败:', error);
        return downloadToFile(urlStr, filePath, idx + 1)
    }
}
async function fetchWithTimeout(url, timeoutMs = 5000) {
    const controller = new AbortController();
    const signal = controller.signal;

    // 设置超时：超过 timeoutMs 毫秒后 abort 请求
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, { signal });

        // 清除超时定时器（请求成功，不再需要）
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 示例：读取响应体（文本形式），实际可替换为 .json() 或流处理
        const data = await response.text();
        console.log('响应数据：', data.substring(0, 100) + '...'); // 只打印前100字符

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`请求超时（${timeoutMs}ms）`);
        } else {
            console.error('请求失败：', error.message);
        }
        throw error; // 重新抛出错误，便于上层处理
    }
}


function getSegmentUrls(m3u8Content: string, m3u8Url: string) {

    const segmentUrls: string[] = []
    const baseUrl = new URL(m3u8Url);

    const lines = m3u8Content.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#')) {
            continue; // 跳过注释行
        }
        if (line.indexOf('.ts') >= 0) {
            // 构建绝对 URL
            const absoluteUrl = new URL(line, baseUrl).toString();
            segmentUrls.push(absoluteUrl);
        }
    }

    if (segmentUrls.length == 0) {
        throw new Error('缺少分段信息')
    }
    return segmentUrls
}


export async function downloadM3U8toFile(m3u8Url: string, filename: string = 'C:\\Users\\lithd\\Videos\\temp\\test') {

    const $1 = {
        m3u8Url, filename, downloadDir: filename.replace(/.mp4$/, '')
    }

    if (!fs.existsSync($1.downloadDir)) {
        fs.mkdirSync($1.downloadDir)
    }

    const $2 = {
        ...$1,
        ... await dowloadM3U8File($1.m3u8Url, $1.downloadDir),
        outputFile: $1.downloadDir + '.mp4'
    }

    const $3 = {
        ...$2,
        ... await createLoaclFile($1.m3u8Url, $1.downloadDir, $2.rawfilePath)
    }

    const $4 = {
        ...$3,
        ... await m3u8ToMp4($3.localFilePath, $3.outputFile)
    }

    console.log($4)

    fs.rmSync($4.downloadDir, { recursive: true, force: true })
    // throw new Error()
}

export async function dowloadM3U8File(m3u8Url: string, downloadDir: string) {
    // 获取 m3u8 文件内容
    const rawfilePath = path.resolve(downloadDir, 'raw.m3u8')
    await downloadToFile(m3u8Url, rawfilePath)
    return {
        rawfilePath, m3u8Url, downloadDir
    }
}

export async function createLoaclFile(m3u8Url: string, downloadDir: string, rawfilePath: string) {
    const m3u8Content = fs.readFileSync(rawfilePath).toString()
    let localContent = m3u8Content
    const lines = m3u8Content.split('\n');
    let keyLine: string | undefined;

    for (const line of lines) {
        if (line.trim().startsWith('#EXT-X-KEY:')) {
            keyLine = line;
            break;
        }
    }

    if (keyLine) {
        const params = new URLSearchParams(keyLine.replace('#EXT-X-KEY:', '').split(',').map(p => p.trim()).join('&'));
        const keyUri = params.get('URI') || '';
        const keyPath = path.join(downloadDir, 'crypt.key')
        await downloadToFile(keyUri.replaceAll('"', ''), keyPath)
        localContent = localContent.replace(keyUri, `"${keyPath.replaceAll('\\', '/')}"`)
    }


    try {
        // 创建下载目录（如果不存在）
        await mkdirAsync(downloadDir, { recursive: true });
        const segmentUrls: string[] = getSegmentUrls(m3u8Content, m3u8Url);
        // 下载每个 .ts 段
        for (let i = 0; i < segmentUrls.length; i++) {
            const segmentUrl = segmentUrls[i];
            const fileName = `${i}.ts`;
            const filePath = path.join(downloadDir, fileName);

            console.log(`正在下载: ${fileName} from ${segmentUrl}`);
            await downloadToFile(segmentUrl, filePath)
            console.log(`下载完成: ${fileName} 进度 ${i + 1}/${segmentUrls.length}`);
            localContent = localContent.replace(segmentUrl, filePath.replaceAll('\\', '/'))
            await waitSec(0)
        }

        console.log(`所有切片下载完成，共 ${segmentUrls.length} 个文件。`);
    } catch (error) {
        console.error('下载失败:', error);
        throw error;
    }


    const localFilePath = path.resolve(downloadDir, 'local.m3u8')
    fs.writeFileSync(localFilePath, localContent)

    return {
        localFilePath
    }

}

export async function m3u8ToMp4(localFilePath: string, outputFile: string) {
    const command = `ffmpeg -allowed_extensions ALL -i "${localFilePath}" -c copy "${outputFile}" -y`
    // 执行命令
    const { stdout, stderr } = await execAsync(command);

    // 清理临时列表文件

    if (stderr) {
        console.warn('FFmpeg 警告:', stderr);
    }

    console.log(`合并完成！输出文件: ${outputFile}`);

    return {}
}

/**
 * 
 #EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI="https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/crypt.key?auth_key=1765553755-70-0-076dc7de8af68728efcffb6f6a07d59b",IV=0xa0bb386988148c03ae5b1680b06df178
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b0.ts?auth_key=1765553755-70-0-994ce2ecc851c398231ec229095bdeff
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b1.ts?auth_key=1765553755-70-0-ef4ea4188d902acaeddf835ff5f27467
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b2.ts?auth_key=1765553755-70-0-46488a7f91e7c43e80228162aec37d9b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b3.ts?auth_key=1765553755-70-0-2b249083c7cc33804f813fc7bb565060
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b4.ts?auth_key=1765553755-70-0-c654536bf37862dcc984a2b26b01274d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b5.ts?auth_key=1765553755-70-0-0b15cf7150d48b347a218bad8cf2077c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b6.ts?auth_key=1765553755-70-0-1a76c36301d4950177687a1be6b74165
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b7.ts?auth_key=1765553755-70-0-9e7ab324b37a6b549ea061d3aab76f81
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b8.ts?auth_key=1765553755-70-0-373158d874759eeedaa86ee7fadb4f5d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b9.ts?auth_key=1765553755-70-0-c60c3ba3b0f35b312acd853fa5fb7731
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b10.ts?auth_key=1765553755-70-0-87bdeee47e11b303b901d508d5474656
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b11.ts?auth_key=1765553755-70-0-95f6fbc5994dce15a3db35892aec22a7
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b12.ts?auth_key=1765553755-70-0-68b3a2b362916cf9bc46f523024c0a62
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b13.ts?auth_key=1765553755-70-0-1a6ed43e88cf8aaa9c242d309403da96
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b14.ts?auth_key=1765553755-70-0-bcdcd5eb3b7894395db36c7d7a9d9589
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b15.ts?auth_key=1765553755-70-0-9fa6fcf27ee4035c0c51b8d44f2b6875
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b16.ts?auth_key=1765553755-70-0-08a82e29a81a6a0d85016e9052d60a47
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b17.ts?auth_key=1765553755-70-0-4f7010064f27ee753e890ed5a59adf78
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b18.ts?auth_key=1765553755-70-0-8d1c3194de765ca5da990672cde6a7f7
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b19.ts?auth_key=1765553755-70-0-d40d4b2feeae6e9ee26f5a3591a78a7f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b20.ts?auth_key=1765553755-70-0-9ea0c64da08b4131a1ceb115e06885db
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b21.ts?auth_key=1765553755-70-0-20ef8c33d7425f218ffcd569b13ff398
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b22.ts?auth_key=1765553755-70-0-d1c3a49c28bbc3be1372ce4ea1d0915d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b23.ts?auth_key=1765553755-70-0-b915b4df8e33bf0aff95c991b87bb60d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b24.ts?auth_key=1765553755-70-0-1804751ffe112e4175f0d3028eb809ec
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b25.ts?auth_key=1765553755-70-0-5812196c99990c56c36924a57edddeba
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b26.ts?auth_key=1765553755-70-0-4ef7782937d3122b119fe37fb6f07f33
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b27.ts?auth_key=1765553755-70-0-d188572aa55c29330bb60c057a89504e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b28.ts?auth_key=1765553755-70-0-c9a1bcb2605c1e78b24663033a31a191
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b29.ts?auth_key=1765553755-70-0-39de3db35ae784f72c5ace29d0806ecd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b30.ts?auth_key=1765553755-70-0-0537b6c385afc7713ef8ec4a2d265991
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b31.ts?auth_key=1765553755-70-0-bd08b1253bdd66717461fefbfae91c19
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b32.ts?auth_key=1765553755-70-0-2e96ef79ff7daf5d7f00097115cd1692
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b33.ts?auth_key=1765553755-70-0-4223b854b59ad67a4a99bde82d308b4d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b34.ts?auth_key=1765553755-70-0-5888f77d5adce83913e987e96a9dc4a8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b35.ts?auth_key=1765553755-70-0-d26d2d72b59639fe6a2533b41f354592
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b36.ts?auth_key=1765553755-70-0-f41493555a7be8d4e27730d2d4eb64b8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b37.ts?auth_key=1765553755-70-0-7e3b6cbbaf3b48181c0db43af7b22abf
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b38.ts?auth_key=1765553755-70-0-e579bd6fb9a998c9117637fbd2dae1b2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b39.ts?auth_key=1765553755-70-0-7ccda3b17831e10cfd5b13fddb9371b2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b40.ts?auth_key=1765553755-70-0-3222ac4f40749596d9e5ac29f865489f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b41.ts?auth_key=1765553755-70-0-7f335968e2ec23fd956bf46765ef0eb1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b42.ts?auth_key=1765553755-70-0-3c0c33c8f722eb02ae8277c5e024275b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b43.ts?auth_key=1765553755-70-0-f7b4b1b226018c086ed75b63b8ef4b90
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b44.ts?auth_key=1765553755-70-0-9c272539aa1cfaa7f1b6d49202f0448a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b45.ts?auth_key=1765553755-70-0-d1b2cea8dc0bf1625426e7bf065e8921
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b46.ts?auth_key=1765553755-70-0-15e51de478e36f41bd938ae7211811be
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b47.ts?auth_key=1765553755-70-0-eb4a5feeb5d6267a08d16a502a8d60e9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b48.ts?auth_key=1765553755-70-0-44526854142a1fe762c9e415cdf48a03
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b49.ts?auth_key=1765553755-70-0-35be3de3aa45a4a022977b00346f166b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b50.ts?auth_key=1765553755-70-0-8a3279bb745d95be993f9785dc62b73c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b51.ts?auth_key=1765553755-70-0-a3db35edf0228d571e9600ea24a03a37
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b52.ts?auth_key=1765553755-70-0-0541fb76128a968e9f0bc72920e69bb0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b53.ts?auth_key=1765553755-70-0-46f42ba42e3a78425f37b71b7ff4974f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b54.ts?auth_key=1765553755-70-0-0a0397d0b63226c9b1f8ae40d62c699e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b55.ts?auth_key=1765553755-70-0-281b58283e787a86cf08c4fdf71cb5f1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b56.ts?auth_key=1765553755-70-0-5e39b399ec4b00595448b2503720463f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b57.ts?auth_key=1765553755-70-0-40291a194b731879e64693fac5bc8ebd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b58.ts?auth_key=1765553755-70-0-cb9afcb71b287ef4ef64b4c2b87e5946
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b59.ts?auth_key=1765553755-70-0-9cc911d1dd67934d85f7064a87602586
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b60.ts?auth_key=1765553755-70-0-5720b0614f69e565f51a6922db8e963a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b61.ts?auth_key=1765553755-70-0-bce6317e0d30bb9f67da4faaf628ec36
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b62.ts?auth_key=1765553755-70-0-0175a6b75d45970b6751965d88919909
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b63.ts?auth_key=1765553755-70-0-502bf28be63443671dded1468a09e255
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b64.ts?auth_key=1765553755-70-0-6eda608b3082245bded8c5908a64c89f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b65.ts?auth_key=1765553755-70-0-c2f2feafc19cc4259219ba15ef8c97a5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b66.ts?auth_key=1765553755-70-0-5b1242e28493c5a78dcb8eb100243c75
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b67.ts?auth_key=1765553755-70-0-92221997fcc8ccf3b7d0209c34760410
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b68.ts?auth_key=1765553755-70-0-16df5dbd9c68d1e4fc2a4d96293bab9b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b69.ts?auth_key=1765553755-70-0-2cf4b8f05b51e79f310a2768148be433
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b70.ts?auth_key=1765553755-70-0-840a1d21469eef7860c4d808765e4d8e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b71.ts?auth_key=1765553755-70-0-a8dd6dc21c3650645d94fd1520671069
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b72.ts?auth_key=1765553755-70-0-8ad4e2ab6e0760d2f950ca2d92db6f4a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b73.ts?auth_key=1765553755-70-0-4359db76a751934b6e80ce53b86398a2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b74.ts?auth_key=1765553755-70-0-d930db6dc6a1d2dcce51127395c1e680
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b75.ts?auth_key=1765553755-70-0-236661160028bf8f0b2949bd38c37f86
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b76.ts?auth_key=1765553755-70-0-7f3cf81d811883302c9fb9d839f34b65
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b77.ts?auth_key=1765553755-70-0-85a3e40d6f26a7afd4605034d917db79
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b78.ts?auth_key=1765553755-70-0-b65471b1ead9a3b5c21c1d5fb5c2f419
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b79.ts?auth_key=1765553755-70-0-f5b29fca61fccd76d27da1f2b1d1c4a4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b80.ts?auth_key=1765553755-70-0-bbc53fc6e1b424f7ae643c6d34aa251e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b81.ts?auth_key=1765553755-70-0-a37c1e3eefc7d63ec38f6327840c8f33
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b82.ts?auth_key=1765553755-70-0-03686a46f7377f0e2ea831983a1c0368
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b83.ts?auth_key=1765553755-70-0-f6734b32e112d94802f21bd975953ff1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b84.ts?auth_key=1765553755-70-0-ff30457f716594ea188e7438821febfe
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b85.ts?auth_key=1765553755-70-0-cdf43f68bb69c3eaf3f2778faeca5441
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b86.ts?auth_key=1765553755-70-0-ba15c36f53e9bfcc9843c0b0610bd7ca
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b87.ts?auth_key=1765553755-70-0-61a478ad2da8b48fef5526d41f730eb0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b88.ts?auth_key=1765553755-70-0-a7edb1e48506a219bc4d761e42c6635a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b89.ts?auth_key=1765553755-70-0-9613aa3ebe69c0e90fee56db540faced
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b90.ts?auth_key=1765553755-70-0-70385816a91058b8e9a67d49c11498b8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b91.ts?auth_key=1765553755-70-0-9bf810fc27f66046668dc2b8c8b7a603
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b92.ts?auth_key=1765553755-70-0-c73a0a220a2d17669edada497a47c62f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b93.ts?auth_key=1765553755-70-0-1a46eb3506bc592635d367367fb01282
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b94.ts?auth_key=1765553755-70-0-566c43bdb490d1fe4b1fe94fab3e0978
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b95.ts?auth_key=1765553755-70-0-9e612eb7d6db8b5cef92437fcbf6e074
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b96.ts?auth_key=1765553755-70-0-790ab2abee85a60949e515ed58c55c3d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b97.ts?auth_key=1765553755-70-0-ddea7b6d0ed1525b29c913e737b3d628
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b98.ts?auth_key=1765553755-70-0-d62374eda036375872385e3f80bacb1a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b99.ts?auth_key=1765553755-70-0-c32dcbe66e637f23d1e7f082fd3410dd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b100.ts?auth_key=1765553755-70-0-cd2f69936f3256c85e50d8a45aad7a87
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b101.ts?auth_key=1765553755-70-0-cba4e10918edf25389874acc9bf13f86
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b102.ts?auth_key=1765553755-70-0-5f3a27c069ab306faad9628977672c40
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b103.ts?auth_key=1765553755-70-0-55ff4775dc4aacdd670de53e992aa22c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b104.ts?auth_key=1765553755-70-0-0cf00fc6771240a32d1d52c66bfe3132
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b105.ts?auth_key=1765553755-70-0-3277a6e1b3d0306bc57f9f93a5336443
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b106.ts?auth_key=1765553755-70-0-186fe419484aafca323970a60c1fa28c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b107.ts?auth_key=1765553755-70-0-20a70da5f817cd0a4f81703860f3ead9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b108.ts?auth_key=1765553755-70-0-f8c627c2a9ba6cf6c05f37feaa6c089f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b109.ts?auth_key=1765553755-70-0-5c426998346c095eb680907d6865fd46
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b110.ts?auth_key=1765553755-70-0-f7f52afbe88662a65f7fe2be54abfec9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b111.ts?auth_key=1765553755-70-0-dfc148a1f3a9c7bea5627b12011b5af9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b112.ts?auth_key=1765553755-70-0-81854c5a44578cd94fd5236698eb268a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b113.ts?auth_key=1765553755-70-0-abaf3b37d55d60359241ccf97ef99570
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b114.ts?auth_key=1765553755-70-0-58e14787e4f4b8ff6092b15ade97a000
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b115.ts?auth_key=1765553755-70-0-e244174fd781b44e8077505e3681fac4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b116.ts?auth_key=1765553755-70-0-531aef4478d75e3ce619c58aa9d29955
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b117.ts?auth_key=1765553755-70-0-950a9dd6073f20e0d9363f928f49d59c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b118.ts?auth_key=1765553755-70-0-06209caf29e8428db08400b888b5af6e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b119.ts?auth_key=1765553755-70-0-8b4a9a3527377a2b3138647020b29832
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b120.ts?auth_key=1765553755-70-0-f4fddc25a3cacb3adb48a8c9a1cb8b2b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b121.ts?auth_key=1765553755-70-0-c64dc9f4deedaeeee3b2e8aec42b41e5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b122.ts?auth_key=1765553755-70-0-234a41f73d5eb2628bab294b59db3342
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b123.ts?auth_key=1765553755-70-0-23a7280ac1528ec5cab4a106efb34fa9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b124.ts?auth_key=1765553755-70-0-516afeb0106dbbfd3698aa694309f3d6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b125.ts?auth_key=1765553755-70-0-00dfd4a12887ecb3be50a5c28444aaec
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b126.ts?auth_key=1765553755-70-0-4e3e9eedff0efb4b6552ed646d3a27fd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b127.ts?auth_key=1765553755-70-0-1679c8bb63aeed30cf2c58e774fa9e40
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b128.ts?auth_key=1765553755-70-0-87d810e2f53f13f5aa758cb085e7e76c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b129.ts?auth_key=1765553755-70-0-126c613417f242c75f3da7e386a521bc
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b130.ts?auth_key=1765553755-70-0-705b2d2dee1c7642a4064527d3960a6d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b131.ts?auth_key=1765553755-70-0-06c7fd07d06e78f85d367d35652b428c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b132.ts?auth_key=1765553755-70-0-747bcc38cad407d160a73cf8c627d987
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b133.ts?auth_key=1765553755-70-0-d5b4f77dafe9d38551809980929dbf91
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b134.ts?auth_key=1765553755-70-0-bdb2403ba54162d90ecf5cb05b133ea9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b135.ts?auth_key=1765553755-70-0-699c6858d4858e62d018c6b66a7b6820
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b136.ts?auth_key=1765553755-70-0-f276275145670fecdb6b7b46a2664cc7
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b137.ts?auth_key=1765553755-70-0-05ff7a7942ed69589a7025e72f2dddfa
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b138.ts?auth_key=1765553755-70-0-4b40818154446713d4eb434d1338a4c5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b139.ts?auth_key=1765553755-70-0-6e523d5cb2b54771c377bacb1b5ad166
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b140.ts?auth_key=1765553755-70-0-3a0fd72ce8513c6ef47dde268e676075
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b141.ts?auth_key=1765553755-70-0-e1d89cb95cec83bc835e1046278118e2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b142.ts?auth_key=1765553755-70-0-784fe3e96b5082b8278e119023aadb53
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b143.ts?auth_key=1765553755-70-0-d1857667545cfd620dfc349adfe89629
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b144.ts?auth_key=1765553755-70-0-05e1943b4de0148784097e456a29aa91
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b145.ts?auth_key=1765553755-70-0-aa6937e7481b9e33344757ff0a917766
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b146.ts?auth_key=1765553755-70-0-e1a9862ecc8fdaf5bb212dae59a57987
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b147.ts?auth_key=1765553755-70-0-c783e8f8922742cb91c82752f5f2de53
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b148.ts?auth_key=1765553755-70-0-3ff9db29989535da8b00720492a1dac8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b149.ts?auth_key=1765553755-70-0-1ffdd7f92f0e57edebde2e9426d360a4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b150.ts?auth_key=1765553755-70-0-f9375c6cefc34ee3e7e3a914d3b97598
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b151.ts?auth_key=1765553755-70-0-3855a0b43f72959819476279a23014ae
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b152.ts?auth_key=1765553755-70-0-e54da45b26b70bf762a4ec2447825bf5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b153.ts?auth_key=1765553755-70-0-7bfdcbc8b605302908a97d6bd0d9c316
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b154.ts?auth_key=1765553755-70-0-6ccda9e3cc1e9c87bfb0a3a4e7f013bb
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b155.ts?auth_key=1765553755-70-0-dd1a144fe9f70643a2aa0e77d698b8dc
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b156.ts?auth_key=1765553755-70-0-8cff51af912e94989f2bee76566aa0a1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b157.ts?auth_key=1765553755-70-0-8572be7621ac62ee374582633971bb54
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b158.ts?auth_key=1765553755-70-0-4c58c318db19a16fb6da3eb30783e821
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b159.ts?auth_key=1765553755-70-0-cfaf60fcc78abfa823996520baa03e25
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b160.ts?auth_key=1765553755-70-0-b01e647ddbde77ea7892f319408f3ab8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b161.ts?auth_key=1765553755-70-0-629de8e5f5c17c10fe3a165b17c29e29
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b162.ts?auth_key=1765553755-70-0-f6468a2dc967a2d88163aa407704cabd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b163.ts?auth_key=1765553755-70-0-a8b4719c6a7ebeb0fca9ed68446a5379
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b164.ts?auth_key=1765553755-70-0-586b161577995b50329abeb4c781e89d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b165.ts?auth_key=1765553755-70-0-6e99dd26e7b39eed56ed4145cf26bed2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b166.ts?auth_key=1765553755-70-0-75cdc023c71486de0a38344466b60109
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b167.ts?auth_key=1765553755-70-0-fcb1498c9bc8e130d9dfacd7aadb3cf3
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b168.ts?auth_key=1765553755-70-0-47220652f663c69ac6dabde5acea7f14
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b169.ts?auth_key=1765553755-70-0-896b2c14a47856d5048a2aed8c6d41de
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b170.ts?auth_key=1765553755-70-0-55c5461fe90554bdc762d8a34aa50b97
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b171.ts?auth_key=1765553755-70-0-08e39ac339eccba39c5c111763cb7491
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b172.ts?auth_key=1765553755-70-0-804d56902dfc7b9193fa51ac1f5ba344
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b173.ts?auth_key=1765553755-70-0-0759ebe46ee703ef0b3b454c5d7360b5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b174.ts?auth_key=1765553755-70-0-55cd63bff845fa6e5bf9a00fa3006136
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b175.ts?auth_key=1765553755-70-0-5f6c7c3ecbd766f748a18cf31cebfcf4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b176.ts?auth_key=1765553755-70-0-e4f7707ac3aac116b6f1c9a80ab1c24f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b177.ts?auth_key=1765553755-70-0-9e0d8c3f18ef00d325857e24f0295baa
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b178.ts?auth_key=1765553755-70-0-293c13a898314656d4470c00ed59a8f3
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b179.ts?auth_key=1765553755-70-0-6f7007354de87da48e77c6b75f36036e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b180.ts?auth_key=1765553755-70-0-2c01d5ad370eab027a0f5cd01c142f35
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b181.ts?auth_key=1765553755-70-0-ec569cebc534aac02ff116f24efc940d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b182.ts?auth_key=1765553755-70-0-2fe8086ff71958074efdb1cb06dc17f2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b183.ts?auth_key=1765553755-70-0-9827ebf440e34097388e0616aace975c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b184.ts?auth_key=1765553755-70-0-7b24c301136b97cf912f7541323914d0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b185.ts?auth_key=1765553755-70-0-17a842376c44854afaab8b17bcbb1f18
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b186.ts?auth_key=1765553755-70-0-831b172b929c079050908fbe81463627
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b187.ts?auth_key=1765553755-70-0-bdd11b12cfaa18ea593b752994ca6a2d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b188.ts?auth_key=1765553755-70-0-832e496c6528d56d87a1ccb86b9a1c54
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b189.ts?auth_key=1765553755-70-0-212cc6f549144aed800eb69a044098e0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b190.ts?auth_key=1765553755-70-0-2997f1de6c034f91396d7e1eb5a07070
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b191.ts?auth_key=1765553755-70-0-cd781b89bf8c6f0f777fc5156741800b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b192.ts?auth_key=1765553755-70-0-4ef76ddc948f8b140c4ce38c607aed8a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b193.ts?auth_key=1765553755-70-0-8d24c2cd5e274f39e72d0fe54598c1ed
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b194.ts?auth_key=1765553755-70-0-cfe8b08d9c58ed132ce968e51b09b5d1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b195.ts?auth_key=1765553755-70-0-633e1803c49e2902d7fb8317ea098b09
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b196.ts?auth_key=1765553755-70-0-8f32fb477d537bb69a981914a1cf20d0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b197.ts?auth_key=1765553755-70-0-f0c5dab4c768cdf011a9186b1acf693d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b198.ts?auth_key=1765553755-70-0-97695c77521fd1d3f19dec03b910a3d0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b199.ts?auth_key=1765553755-70-0-2ecd7bffb629dd8e79793f0e516bf6ce
#EXTINF:4.004,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b200.ts?auth_key=1765553755-70-0-b60f29aa18a947ceaead1618228f8ab4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b201.ts?auth_key=1765553755-70-0-1abfb701b7ab97ed27580ef34b8b0b69
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b202.ts?auth_key=1765553755-70-0-b337bc16dd46effa8e811a3e309e3d74
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b203.ts?auth_key=1765553755-70-0-c05ae85e7951a4041859fe5c4c023c2e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b204.ts?auth_key=1765553755-70-0-f8c4f81c0b424ac1ad4546961f0e8c1f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b205.ts?auth_key=1765553755-70-0-23dab399ed529451dc52a1f2a27f452d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b206.ts?auth_key=1765553755-70-0-d34052738476a682b425127b5543fa14
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b207.ts?auth_key=1765553755-70-0-3fdaba2b2d9bea8a88eebd1508ae3ca0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b208.ts?auth_key=1765553755-70-0-cbba7bcd1cb8be803bfaaec150607a46
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b209.ts?auth_key=1765553755-70-0-34a10339ff721cb0140be8354f9b7148
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b210.ts?auth_key=1765553755-70-0-becde405d7b6ef8f0e90ec377885ddee
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b211.ts?auth_key=1765553755-70-0-d42e1102af76aa9c59297648dd71abb4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b212.ts?auth_key=1765553755-70-0-a5bfc461a56035bcef0c8a3c03652e57
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b213.ts?auth_key=1765553755-70-0-a770a081c7179db45eca9c3c302dbf06
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b214.ts?auth_key=1765553755-70-0-078c7e00d43858cabec8b913c307e97a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b215.ts?auth_key=1765553755-70-0-cf8adbfd776433b2d651112c32208d99
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b216.ts?auth_key=1765553755-70-0-8cf3dc16ec8378df1d366a22f4831727
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b217.ts?auth_key=1765553755-70-0-fed850f5dde9beb1a365732a5875bc90
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b218.ts?auth_key=1765553755-70-0-28b10f0614155ace2b716d885e186987
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b219.ts?auth_key=1765553755-70-0-2fac1281fbd549956496d2d44f46e425
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b220.ts?auth_key=1765553755-70-0-d309c8025b4c376cbbcf9290368bec76
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b221.ts?auth_key=1765553755-70-0-a78e3b69719a39cf60495b5573fa7b5c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b222.ts?auth_key=1765553755-70-0-0fca9b2c431efcda5c9a0cfc91fe5846
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b223.ts?auth_key=1765553755-70-0-417f497c962781a37ccc64386c7064ac
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b224.ts?auth_key=1765553755-70-0-555e8c68c4d5e7a46b7f478905743a41
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b225.ts?auth_key=1765553755-70-0-5cea68d272ce8843889825865347bf3c
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b226.ts?auth_key=1765553755-70-0-cd2ae4a94bfae1e26d5a6fb012a7f7c9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b227.ts?auth_key=1765553755-70-0-1281b39535119176503d10f39f94d3a4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b228.ts?auth_key=1765553755-70-0-25cbcededbd48689da41315a4d4b06ca
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b229.ts?auth_key=1765553755-70-0-824b2c8552c01546d31653d6c04ac266
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b230.ts?auth_key=1765553755-70-0-279309a825b9e86c9084a5a9b34f5ded
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b231.ts?auth_key=1765553755-70-0-fa1e2b0a62d631a52989b31a88603bf5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b232.ts?auth_key=1765553755-70-0-ad28970e49fd6377bbd315dfb9f68721
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b233.ts?auth_key=1765553755-70-0-e6336b70fa5f054a5c27012505071f1a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b234.ts?auth_key=1765553755-70-0-1c2f41911b5a10f1376d3f4695fa0d89
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b235.ts?auth_key=1765553755-70-0-cf8b9411ea690b5820a649ec7586bcb8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b236.ts?auth_key=1765553755-70-0-128a9832f9209f365ea57b89b564cf33
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b237.ts?auth_key=1765553755-70-0-ce21b6b063b20f8f84e28b178cb58c74
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b238.ts?auth_key=1765553755-70-0-c0b670681e7cd7a3acb72d608234470d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b239.ts?auth_key=1765553755-70-0-72a9bf73d33d90977c6a73f84ed06002
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b240.ts?auth_key=1765553755-70-0-75b57a361ce26fbd68c87625cc15c15a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b241.ts?auth_key=1765553755-70-0-f3c0aba374aed85b7dc61bb4481e72b2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b242.ts?auth_key=1765553755-70-0-9d6ff063831561dec3e9d1ca99d6f007
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b243.ts?auth_key=1765553755-70-0-c6f62d8b72e338c0dbff4e50b536e523
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b244.ts?auth_key=1765553755-70-0-de5992445931ae6f36ffff008016d6b4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b245.ts?auth_key=1765553755-70-0-14876ed9101a74592dc70788d0bdf6ca
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b246.ts?auth_key=1765553755-70-0-26f4020005e1ace3cf890c4ac0f04d47
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b247.ts?auth_key=1765553755-70-0-dbcea6526252f9ce0b8f019d615594d5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b248.ts?auth_key=1765553755-70-0-d1f143a584bb138d169183a63df468c9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b249.ts?auth_key=1765553755-70-0-871619a97705ff818d16713ee0987dca
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b250.ts?auth_key=1765553755-70-0-5f30b722b21c61ff5c105d6d9364f6fe
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b251.ts?auth_key=1765553755-70-0-fd49467c01a4fd0f356fa625a1fe9766
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b252.ts?auth_key=1765553755-70-0-d45455afec4079b6ee22d2f00ad3b221
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b253.ts?auth_key=1765553755-70-0-6e4141cc59fa2509d1a08c005190bc55
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b254.ts?auth_key=1765553755-70-0-5d72b5a87ef3916379fec05bef74daac
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b255.ts?auth_key=1765553755-70-0-34d656ff47249427a92fb7e8ef87d644
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b256.ts?auth_key=1765553755-70-0-127fa6d33611ea3f1139413077d4e855
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b257.ts?auth_key=1765553755-70-0-a2d9ead38a5346ea1eb02fe02027a9d5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b258.ts?auth_key=1765553755-70-0-755aa3b070fe3dc9dc00073e6bf1cad2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b259.ts?auth_key=1765553755-70-0-c233e0b920ad47c43e996b07f3921187
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b260.ts?auth_key=1765553755-70-0-2d4f6fe0548e28de39908493be4f22a0
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b261.ts?auth_key=1765553755-70-0-1377e98aa126eb2527088e5b728a8709
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b262.ts?auth_key=1765553755-70-0-d0f1b5798a65798e918e771b577616fd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b263.ts?auth_key=1765553755-70-0-b1cacca9db27c20c1a71f0e3c9713aaf
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b264.ts?auth_key=1765553755-70-0-0e318815f03f0b492d5e27ab2be8eaba
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b265.ts?auth_key=1765553755-70-0-d31e17c83ed74b21845a560abe16e8cd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b266.ts?auth_key=1765553755-70-0-e33fa507e9f585816f9adccd29163160
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b267.ts?auth_key=1765553755-70-0-9a8de7407ee87c94d38902610721a3ec
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b268.ts?auth_key=1765553755-70-0-f27003ff75cd23fcd8e1aa8fee2d8721
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b269.ts?auth_key=1765553755-70-0-f1861f37524b025930319bf51e805b32
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b270.ts?auth_key=1765553755-70-0-1d87d791505026b17c1d8b84fef23858
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b271.ts?auth_key=1765553755-70-0-fef38959e24686512cafe1683e3b778f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b272.ts?auth_key=1765553755-70-0-b3109712e8bb2fa1f7327fd340dba3a1
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b273.ts?auth_key=1765553755-70-0-2476106a31dd6e95939467e196c2e0c6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b274.ts?auth_key=1765553755-70-0-ff994b8a22583355f6b1d6b46ea94b70
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b275.ts?auth_key=1765553755-70-0-bcadbf618698eca2a64528a6ef210759
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b276.ts?auth_key=1765553755-70-0-766851925238fc44be2de5cd5e2b0ed2
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b277.ts?auth_key=1765553755-70-0-db2cdffb83a41c55fe45795b366fc5aa
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b278.ts?auth_key=1765553755-70-0-200367c5cc5816469127d8adfe3f1b18
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b279.ts?auth_key=1765553755-70-0-7e89fd12602f708fd21bc5f358981d26
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b280.ts?auth_key=1765553755-70-0-9a15ae42471c679c21db6d103c549d88
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b281.ts?auth_key=1765553755-70-0-6f0cf388def563ca6534753dbfa43c48
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b282.ts?auth_key=1765553755-70-0-9d3e4ac23969847e78d460e2c4525cda
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b283.ts?auth_key=1765553755-70-0-1976c7d2079de62ea4805051d2650813
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b284.ts?auth_key=1765553755-70-0-b8a493da042f76e5f59587eee9e6f609
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b285.ts?auth_key=1765553755-70-0-25cd141f6daa9d8589fd36a6a060447b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b286.ts?auth_key=1765553755-70-0-bade77e3a6adf9d3401079f3238adbbc
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b287.ts?auth_key=1765553755-70-0-61a34bcd3f9d9af4577af8b12811e08b
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b288.ts?auth_key=1765553755-70-0-9a97125f6e12f87650769feab9399aea
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b289.ts?auth_key=1765553755-70-0-d96d9cc36946d67d27dcc63a76e09437
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b290.ts?auth_key=1765553755-70-0-cd03fc167d4983666c80b8fd4adc7982
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b291.ts?auth_key=1765553755-70-0-22558c819c2e35d3ea0028e366baa76d
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b292.ts?auth_key=1765553755-70-0-871d80decb0e5f8dc8eba786f8afbcae
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b293.ts?auth_key=1765553755-70-0-20bdb6d9e7215e0fac14d9d58f3091ce
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b294.ts?auth_key=1765553755-70-0-bd50890b8c51784a3ee4108351ac8ac8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b295.ts?auth_key=1765553755-70-0-efc21b3b38f5232898343f7b8f77c742
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b296.ts?auth_key=1765553755-70-0-a7c347f6c2fc9b4afaeb40137da2629a
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b297.ts?auth_key=1765553755-70-0-82383b449c3cad7a0c57ebd1b336c9eb
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b298.ts?auth_key=1765553755-70-0-b49267431d9098c6550060e984ed97c9
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b299.ts?auth_key=1765553755-70-0-bdb1559ed4b034c1b09b7a75c12633f5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b300.ts?auth_key=1765553755-70-0-49b74c7bf14ca77ce225e9b497a0d16e
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b301.ts?auth_key=1765553755-70-0-d59fc08efe368a773abea7ba3027f498
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b302.ts?auth_key=1765553755-70-0-313e4b129b941395851c8279a58e51a6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b303.ts?auth_key=1765553755-70-0-6755985ee26d9d7cba19f37b45c6fb17
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b304.ts?auth_key=1765553755-70-0-c7589c121a6eb293f0d3081689768230
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b305.ts?auth_key=1765553755-70-0-104555c607d15c06d02e4efc32cbc6c8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b306.ts?auth_key=1765553755-70-0-69134039dae0951e3681a641a3b1a662
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b307.ts?auth_key=1765553755-70-0-2d006d6ac31563515a80e712ce8eecb5
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b308.ts?auth_key=1765553755-70-0-bdaf29eddaba17939ff6520d7ef98ec6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b309.ts?auth_key=1765553755-70-0-53dbaadbfac01922346736b03d177af4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b310.ts?auth_key=1765553755-70-0-5e2e0030d1c4e99184744389b27d36a6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b311.ts?auth_key=1765553755-70-0-2e8ad5a678244754b464eee2d65df374
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b312.ts?auth_key=1765553755-70-0-b22f7d20ee97dace96605b2f9217dddf
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b313.ts?auth_key=1765553755-70-0-94e6dbd67059d28015581560b74ea425
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b314.ts?auth_key=1765553755-70-0-73a85a92ca206bc42c06de9aefaf49a6
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b315.ts?auth_key=1765553755-70-0-60bbee568850f8f436a0de97dac37dc7
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b316.ts?auth_key=1765553755-70-0-37e25a9b19eb69a91143ce0e0d76002f
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b317.ts?auth_key=1765553755-70-0-cdb7bfa25505361b7a1a522465509fdd
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b318.ts?auth_key=1765553755-70-0-7e08a234cef763e91aaeafab8c2128c8
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b319.ts?auth_key=1765553755-70-0-035ddcab60fcf15a371499874eaa9dc4
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b320.ts?auth_key=1765553755-70-0-e44760c26a964f17b83e4e54a3b7dabe
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b321.ts?auth_key=1765553755-70-0-683833dfd5094456e80c10b1ed14f3c7
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b322.ts?auth_key=1765553755-70-0-22ec26b959564d0c573c2476994d6174
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b323.ts?auth_key=1765553755-70-0-a4c3f6a75a023232d416a10aa28af394
#EXTINF:5.005,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b324.ts?auth_key=1765553755-70-0-77fa9dcc98920dab1612581b9d562851
#EXTINF:3.670,
https://tp1.delipu.cc/videos5/d2e154cf745f01f61526884ac10ae63b/d2e154cf745f01f61526884ac10ae63b325.ts?auth_key=1765553755-70-0-35c0ebb48913f6282b959222fa04b5a3
#EXT-X-ENDLIST
 */