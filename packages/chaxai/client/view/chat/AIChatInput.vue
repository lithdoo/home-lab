<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { AIInputControl } from '../../modal/ChatControl';
import IconImg from '../../components/Icon/IconImg.vue';

const props = defineProps<{ input: AIInputControl }>()

const refInput = ref<HTMLInputElement>(null as any)
let inputTimeout = null as any

onMounted(() => {
    refInput.value?.addEventListener('input', function () {
        refInput.value.style.height = 'auto';
        refInput.value.style.height = Math.min(refInput.value.scrollHeight, 200) + 'px';
        props.input.isInput = true
        if (inputTimeout) {
            clearTimeout(inputTimeout)
        }
        inputTimeout = setTimeout(() => {
            props.input.isInput = false
            inputTimeout = null
        }, 300)
    });
    refInput.value?.addEventListener('focus', function () {
        props.input.isFocus = true
    });
    refInput.value?.addEventListener('blur', function () {
        props.input.isFocus = false
    });
})


const btnDisbaled = computed(() => {
    if (props.input.isDisabled) return true
    if (!props.input.userInput.trim()) return true
    return false
})

</script>


<template>

    <div class="ai-chat-input" :class="{ 'ai-chat-input__focus': input.isFocus }">
        <textarea class="ai-chat-input__textarea" ref="refInput" :placeholder="input.placeholder"
            @keydown.ctrl.enter="(e) => { input.submit(); e.preventDefault() }" v-model="input.userInput"></textarea>
        <div class="ai-chat-input__bar">
            <div class="ai-chat-input__tools">
                <div class="select">Qwen3-235B-A22B</div>
                <!-- <template v-for="value in input.tools">
                    <select v-if="value.type === 'selector'">
                        <option v-for="option in value.options">{{ option }}</option>
                    </select>
                </template> -->
            </div>
            <button class="ai-chat-input__send-btn" :class="btnDisbaled ? 'ai-chat-input__send-btn--disabled' : ''"
                @click="() => input.submit()">
                <IconImg icon="send"></IconImg>
            </button>
        </div>
    </div>
</template>


<style lang="scss" scoped>
.ai-chat-input {
    min-height: 160px;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid transparent;

    &__focus {
        border: 1px solid #343CED;
    }

    &__textarea {
        flex: 1 1 auto;
        border: none;
        border-radius: 12px;
        width: 100%;
        outline: none;
        padding: 0px 16px;
        margin-top: 16px;
        font-size: 14px;
        resize: none;
    }

    &__bar {
        flex: 0 0 auto;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: 16px 14px;
    }


    &__tools {

        select,
        .select {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 28px;
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.12);
            padding: 0 12px 0 12px;
            font-weight: 400;
            font-size: 12px;
            color: rgba(0, 0, 0, 0.8);
            text-align: left;
            font-style: normal;
        }
    }

    &__send-btn {
        width: 40px;
        height: 32px;
        background: #343CED;
        border-radius: 16px;
        border: none;
        outline: none;
        color: #fff;
        cursor: pointer;
        transition: all 0.3s ease;

        &:active {
            opacity: 0.8;
        }

        &--disabled {
            opacity: 0.5 !important;
            cursor: not-allowed;
        }
    }
}
</style>