<template>
    <div class="md-doc">
        <div class="md-doc__icon"><i class="fa fa-file-text"></i></div>
        <div class="md-doc__info">
            <div class="md-doc__title">{{ data.value.title }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { Ref } from 'vue';
defineProps<{
    data: Ref<{
        isProccess: boolean,
        title?: string,
    }>
}>()
</script>


<style lang="scss" scoped>
.md-doc {

    display: flex;
    border: 1px solid rgb(231, 231, 240);
    align-items: center;
    border-radius: 4px;
    width: fit-content;
    padding: 0 16px;
    margin: 12px 0;
    cursor: pointer;
    gap: 8px;
    min-width: 244px;

    height: 68px;
    background: linear-gradient(270deg, rgba(255, 255, 255, 0) 0%, rgba(86, 93, 251, 0.09) 100%);
    border-radius: 12px;

    &:hover {
        opacity: 0.8;
    }


    &__icon {
        width: 24px;
        height: 24px;
        background: #565DFB;
        border-radius: 2px;
        color: #fff;
        align-items: center;
        justify-content: center;
        display: flex;
    }

    &__title {
        font-weight: 600;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.95);
        line-height: 20px;
        text-align: left;
        font-style: normal;
    }

    &__comment {
        opacity: 0.6;

        &::before {
            content: '(';
        }

        &::after {
            content: ')';
        }
    }
}
</style>