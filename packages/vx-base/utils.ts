import { reactive } from "vue";

export const fixReactive = <T extends Object>(t: T ) => reactive(t) as T