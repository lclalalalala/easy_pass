

// 获取当前标签页信息并生成用户名和密码
document.addEventListener('DOMContentLoaded', async function () {
    try {
        // 获取当前标签页
        let tab;
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            tab = tabs[0];
        } catch (chromeError) {
            console.log('Chrome API不可用，使用测试数据');
            // 在普通网页中测试时使用测试数据
            tab = { url: 'https://www.example.com/path' };
        }

        // 获取存储的生成函数
        let data;
        try {
            data = await chrome.storage.sync.get(['passwordFunction', 'usernameFunction']);
        } catch (storageError) {
            console.log('Storage API不可用，使用默认函数');
            // 在普通网页中测试时使用空数据
            data = {};
        }

        let username = 'Generation failed';
        let password = 'Generation failed';

        // 检查URL是否有效并提取变量
        let variables;
        if (tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            // 提取 hostname
            const mainDomain = extractMainDomain(url.hostname);
            variables = {
                domain: mainDomain,
            };
        } else {
            // 使用默认值
            variables = {
                domain: 'FailToGetDomain',
            };
        }

        // 生成用户名
        if (data.usernameFunction) {
            try {
                username = executePasswordFunction(data.usernameFunction, variables);
            } catch (error) {
                console.error('用户名生成错误:', error);
                username = 'Generation error';
            }
        } else {
            username = generateDefaultUsername(variables.domain);
        }

        // 生成密码
        if (data.passwordFunction) {
            try {
                password = executePasswordFunction(data.passwordFunction, variables);
            } catch (error) {
                console.error('密码生成错误:', error);
                password = 'Generation failed';
            }
        } else {
            password = generateDefaultPassword(variables.domain);
        }

        document.getElementById('username').textContent = username;
        document.getElementById('password').textContent = password;

        // 显示主域名
        if (variables && variables.domain) {
            document.getElementById('mainDomain').textContent = variables.domain;
        } else {
            document.getElementById('mainDomain').textContent = 'Failed to get domain';
        }

        // 自动复制密码到剪贴板
        try {
            await copyToClipboard(password);
        } catch (copyError) {
            console.log('复制到剪贴板失败:', copyError);
        }
        const notification = document.getElementById('notification');
        notification.textContent = 'Password copied to clipboard';
        notification.classList.add('show');
        setTimeout(() => {
            notification.textContent = '';
            notification.classList.remove('show');
        }, 10000);

    } catch (error) {
        console.error('错误:', error);
        document.getElementById('username').textContent = 'Failed to get';
            document.getElementById('password').textContent = 'Failed to get';
    }
});

// 复制用户名按钮点击事件
document.getElementById('copyUsernameBtn').addEventListener('click', async function () {
    const username = document.getElementById('username').textContent;
    try {
        await copyToClipboard(username);
    } catch (copyError) {
        console.log('复制用户名到剪贴板失败:', copyError);
    }
    const notification = document.getElementById('notification');
    notification.textContent = 'Username copied to clipboard';
    notification.classList.add('show');
    setTimeout(() => {
        notification.textContent = '';
        notification.classList.remove('show');
    }, 10000);
});

// 复制密码按钮点击事件
document.getElementById('copyPasswordBtn').addEventListener('click', async function () {
    const password = document.getElementById('password').textContent;
    try {
        await copyToClipboard(password);
    } catch (copyError) {
        console.log('复制密码到剪贴板失败:', copyError);
    }
    const notification = document.getElementById('notification');
    notification.textContent = 'Password copied to clipboard';
    notification.classList.add('show');
    setTimeout(() => {
        notification.textContent = '';
        notification.classList.remove('show');
    }, 10000);
});

// 设置按钮点击事件
document.getElementById('settingsBtn').addEventListener('click', function () {
    try {
        chrome.runtime.openOptionsPage();
    } catch (error) {
        console.log('无法打开设置页面:', error);
        // 在普通网页中测试时跳转到设置页面
        window.location.href = 'options.html';
    }
});