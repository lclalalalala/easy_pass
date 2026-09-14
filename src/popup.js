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
            // 任意一侧读失败都要说：只读到 local 的降级副本时，邮箱/规则可能不是最新的
            settingsUnreadable = loaded.readErrors.sync || loaded.readErrors.local;
        } catch (storageError) {
            console.log('Storage API不可用，使用默认函数');
            // 在普通网页中测试时使用空数据
            data = {};
            settingsUnreadable = true;
        }

        let username = 'Generation failed';
        let password = 'Generation failed';

        // 检查URL是否有效并提取变量
        const hasWebsite = Boolean(tab.url && tab.url.startsWith('http'));
        let domainResolved = false;
        let variables;

        if (hasWebsite) {
            const url = new URL(tab.url);
            // 提取 hostname。少数 hostname（如 "www."）会退化成空，主域名取不出来
            const mainDomain = extractMainDomain(url.hostname);
            domainResolved = Boolean(mainDomain);
            // 取不到时用空串：引用会原样保留，一眼能看出没生成成功
            variables = {
                domain: mainDomain || '',
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
            emailEmpty.textContent = 'No emails set';
            emailEmpty.style.display = '';
            emailSelect.style.display = 'none';
            // 没有邮箱可复制时不要把提示文字复制出去
            emailCopyBtn.style.display = 'none';
        }

        // 自动复制只在密码可信时才做。下面三种情况算出来的密码是“假的”，
        // 静默放进剪贴板的话，用户不细看就会粘贴一个错密码：
        //   - 没有网站（chrome:// 等）：根本没有可用于推导的域名
        //   - 拿不到主域名：同样没有可用于推导的域名
        //   - 设置读不到：用的是默认规则，不是用户为该站设定的规则
        let warning = '';
        if (!hasWebsite) {
            warning = 'No website here, so nothing could be generated. Nothing was copied.';
        } else if (!domainResolved) {
            warning = 'Could not work out the website domain. Nothing was copied.';
        } else if (settingsUnreadable) {
            warning = 'Could not read saved settings. Nothing was copied.';
        }

        if (warning) {
            showNotification(warning);
        } else {
            // 复制失败时必须如实告知，否则用户会以为已经复制成功
            await copyWithNotification(password, 'Password copied to clipboard');
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