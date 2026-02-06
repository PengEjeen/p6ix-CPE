import { useEffect, useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/tutorial.css';

/**
 * Custom hook to manage tutorial state with localStorage-based first-visit detection using driver.js
 * @param {string} pageKey - Unique identifier for the page (e.g., 'scheduleMasterList')
 * @param {Array} steps - Array of driver.js step configurations
 * @returns {Object} Tutorial controls
 */
export function useTutorial(pageKey, steps) {
    const STORAGE_KEY = `tutorial_completed_${pageKey}`;
    const driverRef = useRef(null);

    // Check if user has already seen this tutorial
    const hasSeenTutorial = () => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch (error) {
            console.error('Failed to check tutorial status:', error);
            return false;
        }
    };

    // Mark tutorial as completed
    const markAsCompleted = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (error) {
            console.error('Failed to save tutorial completion:', error);
        }
    }, [STORAGE_KEY]);

    // Reset tutorial (for testing purposes)
    const resetTutorial = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Failed to reset tutorial:', error);
        }
    }, [STORAGE_KEY]);

    // Initialize driver
    useEffect(() => {
        if (!driverRef.current && steps && steps.length > 0) {
            driverRef.current = driver({
                showProgress: true,
                steps: steps,
                allowClose: true,
                stagePadding: 15,
                stageRadius: 8,
                popoverOffset: 20,
                onDestroyStarted: () => {
                    // User is closing the tour
                    markAsCompleted();
                    if (driverRef.current) {
                        driverRef.current.destroy();
                    }
                },
                onNextClick: (element, step, opts) => {
                    // If last step, close the tour
                    if (opts.state.activeIndex === steps.length - 1) {
                        markAsCompleted();
                        if (driverRef.current) {
                            driverRef.current.destroy();
                        }
                    } else {
                        driverRef.current.moveNext();
                    }
                },
                onCloseClick: () => {
                    markAsCompleted();
                    if (driverRef.current) {
                        driverRef.current.destroy();
                    }
                },
            });

            // Start tutorial automatically on first visit
            if (!hasSeenTutorial()) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    if (driverRef.current) {
                        driverRef.current.drive();
                    }
                }, 500);
            }
        }

        // Cleanup
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
                driverRef.current = null;
            }
        };
    }, [steps, markAsCompleted]);

    const startTutorial = useCallback(() => {
        if (driverRef.current) {
            driverRef.current.drive();
        }
    }, []);

    return {
        startTutorial,
        resetTutorial,
        driver: driverRef.current
    };
}
