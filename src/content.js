console.log("TopIt: Content script loaded");

// -----------------------------------------------------------------------------
// Utility Functions (Observer-based, no arbitrary sleeps)
// -----------------------------------------------------------------------------

/**
 * Waits for a condition to return a truthy value using MutationObserver.
 * @param {Function} checkFn - Function that checks the condition. Returns the value if found/true.
 * @param {number} timeout - Max wait time in ms.
 * @returns {Promise<any>} - Resolves with the return value of checkFn.
 */
function waitFor(checkFn, timeout = 10000) {
    return new Promise((resolve, reject) => {
        // Check immediately
        const immediateResult = checkFn();
        if (immediateResult) {
            resolve(immediateResult);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            const result = checkFn();
            if (result) {
                observer.disconnect();
                resolve(result);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error("Timeout waiting for condition: " + checkFn.toString()));
        }, timeout);
    });
}

function waitForElement(selector) {
    return waitFor(() => document.querySelector(selector));
}

function waitForXpath(xpath) {
    return waitFor(() => document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue);
}

function simulateClick(element) {
    const mouseEvents = ['mouseover', 'mousedown', 'mouseup', 'click'];
    mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        });
        element.dispatchEvent(event);
    });
}

async function typeValue(element, value) {
    // 1. Activate element (Material Design often needs a click to 'wake' the label)
    element.click();
    element.focus();
    
    // 2. Wait for focus (Poll instead of MutationObserver, as focus changes don't always mutate DOM)
    const startFocus = Date.now();
    while (document.activeElement !== element && (Date.now() - startFocus < 2000)) {
        element.focus(); 
        await new Promise(r => setTimeout(r, 50));
    }
    
    // Warn but continue if focus failed
    if (document.activeElement !== element) {
        console.warn("TopIt: Could not acquire focus, trying anyway", element);
    }

    // 3. Select All
    document.execCommand('selectAll', false, null);
    
    let success = false;
    // Check activeElement again before command
    if (document.activeElement === element) {
        success = document.execCommand('insertText', false, value);
    }
    
    // 4. Fallback if execCommand failed or value mismatch
    if (!success || element.value !== value) {
        console.log(`TopIt: execCommand failed for '${value}'. Using property setter.`);
        
        try {
            // Safe way to get native, un-overridden setter on HTMLInputElement
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(element, value);
        } catch (e) {
            console.warn("TopIt: Native setter failed, trying direct assign.", e);
            element.value = value;
        }
    }

    // 5. Dispatch Events
    // Always dispatch events to trigger framework validation
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); 
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    
    // Blur specifically helps trigger "on leave" validation
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// -----------------------------------------------------------------------------
// Main Logic
// -----------------------------------------------------------------------------

async function performSnooze(targetSnoozeBtn) {
  console.log("TopIt: Starting snooze sequence...");

  try {
    // 1. Find and click Snooze button
    // Use specific target if we know context, otherwise find first (fallback)
    let snoozeBtn = targetSnoozeBtn;
    if (!snoozeBtn) {
        // Fallback: search for aria-label OR title, as Gmail sometimes only has title initially
        snoozeBtn = await waitFor(() => document.querySelector('[aria-label="Snooze"], [title="Snooze"]'));
    }
    
    // Ensure visible/interactive? Usually valid if clicked.
    simulateClick(snoozeBtn);
    
    // 2. Find "Pick date & time" menu item
    // It appears asynchronously after the click
    const pickDateBtn = await waitForXpath("//div[contains(text(), 'Pick date & time')]");
    simulateClick(pickDateBtn);

    // 3. Dialog interactions
    // Wait for dialog inputs to appear in DOM
    const dateInput = await waitForElement('input[aria-label="Date"]');
    const timeInput = await waitForElement('input[aria-label="Time"]');

    const now = new Date();
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', dateOptions); 
    
    await typeValue(dateInput, formattedDate);
    
    const nowForTime = new Date(); 
    const nextMin = new Date(nowForTime.getTime() + 60 * 1000);
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const formattedTime = nextMin.toLocaleTimeString('en-US', timeOptions);

    await typeValue(timeInput, formattedTime);
    
    // 4. Save
    // Wait not just for existence, but for the button to be Enabled (validation logic complete)
    const saveBtn = await waitForXpath("//button[@data-mdc-dialog-action='ok'] | //button[descendant-or-self::*[text()='Save']]");
    
    // Wait until it's effectively enabled
    await waitFor(() => {
        return !saveBtn.disabled && saveBtn.getAttribute('aria-disabled') !== 'true';
    }, 2000).catch(() => console.warn("Save button did not become enabled, attempting click anyway"));

    simulateClick(saveBtn);
    console.log("TopIt: Success!");

  } catch (err) {
    console.error("TopIt Error:", err);
    alert("TopIt failed: " + err.message);
  }
}

// ----------------------------------------------------
// UI Injection Logic
// ----------------------------------------------------

function createCustomSnoozeBtn(nativeSnoozeBtn) {
    const newBtn = document.createElement('div');
    
    // Initial Class Sync only - strict style copying can inadvertently hide the button
    newBtn.className = nativeSnoozeBtn.className;
    
    // Enforce visibility basics, ignore native inline styles which might be 'display: none' transiently
    newBtn.style.display = 'inline-block';

    newBtn.removeAttribute('id');
    newBtn.setAttribute('role', 'button');
    newBtn.setAttribute('data-tooltip', 'TopIt (Snooze 1 Min)');
    newBtn.setAttribute('aria-label', 'TopIt (Snooze 1 Min)');
    
    // Sync ONLY class changes (for hover states, selection states etc)
    const syncObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                 // Keep our hover class if we added it manually, but sync the underlying base classes
                 const isHovered = newBtn.classList.contains('T-I-JW');
                 newBtn.className = nativeSnoozeBtn.className;
                 if (isHovered && !newBtn.classList.contains('T-I-JW')) {
                     newBtn.classList.add('T-I-JW');
                 }
            }
        });
    });
    syncObserver.observe(nativeSnoozeBtn, { attributes: true, attributeFilter: ['class'] });
    
    const innerContainer = document.createElement('div');
    innerContainer.className = 'asa';
    
    const iconContainer = document.createElement('div');
    iconContainer.className = 'T-I-J3 J-J5-Ji';
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';

    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icon48.png');
    iconImg.style.width = '20px'; 
    iconImg.style.height = '20px';
    iconImg.style.opacity = '0.7'; 
    
    iconContainer.appendChild(iconImg);
    innerContainer.appendChild(iconContainer);
    newBtn.appendChild(innerContainer);
    
    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        performSnooze(nativeSnoozeBtn);
    });
    
    newBtn.addEventListener('mouseenter', () => {
             newBtn.classList.add('T-I-JW'); 
             iconImg.style.opacity = '1';
    });
    newBtn.addEventListener('mouseleave', () => {
             newBtn.classList.remove('T-I-JW');
             iconImg.style.opacity = '0.7';
    });
    
    return newBtn;
}

function injectButtons() {
    // Find ALL snooze buttons (list view + single email view)
    // Gmail sometimes uses 'title="Snooze"' initially and adds 'aria-label="Snooze"' later on hover
    const snoozeButtons = document.querySelectorAll('[aria-label="Snooze"], [title="Snooze"]');
    
    for (const snoozeBtn of snoozeButtons) {
        // Double check specific text to avoid false positives if title implies something else
        const ariaLabel = snoozeBtn.getAttribute('aria-label');
        const title = snoozeBtn.getAttribute('title');
        
        // Strict check: Must match Snooze exactly
        if (ariaLabel !== 'Snooze' && title !== 'Snooze') continue;

        // Check if we already visited this button
        if (snoozeBtn.getAttribute('data-topit-injected')) continue;
        
        const newBtn = createCustomSnoozeBtn(snoozeBtn);
        
        // Insert BEFORE
        if (snoozeBtn.parentNode) {
            snoozeBtn.parentNode.insertBefore(newBtn, snoozeBtn);
            // Mark as injected
            snoozeBtn.setAttribute('data-topit-injected', 'true');
        }
    }
}

const observer = new MutationObserver((mutations) => {
    injectButtons();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

injectButtons();
