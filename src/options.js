
import { executePasswordFunction, validateEmailInput } from './core.js';
import { createSettingsStore } from './storage.js';

const store = createSettingsStore(chrome.storage.sync, chrome.storage.local);

document.addEventListener('DOMContentLoaded', function () {
    loadSavedFunction();
});

// Save button click event (settings section)
document.getElementById('saveBtn').addEventListener('click', saveAll);

// Save button click event (default email section)
document.getElementById('saveEmailBtn').addEventListener('click', saveAll);

// Persist all settings at once, so both save buttons behave the same
async function saveAll() {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();
    const emailResult = validateEmailInput(document.getElementById('defaultEmail').value);

    if (!emailResult.ok) {
        alert(emailResult.message);
        return;
    }

    let result;
    try {
        result = await store.save({
            defaultEmail: emailResult.value,
            passwordFunction: passwordFunctionText,
            usernameFunction: usernameFunctionText
        });
    } catch (error) {
        alert(`Failed to save: ${error.message}`);
        return;
    }

    updateCurrentFunctionDisplay(passwordFunctionText);
    updateCurrentEmailDisplay(emailResult.value);

    if (result.backend === 'sync') {
        alert('Saved successfully!');
    } else {
        alert(`Saved on this device only because Chrome sync failed: ${result.syncError.message}`);
    }
}

// Debug button click event
document.getElementById('debugBtn').addEventListener('click', async function () {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();

    if (!passwordFunctionText && !usernameFunctionText) {
        alert('Please enter a password or username generation function');
        return;
    }

    try {
        let testVariables = {
            domain: 'example',
        };

        let debugOutput = `
            <p><strong>Assumed current tab URL:</strong></p>
            <pre>https://www.example.com/path?query=123</pre>
        `;

        // Execute username debugging
        if (usernameFunctionText) {
            try {
                const usernameResult = executePasswordFunction(usernameFunctionText, testVariables);
                debugOutput += `
                    <p><strong>Generated Username:</strong></p>
                    <pre>${usernameResult}</pre>
                `;
            } catch (error) {
                debugOutput += `
                    <p><strong>Username Generation Error:</strong></p>
                    <pre>${error.message}</pre>
                `;
            }
        }

        // Execute password debugging
        if (passwordFunctionText) {
            try {
                const passwordResult = executePasswordFunction(passwordFunctionText, testVariables);
                debugOutput += `
                    <p><strong>Generated Password:</strong></p>
                    <pre>${passwordResult}</pre>
                `;
            } catch (error) {
                debugOutput += `
                    <p><strong>Password Generation Error:</strong></p>
                    <pre>${error.message}</pre>
                `;
            }
        }

        document.getElementById('debugOutput').innerHTML = debugOutput;
        document.getElementById('debugResult').style.display = 'block';
        document.getElementById('debugResult').className = 'debug-result';

    } catch (error) {
        document.getElementById('debugOutput').innerHTML = `
            <p><strong>Error Message:</strong></p>
            <pre>${error.message}</pre>
            <p><strong>Please check if the function syntax is correct</strong></p>
        `;
        document.getElementById('debugResult').style.display = 'block';
        document.getElementById('debugResult').className = 'debug-result error';
    }
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
    if (result.defaultEmail) {
        document.getElementById('defaultEmail').value = result.defaultEmail;
    }

    // Update display
    updateCurrentFunctionDisplay(result.passwordFunction);
    updateCurrentEmailDisplay(result.defaultEmail);
}

// 读写全部失败时的警告：明确告诉用户是存储出错，而不是配置不存在
function showStorageReadWarning() {
    for (const id of ['currentDefaultEmail', 'currentUsernameFunction', 'currentPasswordFunction']) {
        const element = document.getElementById(id);
        element.textContent = 'Could not read saved settings (storage error)';
        element.style.color = '#d32f2f';
    }
}

// Update current default email display
function updateCurrentEmailDisplay(email) {
    const emailDisplayElement = document.getElementById('currentDefaultEmail');

    if (email) {
        emailDisplayElement.textContent = email;
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