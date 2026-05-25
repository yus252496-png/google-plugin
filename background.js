chrome.runtime.onInstalled.addListener(() => {
  console.log('CNBC News Collector 已安装');
});

// 点击工具栏图标时打开独立窗口，而不是默认弹窗
// 避免弹窗在失去焦点时自动关闭
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'popup/popup.html',
    type: 'popup',
    width: 900,
    height: 700,
  });
});
