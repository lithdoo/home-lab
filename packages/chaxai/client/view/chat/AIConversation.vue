<template>
    <div class="ai-chat__conversation__outer" :class="{ 'ai-chat__conversation__outer--first-think': isFirstThink }"
        ref="containerRef">
        <div class="ai-chat__conversation__inner">
            <div class="chat" id="chat-container">
                <!-- 欢迎消息 -->

                <template v-for="value in list">

                    <div class="chat__message chat__message--ai" v-if="value.role === 'assistant'" :key="value.msgId">
                        <div class="chat__avatar chat__avatar--ai">
                            <IconImg icon="face_focus"></IconImg>
                        </div>
                        <div class="chat__bubble chat__bubble--ai">
                            <!-- <div class="chat__sender">AI助手</div> -->
                            <AIMsgContentMarkdown :chat="chat" :key="value.msgId" :msg="value"
                                :check-scroll-bottom="checkScrollBottom" :is-bottom="isBottom"
                                :is-first-think="isFirstThink" @think-done="() => onThinkDone()"
                                @finish="() => onFinish(value.msgId)">
                            </AIMsgContentMarkdown>
                        </div>
                    </div>

                    <div class="chat__message chat__message--user" v-if="value.role === 'user'" :key="value.msgId">
                        <div class="chat__bubble chat__bubble--user">
                            <!-- <div class="chat__sender">用户</div> -->
                            <AIMsgContent :chat="chat" :key="value.msgId" :msg="value" :is-first-think="isFirstThink"
                                :check-scroll-bottom="checkScrollBottom" @finish="() => onFinish(value.msgId)">
                            </AIMsgContent>
                        </div>
                        <div class="chat__avatar chat__avatar--user">
                            <!-- <i class="fa fa-robot"></i> -->
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>

</template>


<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AIMsgContent from './AIMsgContent.vue'
import AIMsgContentMarkdown from './AIMsgContentMarkdown.vue';
import type { AIChatMessage, AIChatRecord } from '../../../common/base';
import type { ChatControl } from '../../modal/ChatControl';
import IconImg from '../../components/Icon/IconImg.vue';


const prop = defineProps<{ record?: AIChatRecord, chat: ChatControl }>()

// 用于加载完成滚动到底部
const finishedMsg = new Set<string>()

const list = computed(() => {
    if (!prop.record) return []
    const msgs: AIChatMessage[] = prop.chat.msgbox
        .msgList[prop.record.recordId] ?? []
    return [...msgs].reverse()
})

const containerRef = ref<HTMLElement | null>(null)

const scrollToBottom = (smooth: boolean) => {
    setTimeout(() => {
        if (!containerRef.value) return
        containerRef.value.scrollTo({
            top: containerRef.value.scrollHeight,
            behavior: smooth ? 'smooth' : undefined
        })
    })
}

const isBottom = () => {
    if (!containerRef.value) return true
    const element = containerRef.value
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

const isFirstThink = computed(() => prop.chat.isFirstThink)

watch(list, () => {
    if (list.value.length > 2) prop.chat.isFirstThink = false
})

onMounted(() => { scrollToBottom(false) })

const checkScrollBottom = async (todo: () => void, smooth: boolean = true) => {
    const nowIsBottom = isBottom()
    todo()
    await new Promise(res => setTimeout(res))
    if (nowIsBottom) scrollToBottom(smooth)
}

const onFinish = (msgId: string) => {
    finishedMsg.add(msgId)
    const unfinished = list.value.find(v => !finishedMsg.has(v.msgId))
    if (!unfinished) scrollToBottom(true)
}

const onThinkDone = () => {
    prop.chat.isFirstThink = false
}

</script>


<style lang="scss" scoped>
/* 基础样式重置 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}


.ai-chat__conversation__outer--first-think {
    // background: url(@/assets/home/ext/first-think-bg.png);
    background-size: cover;

    .chat__message {
        justify-content: center !important;
    }

    .chat__avatar--ai {
        opacity: 0;
        width: 0;
    }
}


.ai-chat__conversation__outer {
    height: 100%;
    overflow: auto;
    padding: 0 12px;
}

.ai-chat__conversation__inner {
    max-width: 880px;
    margin: 0 auto;
    padding: 24px 16px;
    padding-bottom: 200px;
}


.chat {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-bottom: 24px;
}

.chat__message {
    opacity: 0;
    transform: translateY(10px);
    animation: fadeIn 0.3s ease-out forwards;
}

.chat__message--user {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 12px;
}

.chat__message--ai {
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0;
}

.chat__avatar {
    width: 40px;
    height: 40px;
    border-radius: px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.chat__avatar--user {
    background-color: #e5e7eb;
    color: #1F2937;
    opacity: 0;
}

.chat__avatar--ai {
    width: 43px;
    height: 52px;
    transform: scaleX(-1);
    // background-color: #3B82F6;
    color: white;
    transition: all 0.3s ease;

    img {
        width: 100%;
    }
}

.chat__bubble {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 12px;
    margin-top: 32px;
}

.chat__bubble--user {
    background: #E8EAEF;
    border-radius: 4px;

    .chat__sender {
        color: #333;
        text-align: right;
    }
}

.chat__bubble--ai {
    color: #1F2937;
    margin-top: 0;
    padding: 0;
}

.chat__sender {
    position: relative;
    top: -36px;
    font-weight: bolder;
    font-size: 12px;
    margin-bottom: -12px;
    margin-left: -16px;
    margin-right: -16px;
    opacity: 0.8;
}

/* 输入区域样式 */
.input-form {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 12px;
    position: sticky;
    bottom: 12px;
    max-width: 800px;
    margin: 0 auto;
}

.input-main {

    display: flex;
    align-items: center;
    gap: 8px;
}

.input-form__textarea {
    flex-grow: 1;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    resize: none;
    min-height: 44px;
    max-height: 200px;
    transition: border-color 0.3s, box-shadow 0.3s;
}

.input-form__textarea:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.input-form__button {
    background-color: #3B82F6;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: background-color 0.3s;
    flex-shrink: 0;

    &[disabled] {
        opacity: 0.3;
    }
}

.input-form__button:hover {
    background-color: #2563EB;
}

.input-form__button--disabled {
    background-color: #93c5fd;
    cursor: not-allowed;
}

/* 打字指示器样式 */
.typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
}

.typing-indicator__dot {
    width: 8px;
    height: 8px;
    background-color: #6B7280;
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator__dot:nth-child(1) {
    animation-delay: -0.32s;
}

.typing-indicator__dot:nth-child(2) {
    animation-delay: -0.16s;
}

/* 动画 */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes typing {
    0% {
        transform: translateY(0);
    }

    28% {
        transform: translateY(-5px);
    }

    44% {
        transform: translateY(0);
    }
}

/* 响应式调整 */
@media (max-width: 600px) {
    .header__logo-text {
        font-size: 16px;
    }

    .header__button-text {
        display: none;
    }

    .chat__bubble {
        max-width: 80%;
    }
}
</style>