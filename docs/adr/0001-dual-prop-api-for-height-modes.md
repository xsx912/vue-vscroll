# 动态高度采用双 prop 协议，不引入 mode 枚举、不拆独立组件

行高模式有三种（固定 / 已知变高 / 动态测量），用户如何声明？我们决定：`itemSize` 保留双重含义（数字 = 固定行高；函数 = 已知变高），任一存在即确定性模式；`itemSize` 缺省时组件进入动态测量模式，估算高度由新增的可选 prop `estimatedItemSize`（默认 40px）给出。拒绝的替代方案：显式 `mode: 'fixed' | 'variable' | 'dynamic'` 枚举（与 itemSize 描述重复且可能互相冲突）和独立 `VScrollDynamic` 组件（props/slots/逻辑双份维护，长期分叉）。

## Consequences

- 三个模式复用同一套窗口计算与锚定机制，只是偏移来源不同。
- 同时传入 `itemSize` 与 `estimatedItemSize` 时 `itemSize` 优先，开发模式下告警。
- API 已随 0.2.0 发布，事后变更属于破坏性变更。
