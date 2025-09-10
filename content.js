// 内容脚本，用于与页面交互
console.log('Password generator content script loaded');

// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'getPageInfo') {
        // 返回页面信息
        sendResponse({
            title: document.title,
            url: window.location.href,
            hostname: window.location.hostname
        });
    }
    return true; // 保持消息通道开放
});