<template>
    <div class="md-entity">
        <div class="md-entity__icon"><i class="fa fa-table"></i></div>
        <div class="md-entity__title">{{ data.value.name }}</div>
        <div class="md-entity__comment" v-if="data.value.comment">{{ data.value.comment }}</div>
    </div>
</template>

<script lang="ts" setup>
import type { Ref } from 'vue';
defineProps<{
    data: Ref<{
        isProccess: boolean,
        name?: string,
        comment?: string
    }>
}>()
</script>


<style lang="scss" scoped>
.md-entity{
    display: flex;
    background-color: rgb(241,242,251);
    border: 1px solid rgb(231,231,240);
    height: 32px;
    align-items: center;
    border-radius: 4px;
    width: fit-content;
    padding: 0 8px;
    margin: 12px 0;
    cursor: pointer;
    gap: 8px;

    
    
    &:hover{
        opacity: 0.8;
    }
    
    &__title{
        font-weight: bold;
    }
    
    &__comment{
        opacity: 0.6;

        &::before{
            content: '(';
        }
        
        &::after{
            content: ')';
        }
    }
}


</style>