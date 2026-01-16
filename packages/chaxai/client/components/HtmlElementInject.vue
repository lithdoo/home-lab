<template>
  <div ref="container" :style="props.style"></div>
</template>

<script setup lang="ts">
import { type CSSProperties, computed, onMounted, ref, watch } from 'vue'

const container = ref<HTMLElement | null>(null)
const props = defineProps<{
  target: HTMLElement | null
  style?: Partial<CSSProperties>
}>()

const target = computed(() => props.target)

watch(target, () => {
  console.log('target changed')
  if (container.value) container.value.innerHTML = ''
  if (target.value && container.value) {
    container.value.appendChild(target.value)
  }
})

onMounted(() => {
  if (props.target && container.value) {
    container.value.innerHTML = ''
    container.value.appendChild(props.target)
  }
})
</script>
