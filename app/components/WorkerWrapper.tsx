'use client';

import { useEffect, useRef, useState } from 'react';

export default function WorkerWrapper() {
  const [result, setResult] = useState<string>('');
//   const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../worker.js', import.meta.url));
    console.log(worker);
    
    // 创建 MessageChannel
    const channel = new MessageChannel();
    const { port1, port2 } = channel;
  
    // 将 port2 转移给 Worker（零拷贝传输）
    worker.postMessage({ type: "init", port: port2 }, [port2]);
  
    // 通过 port1 与 Worker 通信
    port1.onmessage = (event) => {
      console.log("主线程收到:", event.data);
      setResult(event.data);
    };
  
    port1.postMessage("Hello Worker!");

    // ✅ 创建 Worker（使用 import.meta.url 确保路径正确）
    /*workerRef.current = new Worker(
      new URL('@/workers/my-worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (e) => {
      console.log('主线程收到 Worker 消息:', e.data);
      setResult(e.data);
    };

    workerRef.current.onerror = (error) => {
      console.error('Worker 错误:', error);
    };

    // 发送消息到 Worker
    workerRef.current.postMessage('Hello Next.js Worker!');

    // 清理 Worker
    return () => {
      workerRef.current?.terminate();
    };*/
  }, []);

  return (
    <div>
      <p>Worker 计算结果: {result || '计算中...'}</p>
    </div>
  );
}