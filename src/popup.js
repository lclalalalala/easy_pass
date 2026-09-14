import {
    extractMainDomain,
    executePasswordFunction,
    generateDefaultUsername,
    generateDefaultPassword,
    copyToClipboard,
    normalizeEmailList
} from './core.js';
import { createSettingsStore } from './storage.js';

// 获取当前标签页信息并生成用户名和密码
document.addEventListener('DOMContentLoaded', async function () {
    try {
        // 获取当前标签页
        let tab;
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0) {
                tab = tabs[0];
            } else {
                throw new Error('No active tabs found');
            }
        } catch (chromeError) {
            console.log('Chrome API不可用，使用测试数据:', chromeError);
            // 在普通网页中测试时使用测试数据
            tab = { url: 'https://www.example.com/path' };
            showNotification('使用测试模式，无法访问Chrome API');
        }

        // 获取存储的生成函数
        let data;
        let settingsUnreadable = false;
        try {
            const store = createSettingsStore(chrome.storage.sync, chrome.storage.local);
            const loaded = await store.load();
            data = loaded.data;
            settingsUnreadable = loaded.readErrors.sync && loaded.readErrors.local;
        } catch (storageError) {
            console.log('Storage API不可用，使用默认函数');
            // 在普通网页中测试时使用空数据
            data = {};
            settingsUnreadable = true;
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

        // 默认邮箱列表（全局设置，不随网站变化）。始终保留这一行：整行隐藏在设置前
        // 用户根本不知道有这个功能，所以未设置时也要显示并给出说明。
        const emails = normalizeEmailList(data);
        const emailGroup = document.getElementById('emailGroup');
        const emailSelect = document.getElementById('emailSelect');
        const emailEmpty = document.getElementById('emailEmpty');
        const emailCopyBtn = document.getElementById('copyEmailBtn');

        emailGroup.style.display = '';
        emailSelect.replaceChildren();
        if (emails.length > 0) {
            for (const address of emails) {
                const option = document.createElement('option');
                option.value = address;
                option.textContent = address;
                emailSelect.appendChild(option);
            }
            // 约定默认邮箱排在第一位，所以直接选中它
            emailSelect.value = emails[0];
            emailSelect.style.display = '';
            emailEmpty.style.display = 'none';
            emailCopyBtn.style.display = '';
        } else {
            emailEmpty.textContent = 'No default email set';
            emailEmpty.style.display = '';
            emailSelect.style.display = 'none';
            // 没有邮箱可复制时不要把提示文字复制出去
            emailCopyBtn.style.display = 'none';
        }

        // 自动复制密码到剪贴板（失败时必须如实告知，否则用户会以为已经复制成功）
        await copyWithNotification(password, 'Password copied to clipboard');

        // 两个存储区域都读不到时，界面上的默认值并不是用户的配置，必须提示，
        // 否则用户会以为自己的设置丢了 / 生效了
        if (settingsUnreadable) {
            showNotification('Could not read saved settings');
        }

    } catch (error) {
        console.error('错误:', error);
        document.getElementById('username').textContent = 'Failed to get';
        document.getElementById('password').textContent = 'Failed to get';
    }
});

// 复制用户名按钮点击事件
document.getElementById('copyUsernameBtn').addEventListener('click', function () {
    const username = document.getElementById('username').textContent;
    copyWithNotification(username, 'Username copied to clipboard');
});

// 复制密码按钮点击事件
document.getElementById('copyPasswordBtn').addEventListener('click', function () {
    const password = document.getElementById('password').textContent;
    copyWithNotification(password, 'Password copied to clipboard');
});

// 复制默认邮箱按钮点击事件
document.getElementById('copyEmailBtn').addEventListener('click', function () {
    const email = document.getElementById('emailSelect').value;
    copyWithNotification(email, 'Email copied to clipboard');
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


// 复制文本到剪贴板并显示通知。copyToClipboard 不抛异常、只返回成功与否，
// 所以这里必须检查返回值，否则复制失败也会显示“已复制”。
async function copyWithNotification(text, successMessage) {
    const succeeded = await copyToClipboard(text);
    showNotification(succeeded ? successMessage : 'Copy failed, please copy manually');
}

let notificationTimer;

// 显示通知
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');

    // 只保留最新的计时器，否则旧计时器会把刚显示的新提示提前清掉
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
        notification.textContent = '';
        notification.classList.remove('show');
    }, 10000);
}