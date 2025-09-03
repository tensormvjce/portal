/**
 * UI Automation System
 * Handles automated UI updates for break logic, slot filtering, and enhanced messaging
 */

import { 
  getCurrentActiveWeeks,
  calculateWeekDeadlines 
} from './automated-date-range.js';

import {
  checkUserEligibility,
  getUserBreakStatus,
  filterSlotsForUser
} from './break-logic.js';

import {
  determinePostType,
  getNextSameTypeWeek
} from './content-type-alternation.js';

/**
 * Updates dropdown population to show only current booking week
 * @param {Object} database - Firebase database reference
 * @param {string} currentUserId - Current user identifier (optional)
 */
export async function updateDropdownsForCurrentWeek(database, currentUserId = null) {
  try {
    console.log('Updating dropdowns for current booking week');
    
    // Get current active weeks configuration
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    let currentBookingWeek = null;
    let activeWeeks = {};
    
    if (configSnapshot.exists()) {
      const config = configSnapshot.val();
      currentBookingWeek = config.currentBookingWeek;
      
      // Get week data from automated system
      const automatedWeeks = getCurrentActiveWeeks(config.currentCycle || 1);
      activeWeeks = automatedWeeks.weeks;
    } else {
      // Fallback to default
      const automatedWeeks = getCurrentActiveWeeks(1);
      currentBookingWeek = automatedWeeks.bookingWeek;
      activeWeeks = automatedWeeks.weeks;
    }
    
    // Update date range dropdown
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect && currentBookingWeek && activeWeeks[currentBookingWeek]) {
      dateRangeSelect.innerHTML = '<option value="" disabled selected>Select week</option>';
      
      // Check if user is eligible for this week
      let isEligible = true;
      let breakMessage = '';
      
      if (currentUserId) {
        const eligibility = await checkUserEligibility(currentUserId, currentBookingWeek, database);
        isEligible = eligibility.isEligible;
        if (!isEligible) {
          breakMessage = ` (You're in break period - ${eligibility.reason})`;
        }
      }
      
      const option = document.createElement('option');
      option.value = currentBookingWeek;
      option.disabled = !isEligible;
      
      const weekDisplay = currentBookingWeek.replace('-', ' - ');
      option.textContent = `Slots Open: ${weekDisplay}${breakMessage}`;
      
      if (!isEligible) {
        option.style.color = '#ef4444';
        option.style.fontStyle = 'italic';
      }
      
      dateRangeSelect.appendChild(option);
      
      // Add break status indicator if user is not eligible
      if (!isEligible && currentUserId) {
        addBreakStatusIndicator(dateRangeSelect, currentBookingWeek, currentUserId, database);
      }
    }
    
    console.log('Dropdowns updated for current booking week:', currentBookingWeek);
    
  } catch (error) {
    console.error('Error updating dropdowns for current week:', error);
  }
}

/**
 * Adds break status indicators to the slot selection interface
 * @param {HTMLElement} parentElement - Parent element to add indicator to
 * @param {string} weekKey - Week identifier
 * @param {string} userId - User identifier
 * @param {Object} database - Firebase database reference
 */
export async function addBreakStatusIndicator(parentElement, weekKey, userId, database) {
  try {
    // Remove existing indicator
    const existingIndicator = document.getElementById('breakStatusIndicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Get user break status
    const breakStatus = await getUserBreakStatus(userId, [weekKey], database);
    const weekStatus = breakStatus[weekKey];
    
    if (!weekStatus || weekStatus.isEligible) {
      return; // No indicator needed
    }
    
    // Create break status indicator
    const indicator = document.createElement('div');
    indicator.id = 'breakStatusIndicator';
    indicator.className = 'break-status-indicator';
    indicator.innerHTML = `
      <div class="break-status-content">
        <i class="fas fa-pause-circle"></i>
        <div class="break-status-text">
          <strong>Break Week Active</strong>
          <p>${weekStatus.reason}</p>
          ${weekStatus.lastAssignedWeek ? `<small>Last assigned: ${weekStatus.lastAssignedWeek}</small>` : ''}
        </div>
      </div>
    `;
    
    // Add styles
    indicator.style.cssText = `
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #92400e;
      animation: slideDown 0.3s ease forwards;
    `;
    
    // Style the content
    const content = indicator.querySelector('.break-status-content');
    if (content) {
      content.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
      `;
    }
    
    const icon = indicator.querySelector('i');
    if (icon) {
      icon.style.cssText = `
        font-size: 1.5rem;
        color: #f59e0b;
      `;
    }
    
    const textDiv = indicator.querySelector('.break-status-text');
    if (textDiv) {
      textDiv.style.cssText = `
        flex: 1;
      `;
    }
    
    const strong = indicator.querySelector('strong');
    if (strong) {
      strong.style.cssText = `
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 600;
      `;
    }
    
    const p = indicator.querySelector('p');
    if (p) {
      p.style.cssText = `
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
      `;
    }
    
    const small = indicator.querySelector('small');
    if (small) {
      small.style.cssText = `
        display: block;
        margin-top: 0.25rem;
        font-size: 0.8rem;
        opacity: 0.7;
      `;
    }
    
    // Insert after parent element
    if (parentElement.parentNode) {
      parentElement.parentNode.insertBefore(indicator, parentElement.nextSibling);
    }
    
  } catch (error) {
    console.error('Error adding break status indicator:', error);
  }
}

/**
 * Updates slot filtering to hide ineligible slots for users in break period
 * @param {string} userId - User identifier
 * @param {Array} availableSlots - Array of available slot objects
 * @param {Object} database - Firebase database reference
 * @returns {Array} Filtered slots array
 */
export async function updateSlotFiltering(userId, availableSlots, database) {
  try {
    console.log('Filtering slots for user:', userId);
    
    if (!userId || !availableSlots || availableSlots.length === 0) {
      return availableSlots;
    }
    
    // Use break logic to filter slots
    const eligibleSlots = await filterSlotsForUser(userId, availableSlots, database);
    
    console.log(`Filtered ${availableSlots.length} slots to ${eligibleSlots.length} eligible slots for user ${userId}`);
    
    return eligibleSlots;
    
  } catch (error) {
    console.error('Error filtering slots:', error);
    return availableSlots; // Return original slots if filtering fails
  }
}

/**
 * Updates day and role dropdowns based on user eligibility
 * @param {string} weekKey - Selected week
 * @param {string} userId - User identifier
 * @param {Object} database - Firebase database reference
 */
export async function updateDayRoleDropdowns(weekKey, userId, database) {
  try {
    const daySelect = document.getElementById('daySelect');
    const roleSelect = document.getElementById('roleSelect');
    
    if (!daySelect || !roleSelect || !weekKey) {
      return;
    }
    
    // Check user eligibility for this week
    const eligibility = await checkUserEligibility(userId, weekKey, database);
    
    if (!eligibility.isEligible) {
      // User not eligible - disable all options
      daySelect.innerHTML = '<option value="" disabled selected>Not available during break week</option>';
      roleSelect.innerHTML = '<option value="" disabled selected>Not available during break week</option>';
      
      daySelect.disabled = true;
      roleSelect.disabled = true;
      
      // Show break status indicator
      await addBreakStatusIndicator(daySelect, weekKey, userId, database);
      
      return;
    }
    
    // User is eligible - populate normally
    daySelect.disabled = false;
    roleSelect.disabled = false;
    
    // Get week data
    const activeWeeks = getCurrentActiveWeeks();
    const weekData = activeWeeks.weeks[weekKey];
    
    if (!weekData) {
      console.error('Week data not found for:', weekKey);
      return;
    }
    
    // Populate day dropdown
    daySelect.innerHTML = '<option value="" disabled selected>Choose day</option>';
    
    for (const [dayName, dayData] of Object.entries(weekData.days)) {
      const option = document.createElement('option');
      option.value = dayName;
      
      if (dayName === 'Sunday') {
        const postType = determinePostType(weekKey);
        const formattedDate = formatDate(dayData);
        option.textContent = `${dayName} (${formattedDate}) - ${postType.toUpperCase()}`;
      } else {
        const formattedDate = formatDate(dayData);
        option.textContent = `${dayName} (${formattedDate})`;
      }
      
      daySelect.appendChild(option);
    }
    
    // Clear role dropdown
    roleSelect.innerHTML = '<option value="" disabled selected>Select role</option>';
    
  } catch (error) {
    console.error('Error updating day/role dropdowns:', error);
  }
}

/**
 * Enhances countdown banner with automated transition messaging
 * @param {string} currentWeek - Current week identifier
 * @param {Object} database - Firebase database reference
 */
export async function enhanceCountdownBanner(currentWeek, database) {
  try {
    const countdownText = document.getElementById('countdownText');
    const countdownBanner = document.getElementById('countdownBanner');
    
    if (!countdownText || !countdownBanner) {
      return;
    }
    
    // Get current configuration
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    let config = {};
    if (configSnapshot.exists()) {
      config = configSnapshot.val();
    }
    
    // Get week data and deadline
    const activeWeeks = getCurrentActiveWeeks(config.currentCycle || 1);
    const weekData = activeWeeks.weeks[currentWeek];
    
    if (!weekData) {
      return;
    }
    
    const deadlineInfo = calculateWeekDeadlines(currentWeek, weekData.startDate);
    
    // Enhanced messaging with automation context
    const enhancedMessage = `
      <div class="countdown-enhanced-message">
        <div class="countdown-main-text">
          <i class="fas fa-robot"></i>
          <strong>Automated Scheduling Active!</strong> 
          Book your slots for <strong>${currentWeek.replace('-', ' - ')}</strong>
        </div>
        <div class="countdown-sub-text">
          <i class="fas fa-clock"></i>
          Deadline: ${deadlineInfo.formattedDeadline} | 
          <i class="fas fa-magic"></i>
          Remaining slots will be auto-assigned | 
          <i class="fas fa-forward"></i>
          Next week opens automatically
        </div>
      </div>
    `;
    
    countdownText.innerHTML = enhancedMessage;
    
    // Add enhanced styling
    const style = document.createElement('style');
    style.textContent = `
      .countdown-enhanced-message {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .countdown-main-text {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
      }
      
      .countdown-sub-text {
        display: flex;
        align-items: center;
        gap: 1rem;
        font-size: 0.9rem;
        opacity: 0.9;
        flex-wrap: wrap;
      }
      
      .countdown-sub-text i {
        margin-right: 0.25rem;
      }
      
      @media (max-width: 768px) {
        .countdown-sub-text {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }
      }
    `;
    
    if (!document.getElementById('countdownEnhancedStyles')) {
      style.id = 'countdownEnhancedStyles';
      document.head.appendChild(style);
    }
    
  } catch (error) {
    console.error('Error enhancing countdown banner:', error);
  }
}

/**
 * Updates the entire UI for automated features
 * @param {string} userId - Current user identifier (optional)
 * @param {Object} database - Firebase database reference
 */
export async function updateAutomatedUI(userId = null, database) {
  try {
    console.log('Updating automated UI features');
    
    // Update dropdowns for current week
    await updateDropdownsForCurrentWeek(database, userId);
    
    // Get current booking week for other updates
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    let currentBookingWeek = null;
    if (configSnapshot.exists()) {
      const config = configSnapshot.val();
      currentBookingWeek = config.currentBookingWeek;
    } else {
      const automatedWeeks = getCurrentActiveWeeks(1);
      currentBookingWeek = automatedWeeks.bookingWeek;
    }
    
    if (currentBookingWeek) {
      // Enhance countdown banner
      await enhanceCountdownBanner(currentBookingWeek, database);
      
      // Update day/role dropdowns if user is provided
      if (userId) {
        await updateDayRoleDropdowns(currentBookingWeek, userId, database);
      }
    }
    
    console.log('Automated UI features updated successfully');
    
  } catch (error) {
    console.error('Error updating automated UI:', error);
  }
}

/**
 * Initializes UI automation event handlers
 * @param {Object} database - Firebase database reference
 */
export function initializeUIAutomation(database) {
  try {
    console.log('Initializing UI automation event handlers');
    
    // Date range change handler with break logic
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', async function(e) {
        const weekKey = e.target.value;
        const userId = getCurrentUserId(); // You'll need to implement this
        
        if (weekKey && userId) {
          await updateDayRoleDropdowns(weekKey, userId, database);
        }
      });
    }
    
    // Day change handler with post type information
    const daySelect = document.getElementById('daySelect');
    if (daySelect) {
      daySelect.addEventListener('change', async function(e) {
        const selectedDay = e.target.value;
        const selectedWeek = dateRangeSelect?.value;
        const roleSelect = document.getElementById('roleSelect');
        
        if (!selectedDay || !selectedWeek || !roleSelect) {
          return;
        }
        
        roleSelect.innerHTML = '<option value="" disabled selected>Select role</option>';
        
        if (selectedDay === 'Sunday') {
          const postType = determinePostType(selectedWeek);
          const postTypeDisplay = postType.charAt(0).toUpperCase() + postType.slice(1);
          
          roleSelect.innerHTML = `
            <option value="" disabled selected>Select role</option>
            <option value="Content">Content - ${postTypeDisplay} Post (3 slots)</option>
            <option value="Design">Design - ${postTypeDisplay} Post (3 slots)</option>
          `;
          
          // Show post type information
          updatePostTypeDisplay(selectedWeek, postType);
        } else if (selectedDay === 'Wednesday') {
          roleSelect.innerHTML = `
            <option value="" disabled selected>Select role</option>
            <option value="BlogPost">Blog Post Writer (1 slot)</option>
          `;
          
          clearPostTypeDisplay();
        }
      });
    }
    
    console.log('UI automation event handlers initialized');
    
  } catch (error) {
    console.error('Error initializing UI automation:', error);
  }
}

/**
 * Updates post type display with enhanced information
 * @param {string} weekKey - Week identifier
 * @param {string} postType - Post type (text/video)
 */
function updatePostTypeDisplay(weekKey, postType) {
  try {
    let container = document.getElementById('postTypeDisplayContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'postTypeDisplayContainer';
      container.style.marginTop = '0.5rem';
      
      const daySelect = document.getElementById('daySelect');
      if (daySelect && daySelect.parentNode) {
        daySelect.parentNode.insertBefore(container, daySelect.nextSibling);
      }
    }
    
    const postTypeDisplay = postType.charAt(0).toUpperCase() + postType.slice(1);
    const nextSameTypeWeek = getNextSameTypeWeek(weekKey, postType);
    
    container.innerHTML = `
      <div class="post-type-enhanced-display">
        <div class="post-type-badge" style="background: ${postType === 'text' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(249, 115, 22, 0.2)'}; color: ${postType === 'text' ? '#38bdf8' : '#fb923c'}; display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; border: 1px solid rgba(255, 255, 255, 0.2);">
          📝 ${postTypeDisplay} Post Week
        </div>
        <div class="post-type-info" style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.25rem;">
          <div><i class="fas fa-calendar-alt"></i> Next ${postType} post: ${nextSameTypeWeek}</div>
          <div><i class="fas fa-users"></i> 3 Content + 3 Design slots available</div>
          <div><i class="fas fa-sync-alt"></i> Alternates with ${postType === 'text' ? 'video' : 'text'} posts every 2 weeks</div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error updating post type display:', error);
  }
}

/**
 * Clears post type display
 */
function clearPostTypeDisplay() {
  const container = document.getElementById('postTypeDisplayContainer');
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Helper function to get current user ID (placeholder - implement based on your auth system)
 * @returns {string|null} Current user ID or null
 */
function getCurrentUserId() {
  // This is a placeholder - implement based on your authentication system
  // For now, return null to indicate no user authentication
  return null;
}

/**
 * Helper function to format date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Shows a notification about UI automation features
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, warning, error)
 */
export function showUIAutomationNotification(message, type = 'info') {
  try {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `ui-automation-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1000;
      background: ${getNotificationColor(type)};
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      animation: slideInRight 0.3s ease forwards;
    `;
    
    const content = notification.querySelector('.notification-content');
    if (content) {
      content.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
      `;
    }
    
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        margin-left: auto;
      `;
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
  } catch (error) {
    console.error('Error showing UI automation notification:', error);
  }
}

/**
 * Helper function to get notification icon
 * @param {string} type - Notification type
 * @returns {string} Icon class name
 */
function getNotificationIcon(type) {
  const icons = {
    info: 'info-circle',
    success: 'check-circle',
    warning: 'exclamation-triangle',
    error: 'exclamation-circle'
  };
  return icons[type] || 'info-circle';
}

/**
 * Helper function to get notification color
 * @param {string} type - Notification type
 * @returns {string} CSS color value
 */
function getNotificationColor(type) {
  const colors = {
    info: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };
  return colors[type] || '#3b82f6';
}

/**
 * Adds CSS animation keyframes for UI automation
 */
function addUIAutomationStyles() {
  if (document.getElementById('uiAutomationStyles')) {
    return; // Already added
  }
  
  const style = document.createElement('style');
  style.id = 'uiAutomationStyles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideDown {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .break-status-indicator {
      animation: slideDown 0.3s ease forwards;
    }
    
    .ui-automation-notification {
      animation: slideInRight 0.3s ease forwards;
    }
  `;
  
  document.head.appendChild(style);
}

// Initialize styles when module loads
if (typeof document !== 'undefined') {
  addUIAutomationStyles();
}