<template>
    <div class="main-view">

        <SinglePanelSplit :handler="splitSider">
            <template #panel>
                <div class="main-view__sider" :style="{ width: siderSplitWidth }">
                    <AIHistory :chat="chat" @hide="() => hideRecordList()" @new-conversation="() => newConversation()">
                    </AIHistory>
                </div>
            </template>
            <template #extra>
                <div class="main-view__main">
                    <SinglePanelSplit :handler="splitTab" :extra-style="{ overflow: 'visible', zIndex: '999' }">
                        <template #panel>
                            <div class="main-view__chat" :style="{ width: chatSplitWidth }">
                                <AIChat :chat="chat">
                                    <template #header>
                                        <div class="header__logo">
                                            <!-- <img :src="imgLogo"> -->
                                        </div>

                                        <div style="margin-left: 16px;" @click="() => toggleRecordList()">
                                            <IconBtn icon="history"></IconBtn>
                                        </div>

                                        <button class="header__coversation" @click="() => newConversation()">
                                            新会话
                                        </button>
                                        <!-- <button class="header__coversation" @click="() => showRecordList()"
                                            :data-show="!showSider">
                                            历史记录
                                        </button> -->
                                        <div class="header__title"></div>
                                        <div class="header__avatar">
                                            <!-- <img src="https://via.placeholder.com/32"> -->
                                            <IconImg icon="avatar"></IconImg>
                                        </div>
                                    </template>

                                    <template #input-extra>
                                        <!-- <div class="user-selected" v-if="chat?.selected.length">
                                            <div class="user-selected__node" v-for="value in chat.selected">
                                                <div class="user-selected__node-name">
                                                    {{ value.data.keyName }}
                                                </div>
                                                <div class="user-selected__node-comment">
                                                    {{ value.data.comment }}
                                                </div>
                                                <div class="user-selected__node-btn"
                                                    @click="() => chat.selected = chat.selected.filter(v => v.id !== value.id)">

                                                </div>
                                            </div>
                                        </div> -->
                                    </template>
                                </AIChat>
                            </div>
                        </template>
                        <template #extra>
                            <div class="main-view__extra-tab">
                                <ExtraTab :tab="tab"></ExtraTab>
                            </div>
                        </template>
                    </SinglePanelSplit>
                </div>
            </template>
        </SinglePanelSplit>
    </div>
</template>


<script lang="ts" setup>
import { computed, ref } from 'vue'
import { SinglePanelSplitHandler, SinglePanelSplit } from '../components/SinglePanelSplit'
import AIChat from './chat/AIChat.vue'
import ExtraTab from './tab/ExtraTab.vue'
import { watch } from 'vue'
import AIHistory from './sider/AIHistory.vue'
import { ChatControlWithTab } from '../modal/ChatControl'
import { TabControl } from '../modal/TabControl'
import IconBtn from '../components/Icon/IconBtn.vue'
import IconImg from '../components/Icon/IconImg.vue'

const props = defineProps<{
    chat: ChatControlWithTab,
    tab: TabControl,
}>()



const splitSider = ref(new SinglePanelSplitHandler())
splitSider.value.minDistance = 240
splitSider.value.maxDistance = 480
splitSider.value.distance = 240


const splitTab = ref(new SinglePanelSplitHandler())
splitTab.value.minDistance = 480
splitTab.value.maxDistance = 800
splitTab.value.distance = 600



const showTab = computed(() => {
    return !!props.tab.current
})
const showSider = ref(false)


const isTabVisiable = computed(() => !!showTab.value)



const siderSplitWidth = computed(() => (showSider.value ? splitSider.value.distance + 'px' : '0'))

const chatSplitWidth = computed(() => {

    if(isTabVisiable.value) return splitTab.value.distance + 'px'
    // return '100vw'
    if(showSider.value) return `calc(100vw - ${siderSplitWidth.value})`

    return '100vw'
})

// const chatSqlitRealWidth = ref<string>(chatSplitWidth.value)

// const timeout = null as any
// watch(chatSplitWidth,()=>{
//     if(timeout) clearTimeout(timeout)
//     if(chatSplitWidth.value === '100%'){
//         chatSplitWidth.value = 
//     }
// })


splitTab.value.siderBarWitdh = '100%'
watch(chatSplitWidth, () => {
    splitTab.value.siderBarWitdh = chatSplitWidth.value === '100%' ? '100%' : '0'
})


watch(computed(() => props.chat.currentId), () => {
    props.tab.clearTab()
})


const newConversation = () => {
    props.chat.load(null)
    showSider.value = false
}

const showRecordList = () => {
    showSider.value = true
}

const toggleRecordList = () => {
    showSider.value = !showSider.value
}

const hideRecordList = () => {
    showSider.value = false
}

</script>

<style lang="scss" scoped>
.main-view {
    height: 100%;
    overflow: hidden;

    &__sider {
        height: 100%;
        transition: all 0.2s ease;
    }

    &__main {
        height: 100%;
        width: 100%;
        overflow: hidden;
    }

    &__chat {
        height: 100%;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    &__extra-tab {
        height: 100%;
        width: 100%;
    }
}

[data-show="true"] {
    opacity: 1;
    transition: all 0.3s ease;
}

[data-show="false"] {
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
}

.header {
    &__logo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 1.125rem;
        color: var(--color-primary);
        margin-left: 16px;

        img {
            height: 28px;
            width: 160px;
            object-fit: cover;
        }
    }

    &__coversation {
        cursor: pointer;
        margin-left: 16px;
        flex: 0 0 auto;
        width: 93px;
        height: 32px;
        background: linear-gradient(90deg, #CBEFF3 0%, #E1FA9A 44%, #DEF9A6 63%, #D1F2E0 100%);
        border-radius: 22px;
        border: none;

        &:active {
            opacity: 0.7;
        }

    }

    &__title {
        flex: 1 1 0;
        width: 0;
    }

    &__avatar {
        margin-right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            background-color: #ccc;
        }
    }
}

.user-selected {
    display: flex;
    flex-wrap: wrap;
    margin: 16px 16px -8px 16px;
    gap: 8px;

    &__node {
        height: 28px;
        background: rgba(44, 78, 247, 0.06);
        border-radius: 4px;
        gap: 8px;
        border: 1px solid rgba(44, 78, 247, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
    }

    &__node-name {
        font-weight: 400;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.85);
        line-height: 22px;
        text-align: left;
        font-style: normal;
    }

    &__node-comment {
        font-family: PingFangSC, PingFang SC;
        font-weight: 400;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.45);
        line-height: 22px;
        text-align: left;
        font-style: normal;
    }

    &__node-btn {
        &::after {
            content: 'X';
        }

        width: 16px;
        text-align: center;
        font-weight: 400;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.45);
        line-height: 22px;
        text-align: left;
        font-style: normal;
    }

}
</style>