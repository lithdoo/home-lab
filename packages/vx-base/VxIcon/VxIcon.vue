<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ name: string }>();
const theme = ref('light');
</script>

<template>
  <svg class="icon" aria-hidden="true">
    <use :xlink:href="`#vx-${theme}-${props.name}`"></use>
  </svg>
</template>

<style scoped>
.icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
  margin: 2px;
}
</style>
