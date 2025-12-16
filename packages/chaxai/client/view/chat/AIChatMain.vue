<template>
    <div class="ai-chat-messages">
        <template v-for="value in chat.list">
            <keep-alive>
                <component :is="AIConversation" :chat="chat" v-if="value.recordId === chat.currentId" :record="value"
                    :key="value.recordId">
                    <template #input-extra>
                        <slot name="input-extra"></slot>
                    </template>
                </component>
                <div v-else></div>
            </keep-alive>
        </template>

    </div>
</template>
<script lang="ts" setup>
import AIConversation from './AIConversation.vue'
import type { ChatControl } from '../../modal/ChatControl';

defineProps<{
    chat: ChatControl
}>()

</script>

<style lang="scss" scoped>
.ai-chat-messages{
    height: 100%;width: 100%;;
}
</style>