# LLM Fallback + SSE 中断恢复

## Goal
提升 AI 对话的鲁棒性：LLM 主服务不可用时自动降级到备用 Provider；网络中断时保留已收到的内容并提供重试。

## Requirements

### 1. LLM Fallback
- 主 Provider: Agnes AI (`agnes-2.0-flash`)
- 备选: 百炼 DashScope (`qwen-turbo`，OpenAI 兼容接口)
- 使用 LangChain `withFallbacks()` 实现，主服务抛异常时自动切换到备选
- fallback 对前端透明，前端无感知

### 2. SSE 中断恢复
- 中断时保留已收到的 partial content，不替换为 "出错了，请重试"
- 中断时在输入框上方显示重试按钮，点击重新发送最后一轮用户消息
- 重试时带上之前已收到的 content 作为上下文继续对话
- 中断消息不再写入数据库（等待重试成功后再完整写入）

## Acceptance Criteria
1. 关闭 Agnes 网络 → 对话自动用百炼回复，前端无感知
2. 对话中手动断开网络 → 页面显示 partial content + 重试按钮
3. 点击重试 → 带上已有上下文重新请求
