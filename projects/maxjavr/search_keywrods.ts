import * as fs from 'fs'
import * as path from 'path'
import toml from '@iarna/toml'

const KEYWORDS_FILE = 'D:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\search_keywords.txt'
const VIDEO_INFO_DIR = 'D:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__REF__video_info'

export interface DownloadInfo {
    url: string
    filename: string
    hostname: string
}

export interface VideoInfoData {
    video_code: string
    html_update_date: string
    img_url: string
    title: string
    desc: string
    downloads: DownloadInfo[]
}

export const readSearchKeywords = (): string[] => {
    if (!fs.existsSync(KEYWORDS_FILE)) {
        console.warn(`Keywords file not found: ${KEYWORDS_FILE}`)
        return []
    }

    const content = fs.readFileSync(KEYWORDS_FILE, 'utf-8')
    const lines = content.split('\n')

    const keywords = lines
        .map(line => line.trim())
        .filter(line => line.length > 0)

    console.log(`Loaded ${keywords.length} search keywords`)
    return keywords
}

export const readVideoInfo = (fileName: string): VideoInfoData | null => {
    const filePath = path.join(VIDEO_INFO_DIR, fileName)

    if (!fs.existsSync(filePath)) {
        console.warn(`Video info file not found: ${filePath}`)
        return null
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content) as VideoInfoData
        console.log(`[INFO] Read video info: ${fileName} (${data.video_code})`)
        return data
    } catch (error) {
        console.error(`Failed to parse video info file: ${filePath}`, error)
        return null
    }
}

export const isVideoMatchSearch = (video: VideoInfoData, searchQuery: string): boolean => {
    const searchText = `${video.title} ${video.desc}`.toLowerCase()
    const normalizedQuery = searchQuery.toLowerCase()

    let currentIndex = 0
    let expectAND = false
    let expectOR = false

    while (currentIndex < normalizedQuery.length) {
        while (currentIndex < normalizedQuery.length && normalizedQuery[currentIndex] === ' ') {
            expectAND = true
            currentIndex++
        }

        if (currentIndex >= normalizedQuery.length) break

        let isNegated = false
        if (normalizedQuery[currentIndex] === '+') {
            expectAND = true
            currentIndex++
            while (currentIndex < normalizedQuery.length && normalizedQuery[currentIndex] === ' ') {
                currentIndex++
            }
            if (currentIndex >= normalizedQuery.length) break
        } else if (normalizedQuery[currentIndex] === '-') {
            isNegated = true
            currentIndex++
            while (currentIndex < normalizedQuery.length && normalizedQuery[currentIndex] === ' ') {
                currentIndex++
            }
            if (currentIndex >= normalizedQuery.length) break
        }

        let orIndex = normalizedQuery.indexOf(' or ', currentIndex)
        if (orIndex === -1) {
            orIndex = normalizedQuery.length
        }

        let termEnd = orIndex
        while (termEnd > currentIndex && normalizedQuery[termEnd - 1] === ' ') {
            termEnd--
        }

        const term = normalizedQuery.substring(currentIndex, termEnd)
        const isNegatedTerm = isNegated

        const found = searchText.includes(term)

        if (expectAND && !expectOR) {
            if (isNegatedTerm) {
                if (found) return false
            } else {
                if (!found) return false
            }
        } else if (expectOR) {
            if (isNegatedTerm) {
                if (found) return false
            } else {
                if (found) return true
            }
            expectOR = false
        } else {
            if (isNegatedTerm) {
                if (found) return false
            } else {
                if (!found) return false
            }
        }

        currentIndex = orIndex
        if (currentIndex < normalizedQuery.length && normalizedQuery.substring(currentIndex, currentIndex + 4) === ' or ') {
            expectOR = true
            currentIndex += 4
        } else {
            expectAND = true
        }
    }

    return true
}

/**
 * 写个函数，入参为 VideoInfoData 和 一个搜索字符串
 * 在 D:\Coding\home-lab\projects\maxjavr\data-store\.file-view-store\[FILE_VIEW]maxjavr_keywords 路径下创建（已存在则忽略）和搜索字符串同名的目录（如果包含+ 则替换为_）
 * 在 D:\Coding\home-lab\projects\maxjavr\data-store\.new_maxjavr\__LIB__maxjavr-info-img 找到于 VideoInfoData.video_code 匹配的图片文件(后缀可能为 jpg，jpeg，png 或其大写)
 * 将图片复制到上述目录中，并为图片创建 projects\maxjavr\data-store\.file-view-store\file-view-directory-specification.md 所定义的描述文件
 * 其 title 和 desc 来自于 VideoInfoData , tags 来自于 VideoInfoData.downloads 中的 hostname(需要去重)
 * links 来自于 VideoInfoData.downloads 中的 url 和 filename
 */

const FILE_VIEW_KEYWORDS_DIR = 'D:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.file-view-store\\[FILE_VIEW]maxjavr_keywords'
const VIDEO_IMG_DIR = 'D:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__LIB__maxjavr-info-img'

const createSearchKeywordDirectory = (searchQuery: string): string => {
    const dirName = searchQuery.replace(/\+/g, '_')
    const dirPath = path.join(FILE_VIEW_KEYWORDS_DIR, dirName)

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        console.log(`[INFO] Created directory: ${dirName}`)
    }

    return dirPath
}

const findVideoImage = (videoCode: string): string | null => {
    const extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']

    for (const ext of extensions) {
        const filePath = path.join(VIDEO_IMG_DIR, `${videoCode}${ext}`)
        if (fs.existsSync(filePath)) {
            console.log(`[INFO] Found image: ${videoCode}${ext}`)
            return filePath
        }
    }

    console.warn(`[WARN] Image not found for video code: ${videoCode}`)
    return null
}

const generateMetadataContent = (video: VideoInfoData): string => {
    const uniqueHosts = [...new Set(video.downloads.map(d => d.hostname))]

    const links = video.downloads.map(d => ({
        title: d.filename,
        url: d.url
    }))

    const metadata = {
        info: {
            title: video.title,
            describe: video.desc,
            tags: uniqueHosts
        },
        links: links
    }

    return toml.stringify(metadata)
}

const copyImageWithMetadata = (srcImagePath: string, destDir: string, video: VideoInfoData): void => {
    const fileName = path.basename(srcImagePath)
    const destImagePath = path.join(destDir, fileName)

    fs.copyFileSync(srcImagePath, destImagePath)
    console.log(`[INFO] Copied image: ${fileName}`)

    const metadataPath = path.join(destDir, `${fileName}.meta.toml`)
    const metadataContent = generateMetadataContent(video)
    fs.writeFileSync(metadataPath, metadataContent, 'utf-8')
    console.log(`[INFO] Created metadata: ${path.basename(metadataPath)}`)
}

export const createVideoForSearch = (video: VideoInfoData, searchQuery: string): void => {
    if (!video.downloads || video.downloads.length === 0) {
        console.warn(`Video ${video.video_code} has no downloads, skipping`)
        return
    }

    const destDir = createSearchKeywordDirectory(searchQuery)

    const imagePath = findVideoImage(video.video_code)
    if (!imagePath) {
        return
    }

    console.log(`[INFO] Creating search result for "${searchQuery}" with video ${video.video_code}`)
    copyImageWithMetadata(imagePath, destDir, video)
}


/**
 * 写一个函数写通过 readSearchKeywords 读取所有的搜索字符串
 * 读取  VIDEO_INFO_DIR 下的文件列表，并对逐一对文件（文件内容通过 readVideoInfo 读取，只读一次）和字符串通过 isVideoMatchSearch 匹配
 * 文件之间需要间隔 10 ms, 但搜索关键字之间不需要间隔
 * 如果匹配成功，则调用 createVideoForSearch 创建搜索结果
 */

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export const processAllVideosForSearch = async (): Promise<void> => {
    const keywords = readSearchKeywords()
    if (keywords.length === 0) {
        console.warn('No search keywords found')
        return
    }

    if (!fs.existsSync(VIDEO_INFO_DIR)) {
        console.warn(`Video info directory not found: ${VIDEO_INFO_DIR}`)
        return
    }

    const files = fs.readdirSync(VIDEO_INFO_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    console.log(`Found ${jsonFiles.length} video info files to process`)

    let processed = 0
    let matched = 0

    for (const fileName of jsonFiles) {
        console.log(`[${processed + 1}/${jsonFiles.length}] Processing: ${fileName}`)

        const video = readVideoInfo(fileName)
        if (!video) continue

        for (const keyword of keywords) {
            if (isVideoMatchSearch(video, keyword)) {
                createVideoForSearch(video, keyword)
                matched++
            }
        }

        processed++
        await sleep(10)
    }

    console.log(`\n[COMPLETE] Processed: ${processed} files, Matched: ${matched} entries`)
}

processAllVideosForSearch()