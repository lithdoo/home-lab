import type { VNode } from 'vue';
import { Menu, type MenuItem, PopMenuListHandler } from './handler';

export class PopMenuBuilder {
  static create() {
    return new PopMenuBuilder();
  }

  constructor(list: MenuItem[] = []) {
    this.list = list;
  }

  list: MenuItem[] = [];

  divide() {
    const item = Menu.divide();
    return new PopMenuBuilder(this.list.concat([item]));
  }

  button(
    key: string,
    label: string | VNode,
    action?: () => void,
    option: {
      icon?: string;
      disabled?: boolean;
    } = {}
  ) {
    const item = Menu.button({
      key,
      label,
      action,
      ...option,
    });
    return new PopMenuBuilder(this.list.concat([item]));
  }

  build() {
    return PopMenuListHandler.create(this.list);
  }
}
