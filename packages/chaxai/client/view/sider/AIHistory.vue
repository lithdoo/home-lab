<template>
    <aside class="history">
        <div class="history__header">
            <h2 class="history__title">历史记录</h2>
            <button class="history__clear" @click="()=>hide()">
                <i class="fa fa-close"></i>
            </button>
        </div>
        <div class="history__list">

            <div :class="{ 'history__item--active': chat.currentId === value.recordId }" class="history__item "
                v-for="value in chat.list" :key="value.recordId" @click="() => load(value.recordId)">
                <button class="history__item-delete">
                    <i class="fa fa-trash-o"></i>
                </button>
                <div class="history__item-title">{{ value.title }}</div>
                <div class="history__item-time">{{ value.updateTimestamp }}</div>
            </div>
        </div>
        <div class="history__new">
            <button class="history__new-button" @click="() => newConversation()">
                <i class="fa fa-plus"></i>
                新建对话
            </button>
        </div>
    </aside>
</template>


<script lang="ts" setup>
import type {  ChatControl } from '../../modal/ChatControl';


const emitter = defineEmits(['hide', 'newConversation'])
const props = defineProps<{ chat: ChatControl }>()


const load = (id: string) => { props.chat.load(id) }
const newConversation = () => { emitter('newConversation') }
const hide = () => { emitter('hide') }

</script>

<style lang="scss" scoped>
.history {
    height: 100%;
    width: 100%;
    background-color: #fff;
    border-right: 1px solid #efefef;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    overflow: hidden;

    &__header {
        padding: 16px;
        border-bottom: 1px solid #efefef;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    &__title {
        font-size: 18px;
        font-weight: 600;
        color: #2a2a3c;
    }

    &__clear {
        background: none;
        border: none;
        color: #3d3d5c;
        cursor: pointer;
        font-size: 14px;
        transition: color 0.2s ease;
    }

    &__clear:hover {
        color: #ff6b6b;
    }

    &__list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    &__item {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: rgba(100, 108, 255, 0.1);
        border: 1px solid transparent;
        position: relative;
    }

    &__item:hover {
        background-color: rgba(100, 108, 255, 0.2);
        transform: translateX(4px);
    }

    &__item--active {
        background-color: rgba(100, 108, 255, 0.2);
        border-left: 3px solid #646cff;
    }

    &__item-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__item-time {
        font-size: 12px;
        color: #a0a0c0;
    }

    &__item-delete {
        position: absolute;
        top: 8px;
        right: 8px;
        color: #a0a0c0;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    &__item:hover &__item-delete {
        opacity: 1;
    }

    &__item-delete:hover {
        color: #ff6b6b;
    }

    &__new {
        padding: 16px;
        border-top: 1px solid #efefef;
    }

    &__new-button {
        width: 100%;
        padding: 12px;
        background-color: #646cff;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    &__new-button:hover {
        background-color: #535bf2;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
    }
}
</style>