# 安装

vue-vscroll 目前是仓库内的独立组件目录（`src/vscroll/`），按「可拆包」标准组织，将来可直接迁移为 npm 包。

## 在项目内使用

clone 仓库后，组件入口为：

```ts
import VScroll from './vscroll/VScroll.vue'
import { useVScroll } from './vscroll/useVScroll'
```

## 零运行时依赖

组件与核心算法只依赖 `vue`。开发工具链（TypeScript、Vitest、Vite）均为 devDependency。

## 版本要求

- Vue `>= 3.3`（组件使用 `generic` 泛型语法，插槽自动推导 item 类型）
- TypeScript `>= 5.0`（可选，纯 JS 也可使用，只是失去类型推导）