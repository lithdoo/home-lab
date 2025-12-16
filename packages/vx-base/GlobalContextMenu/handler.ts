import { PopMenuListHandler } from '../PopMenu';
import { fixReactive } from '../utils';

export interface ContextMenuEvent {
  clientY: number;
  clientX: number;
}

export class ContextMenu {
  static globe = fixReactive(new ContextMenu())
  ev: ContextMenuEvent | null = null;

  open(list: PopMenuListHandler, ev?: ContextMenuEvent) {
    this.ev = ev ?? null;
    this.$emitOpen?.(list);
  }
  $emitOpen?: (list: any) => void;

  close() { }
}

// export const contextMenu = fixReactive(new ContextMenu());


// export create