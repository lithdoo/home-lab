<template>
    <div class="icon-btn">
        <IconImg :icon="icon"></IconImg>
    </div>
</template>

<script lang="ts" setup>
import IconImg from '../Icon/IconImg.vue';



const props = defineProps<{
    icon: string
}>()

</script>

<style lang="scss" scoped>

.icon-btn{
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    &:hover{
        opacity: 0.7;
    }
}
</style>