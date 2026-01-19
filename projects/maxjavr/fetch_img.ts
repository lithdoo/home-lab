import * as fs from 'fs'
import * as path from 'path'
import { URL } from 'url'

const REF_VIDEO_INFO_DIR = path.join(__dirname, 'data-store', '.new_maxjavr', '__REF__video_info')
const LIB_MAXJAVR_INFO_IMG_DIR = path.join(__dirname, 'data-store', '.new_maxjavr', '__LIB__maxjavr-info-img')
const OUTPUT_JSONL_FILE = path.join(__dirname, 'data-store', '.new_maxjavr', 'fetched_images.jsonl')

interface VideoInfoJson {
    video_code: string
    img_url: string | null
    title?: string
    desc?: string
    html_update_date: string
    downloads?: Array<{
        url: string
        filename: string
        hostname: string
    }>
}

const existingImages = new Set<string>()

const loadExistingImages = (): void => {
    if (fs.existsSync(LIB_MAXJAVR_INFO_IMG_DIR)) {
        const files = fs.readdirSync(LIB_MAXJAVR_INFO_IMG_DIR)
        for (const file of files) {
            existingImages.add(file)
        }
    }
    console.log(`Loaded ${existingImages.size} existing images`)
}

const getImageExt = (imgUrl: string): string => {
    const filename = imgUrl.split('/').pop() || ''
    const ext = filename.split('.').pop() || ''
    return ext ? `.${ext}` : '.jpg'
}

const appendToJsonl = (data: Record<string, unknown>): void => {
    const line = JSON.stringify(data) + '\n'
    fs.appendFileSync(OUTPUT_JSONL_FILE, line)
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const downloadImageWithFetch = async (imgUrl: string): Promise<Buffer | null> => {
    try {
        const response = await fetch(imgUrl)
        if (!response.ok) {
            console.error(`HTTP error: ${response.status} ${response.statusText}`)
            return null
        }
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
    } catch (err) {
        console.error(`Failed to fetch ${imgUrl}:`, err)
        return null
    }
}

const downloadImage = async (imgUrl: string, videoCode: string): Promise<boolean> => {
    if (!imgUrl) return false

    const ext = getImageExt(imgUrl)
    const filename = `${videoCode}${ext}`
    const imgPath = path.join(LIB_MAXJAVR_INFO_IMG_DIR, filename)

    if (existingImages.has(filename)) {
        return false
    }

    console.log(`Fetching: ${imgUrl}`)
    const imgData = await downloadImageWithFetch(imgUrl)
    if (!imgData) {
        console.error(`Failed to download: ${videoCode}`)
        return false
    }

    try {
        fs.writeFileSync(imgPath, imgData)
        existingImages.add(filename)
        console.log(`Downloaded: ${filename} (${videoCode})`)
        console.log(`  -> ${imgPath}`)

        appendToJsonl({
            video_code: videoCode,
            img_path: imgPath,
            img_url: imgUrl,
            downloaded_at: new Date().toISOString()
        })

        return true
    } catch (err) {
        console.error(`Failed to save ${imgPath}:`, err)
        return false
    }
}

const fetchMissingImages = async (): Promise<void> => {
    console.log('='.repeat(60))
    console.log('Fetch Missing Images')
    console.log('='.repeat(60))

    if (!fs.existsSync(REF_VIDEO_INFO_DIR)) {
        console.error(`❌ Directory not found: ${REF_VIDEO_INFO_DIR}`)
        return
    }

    if (!fs.existsSync(LIB_MAXJAVR_INFO_IMG_DIR)) {
        fs.mkdirSync(LIB_MAXJAVR_INFO_IMG_DIR, { recursive: true })
        console.log(`Created directory: ${LIB_MAXJAVR_INFO_IMG_DIR}`)
    }

    loadExistingImages()

    const files = fs.readdirSync(REF_VIDEO_INFO_DIR).filter(f => f.endsWith('.json'))
    console.log(`\n📁 Found ${files.length} video info files to process\n`)
    console.log('-'.repeat(60))

    if (fs.existsSync(OUTPUT_JSONL_FILE)) {
        fs.unlinkSync(OUTPUT_JSONL_FILE)
    }

    let downloadCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < files.length; i++) {
        
        const file = files[i]
        const jsonPath = path.join(REF_VIDEO_INFO_DIR, file)
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as VideoInfoJson

        const videoCode = jsonData.video_code
        const imgUrl = jsonData.img_url

        console.log(`[${i + 1}/${files.length}] Processing: ${videoCode}`)

        if (!imgUrl) {
            console.log(`  ⚠️  No image URL for ${videoCode}`)
            skipCount++
            continue
        }

        const ext = getImageExt(imgUrl)
        const filename = `${videoCode}${ext}`

        if (existingImages.has(filename)) {
            console.log(`  ⏭️  Already exists: ${filename}`)
            skipCount++
            continue
        }

        const success = await downloadImage(imgUrl, videoCode)
        if (success) {
            downloadCount++
        } else {
            errorCount++
        }

        await sleep(10)
    }

    console.log('\n' + '-'.repeat(60))
    console.log('='.repeat(60))
    console.log('Summary')
    console.log('='.repeat(60))
    console.log(`Total files: ${files.length}`)
    console.log(`✅ Downloaded: ${downloadCount}`)
    console.log(`⏭️  Skipped: ${skipCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log(`📄 Output: ${OUTPUT_JSONL_FILE}`)
    console.log('='.repeat(60))
}

fetchMissingImages()
