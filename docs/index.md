---
layout: home

hero:
  name: vue-vscroll
  text: 高性能虚拟滚动列表组件
  tagline: 零运行时依赖 · 10 万条数据 DOM 恒定 · 60fps 滚动
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/usage
    - theme: alt
      text: 查看示例
      link: /examples/basic

features:
  - title: 零运行时依赖
    details: 窗口计算、状态机、触底哨兵全部自研，只依赖 Vue 本身；核心算法纯函数、单测覆盖
  - title: 定高起步，动态预留
    details: itemSize 支持 number 或 (index) => number，函数形式为 v2 动态高度实测预留
  - title: 完整插槽集
    details: item / header / footer / empty / loading 五个插槽，事件 loadMore，方法 scrollToIndex / reset
  - title: 数据变更锚定
    details: 列表增删时以第一个可见项为锚修正滚动偏移，可视内容不跳动
---