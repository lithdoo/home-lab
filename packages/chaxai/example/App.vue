<script setup lang="ts">
import MainView from '../client/view/MainView.vue';
import { ChatControlWithTab } from '../client/modal/ChatControl';
import { computed, reactive, watch } from 'vue';
import { GlobalContextMenu } from '../../vx-base/GlobalContextMenu';


const chat = reactive(new ChatControlWithTab()) as ChatControlWithTab

;(window as any).chat = chat

const disableSend = computed(() => {
  if (chat.msgbox.hasSSE()) {
    return true
  }
  return false
})

watch(disableSend, () => {
  chat.input.isDisabled = disableSend.value
})


chat.init()

</script>

<template>
  <GlobalContextMenu></GlobalContextMenu>
  <MainView :chat="chat" :tab="chat.tab"></MainView>
</template>

<style>
body,
html,
#app {
  height: 100%;
  width: 100%;
  padding: 0;
  margin: 0;
  display: block;
  max-width: none;

}

#app {
  background: #fff;
}
</style>
