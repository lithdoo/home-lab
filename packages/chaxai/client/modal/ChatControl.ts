import { computed, reactive, watch } from "vue"
import type { AIChatMessage, AIChatRecord } from "../../common/base"
import { defaultRenderer, type MarkdownNodeRenderer, type MarkdownNodeRenderKeyType } from "./ASTNode/render"
import { renderKeyType } from "../view/message"
import { TabControl } from "./TabControl"

export interface AIRecords {
    currentId: string | null
    list: AIChatRecord[]
    refresh(): Promise<void>
}

export class SSEMessage {

    total: string = ''
    source?: EventSource
    constructor(public msgId: string) { }
    start() {
        this.source = new EventSource(`/ai/message/content/sse/${this.msgId}`);

        this.source.onmessage = (event) => {
            const data = event.data
            try {
                const { type, content } = JSON.parse(data)
                if (type === 'chunk') {
                    this.total = this.total + content
                } else if (type === 'init') {
                    this.total = content
                } else if (type === 'done') {
                    this.source?.close()
                    this.onClose?.()
                }
            } catch (e) {
                console.error(e)
            }
        }
    }

    onClose?: () => void
}

export class MsgBox {
    msgList: { [key: string]: AIChatMessage[] } = {}
    msgContent: { [key: string]: string } = {}
    msgSSE: { [key: string]: SSEMessage } = {}


    hasSSE() {
        return !![...Object.values(this.msgSSE)].length
    }

    async reload(recordId: string) {
        const res = await fetch(`/ai/message/list/${recordId}`)
        const data = await res.json()
        this.msgList[recordId] = data
        const unfinished = this.msgList[recordId].filter(v => {
            return v.unfinished
        }).forEach(msg => {
            if (this.msgSSE[msg.msgId]) return
            const sse = reactive(new SSEMessage(msg.msgId))
            this.msgSSE[msg.msgId] = sse
            sse.start()
            sse.onClose = () => {
                delete this.msgSSE[msg.msgId]
            }
        })

    }

    async content(msgId: string, useCache = true) {
        if ((!useCache) && this.msgContent[msgId]) return this.msgContent[msgId]
        const res = await fetch(`/ai/message/content/${msgId}`)
        const data = await res.text()
        this.msgContent[msgId] = data
        return data
    }


}

export class AIInputControl {

    isFocus: boolean = false
    isInput: boolean = false
    isDisabled: boolean = false
    userInput: string = ''
    placeholder: string = '请输入需求，功能点…'
    tools = [{
        type: 'selector',
        options: ['Qwen3-235B-A22B']
    }]

    withContent() { return !!this.userInput.trim() }

    submit() {
        if (this.isDisabled) return
        this.onSubmit?.(this.userInput)
        this.userInput = ''
    }

    onSubmit?: (userInput: string) => void
}

export class ChatControl implements AIRecords {
    currentId: string | null = null
    list: AIChatRecord[] = []
    msgbox: MsgBox = reactive(new MsgBox())
    input = new AIInputControl()
    markdown: {
        renderer: MarkdownNodeRenderer
        keyType: MarkdownNodeRenderKeyType
    } = { renderer: defaultRenderer, keyType: renderKeyType }

    async refresh(): Promise<void> {
        if (this.currentId) {
            await this.msgbox.reload(this.currentId)
        }
    }




    async loadRecords() {
        const res = await fetch('/ai/record/list')
        const data = await res.json()
        this.list = data
    }

    async init() {
        this.input.onSubmit = (text) => {
            this.send(text)
        }
        await this.loadRecords()
        watch(computed(() => this.currentId), () => {
            this.refresh()
        })
    }

    async load(id: string | null) {
        if (!id) {
            this.currentId = null
            return
        }

        if (this.list.map(v => v.recordId).includes(id)) {
            this.currentId = id
            this.isFirstThink = false
            await this.refresh()
            if (this.currentId === id) {
                if (this.msgbox.msgList[this.currentId].length < 2) {
                    this.isFirstThink = true
                } else if (this.msgbox.msgList[this.currentId].length > 2) {
                    this.isFirstThink = false
                } else if (this.msgbox.msgList[this.currentId].find(v => v.unfinished)) {
                    this.isFirstThink = true
                } else {
                    this.isFirstThink = false
                }
            }

        }
    }

    beforeSend?(content: string): any | false
    afterSend?(): void

    async send(content: string) {
        const extra = this.beforeSend?.(content)
        if (extra === false) return

        const data = {
            recordId: this.currentId || null,
            content,
            extra
        }

        const res = await fetch('/ai/chat', {
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        })

        const { recordId } = await res.json()



        await this.loadRecords()
        await this.load(recordId)
    }


    isFirstThink: boolean = false
}

export class ChatControlWithTab extends ChatControl {
    tab: TabControl = new TabControl()
    constructor() {
        super()
    }
}
