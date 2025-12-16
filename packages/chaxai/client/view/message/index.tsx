
import {
    BaseViewNode,
    CacheRootViewNode,
    defaultRenderer,
    defaultRendererKeyType,
    MDNodeType,
    type CodeNode,
    type MarkdownNodeRenderer,
    type MarkdownNodeRenderKeyType
} from '../../modal/ASTNode/render';

import MDEntityNode from './MDEntityNode.vue'
import MDDocNode from './MDDocNode.vue'
import { computed, ref, render, type Ref } from 'vue';
import type { ETab, TabControl } from '../../modal/TabControl';
import type { ErdControl, ErdView } from '../../erd';
import ThinkNode from './ThinkNode.vue';
import { ChatControl } from '../../modal/ChatControl';

export const renderer: (erd: ErdControl) => MarkdownNodeRenderer = (erd: ErdControl) => (type, node, ctx) => {
    if (type === MDNodeType.Code && node.lang === 'md-doc') {
        return new DocViewNode(node, ctx)
    }
    if (type === MDNodeType.Code && node.lang?.indexOf('xml:entity-update') === 0) {
        return new EntityViewNode(node, ctx, erd)
    }
    if (type === MDNodeType.Code && node.lang?.indexOf('think') === 0) {
        return new ThinkViewNode(node, ctx, erd)
    }
    return defaultRenderer(type, node)
}


export const renderKeyType: MarkdownNodeRenderKeyType = (type, node) => {
    if (type === MDNodeType.Code && node.lang === 'md-doc') {
        return 'md-doc'
    }
    if (type === MDNodeType.Code && node.lang?.indexOf('xml:entity-update') === 0) {
        return 'er-node'
    }
    if (type === MDNodeType.Code && node.lang === 'think') {
        return 'think'
    }
    return defaultRendererKeyType(type, node)
}

export type CtxWithTabControl = {
    tab: TabControl
} & ChatControl 

export class DocViewNode extends BaseViewNode<CodeNode, HTMLDivElement, CtxWithTabControl> {
    root = new CacheRootViewNode(defaultRenderer, defaultRendererKeyType, null)
    tabBodyInner = document.createElement('div')
    tabBodyOuter = document.createElement('div')
    tab: Ref<ETab>
    data: Ref<{
        isProccess: boolean,
        title?: string,
    }> = ref({ isProccess: true, name: undefined, comment: undefined })
    constructor(node: CodeNode, ctx: CtxWithTabControl) {
        super(node, ctx)
        this.target = document.createElement('div')
        render(<MDDocNode data={this.data}></MDDocNode>, this.target)
        const tabBodyInner = this.tabBodyInner
        const tabBodyOuter = this.tabBodyOuter
        tabBodyInner.appendChild(this.root.target)
        tabBodyOuter.appendChild(tabBodyInner)
        tabBodyOuter.className = 'tabBodyOuter'
        tabBodyInner.className = 'tabBodyInner'
        setTimeout(() => {
            tabBodyOuter.style.background = `linear-gradient( 180deg, rgba(55,90,247,0.16) 0%, rgba(255,255,255,0) 85px)`
            tabBodyOuter.style.borderRadius = `16px 0px 16px 16px`
            tabBodyOuter.style.height = '100%'
            tabBodyOuter.style.overflow = 'auto'

            tabBodyInner.style.padding = '46px 64px'
            tabBodyInner.style.margin = '0 auto'
            tabBodyInner.style.maxWidth = '800'
        })
        this.tab = ref({
            title: '需求文档',
            icon: 'doc',
            element: tabBodyOuter
        })

        this.target.addEventListener('click', () => {
            this.openTab()
        })
        this.update(node, false)
    }

    update(node: CodeNode, openTab: boolean = true): void {

        this.checkScrollBottom(() => {
            const content = node.value
            this.root.update(content)
        }, true)
        const header = this.root.target.querySelector('h1')
        if (header) {
            this.data.value.title = header.innerText
            this.tab.value.title = header.innerText
        }

        if (openTab) {
            this.openTab()
        }
    }


    openTab() {
        this.ctx.tab.addTab(this.tab.value)
    }


    private async checkScrollBottom(todo: () => void, smooth: boolean = true) {
        const nowIsBottom = this.isBottom()
        todo()
        await new Promise(res => setTimeout(res))
        if (nowIsBottom) this.scrollToBottom(smooth)
    }


    private isBottom() {
        // if (!this.root.target) return true
        const element = this.tabBodyOuter
        const tolerance = 64
        // 元素内容总高度（包括不可见部分）
        const scrollHeight = element.scrollHeight;
        // 元素的可视高度
        const clientHeight = element.clientHeight;
        // 元素已滚动的距离
        const scrollTop = element.scrollTop;
        // 当滚动到底部时，scrollTop + clientHeight 约等于 scrollHeight
        // 考虑到可能存在的浮点精度问题，使用容差范围
        return scrollTop + clientHeight >= scrollHeight - tolerance;
    }

    private scrollToBottom(smooth: boolean) {
        setTimeout(() => {
            this.tabBodyOuter.scrollTo({
                top: this.tabBodyOuter.scrollHeight,
                behavior: smooth ? 'smooth' : undefined
            })
        })
    }

}

export class EntityViewNode extends BaseViewNode<CodeNode, HTMLDivElement, CtxWithTabControl> {
    root = document.createElement('div')
    view?: ErdView
    data: Ref<{
        isProccess: boolean,
        name?: string,
        id?: string,
        comment?: string
    }> = ref({ isProccess: true, name: undefined, comment: undefined, id: undefined })

    constructor(node: CodeNode, ctx: CtxWithTabControl, private erd: ErdControl) {
        super(node, ctx)
        this.target = document.createElement('div')
        render(<MDEntityNode data={this.data}></MDEntityNode>, this.target)
        this.target.addEventListener('click', () => {
            this.openTab()
        })
        this.update(node)
        setTimeout(() => {
        })
        // console.log({ node })
    }

    i = 0

    update(node: CodeNode): void {
        this.i = this.i + 1
        if (this.i == 2) {
            this.openTab()
        }

        const content = node.value
        console.log('content', content)
        this.root.innerHTML = node.value
        const entity = this.root.querySelector('entity')
        const name = entity && entity.getAttribute('name')
        const id = entity && entity.getAttribute('id')
        const comment = entity && entity.getAttribute('comment')
        if (id) {
            this.data.value.id = id
        }
        if (name) {
            this.data.value.name = name
            if (comment) {
                this.data.value.comment = name
            }
        }
    }


    openTab() {
        console.log('openTab')
        console.log(this)
        this.ctx.tab.addTab({
            title: 'ER图',
            icon: 'erd',
            element: this.erd.container
        })
        setTimeout(() => {
            if (this.data.value.id) {
                this.erd.currentView?.focus(this.data.value.id)
            }
        }, 0)
    }
}



export class ThinkViewNode extends BaseViewNode<CodeNode, HTMLDivElement, CtxWithTabControl> {

    view?: ErdView
    data: Ref<{ content: string}>

    root :CacheRootViewNode<null>
    constructor(node: CodeNode, ctx: CtxWithTabControl, private erd: ErdControl) {
        super(node, ctx)
        this.target = document.createElement('div')


        this.data = ref({
            content: this.node.value,
        })

        const isFirstThink = computed(()=>{
            return !! this.ctx.isFirstThink
        })

        this.root = new CacheRootViewNode(defaultRenderer, defaultRendererKeyType, null)
        this.root.prefix = ''
        render(<ThinkNode target={this.root.target} data={this.data} isFirstThink={isFirstThink}></ThinkNode>, this.target)
        this.update(node)
    }




    update(node: CodeNode): void {
        const content = node.value
        this.data.value.content = content
        this.root.update(content)

    }


    setComplete(){
        this.ctx.isFirstThink = false
    }


}


