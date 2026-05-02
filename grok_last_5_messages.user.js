// ==UserScript==
// @name         Grok - Show Last 5 Messages
// @namespace    burak-tools
// @version      1.0
// @description  Shows only the last 5 messages from user and Grok in the conversation
// @author       Burak
// @match        https://grok.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM.addStyle
// @license      MIT
// @compatible   firefox
// @compatible   chrome
// ==/UserScript==

(function() {
    'use strict';

    // Cross-browser GM_addStyle
    const addStyle = (css) => {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(css);
        } else if (typeof GM !== 'undefined' && GM.addStyle) {
            GM.addStyle(css);
        } else {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // Function to hide old messages and show only last 5
    function hideOldMessages() {
        // Find all message containers - Grok uses various selectors
        const messageSelectors = [
            '[data-testid="conversation-turn"]',
            '[data-message-id]',
            '.message',
            '[role="presentation"]',
            'div[class*="message"]',
            'div[class*="conversation"]'
        ];
        
        let allMessages = [];
        
        // Try different selectors to find messages
        for (const selector of messageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                allMessages = Array.from(elements);
                break;
            }
        }
        
        // If no messages found with specific selectors, try broader search
        if (allMessages.length === 0) {
            // Look for divs that contain typical message content
            const allDivs = document.querySelectorAll('div');
            allMessages = Array.from(allDivs).filter(div => {
                const text = div.textContent || '';
                // Check if this looks like a message (has substantial text)
                return text.length > 50 && (
                    text.includes('Grok') || 
                    text.includes('User') ||
                    div.querySelector('[data-testid*="message"]') ||
                    div.querySelector('[role="presentation"]') ||
                    div.parentElement?.querySelector('[data-testid="conversation-turn"]')
                );
            });
        }
        
        if (allMessages.length > 10) {
            // Hide all but the last 10 messages (5 user + 5 Grok)
            const messagesToHide = allMessages.slice(0, -10);
            const messagesToShow = allMessages.slice(-10);
            
            // Hide old messages
            messagesToHide.forEach(message => {
                message.style.display = 'none';
            });
            
            // Show recent messages
            messagesToShow.forEach(message => {
                message.style.display = '';
            });
            
            console.log(`Hidden ${messagesToHide.length} old messages, showing ${messagesToShow.length} recent messages`);
        }
    }

    // Function to observe DOM changes
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if new messages were added
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            if (element.matches && (
                                element.matches('[data-testid="conversation-turn"]') ||
                                element.matches('[data-message-id]') ||
                                element.matches('.message') ||
                                element.querySelector('[data-testid="conversation-turn"]') ||
                                element.querySelector('[data-message-id]') ||
                                element.querySelector('.message')
                            )) {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldUpdate) {
                // Wait a bit for messages to fully load
                setTimeout(hideOldMessages, 100);
            }
        });
        
        // Start observing the document body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize the script
    function init() {
        // Wait a moment for the page to fully load
        setTimeout(() => {
            hideOldMessages();
            startObserver();
        }, 1000);
    }

    // Start the script when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
