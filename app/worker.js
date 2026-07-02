let mainPort;

self.onmessage = (event) => {
  if (event.data.type === 'init') {
    mainPort = event.data.port;
    
    mainPort.onmessage = (e) => {
      console.log('Worker 收到:', e.data);
      mainPort.postMessage('Hello Main!');
    };
  }
};