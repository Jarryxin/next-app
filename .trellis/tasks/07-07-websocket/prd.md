# WebSocket 最小示例练习

## Goal

在 Next.js 项目中创建一个最小 WebSocket 连接示例，理解 WebSocket 在项目中的应用方式。

## Requirements

1. **服务端**: 在 Next.js 项目中启动 WebSocket 服务（使用 `ws` 库，独立端口或同端口）
2. **客户端**: 一个独立页面（`/ws-demo`）展示 WebSocket 连接状态，包含：
   - 连接/断开按钮
   - 消息发送输入框 + 发送按钮
   - 消息收发日志展示
3. **双向通信**: 客户端发送消息 → 服务端 echo 返回（带时间戳）

## Tech Decisions

- 使用 `ws` 库（Node.js 标准 WebSocket 库）
- 服务端独立端口启动（不与 Next.js HTTP 冲突）
- 客户端使用浏览器原生 `WebSocket` API（无需额外依赖）

## Acceptance Criteria

1. [ ] 访问 `/ws-demo` 页面可看到连接面板
2. [ ] 点击「连接」建立 WebSocket 连接
3. [ ] 连接成功后发送消息，服务端 echo 返回
4. [ ] 点击「断开」关闭连接
5. [ ] 页面展示连接状态和消息日志
