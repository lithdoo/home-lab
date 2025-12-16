<template>
    <div class="think-node" :class="{ 'think-node--first-think': isFirstThink.value }">
        <div class="think-node__face">
            <div class="think-node__face-ico">
                <IconImg icon="face_input"></IconImg>
            </div>
        </div>
        <div class="think-node__think">
            <div class="think-node__title">

                <i class="fa fa-angle-down"></i>
            </div>
            <div class="think-node__content" ref="container">
                <!-- 3213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321213123123123131321321 -->
                <HtmlElementInject :target="target"></HtmlElementInject>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, type Ref } from 'vue';
import HtmlElementInject from '../../components/HtmlElementInject.vue';
import IconImg from '../../components/Icon/IconImg.vue';

const props = defineProps<{
    target: HTMLElement
    data: Ref<{
        content: string
    }>
    isFirstThink: Ref<boolean>
}>();

const content = computed(() => props.data.value.content)
const container = ref<HTMLElement | null>(null)

watch(content, () => {
    if (container.value) {
        container.value.scrollTop = container.value.scrollHeight
    }
})

</script>


<style lang="scss" scoped>
.think-node {
    background: #F1F3F9;
    border-radius: 6px;
    border: 1px solid rgba(164, 176, 235, 0.1);
    display: flex;
    flex-direction: row;
    max-width: 100%;
    transition: all 0.3s ease;
    min-width: 360px;

    * {
        transition: all 0.3s ease;
    }

    &--first-think {
        background: #FFFFFF;
        border-radius: 12px;
        border: 3px solid #2F3AF7;
        margin-top: 48px;

        .think-node__content {
            max-height: 400px;
        }

        .think-node__title {
            ::before {
                content: '嗯...,我想想...';
                font-weight: 600;
                font-size: 28px;
                color: #000341;
                line-height: 40px;
                text-align: right;
                font-style: normal;
            }
        }

        .think-node__face {
            width: 95px;

            &::after {
                left: 37px;
                top: 78px;
            }
        }

        .think-node__face-ico {
            margin-left: -28px;
            margin-top: -40px;

            img {
                height: 110px;
                width: 92px;
            }
        }
    }


    &__face {
        flex: 0 0 auto;
        width: 48px;
        position: relative;

        &::after {
            position: absolute;
            top: 40px;
            left: 24px;
            width: 1px;
            bottom: 25px;
            content: '';
            background-color: #A6AFE0;
        }
    }

    &__face-ico {
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 8px;

        img {
            box-shadow: none !important;
            width: 28px;
            margin: 0;
        }
    }

    &__think {
        flex: 1;
        min-width: 0;
        word-break: break-word;
        overflow-wrap: anywhere;
    }

    &__title {

        ::before {
            content: '思考过程';
        }

        font-weight: 400;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.55);
        line-height: 16px;
        text-align: left;
        font-style: normal;
        margin-top: 14px;
        margin-bottom: 6px;
    }

    &__content {
        overflow: auto;
        padding-right: 32px;
        margin-bottom: 24px;
    }
}
</style>


<style lang="scss">
.think-node.think-node--first-think .markdown-container {
    font-size: 18px;
    line-height: 22px;
    color: rgba(0, 0, 0, 0.85);
}

.think-node .markdown-container {
    font-size: 13px;
    padding: 0;
    color: rgba(0, 0, 0, 0.55);
    word-break: break-word;
    overflow-wrap: anywhere;
}
</style>