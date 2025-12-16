<script setup lang="ts">
import { type Placement } from '@popperjs/core';
import PopMenuLayer from './PopMenuLayer.vue';
import { PopMenuLayerHandler, PopMenuListHandler } from './handler';
import { onUnmounted } from 'vue';
import { fixReactive } from '../utils';

const props = defineProps<{
  menu: PopMenuListHandler;
  placement: Placement;
}>();

const layer = fixReactive(new PopMenuLayerHandler());

const mouseenter = (e: MouseEvent) => {
  setTimeout(() => {
    layer.stopHide();
    layer.open(
      {
        target: e.target as HTMLElement,
        placement: props.placement,
      },
      props.menu
    );
  });
};

const mouseleave = () => {
  layer.hide();
};

const bind = (target: HTMLElement) => {
  target.onmouseenter = mouseenter;
  target.onmouseleave = mouseleave;
};

const stopHide = () => {
  layer.stopHide();
};

const remove = () => {
  layer.hide(true);
};

document.body.addEventListener('click', remove);
document.body.addEventListener('contextmenu', remove);
document.body.addEventListener('wheel', remove);

onUnmounted(() => {
  document.body.removeEventListener('click', remove);
  document.body.removeEventListener('contextmenu', remove);
  document.body.removeEventListener('wheel', remove);
});
</script>

<template>
  <slot name="triggler" :slot-scope="{ bind }"></slot>
  <PopMenuLayer :handler="layer" @mouseenter="stopHide"></PopMenuLayer>
</template>
