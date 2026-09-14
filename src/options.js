
import { executePasswordFunction, normalizeEmailList, buildEmailList } from './core.js';
import { createSettingsStore } from './storage.js';

const store = createSettingsStore(chrome.storage.sync, chrome.storage.local);

const EMAIL_ROW_CLASS = 'email-row';
const EMAIL_INPUT_CLASS = 'email-input';
const EMAIL_RADIO_CLASS = 'email-default';
const EMAIL_REMOVE_CLASS = 'email-remove';

document.addEventListener('DOMContentLoaded', function () {
    loadSavedFunction();
});

// Save button click event (settings section)
document.getElementById('saveBtn').addEventListener('click', saveAll);

// Save button click event (default email section)
document.getElementById('saveEmailBtn').addEventListener('click', saveAll);

document.getElementById('addEmailBtn').addEventListener('click', function () {
    const rows = readEmailRows();
    // 第一行自动成为默认邮箱
    rows.push({ address: '', isDefault: rows.length === 0 });
    showEmailRows(rows);
});

// 递归查找：默认邮箱的 radio 嵌在它的 label 里，不是行的直接子元素
function findChildByClass(element, className) {
    for (let i = 0; i < element.children.length; i += 1) {
        const child = element.children[i];
        if (child.className === className) return child;
        const nested = findChildByClass(child, className);
        if (nested) return nested;
    }
    return null;
}

// 以 DOM 为唯一状态来源，避免再维护一份可能不同步的数据
function readEmailRows() {
    const container = document.getElementById('emailList');
    const rows = [];

    for (let i = 0; i < container.children.length; i += 1) {
        const row = container.children[i];
        const input = findChildByClass(row, EMAIL_INPUT_CLASS);
        const radio = findChildByClass(row, EMAIL_RADIO_CLASS);
        rows.push({
            address: input ? input.value : '',
            isDefault: !!(radio && radio.checked)
        });
    }

    return rows;
}

// 只在增/删行时整表重绘，所以不会打断正在输入的内容
function showEmailRows(rows) {
    const container = document.getElementById('emailList');
    // 始终留一行可输入的行，否则列表空了以后没地方填
    const visibleRows = rows.length > 0 ? rows : [{ address: '', isDefault: true }];

    container.replaceChildren();

    visibleRows.forEach(function (row, index) {
        const wrapper = document.createElement('div');
        wrapper.className = EMAIL_ROW_CLASS;

        const label = document.createElement('label');
        label.className = 'email-default-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'defaultEmail';
        radio.className = EMAIL_RADIO_CLASS;
        radio.checked = !!row.isDefault;
        label.appendChild(radio);

        const radioText = document.createElement('span');
        radioText.textContent = 'Default';
        label.appendChild(radioText);

        const input = document.createElement('input');
        input.type = 'email';
        input.className = EMAIL_INPUT_CLASS;
        input.value = row.address || '';
        input.placeholder = 'your.email@example.com';

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = EMAIL_REMOVE_CLASS;
        remove.textContent = 'Remove';
        remove.addEventListener('click', function () {
            const current = readEmailRows();
            current.splice(index, 1);
            showEmailRows(current);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        wrapper.appendChild(remove);
        container.appendChild(wrapper);
    });
}

// Persist all settings at once, so both save buttons behave the same
async function saveAll() {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();
    const emailResult = buildEmailList(readEmailRows());

    if (!emailResult.ok) {
        alert(emailResult.message);
        return;
    }

    let result;
    try {
        result = await store.save({
            emails: emailResult.emails,
            passwordFunction: passwordFunctionText,
            usernameFunction: usernameFunctionText
        });
    } catch (error) {
        alert(`Failed to save: ${error.message}`);
        return;
    }

    // 默认邮箱排到第一位，重绘让用户看到结果
    showEmailRows(emailResult.emails.map((address, index) => ({ address, isDefault: index === 0 })));
    updateCurrentFunctionDisplay(passwordFunctionText);
    updateCurrentEmailDisplay(emailResult.emails);

    if (result.backend === 'sync') {
        alert('Saved successfully!');
    } else {
        alert(`Saved on this device only because Chrome sync failed: ${result.syncError.message}`);
    }
}

// 用 DOM 节点拼出 debug 结果。绝不能用 innerHTML：
// 规则输出是用户可控的文本，规则里写 <img onerror=...> 就会在设置页里执行，
// 而设置页有 storage 权限，能读走邮箱清单和生成规则。
function renderDebugResult(blocks, isError) {
    const output = document.getElementById('debugOutput');
    output.replaceChildren();

    for (const block of blocks) {
        const title = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = block.title;
        title.appendChild(strong);
        output.appendChild(title);

        const pre = document.createElement('pre');
        pre.textContent = block.text;
        output.appendChild(pre);
    }

    const result = document.getElementById('debugResult');
    result.style.display = 'block';
    result.className = isError ? 'debug-result error' : 'debug-result';
}

function runDebugStep(title, errorTitle, run) {
    try {
        return { title, text: run() };
    } catch (error) {
        return { title: errorTitle, text: error.message };
    }
}

// Debug button click event
document.getElementById('debugBtn').addEventListener('click', function () {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();

    if (!passwordFunctionText && !usernameFunctionText) {
        alert('Please enter a password or username generation function');
        return;
    }

    const testVariables = { domain: 'example' };
    const blocks = [{
        title: 'Assumed current tab URL:',
        text: 'https://www.example.com/path?query=123'
    }];

    if (usernameFunctionText) {
        blocks.push(runDebugStep(
            'Generated Username:',
            'Username Generation Error:',
            () => executePasswordFunction(usernameFunctionText, testVariables)
        ));
    }

    if (passwordFunctionText) {
        blocks.push(runDebugStep(
            'Generated Password:',
            'Password Generation Error:',
            () => executePasswordFunction(passwordFunctionText, testVariables)
        ));
    }

    renderDebugResult(blocks, false);
});

// Load saved functions
async function loadSavedFunction() {
    const { data: result, readErrors } = await store.load();

    // 两个存储区域都读不到时，不能让 "No ... set" 冒充成“用户还没配过”
    if (readErrors.sync && readErrors.local) {
        showStorageReadWarning();
        return;
    }

    if (result.passwordFunction) {
        document.getElementById('passwordFunction').value = result.passwordFunction;
    }
    if (result.usernameFunction) {
        document.getElementById('usernameFunction').value = result.usernameFunction;
    }

    // 默认邮箱约定排在第一位
    const emails = normalizeEmailList(result);
    showEmailRows(emails.map((address, index) => ({ address, isDefault: index === 0 })));

    // Update display
    updateCurrentFunctionDisplay(result.passwordFunction);
    updateCurrentEmailDisplay(emails);
}

// 读写全部失败时的警告：明确告诉用户是存储出错，而不是配置不存在
function showStorageReadWarning() {
    for (const id of ['currentDefaultEmail', 'currentUsernameFunction', 'currentPasswordFunction']) {
        const element = document.getElementById(id);
        element.textContent = 'Could not read saved settings (storage error)';
        element.style.color = '#d32f2f';
    }
}

// Update current email list display
function updateCurrentEmailDisplay(emails) {
    const emailDisplayElement = document.getElementById('currentDefaultEmail');

    if (emails && emails.length > 0) {
        emailDisplayElement.textContent = emails
            .map((address, index) => (index === 0 ? `${address} (default)` : address))
            .join('\n');
        emailDisplayElement.style.color = '#333';
    } else {
        emailDisplayElement.textContent = 'No default email set';
        emailDisplayElement.style.color = '#999';
    }
}

// Update current function display
function updateCurrentFunctionDisplay(passwordFunctionText) {
    const passwordDisplayElement = document.getElementById('currentPasswordFunction');
    const usernameDisplayElement = document.getElementById('currentUsernameFunction');

    // Update password display
    if (passwordFunctionText) {
        passwordDisplayElement.textContent = passwordFunctionText;
        passwordDisplayElement.style.color = '#333';
    } else {
        passwordDisplayElement.textContent = 'No password generation rule set';
        passwordDisplayElement.style.color = '#999';
    }

    // Update username display
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();
    if (usernameFunctionText) {
        usernameDisplayElement.textContent = usernameFunctionText;
        usernameDisplayElement.style.color = '#333';
    } else {
        usernameDisplayElement.textContent = 'No username generation rule set';
        usernameDisplayElement.style.color = '#999';
    }
}