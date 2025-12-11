import { Page } from "puppeteer"
import { getChromePage, openChrome2, shutdownChrome } from "./puppeteer"
import { ManualPromise } from "../utils"


export * from './dom'
export * from './sqlite'


interface Response {
    url(): string
}


interface Request {
    url(): string
}


export class WebPageScaner {

    static chrome: undefined | Promise<any> = undefined

    page = new ManualPromise<Page>()
    tasks: ScanerTask[] = []
    current?: ScanerTask

    constructor() {
        if (!WebPageScaner.chrome)
            WebPageScaner.chrome = openChrome2()

        this.init()
    }

    shutdown() {
        shutdownChrome()
        WebPageScaner.chrome = undefined
    }

    async init() {
        await WebPageScaner.chrome
        const page = await getChromePage()
        this.page.resolve(page)
        // 过滤监听：只打印 API 请求
        page.on('request', (request) => {
            if (!this.current) return
            if (!this.current.requestFilter) return

            if (this.current.requestFilter(request.url())) {
                this.current.requests.push(request)
            }
        });

        // 监听所有响应，但处理特定一个
        page.on('response', (response) => {
            if (!this.current) return
            if (!this.current.respondFilter) return

            if (this.current.respondFilter(response.url())) {
                this.current.responds.push(response)
            }
        });
    }

    async start() {
        if (this.current) return
        const current = this.tasks.shift()
        if (!current) return
        this.current = current
        await this.deal(current)
        await new Promise(res => setTimeout(res,
            Math.random() * 5 * 1000 + 2000
        ))
        this.current = undefined
        this.start()
    }

    run(task: ScanerTask) {
        this.tasks.push(task)
        this.start()
    }


    read(url: string, waitForSelector?: string) {
        return new Promise<string>((onSuccess, onError) => {
            const task: ScanerTask = {
                url, waitForSelector, onSuccess, onError, requests: [], responds: []
            }
            this.run(task)
        })
    }


    respond(url: string, option: {
        filter: (url: string) => boolean,
        timeout: () => Promise<void>
    }, waitForSelector?: string) {
        const { filter, timeout } = option
        return new Promise<Response[]>((onResolve, onError) => {
            const onSuccess = () => {
                onResolve(task.responds)
            }
            const task: ScanerTask = {
                url, waitForSelector, onSuccess, onError, requests: [], responds: [],
                respondFilter: filter, timeout
            }
            this.run(task)
        })
    }

    currentTask?: ScanerTask

    private async deal(task: ScanerTask) {
        try {
            const page = await this.page.target
            await page.goto(task.url, {
                timeout: 1000 * 60 * 20
            })
            if (task.waitForSelector) {
                await page.waitForSelector(
                    task.waitForSelector,
                    { timeout: 1000 * 60 * 20 }
                )
                const html = await page.evaluate(() => document.body.innerHTML)
                if (task.timeout) {
                    await task.timeout()
                }
                task.onSuccess(html)
            }
        } catch (e: any) {
            task.onError(e)
        }

    }
}

export interface ScanerTask {
    url: string
    waitForSelector?: string
    onError(e: Error): void
    onSuccess(html: string): void
    requestFilter?: (url: string) => boolean
    respondFilter?: (url: string) => boolean
    requests: Request[]
    responds: Response[]
    timeout?: () => Promise<void>
}