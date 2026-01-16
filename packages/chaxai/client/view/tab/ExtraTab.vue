<template>
    <div class="extra-tab">
        <div class="extra-tab__header">
            <div class="extra-tab__tab-list">
                <div class="extra-tab__tab-title" v-for="value in tab.list" :class="{
                    'extra-tab__tab-title--focus': tab.current === value
                }" @click="() => swichTo(value)">
                    <IconImg v-if="value.icon" :icon="value.icon" style="height: 20px;width: 20px;margin-right: 4px;"></IconImg>
                    {{ value.title }}
                    <button class="extra-tab__tab-delete" @click="() => remove(value)">
                        <i class="fa fa-trash-o"></i>
                    </button>
                </div>
            </div>
            <button class="extra-tab__tab-close" @click="() => tab.closeTab()">
                <i class="fa fa-trash-o"></i>
            </button>
        </div>
        <div class="extra-tab__body">
            <div class="extra-tab__tab-content">
                <HtmlElementInject v-if="tab.current" :target="tab.current.element" :style="{ height: '100%' }">
                </HtmlElementInject>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
import type { TabControl } from '../../modal/TabControl';
import HtmlElementInject from '../../components/HtmlElementInject.vue';
import type { ETab } from '../../modal/TabControl';
import IconImg from '../../components/Icon/IconImg.vue';

const props = defineProps<{
    tab: TabControl
}>()

const swichTo = (tab: ETab) => {
    props.tab.switchTo(tab)
}

const remove = (tab: ETab) => {
    props.tab.removeTab(tab)
}

</script>
<style lang="scss" scoped>
.extra-tab {
    // background-color: #66ccff;
    height: 100%;
    display: flex;
    flex-direction: column;

    box-shadow:0px 6px 8px 0 rgba(0,0,0,0.1);


    background: rgb(247, 247, 247);
    border-radius: 12px 12px 0px 12px;
    border: 1px solid rgba(151, 151, 151, 0.24);

    &__header {
        min-height: 64px;
        display: flex;
        align-items: start;
        padding: 16px 8px;
        gap: 16px;
        flex-wrap: wrap;
        flex: 0 0 auto;
    }

    &__tab-list {
        flex: 1 1 0;
        display: flex;
        align-items: center;
        // justify-content: center;
        padding: 0 8px;
        gap: 16px;
        flex-wrap: wrap;
    }

    &__tab-close {
        background: none;
        border: none;
        cursor: pointer;
        height: 32px;
        padding: 0 12px;

        &:hover {
            opacity: 0.8;
        }
    }

    &__tab-title {
        height: 40px;
        padding: 0 18px;
        display: flex;
        align-items: center;
        cursor: pointer;
        flex: 0 0 auto;
        position: relative;

        background: #EBEBEB;
        border-radius: 6px;
        border: 1px solid rgba(179, 184, 201, 0.1);

        &--focus {
            background: #FFFFFF;
        }
    }

    &__tab-title:hover &__tab-delete {
        opacity: 1;
    }

    &__tab-delete {
        position: absolute;
        top: 12px;
        right: 6px;
        color: #a0a0c0;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    &__body {
        flex: 1 1 0;
        height: 0;
    }


    &__tab-content {
        height: 100%;
    }

}
</style>