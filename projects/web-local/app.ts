import "./styles.css";  // 导入 CSS 到 JS 捆绑

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("message")!.textContent = "Bun 页面加载成功！";
});


export class ComponentViewBuilder {

}


interface BaseNode {
    nodeId: string
}



interface ParentNode extends BaseNode {
    children: BaseNode[]
}

interface RootNode extends ParentNode {

}

interface ContextNode extends ParentNode {
    keyName?: string
    extend: boolean,
    var: {
        name: string,
        value: string,
    }[]
}

interface ApplyNode extends BaseNode { }

interface TagNode extends ParentNode {
    tagName: string
}

interface TextNode extends BaseNode { }


interface CondNode extends ParentNode { }

interface LoopNode extends ParentNode { }