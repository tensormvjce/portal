/**
 * Enhanced Countdown System with Automatic Transitions
 * Handles countdown timers, deadline enforcement, and automatic week transitions
 */

import { 
  getCurrentActiveWeeks, 
  calculateWeekDeadlines, 
  isDeadlinePassed,
  advanceToNextCycle 
} from './automated-date-range.js';

// Import will be done dynamically to avoid circular dependencies

/**
 * Enhanced countdown system state
 */
let countdownInterval = null;
let currentCountdownWeek = null;
let isTransitioning = false;

/**
 * Enhanced startCountdown function with automatic transitions
 * @param {string} weekKey - Week identifier (e.g., "Sep8-14")
 * @param {Object} database - Firebase database reference
 * @param {Function} updateUICallback - Callback to update UI after transitions
 */
export async function startCountdown(weekKey, database, updateUICallback = null) {
  console.log('Starting enhanced countdown for week:', weekKey);
  
  try {
    // Clear any existing countdown
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    // Get current active weeks configuration
    const activeWeeks = getCurrentActiveWeeks();
    const weekData = activeWeeks.weeks[weekKey];
    
    if (!weekData) {
      console.error('Week data not found for:', weekKey);
      return false;
    }
    
    // Calculate deadline for this week
    const deadlineInfo = calculateWeekDeadlines(weekKey, weekData.startDate);
    const deadline = deadlineInfo.deadline;
    
    console.log('Countdown deadline set for:', deadlineInfo.formattedDeadline);
    
    // Update countdown display elements
    const banner = document.getElementById('countdownBanner');
    const countdownText = document.getElementById('countdownText');
    const countdownDisplay = document.getElementById('countdownDisplay');
    
    if (!banner || !countdownText || !countdownDisplay) {
      console.error('Countdown UI elements not found');
      return false;
    }
    
    // Show countdown banner
    banner.style.display = 'block';
    
    // Update countdown message
    countdownText.innerHTML = `⏰ <strong>Deadline approaching!</strong> Book your slots for <strong>${weekKey.replace('-', ' - ')}</strong> before ${deadlineInfo.formattedDeadline}!`;
    
    // Set current countdown week
    currentCountdownWeek = weekKey;
    
    // Start countdown interval
    countdownInterval = setInterval(async () => {
      await updateCountdownDisplay(weekKey, deadline, database, updateUICallback);
    }, 1000);
    
    // Initial display update
    await updateCountdownDisplay(weekKey, deadline, database, updateUICallback);
    
    return true;
    
  } catch (error) {
    console.error('Error starting countdown:', error);
    return false;
  }
}

/**
 * Updates countdown display and handles deadline reached
 * @param {string} weekKey - Week identifier
 * @param {Date} deadline - Deadline date/time
 * @param {Object} database - Firebase database reference
 * @param {Function} updateUICallback - Callback to update UI
 */
async function updateCountdownDisplay(weekKey, deadline, database, updateUICallback) {
  try {
    const now = new Date();
    const timeLeft = deadline - now;
    
    const countdownDisplay = document.getElementById('countdownDisplay');
    const countdownText = document.getElementById('countdownText');
    
    if (timeLeft <= 0) {
      // Deadline reached - trigger automatic processing
      console.log('Deadline reached for week:', weekKey);
      await handleDeadlineReached(weekKey, database, updateUICallback);
      return;
    }
    
    // Check if all slots are filled
    const allSlotsFilled = await checkIfAllSlotsFilled(weekKey, database);
    if (allSlotsFilled) {
      // All slots filled - update banner
      if (countdownText && countdownDisplay) {
        countdownText.innerHTML = `🎉 <strong>All slots filled!</strong> Wait for the next week to open!`;
        countdownDisplay.textContent = 'Stay tuned!';
      }
      return;
    }
    
    // Update countdown display
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    if (countdownDisplay) {
      if (days > 0) {
        countdownDisplay.textContent = `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      } else {
        countdownDisplay.textContent = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      }
    }
    
  } catch (error) {
    console.error('Error updating countdown display:', error);
  }
}

/**
 * Handles deadline reached event - triggers auto-assignment and week transition
 * @param {string} weekKey - Week identifier that reached deadline
 * @param {Object} database - Firebase database reference
 * @param {Function} updateUICallback - Callback to update UI
 */
export async function handleDeadlineReached(weekKey, database, updateUICallback = null) {
  console.log('Processing deadline reached for week:', weekKey);
  
  if (isTransitioning) {
    console.log('Already transitioning, skipping duplicate deadline processing');
    return;
  }
  
  isTransitioning = true;
  
  try {
    // Clear countdown interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    // Update countdown display to show processing
    const countdownText = document.getElementById('countdownText');
    const countdownDisplay = document.getElementById('countdownDisplay');
    
    if (countdownText && countdownDisplay) {
      countdownText.innerHTML = `⚡ <strong>Processing deadline...</strong> Auto-assigning remaining slots!`;
      countdownDisplay.textContent = 'Processing...';
    }
    
    // Step 1: Auto-assign remaining slots for the current week
    console.log('Step 1: Auto-assigning remaining slots for week:', weekKey);
    
    // Dynamic import to avoid circular dependencies
    let assignmentResult;
    try {
      const { autoAssignRemainingSlots } = await import('./automated-assignment-engine.js');
      assignmentResult = await autoAssignRemainingSlots(weekKey, database);
    } catch (importError) {
      console.warn('Could not import auto-assignment engine, using mock:', importError.message);
      // Use mock function if available (for testing)
      if (typeof window !== 'undefined' && window.mockAutoAssignRemainingSlots) {
        assignmentResult = await window.mockAutoAssignRemainingSlots(weekKey, database);
      } else {
        assignmentResult = {
          success: false,
          error: 'Auto-assignment engine not available'
        };
      }
    }
    
    if (assignmentResult.success) {
      console.log('Auto-assignment completed:', assignmentResult.assignments);
      
      // Show assignment results briefly
      if (countdownText) {
        const assignmentCount = assignmentResult.assignments.length;
        countdownText.innerHTML = `✅ <strong>Auto-assigned ${assignmentCount} slots!</strong> Advancing to next week...`;
      }
      
      // Wait a moment to show the result
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.warn('Auto-assignment had issues:', assignmentResult.error);
    }
    
    // Step 2: Advance to next week
    console.log('Step 2: Advancing to next week');
    const advanceResult = await advanceToNextWeek(weekKey, database);
    
    if (advanceResult.success) {
      console.log('Week advancement successful:', advanceResult);
      
      // Step 3: Start countdown for new week
      const newWeek = advanceResult.newBookingWeek;
      console.log('Step 3: Starting countdown for new week:', newWeek);
      
      // Update UI if callback provided
      if (updateUICallback) {
        await updateUICallback(advanceResult);
      }
      
      // Start countdown for new week
      setTimeout(async () => {
        await startCountdown(newWeek, database, updateUICallback);
      }, 1000);
      
    } else {
      console.error('Week advancement failed:', advanceResult.error);
      
      // Show error message
      if (countdownText && countdownDisplay) {
        countdownText.innerHTML = `❌ <strong>Error advancing week!</strong> Please contact admin.`;
        countdownDisplay.textContent = 'Error';
      }
    }
    
  } catch (error) {
    console.error('Error handling deadline reached:', error);
    
    // Show error message
    const countdownText = document.getElementById('countdownText');
    const countdownDisplay = document.getElementById('countdownDisplay');
    
    if (countdownText && countdownDisplay) {
      countdownText.innerHTML = `❌ <strong>System error!</strong> Please contact admin.`;
      countdownDisplay.textContent = 'Error';
    }
    
  } finally {
    isTransitioning = false;
  }
}

/**
 * Advances to the next week with proper data transitions
 * @param {string} currentWeekKey - Current week that's ending
 * @param {Object} database - Firebase database reference
 * @returns {Object} Result object with success status and new week info
 */
export async function advanceToNextWeek(currentWeekKey, database) {
  console.log('Advancing from week:', currentWeekKey);
  
  try {
    const { ref, get, set } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    
    // Get current configuration
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    if (!configSnapshot.exists()) {
      throw new Error('Week configuration not found in Firebase');
    }
    
    const currentConfig = configSnapshot.val();
    const currentCycle = currentConfig.currentCycle;
    
    console.log('Current cycle:', currentCycle);
    
    // Get next cycle configuration
    const nextCycleConfig = advanceToNextCycle(currentCycle);
    
    console.log('Next cycle config:', nextCycleConfig);
    
    // Update Firebase with new configuration
    const newConfig = {
      currentCycle: nextCycleConfig.currentCycle,
      activeWeeks: [nextCycleConfig.currentWeek, nextCycleConfig.nextWeek],
      currentBookingWeek: nextCycleConfig.bookingWeek,
      lastUpdated: new Date().toISOString(),
      deadlines: nextCycleConfig.deadlines,
      previousWeek: currentWeekKey,
      transitionedAt: new Date().toISOString()
    };
    
    // Update post type schedule for new weeks if needed
    if (currentConfig.postTypeSchedule) {
      newConfig.postTypeSchedule = {
        ...currentConfig.postTypeSchedule,
        // Add new weeks with alternating post types
        [nextCycleConfig.currentWeek]: { 
          sunday: currentConfig.postTypeSchedule[currentWeekKey]?.sunday === 'text' ? 'video' : 'text' 
        },
        [nextCycleConfig.nextWeek]: { 
          sunday: currentConfig.postTypeSchedule[currentWeekKey]?.sunday === 'text' ? 'text' : 'video' 
        }
      };
    }
    
    await set(configRef, newConfig);
    
    console.log('Firebase configuration updated successfully');
    
    return {
      success: true,
      previousWeek: currentWeekKey,
      newCurrentWeek: nextCycleConfig.currentWeek,
      newBookingWeek: nextCycleConfig.bookingWeek,
      newCycle: nextCycleConfig.currentCycle,
      config: newConfig
    };
    
  } catch (error) {
    console.error('Error advancing to next week:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Checks if all slots are filled for a given week
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {boolean} True if all slots are filled
 */
async function checkIfAllSlotsFilled(weekKey, database) {
  try {
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    
    // Get current active weeks to determine expected slots
    const activeWeeks = getCurrentActiveWeeks();
    const weekData = activeWeeks.weeks[weekKey];
    
    if (!weekData) {
      return false;
    }
    
    // Calculate expected slots
    let expectedSlots = 0;
    
    // Wednesday: 1 blog slot
    expectedSlots += 1;
    
    // Sunday: 6 slots (3 content + 3 design)
    expectedSlots += 6;
    
    // Get actual bookings
    const bookingsRef = ref(database, `bookings/${weekKey}`);
    const snapshot = await get(bookingsRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const bookings = snapshot.val();
    let filledSlots = 0;
    
    // Count filled slots
    Object.entries(bookings).forEach(([day, dayData]) => {
      Object.entries(dayData).forEach(([role, roleData]) => {
        filledSlots += Object.keys(roleData).length;
      });
    });
    
    return filledSlots >= expectedSlots;
    
  } catch (error) {
    console.error('Error checking if slots are filled:', error);
    return false;
  }
}

/**
 * Stops the current countdown
 */
export function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  currentCountdownWeek = null;
  
  // Hide countdown banner
  const banner = document.getElementById('countdownBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Gets the current countdown status
 * @returns {Object} Current countdown status
 */
export function getCountdownStatus() {
  return {
    isActive: countdownInterval !== null,
    currentWeek: currentCountdownWeek,
    isTransitioning: isTransitioning
  };
}

/**
 * Restarts countdown for a specific week (used after manual transitions)
 * @param {string} weekKey - Week to start countdown for
 * @param {Object} database - Firebase database reference
 * @param {Function} updateUICallback - Callback to update UI
 */
export async function restartCountdown(weekKey, database, updateUICallback = null) {
  console.log('Restarting countdown for week:', weekKey);
  
  // Stop current countdown
  stopCountdown();
  
  // Wait a moment then start new countdown
  setTimeout(async () => {
    await startCountdown(weekKey, database, updateUICallback);
  }, 500);
}

/**
 * Firebase schema for enhanced countdown system
 */
export const ENHANCED_COUNTDOWN_FIREBASE_SCHEMA = {
  countdownConfiguration: {
    currentCountdownWeek: "Sep8-Sep14",
    lastDeadlineProcessed: "Sep1-Sep7",
    autoTransitionEnabled: true,
    transitionHistory: [
      {
        fromWeek: "Sep1-Sep7",
        toWeek: "Sep8-Sep14",
        processedAt: "2025-09-07T19:00:00Z",
        autoAssignmentsCount: 3,
        success: true
      }
    ]
  },
  
  deadlineProcessing: {
    "Sep8-Sep14": {
      deadline: "2025-09-07T19:00:00+05:30",
      processed: false,
      processingStarted: null,
      processingCompleted: null,
      autoAssignmentsTriggered: false,
      transitionCompleted: false
    }
  }
};