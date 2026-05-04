// ==UserScript==
// @name         Grok - Keep Last 10 Responses
// @namespace    burak-tools
// @version      2.0
// @description  Keeps only the last 10 response elements in Grok, deletes older ones
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

    // Function to find and delete old response elements
    function deleteOldResponses() {
        // Find the last reply container (should never be deleted)
        const lastReplyContainer = document.getElementById('last-reply-container');
        if (!lastReplyContainer) return;
        
        // Find all response elements in the document
        const responseElements = document.querySelectorAll('[id^="response-"], [id*="response-"]');
        const responseArray = Array.from(responseElements);
        
        // Find the position of the last reply container in the response array
        const lastReplyIndex = responseArray.findIndex(el => 
            el.contains(lastReplyContainer) || 
            el.id === 'last-reply-container' ||
            el.querySelector('#last-reply-container')
        );
        
        // Get all responses up to and including the last reply container
        let responsesToCheck = [];
        if (lastReplyIndex >= 0) {
            responsesToCheck = responseArray.slice(0, lastReplyIndex + 1);
        } else {
            // If last reply container is not found in response elements, check all
            responsesToCheck = responseArray;
        }
        
        // If we have more than 10 responses, delete the oldest ones
        if (responsesToCheck.length > 10) {
            const responsesToDelete = responsesToCheck.slice(0, -10);
            
            console.log(`Found ${responsesToCheck.length} responses, deleting ${responsesToDelete.length} old ones`);
            
            // Delete old response elements
            responsesToDelete.forEach(response => {
                try {
                    response.remove();
                } catch (error) {
                    console.error('Error deleting response:', error);
                }
            });
        }
    }

    // Function to observe for new response elements
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if new response elements were added
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            if (element.matches && (
                                element.matches('[id^="response-"]') ||
                                element.matches('[id*="response-"]') ||
                                element.querySelector('[id^="response-"]') ||
                                element.querySelector('[id*="response-"]')
                            )) {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldUpdate) {
                // Wait a bit for responses to fully load
                setTimeout(deleteOldResponses, 100);
            }
        });
        
        // Start observing the document body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Response observer started');
    }

    // Initialize the script
    function init() {
        // Wait 60 seconds for the page to fully load
        setTimeout(() => {
            deleteOldResponses();
            startObserver();
        }, 60000);
    }

    // Start the script when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();