

// Load saved functions when the page loads
document.addEventListener('DOMContentLoaded', function () {
    loadSavedFunction();
});

// Save button click event
document.getElementById('saveBtn').addEventListener('click', function () {
    const passwordFunctionText = document.getElementById('passwordFunction').value.trim();
    const usernameFunctionText = document.getElementById('usernameFunction').value.trim();

    if (passwordFunctionText || usernameFunctionText) {
        chrome.storage.sync.set({ 
            passwordFunction: passwordFunctionText,
            usernameFunction: usernameFunctionText 
        }, function () {
            alert('Saved successfully!');
            updateCurrentFunctionDisplay(passwordFunctionText);
        });
    } else {
        alert('Please enter a password or username generation function');
    }
});

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
    chrome.storage.sync.get(['passwordFunction', 'usernameFunction'], function (result) {
        if (result.passwordFunction) {
            document.getElementById('passwordFunction').value = result.passwordFunction;
        }
        if (result.usernameFunction) {
            document.getElementById('usernameFunction').value = result.usernameFunction;
        }
        // Update display
        updateCurrentFunctionDisplay(result.passwordFunction);
    });
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