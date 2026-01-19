import { getBody, WebPageScaner } from '@pkg/scaner/web'
import { sleep } from 'bun'
import * as fs from 'fs'
import * as path from 'path'

const body = getBody()
const scaner = new WebPageScaner()

const OBJ_VIDEO_PAGE_DIR = path.join(__dirname, 'data-store', '.new_maxjavr', '__OBJ__video_page')
const LIB_MAXJAVR_INFO_HTML_DIR = path.join(__dirname, 'data-store', '.new_maxjavr', '__LIB__maxjavr-info-html')

const readList = (html: string) => {
    body.innerHTML = html

    const list = [...body.querySelectorAll('#content > div.post')]
        .map(v => v.innerHTML)

    return list.map(item_html => {
        body.innerHTML = item_html

        const a = body.querySelector('h2 > a')
        const url = a?.getAttribute('href')
        const code = url?.match(/https\:\/\/maxjav\.xyz\/([0-9]*)\//)?.[1]
        const page_update_date = body.querySelector('[rel="bookmark"]')?.textContent

        const data = {
            url,
            code,
            item_html,
            page_update_date,
            update_timestamp: new Date().getTime()
        }
        return data
    })
}

const checkAndUpdateVideoPage = async (video_page: any): Promise<boolean> => {
    if (!video_page.code) {
        console.log('  [Skip] missing code')
        return false
    }

    const jsonPath = path.join(OBJ_VIDEO_PAGE_DIR, `${video_page.code}.json`)
    const htmlPath = path.join(LIB_MAXJAVR_INFO_HTML_DIR, `${video_page.code}.html`)

    const jsonExists = fs.existsSync(jsonPath)
    if (jsonExists) {
        const existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        if (existingData.page_update_date === video_page.page_update_date
        ) {
            console.log(`  [Skip] ${video_page.code} (no changes)`)
            return false
        }
    }

    try {
        const html = await scaner.read(
            video_page.url, 'div#header > div.site_title > h1 > a'
        )

        if (!fs.existsSync(LIB_MAXJAVR_INFO_HTML_DIR)) {
            fs.mkdirSync(LIB_MAXJAVR_INFO_HTML_DIR, { recursive: true })
        }
        fs.writeFileSync(htmlPath, html, 'utf-8')

        if (!fs.existsSync(OBJ_VIDEO_PAGE_DIR)) {
            fs.mkdirSync(OBJ_VIDEO_PAGE_DIR, { recursive: true })
        }
        fs.writeFileSync(jsonPath, JSON.stringify(video_page, null, 2), 'utf-8')

        const action = jsonExists ? 'Update' : 'Create'
        console.log(`  [${action}] ${video_page.code}`)
        console.log(`    JSON: ${jsonPath}`)
        console.log(`    HTML: ${htmlPath}`)

        return true
    } catch (err) {
        console.error(`  [Error] ${video_page.code}:`, err)
        return false
    }
}

const main = async () => {

    const rootUrl = 'https://maxjav.xyz/category/vr/'
    const pageUrl = (pageNo = 0) => {
        if (pageNo === 0) return rootUrl
        return `${rootUrl}page/${pageNo + 1}/`
    }

    let i = -1
    let updateCount = 0
    let skipCount = 0

    while (i < 1200) {
        i = i + 1
        const url = pageUrl(i + 134)
        console.log(`\n=== Page ${i + 135}: ${url} ===`)

        try {
            const html = await scaner.read(
                url, 'div#header > div.site_title > h1 > a'
            )

            const list = readList(html)

            if (list.length === 0) {
                console.log('No more videos found. Stopping.')
                break
            }

            for (const video_page of list) {
                const updated = await checkAndUpdateVideoPage(video_page)
                if (updated) {
                    updateCount++
                } else {
                    skipCount++
                }
            }
            sleep(1000 + Math.random() * 4000)
        } catch (err) {
            console.error(`Error reading page ${i + 1}:`, err)
            break
        }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Updated: ${updateCount}`)
    console.log(`Skipped: ${skipCount}`)
}

main().catch(console.error)
