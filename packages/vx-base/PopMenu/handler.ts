import type { VNode } from 'vue';
import type { Placement, Instance as PopperInstance } from '@popperjs/core';
// type HTMLElement = any

export interface MenuButton {
  type: 'button';
  key: string;
  label: string | VNode;
  icon?: string;
  extra?: string | VNode;
  disabled: boolean;
  action?: (e: MouseEvent) => void;
  $el?: HTMLElement;
  appEvent?: string;
  accelerator?: string;
}

export interface SubMenu {
  type: 'submenu';
  key: string;
  label: string | VNode;
  icon?: string;
  menu?: PopMenuListHandler;
  $el?: HTMLElement;
  appEvent?: string;
  accelerator?: string;
}

export interface MenuDivide {
  type: 'divide';
}

export type MenuItem = MenuButton | MenuDivide | SubMenu;

export class PopMenuListHandler {
  static create(
    list: MenuItem[],
    opiton?: Partial<PopMenuListHandler>
  ): PopMenuListHandler {
    return Object.assign(new PopMenuListHandler(), {
      list,
      ...opiton,
    });
  }

  id: string = Math.random().toString();
  list: MenuItem[] = [];
  width?: number;
  $close: () => void = () => {};
}

export type MenuRenderOption = {
  target: HTMLElement;
  placement: Placement;
  popper?: PopperInstance;
  container?: HTMLElement;
};

export class PopMenuLayerHandler {
  stack: {
    menu: PopMenuListHandler;
    option: MenuRenderOption;
  }[] = [];
  open(option: MenuRenderOption, menu: PopMenuListHandler) {
    this.stack = [{ menu, option }];
  }
  clear() {
    this.stack = [];
  }
  submenu(pid: string, option: MenuRenderOption, menu: PopMenuListHandler) {
    const pIndex = this.stack.findIndex((v) => v.menu.id === pid);
    if (pIndex < 0) return;
    this.stack = this.stack
      .filter((_, idx) => idx <= pIndex)
      .concat({
        menu,
        option,
      });
  }
  remove({ current, after }: { current?: string; after?: string }) {
    if (current) {
      const index = this.stack.findIndex((v) => v.menu.id === current);
      if (index >= 0) {
        this.stack = this.stack.filter((_, idx) => idx < index);
        return;
      }
    }
    if (after) {
      const index = this.stack.findIndex((v) => v.menu.id === after);
      if (index >= 0) {
        this.stack = this.stack.filter((_, idx) => idx <= index);
        return;
      }
    }
  }

  private hideTimeout: any | null = null;

  hide(force: boolean = true) {
    if (force) {
      this.clear();
      return;
    }
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      this.clear();
      this.hideTimeout = null;
    }, 1000);
  }

  stopHide() {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
  }
}

export class Menu {
  static button(option: {
    key: string;
    label: string | VNode;
    icon?: string;
    disabled?: boolean;
    action?: (e: MouseEvent) => void;
    appEvent?: string;
    accelerator?: string;
  }): MenuButton {
    return {
      disabled: false,
      ...option,
      type: 'button',
    };
  }

  static submenu(option: {
    key: string;
    label: string | VNode;
    icon?: string;
    disabled?: boolean;
    menu?: PopMenuListHandler;
    appEvent?: string;
    accelerator?: string;
  }): SubMenu {
    return {
      ...option,
      type: 'submenu',
    };
  }
  static divide(): MenuDivide {
    return { type: 'divide' };
  }
}
