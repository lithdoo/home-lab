
import { getBody } from '@pkg/scaner/web'
import * as fs from 'fs'
import * as path from 'path'

const body = getBody()

const OBJ_VIDEO_PAGE_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__OBJ__video_page'
const LIB_MAXJAVR_INFO_HTML_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__LIB__maxjavr-info-html'
const REF_VIDEO_INFO_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__REF__video_info'

export interface VideoPageJson {
    url: string
    item_html: string
    code: string
    page_update_date: string
    update_timestamp: number
}

export interface DownloadItem {
    url: string
    filename: string
    hostname: string
}

export interface VideoPageData {
    jsonPath: string
    htmlPath: string
    jsonData: VideoPageJson | null
    htmlContent: string | null
    exists: boolean
}

export const readHTML = (code: string): VideoPageData => {
    const jsonPath = path.join(OBJ_VIDEO_PAGE_DIR, `${code}.json`)
    const htmlPath = path.join(LIB_MAXJAVR_INFO_HTML_DIR, `${code}.html`)

    if (!fs.existsSync(jsonPath)) {
        throw new Error(`JSON file not found: ${jsonPath}`)
    }

    if (!fs.existsSync(htmlPath)) {
        throw new Error(`HTML file not found: ${htmlPath}`)
    }

    let jsonData: VideoPageJson | null = null
    let htmlContent: string | null = null

    try {
        jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    } catch (err) {
        throw new Error(`Error reading JSON for ${code}: ${err}`)
    }

    try {
        htmlContent = fs.readFileSync(htmlPath, 'utf-8')
    } catch (err) {
        throw new Error(`Error reading HTML for ${code}: ${err}`)
    }

    return {
        jsonPath,
        htmlPath,
        jsonData,
        htmlContent,
        exists: true
    }
}


export interface VideoInfoResult {
    status: '404' | 'lose-page' | 'lose-detail' | 'latest' | 'need-update' | 'success'
    code: string
    video_info?: VideoInfoData
}

export interface VideoInfoData {
    video_code: string
    html_update_date: string
    img_url: string | null
    desc?: string | null
    title?: string | null
    downloads?: DownloadItem[]
}

export const createVideoInfo = (pageData: VideoPageData): VideoInfoResult => {
    const { jsonData, htmlContent, jsonData: { code } } = pageData

    if (!code) {
        return { status: 'lose-page', code: '' }
    }

    if (htmlContent.includes('Error 404 - Not Found')) {
        return { status: '404', code }
    }

    body.innerHTML = htmlContent

    const img_url = body.querySelector('.entry img')?.getAttribute('src') || null
    const page_update_date = jsonData.page_update_date

    const titleElement = body.querySelector('h2.title') || body.querySelector('h1')
    const title = titleElement?.textContent?.trim() || null

    const descElement = body.querySelector('.entry p')
    const desc = descElement?.textContent?.trim() || null

    const links = body.querySelectorAll('a[href]')
    const downloads: DownloadItem[] = []

    const videoExtensions = ['.mp4', '.mkv', '.zip', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.rar', '.7z']

    links.forEach(a => {
        const href = a.getAttribute('href') || ''
        const lowerHref = href.toLowerCase()
        
        for (const ext of videoExtensions) {
            if (lowerHref.endsWith(ext)) {
                try {
                    const url = new URL(href)
                    const hostname = url.hostname
                    const filename = href.split('/').pop() || href
                    
                    downloads.push({
                        url: href,
                        filename,
                        hostname
                    })
                } catch {
                    downloads.push({
                        url: href,
                        filename: href.split('/').pop() || href,
                        hostname: ''
                    })
                }
                break
            }
        }
    })

    return {
        status: 'success',
        code,
        video_info: {
            video_code: code,
            html_update_date: page_update_date,
            img_url,
            title,
            desc,
            downloads: downloads.length > 0 ? downloads : undefined
        }
    }
}

export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export const processAllVideoPages = async (): Promise<void> => {
    if (!fs.existsSync(OBJ_VIDEO_PAGE_DIR)) {
        console.error(`❌ Input directory not found: ${OBJ_VIDEO_PAGE_DIR}`)
        return
    }

    if (!fs.existsSync(REF_VIDEO_INFO_DIR)) {
        fs.mkdirSync(REF_VIDEO_INFO_DIR, { recursive: true })
    }

    const files = fs.readdirSync(OBJ_VIDEO_PAGE_DIR).filter(f => f.endsWith('.json'))
    const totalFiles = files.length

    console.log(`🚀 Starting to process ${totalFiles} video pages...`)
    console.log(`📁 Input: ${OBJ_VIDEO_PAGE_DIR}`)
    console.log(`📁 Output: ${REF_VIDEO_INFO_DIR}`)
    console.log('')

    let successCount = 0
    let errorCount = 0
    let skipCount = 0
    let totalDownloads = 0

    for (let i = 0; i < files.length; i++) {
        await sleep(0)
        const file = files[i]
        const code = file.replace('.json', '')
        const progress = `[${i + 1}/${totalFiles}]`

        try {
            const pageData = readHTML(code)
            const result = createVideoInfo(pageData)

            if (result.status === 'success' && result.video_info) {
                const outputPath = path.join(REF_VIDEO_INFO_DIR, `${code}.json`)
                fs.writeFileSync(outputPath, JSON.stringify(result.video_info, null, 2), 'utf-8')

                const downloadCount = result.video_info.downloads?.length || 0
                totalDownloads += downloadCount

                console.log(`✅ ${progress} ${code} | Downloads: ${downloadCount}`)
                successCount++
            } else {
                console.log(`⏭️  ${progress} ${code} | Status: ${result.status}`)
                skipCount++
            }
        } catch (err) {
            console.error(`❌ ${progress} ${code} | Error: ${(err as Error).message}`)
            errorCount++
        }
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('📊 Processing Summary')
    console.log('='.repeat(60))
    console.log(`  Total files:  ${totalFiles}`)
    console.log(`  ✅ Success:   ${successCount}`)
    console.log(`  ⏭️  Skipped:   ${skipCount}`)
    console.log(`  ❌ Errors:    ${errorCount}`)
    console.log(`  📥 Downloads: ${totalDownloads}`)
    console.log(`  📁 Output:    ${REF_VIDEO_INFO_DIR}`)
    console.log('='.repeat(60))
}

processAllVideoPages()