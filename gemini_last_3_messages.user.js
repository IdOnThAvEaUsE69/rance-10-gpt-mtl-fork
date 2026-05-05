// ==UserScript==
// @name         Gemini - Keep Last 3 Messages
// @namespace    burak-tools
// @version      1.0
// @description  Keeps only the last 3 conversation pairs in Gemini, deletes older ones
// @author       Burak
// @match        https://gemini.google.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM.addStyle
// @license      MIT
// @compatible   firefox
// @compatible   chrome
// ==/UserScript==

(function() {
    'use strict';

    // Function to find and delete old conversation elements
    function deleteOldConversations() {
        // Find parent container that holds all conversations
        const parentContainer = document.querySelector('infinite-scroller');
        if (!parentContainer) {
            console.log('Parent container not found');
            return;
        }
        
        // Find all conversation containers (these contain both user query and response)
        const conversationElements = parentContainer.querySelectorAll('.conversation-container');
        const conversationArray = Array.from(conversationElements);
        
        console.log(`Found ${conversationArray.length} conversations`);
        
        // If we have more than 3 conversations, delete oldest ones
        if (conversationArray.length > 3) {
            const conversationsToDelete = conversationArray.slice(0, -3);
            
            console.log(`Deleting ${conversationsToDelete.length} old conversations`);
            
            // Delete old conversation elements
            conversationsToDelete.forEach(conversation => {
                try {
                    conversation.remove();
                } catch (error) {
                    console.error('Error deleting conversation:', error);
                }
            });
        }
    }

    // Function to observe for new conversation elements
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if new conversation elements were added
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            if (element.matches && (
                                element.matches('.conversation-container') ||
                                element.querySelector('.conversation-container')
                            )) {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldUpdate) {
                // Wait a bit for conversations to fully load
                setTimeout(deleteOldConversations, 500);
            }
        });
        
        // Start observing the parent container
        const parentContainer = document.querySelector('infinite-scroller');
        if (parentContainer) {
            observer.observe(parentContainer, {
                childList: true,
                subtree: true
            });
            console.log('Conversation observer started');
        }
    }

    // Initialize the script
    function init() {
        // Wait 60 seconds for the page to fully load
        setTimeout(() => {
            deleteOldConversations();
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
