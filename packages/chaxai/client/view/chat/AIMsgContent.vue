<template>
    <div class="msg-content" >
        <div v-if="content === null" data-loading-dot="true" class="msg-content__loading">loading</div>
        <pre v-else>{{ content }}</pre>
    </div>
</template>


<script setup lang="ts">
import type { AIChatMessage } from '../../../common/base';
import { ref } from 'vue';
import type { ChatControl } from '../../modal/ChatControl';
const content = ref<string | null>(null)
const emitter = defineEmits(['finish'])

const prop = defineProps<{
    msg: AIChatMessage,
    isFirstThink: boolean,
    chat: ChatControl,
    checkScrollBottom: (todo: () => void, smooth: boolean) => void
}>()

const load = async () => {
    const text = (await prop.chat.msgbox.content(prop.msg.msgId)) ?? '<无信息>'
    content.value = text
    emitter('finish')
}

load()
</script>

<style>
.msg-content {
    overflow: hidden;
    word-break: break-all;
    word-wrap: break-word;
}

[data-loading-dot="true"] {
    &::after {
        content: '';
        animation: dotPulse 1.4s 0.4s infinite ease-in-out;
        ;
    }
}


pre {
    white-space: pre-wrap;
    /* 保留换行符，同时允许长单词换行到下一行 */
    word-wrap: break-word;
    /* 允许在单词内换行（针对长单词或URL） */
}

/* 省略号动画 */
@keyframes dotPulse {

    0%,
    100% {
        content: '.';
    }

    30% {

        content: '..';
    }

    66% {

        content: '...';
    }
}
</style>