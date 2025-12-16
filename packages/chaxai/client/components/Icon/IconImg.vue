<template>
    <img :src="iconMap[props.icon]"></img>
</template>

<script lang="ts" setup>

import { iconMap } from './icon'

const props = defineProps<{
    icon: string
}>()

</script>