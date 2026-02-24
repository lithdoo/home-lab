import puppeteer from 'puppeteer'

const TEZFILES_URL = process.argv[2]

if (!TEZFILES_URL) {
    console.error('❌ Usage: bun open-url.ts <URL>')
    process.exit(1)
}

async function openTezfilesUrl(): Promise<void> {
    console.log('🚀 Connecting to Chrome...')
    console.log(`URL: ${TEZFILES_URL}`)

    const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        protocolTimeout: 60000,
    })

    console.log('✅ Connected to Chrome')

    // const pages = await browser.pages()
    const page = await browser.newPage()
    
    console.log('🔗 Navigating to URL...')
    try {
        await page.goto(TEZFILES_URL, { waitUntil: 'load', timeout: 30000 })
        console.log(`✅ Page loaded: ${TEZFILES_URL}`)
    } catch (e: any) {
        console.log(`⚠️ Navigation warning: ${e.message}`)
    }
    
    console.log('⏳ Waiting for page to settle...')
    await new Promise(r => setTimeout(r, 5000))
    
    console.log('🔍 Looking for download button...')
    const downloadButton = await page.$('[data-stats="files:premium-download"]')
    if (downloadButton) {
        await downloadButton.click()
        console.log('✅ Clicked download button')
        console.log('⏳ Waiting for download to start...')
        await new Promise(r => setTimeout(r, 8000))
    } else {
        console.log('⚠️ Download button not found')
    }

    console.log('👋 Closing page and disconnecting...')
    await page.close()
    await browser.disconnect()
    console.log('✅ Done')
    process.exit(0)
}

openTezfilesUrl().catch((err) => {
    console.error('❌ Failed:', err)
    process.exit(1)
})
