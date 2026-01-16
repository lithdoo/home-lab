<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { VxIcon } from '../VxIcon/index';
import {
  PopMenuLayerHandler,
  PopMenuListHandler,
  type MenuButton,
  type SubMenu,
  type MenuRenderOption,
} from './handler';
// import { useLocale } from '@/vue-utils/composables/useLocale';
// const { $t } = useLocale();

const props = defineProps<{
  handler: PopMenuListHandler;
  layer: PopMenuLayerHandler;
}>();

const list = computed(() => {
  return props.handler.list;
});

const layer = computed(() => {
  return props.layer;
});

const onButtonClick = (item: MenuButton, e: MouseEvent) => {
  if (item.disabled) return;
  else {
    item.action?.(e);
    layer.value.clear();
  }
};

const onSubMenuMouseEnter = (item: SubMenu, e: MouseEvent) => {
  if (!item.menu) return;
  stopHide();
  const renderOption = reactive<MenuRenderOption>({
    placement: 'right-start',
    target: e.target as HTMLElement,
  });
  layer.value.submenu(props.handler.id, renderOption, item.menu);
  watch([renderOption], () => {
    if (renderOption.container) {
      renderOption.container.addEventListener('mouseenter', stopHide);
    }
  });
};

let hideSubmenuTimeout: any | null = null;

const hideSubmenu = () => {
  if (hideSubmenuTimeout) return;
  hideSubmenuTimeout = setTimeout(() => {
    layer.value.remove({ after: props.handler.id });
    hideSubmenuTimeout = null;
  }, 300);
};

const stopHide = () => {
  if (hideSubmenuTimeout) {
    clearTimeout(hideSubmenuTimeout);
    hideSubmenuTimeout = null;
  }
};

const rand = (item: any) => item.key ?? Math.random().toString();

const updateItemEl = (item:MenuButton,ele:any)=>{
  item.$el = ele
}
</script>

<template>
  <div class="menu-list">
    <div class="menu-list__item" v-for="item in list" :key="rand(item)">
      <template v-if="item.type === 'divide'">
        <hr class="menu-list__divide" />
      </template>
      <template v-if="item.type === 'button'">
        <div @click="(e) => onButtonClick(item, e)" @mouseenter="() => hideSubmenu()" @mouseleave="() => hideSubmenu()"
          :ref="(el) => updateItemEl(item,el) " :class="[
            'menu-list__button',
            item.disabled ? 'menu-list__button--disabled' : '',
          ]">
          <div class="menu-list__button-icon">
            <VxIcon v-if="item.icon" :name="item.icon"></VxIcon>
          </div>
          <div class="menu-list__button-label">
            {{
              item.label
            }}
          </div>
          <div class="menu-list__button-extra" v-if="item.extra && typeof item.extra === 'string'">
            {{ item.extra }}
          </div>
          <div class="menu-list__button-extra" v-if="item.extra && typeof item.extra === 'object'">
            <component :is="item.extra" />
          </div>
        </div>
      </template>

      <template v-if="item.type === 'submenu'">
        <div @mouseenter="(e) => onSubMenuMouseEnter(item, e)" @mouseleave="() => hideSubmenu()" :class="[
          'menu-list__button',
          !item.menu ? 'menu-list__button--disabled' : '',
        ]">
          <div class="menu-list__button-icon">
            <VxIcon v-if="item.icon" :name="item.icon"></VxIcon>
          </div>
          <div class="menu-list__button-label">
            {{
              item.label
            }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
<style>
:root {
  --menu-list-background: #1b1b1f;
  --menu-list-width: 240px;
  --menu-list-border: 1px solid rgba(255, 255, 255, 0.2);
  --menu-list-border-radius: 4px;
  --menu-list-box-shadow: 0 4px 8px 1px rgba(255, 255, 255, 0.04);
  --menu-list-padding: 4px;

  --menu-list-divide-margin: 4px 0;
  --menu-list-divide-height: 1px;
  --menu-list-divide-background: rgba(255, 255, 255, 0.2);

  --menu-list-button-height: 28px;
  --menu-list-button-font-size: 14px;
  --menu-list-button-text-color: #fff;
  --menu-list-button-disabled-text-color: rgba(255, 255, 255, 0.3);
}
</style>

<style>
:root {
  --menu-list-background: #1b1b1f;
  --menu-list-width: 240px;
  --menu-list-border: 1px solid rgba(255, 255, 255, 0.2);
  --menu-list-border-radius: 4px;
  --menu-list-box-shadow: 0 4px 8px 1px rgba(255, 255, 255, 0.04);
  --menu-list-padding: 4px;

  --menu-list-divide-margin: 4px 0;
  --menu-list-divide-height: 1px;
  --menu-list-divide-background: rgba(255, 255, 255, 0.2);

  --menu-list-button-height: 28px;
  --menu-list-button-font-size: 14px;
  --menu-list-button-text-color: #fff;
  --menu-list-button-disabled-text-color: rgba(255, 255, 255, 0.3);
}
</style>

<style lang="scss" scoped>
.menu-list {
  background: var(--menu-list-background);
  width: var(--menu-list-width);
  border: var(--menu-list-border);
  border-radius: var(--menu-list-border-radius);
  box-shadow: var(--menu-list-box-shadow);
  overflow: hidden;

  .menu-list__button {
    height: var(--menu-list-button-height);
    color: var(--menu-list-button-text-color);
    cursor: pointer;

    &:hover {
      background: var(--select-dropdown-item-selecte);
    }

    display: flex;
    flex-direction: row;
    align-items: center;

    &.menu-list__button--disabled {
      color: var(--menu-list-button-disabled-text-color);

      &:hover {
        background: none;
      }
    }

    .menu-list__button-icon {
      width: 24px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex: 0 0 auto;
    }

    .menu-list__button-label {
      font-size: var(--menu-list-button-font-size);
      flex: 1 1 0;
      width: 0;
      text-align: left;
    }

    .menu-list__button-extra {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  .menu-list__divide {
    display: block;
    width: auto;
    border: none;
    height: var(--menu-list-divide-height);
    background: var(--menu-list-divide-background);
    margin: var(--menu-list-divide-margin);
  }
}
</style>
