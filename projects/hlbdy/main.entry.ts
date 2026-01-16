
import { getBody, WebPageScaner } from '@pkg/scaner/web'
import { downloadM3U8toFile } from '@pkg/scaner/web/m3u8.utils'
import { downloadM3U8, waitSec } from '@pkg/scaner/web/puppeteer'
import { kMaxLength } from 'node:buffer'
// import { downloadM3U80 } from '@pkg/scaner/web/puppeteer'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

const scaner = new WebPageScaner()


function sanitizeFilename(
    filename: string,
    replacement: string = '',
    maxLength: number = 255
): string {
    if (!filename || typeof filename !== 'string') {
        return 'unnamed';
    }
    // 定义不允许的字符正则（覆盖常见 OS 限制：路径分隔符、通配符、控制字符等）
    const invalidCharsRegex = /[<>:"/\\|?*\x00-\x1F]/g;

    // 替换无效字符
    let sanitized = filename.replace(invalidCharsRegex, replacement);

    // 限制长度
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // 如果结果为空，返回默认名
    return sanitized.replaceAll(' ', '') || 'unnamed';
}

const main = async () => {

    const doneFile = path.resolve(__dirname, '.temp/done.jsonl')
    const doneSet = new Set<string>()
    const saveDone = (link: string, files: string[]) => {
        doneSet.add(link)
        writeFileSync(doneFile, JSON.stringify({ link, files }) + '\n', { flag: 'a' })
        console.log(`page done: ${link} in idx ${i}`)
    }
    readFileSync(doneFile).toString().split('\n')
        .map(v => v.trim())
        .filter(v => !!v)
        .map(v => {
            try {
                return JSON.parse(v)
            } catch (e) {
                console.log(v)
                throw e
            }
        })
        .forEach(({ link }) => {
            doneSet.add(link)
        })

    let i = 0
    while (i < 100) {
        i = i + 1
        // const paggUrl = i === 1
        //     ? 'https://cake.tdbzzsmy.com/'
        //     : `https://cake.tdbzzsmy.com/page/${i}`

        const hostname = 
            // 'cake.mmybmwvv.cc' 
            // 'analyst.poggqlw.cc'
            'cake.tdbzzsmy.com/'
        const paggUrl = i === 1
            ? `https://${hostname}/category/xyrg/`
            : `https://${hostname}/category/xyrg/${i}/`


        console.log(paggUrl)
        const html = await scaner.read(
            paggUrl, 'div.container article a'
        )

        const body = getBody()
        body.innerHTML = html
        const list = body.querySelectorAll('div.container article a');
        const links = [...list].map(ele => {
            return {
                ele,
                header: ele.querySelector('.post-card-container h2.post-card-title')
            }
        })
            .filter(v => {
                return !!v.header
            })
            .map(v => {
                console.log((v.ele as HTMLAnchorElement).href)
                return {
                    link: (v.ele as HTMLAnchorElement).href,
                    title: v.header.textContent.trim()
                }
            })
            .filter(v => !!v.title)

        await links.reduce(async (res, link) => {

            try{
                await res
            }catch(e){
                console.error(e.message)
            }

            if (doneSet.has(link.link)) return

            const title = link.title

            const req = await scaner.request(
                URL.parse(paggUrl).origin + link.link,

                {
                    filter: (url) => url.toLocaleLowerCase().includes('.m3u8'),
                    timeout: () => new Promise(res => setTimeout(res, 10000)),
                },
                'div#post[role="main"]'
            )

            const files: string[] = []

            await [...new Set(req.map(v => v.url()))].reduce(async (res, v) => {
                await res
                let i = 0
                let filePath = () => path.resolve(__dirname, `.temp/video/${sanitizeFilename(title)}.${i}.mp4`)
                // let filePath = () => path.resolve('C:\\Users\\lithd\\Videos\\temp', `${sanitizeFilename(title)}.${i}.mp4`)
                while (existsSync(filePath())) {
                    i = i + 1
                }
                console.log(`start file: ${sanitizeFilename(title)}.${i}.mp4`)
                console.log(`start url: ${v}`)
                // await downloadM3U80(v, filePath())
                await downloadM3U8toFile(v, filePath())
                files.push(filePath())
            }, Promise.resolve())

            await waitSec(10)
            saveDone(link.link, files)

        }, Promise.resolve())

    }




}


main()