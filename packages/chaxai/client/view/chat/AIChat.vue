<script lang="ts" setup>
import { computed, ref } from 'vue';
import AIChatInput from './AIChatInput.vue';
import AIChatMain from './AIChatMain.vue';
import type { ChatControl } from '../../modal/ChatControl';
import IconImg from '../../components/Icon/IconImg.vue';

const props = defineProps<{
    chat: ChatControl
}>()

const showWelcome = computed(() => {
    return !props.chat.currentId
})

const tip = '帮我设计电商管理系统，具备商品、订单、库存、物流等核心业务模块...'

const askByTip = ()=>{
    props.chat.input.userInput = tip
    props.chat.input.submit()
}

</script>

<template>
    <div class="page" :class="showWelcome ? '' : 'page--hide-welcome'">

        <!-- Header -->
        <header class="header">
            <slot name="header"></slot>
        </header>

        <!-- Main -->
        <main class="main">

            <section class="message">
                <AIChatMain :chat="chat"></AIChatMain>
            </section>

            <!-- Hero -->
            <section class="hero">
                <div class="hero__icon">
                    <IconImg icon="face_input" v-if="props.chat.input.withContent()"></IconImg>
                    <IconImg icon="face_focus" v-else-if="props.chat.input.isFocus"></IconImg>
                    <IconImg icon="face_normal" v-else></IconImg>
                </div>
                <h1 class="hero__title" v-if="props.chat.input.withContent()">嗯...,我想想...？</h1>
                <h1 class="hero__title" v-else>今天，与 DM-AGENT 协作完成什么？</h1>
            </section>

            <!-- Chat Input -->
            <section class="chat" :class="{'chat--hidden': chat.isFirstThink}">
                <div class="chat__input-wrapper" :class="{
                    ['chat__input-wrapper--focus']: chat.input.isFocus
                }">
                    <slot name="input-extra"></slot>
                    <AIChatInput :input="chat.input" :chat="chat"></AIChatInput>
                </div>

                <div class="chat__input-shadow--blue"></div>
                <div class="chat__input-shadow--green"></div>

                <!-- Quick Actions -->
                <div class="chat__quick">
                    <button class="quick-btn" @click="()=>askByTip()">
                        <IconImg icon="code"></IconImg>
                        <div>{{ tip }}</div>
                    </button>
                </div>
            </section>

        </main>

    </div>
</template>


<style lang="scss">
/* -------------------------------------------------
   CSS 变量（替代 SCSS 变量）
   ------------------------------------------------- */
:root {
    --color-primary: #7b61ff;
    --color-primary-light: #f5f3ff;
    --color-bg: #fafafa;
    --color-border: #e0e0e0;
    --color-text: #333;
    --color-text-light: #666;
    --color-placeholder: #aaa;
    --radius-sm: 0.5rem;
    --radius-md: 1.5rem;
    --radius-full: 2rem;
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.08);
    --transition: all 0.25s ease;
}

/* -------------------------------------------------
   全局
   ------------------------------------------------- */
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    background: var(--color-bg);
    color: var(--color-text);
}

body {
    min-height: 100vh;
}
</style>
<style lang="scss" scoped>
/* -------------------------------------------------
   Page
   ------------------------------------------------- */
.page {
    // max-width: 1200px;
    margin: 0 auto;
    // padding: 0;
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: #F7F8FA;

    &--hide-welcome {
        .hero {
            opacity: 0;
            pointer-events: none;
        }

        .chat {
            width: calc(100% - 32px);

            &__quick {
                opacity: 0;
                pointer-events: none;
            }

            &__input-shadow--blue {
                opacity: 0;
                pointer-events: none;
            }

            &__input-shadow--green {
                opacity: 0;
                pointer-events: none;

            }
        }

        .main {
            padding-bottom: 0;
        }

    }

    .message {
        position: absolute;
        top: 64px;
        bottom: 0px;
        width: 100%;
    }
}

/* -------------------------------------------------
   Header
   ------------------------------------------------- */
.header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;


}




/* -------------------------------------------------
   Main
   ------------------------------------------------- */
.main {
    flex: 1;

    padding-bottom: 40vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: end;
    transition: var(--transition);
    overflow: hidden;
}

/* -------------------------------------------------
   Hero
   ------------------------------------------------- */
.hero {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-direction: row;
    margin-top: 10vh;
    margin-bottom: 40px;
    transition: var(--transition);

    &__icon {
        width: 87px;
        height: 104px;
        margin-right: 22px;

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
    }

    &__title {
        font-family: PingFangSC, PingFang SC;
        font-weight: 600;
        font-size: 28px;
        color: #000341;
        line-height: 40px;
        text-align: right;
        font-style: normal;
    }
}


/* -------------------------------------------------
   Chat
   ------------------------------------------------- */
.chat {
    max-width: calc(880px + 32px);
    position: relative;
    margin-left: 16px;
    margin-right: 16px;
    width: 880px;
    transition: all 0.3s ease;

    &--hidden{
        opacity: 0;
        pointer-events: none;
    }

    &__input-wrapper {
        position: relative;
        // display: flex;
        // align-items: flex-end;
        background: #FFFFFF;
        box-shadow: 0px 6px 20px 0px rgba(148, 164, 226, 0.5);
        border-radius: 12px;
        border: 1px solid rgba(44, 85, 247, 0.5);
        z-index: 1;
        transition: var(--transition);

        &--focus {
            box-shadow: 0px 0px 40px 0px rgba(148, 164, 226, 0.5);
            border-radius: 12px;
            border: 1px solid #343CED;
        }
    }

    &__input-shadow {
        &--blue {
            position: absolute;
            width: 772px;
            height: 217px;
            background: linear-gradient(180deg, #8DA7FF 0%, rgba(255, 255, 255, 0) 100%);
            border-radius: 12px;
            filter: blur(42px);
            left: -25px;
            top: 43px;
            transition: var(--transition);
        }

        &--green {
            position: absolute;
            width: 319px;
            height: 160px;
            background: rgba(221, 248, 170, 0.7);
            opacity: 0.8;
            filter: blur(50px);
            right: -25px;
            top: 53px;
            transition: var(--transition);
        }
    }

    /* Quick actions */
    &__quick {
        display: flex;
        flex-wrap: wrap;
        gap: 60px;
        margin-top: 32px;
        height: 40px;
        justify-content: center;
        z-index: 1;
        position: relative;
        transition: var(--transition);
    }
}

/* -------------------------------------------------
   Quick button
   ------------------------------------------------- */
.quick-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 18px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 20px;
    font-size: 14px;
    color: #000;
    cursor: pointer;
    transition: var(--transition);
    height: 40px;

}

.quick-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.quick-btn__icon {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    background-color: #ccc;
}






/* -------------------------------------------------
   响应式
   ------------------------------------------------- */
// @media (max-width: 640px) {
//     .header {
//         padding: 0.5rem 0;
//     }

//     .hero {
//         margin-bottom: 2rem;
//     }

//     .hero__title {
//         font-size: 1.5rem;
//     }

//     .chat {
//         padding: 0 0.5rem;
//     }
// }</style>