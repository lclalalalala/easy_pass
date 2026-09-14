
import { executePasswordFunction, validateEmailInput } from './core.js';


document.addEventListener('DOMContentLoaded', function () {
    loadSavedFunction();
});

// Save button click event (settings section)
document.getElementById('saveBtn').addEventListener('click', saveAll);

// Save button click event (default email section)
document.getElementById('saveEmailBtn').addEventListener('click', saveAll);

// Persist all settings at once, so both save buttons behave the same
function saveAll() {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();
    const emailResult = validateEmailInput(document.getElementById('defaultEmail').value);

    if (!emailResult.ok) {
        alert(emailResult.message);
        return;
    }

    chrome.storage.sync.set({
        defaultEmail: emailResult.value,
        passwordFunction: passwordFunctionText,
        usernameFunction: usernameFunctionText
    }, function () {
        alert('Saved successfully!');
        updateCurrentFunctionDisplay(passwordFunctionText);
        updateCurrentEmailDisplay(emailResult.value);
    });
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
function loadSavedFunction() {
    chrome.storage.sync.get(['passwordFunction', 'usernameFunction', 'defaultEmail'], function (result) {
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
    });
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