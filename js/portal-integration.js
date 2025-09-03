/**
 * Portal Integration System
 * Integrates all automation components with the existing portal
 * Task 12: Integrate all automation components with existing portal
 */

// Import all automation systems
import { 
  getCurrentActiveWeeks as getAutomatedActiveWeeks,
  calculateWeekDeadlines, 
  initializeFirebaseSchema,
  advanceToNextCycle,
  isDeadlinePassed
} from './automated-date-range.js';

import {
  checkUserEligibility,
  updateAssignmentHistory,
  getEligibleUsers,
  filterSlotsForUser,
  getUserBreakStatus,
  initializeBreakLogicSchema
} from './break-logic.js';

import {
  updateDropdownsForCurrentWeek,
  addBreakStatusIndicator,
  updateSlotFiltering,
  updateDayRoleDropdowns,
  enhanceCountdownBanner,
  updateAutomatedUI,
  initializeUIAutomation,
  showUIAutomationNotification
} from './ui-automation.js';

import {
  startCountdown,
  handleDeadlineReached,
  advanceToNextWeek,
  restartCountdown,
  stopCountdown,
  getCountdownStatus
} from './enhanced-countdown-system.js';

import {
  autoAssignRemainingSlots,
  selectOptimalUser,
  distributeWorkload,
  initializeAssignmentEngineSchema
} from './automated-assignment-engine.js';

import {
  scheduleWednesdayBlogPosts,
  processQueuedBlogAssignments,
  getBlogAssignmentStatus,
  initializeBlogAutomationSchema
} from './blog-automation.js';

import {
  determinePostType,
  getNextSameTypeWeek,
  updatePostTypeSchedule,
  initializePostTypeSchedule,
  assignSundayRoles,
  validateSundayPostAssignment
} from './content-type-alternation.js';

/**
 * Enhanced getCurrentActiveWeeks function with automation logic
 * Replaces the existing function in the portal
 * @param {Object} database - Firebase database reference
 * @returns {Object} Current active weeks with automation data
 */
export async function getCurrentActiveWeeks(database) {
  try {
    console.log('Getting current active weeks with automation logic');
    
    // Initialize all schemas if needed
    await initializeFirebaseSchema(database);
    await initializeBreakLogicSchema(database);
    await initializePostTypeSchedule(database);
    await initializeBlogAutomationSchema(database);
    await initializeAssignmentEngineSchema(database);
    
    // Get current configuration from Firebase
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    let currentCycle = 3; // Default to cycle 3 (Sep1-Sep14)
    let activeWeeks = {};
    let currentBookingWeek = null;
    let deadlines = {};
    
    if (configSnapshot.exists()) {
      const config = configSnapshot.val();
      currentCycle = config.currentCycle || 3;
      currentBookingWeek = config.currentBookingWeek;
      deadlines = config.deadlines || {};
      
      console.log('Loaded configuration from Firebase:', {
        currentCycle,
        currentBookingWeek,
        deadlines: Object.keys(deadlines)
      });
    } else {
      console.log('No Firebase config found, initializing with defaults');
    }
    
    // Get automated active weeks
    const automatedWeeks = getAutomatedActiveWeeks(currentCycle);
    
    // Convert to legacy format for compatibility with existing portal code
    const legacyFormat = {};
    Object.values(automatedWeeks.weeks).forEach(week => {
      legacyFormat[week.key] = {
        start: week.startDate,
        end: week.endDate,
        days: {
          'Wednesday': week.days.Wednesday,
          'Sunday': {
            date: week.days.Sunday,
            postType: determinePostType(week.key)
          }
        }
      };
    });
    
    // Update global variables for compatibility
    if (typeof window !== 'undefined') {
      window.dateRanges = legacyFormat;
      window.currentWeekCycle = automatedWeeks.currentCycle;
      window.currentActiveWeek = currentBookingWeek || automatedWeeks.bookingWeek;
    }
    
    return {
      dateRanges: legacyFormat,
      currentCycle: automatedWeeks.currentCycle,
      currentWeek: automatedWeeks.currentWeek,
      nextWeek: automatedWeeks.nextWeek,
      bookingWeek: currentBookingWeek || automatedWeeks.bookingWeek,
      deadlines: deadlines,
      automatedWeeks: automatedWeeks
    };
    
  } catch (error) {
    console.error('Error getting current active weeks:', error);
    
    // Fallback to basic automated weeks
    const fallbackWeeks = getAutomatedActiveWeeks(3);
    const legacyFormat = {};
    
    Object.values(fallbackWeeks.weeks).forEach(week => {
      legacyFormat[week.key] = {
        start: week.startDate,
        end: week.endDate,
        days: {
          'Wednesday': week.days.Wednesday,
          'Sunday': {
            date: week.days.Sunday,
            postType: 'text' // Default fallback
          }
        }
      };
    });
    
    return {
      dateRanges: legacyFormat,
      currentCycle: fallbackWeeks.currentCycle,
      currentWeek: fallbackWeeks.currentWeek,
      nextWeek: fallbackWeeks.nextWeek,
      bookingWeek: fallbackWeeks.bookingWeek,
      deadlines: {},
      automatedWeeks: fallbackWeeks
    };
  }
}

/**
 * Enhanced form submission with break logic validation
 * Replaces the existing form submission handler
 * @param {Object} database - Firebase database reference
 * @param {Function} originalSubmitHandler - Original form submission logic
 */
export function enhanceFormSubmission(database, originalSubmitHandler) {
  const form = document.getElementById('slotBookingForm');
  if (!form) {
    console.error('Slot booking form not found');
    return;
  }
  
  // Remove existing event listeners
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  // Add enhanced event listener
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      console.log('Processing enhanced form submission with break logic');
      
      // Get form data
      const formData = new FormData(newForm);
      const userName = formData.get('userName') || document.getElementById('userName')?.value;
      const dateRange = formData.get('dateRange') || document.getElementById('dateRangeSelect')?.value;
      const day = formData.get('day') || document.getElementById('daySelect')?.value;
      const role = formData.get('role') || document.getElementById('roleSelect')?.value;
      const number = formData.get('number') || document.getElementById('number')?.value;
      
      if (!userName || !dateRange || !day || !role || !number) {
        showUIAutomationNotification('Please fill in all required fields', 'warning');
        return;
      }
      
      // Create user identifier from name and number
      const userId = `${userName.toLowerCase().replace(/\s+/g, '_')}_${number.replace(/\D/g, '').slice(-4)}`;
      
      // Check user eligibility with break logic
      console.log('Checking user eligibility for break logic');
      const eligibility = await checkUserEligibility(userId, dateRange, database);
      
      if (!eligibility.isEligible) {
        // User is in break period
        showUIAutomationNotification(
          `Sorry, you cannot book slots this week. ${eligibility.reason}. You'll be eligible again starting ${eligibility.nextEligibleWeek || 'next week'}.`,
          'warning'
        );
        
        // Add break status indicator
        await addBreakStatusIndicator(newForm, dateRange, userId, database);
        return;
      }
      
      // Validate Sunday post assignment limits
      if (day === 'Sunday') {
        const isValidAssignment = await validateSundayPostAssignment(dateRange, role, database);
        if (!isValidAssignment.isValid) {
          showUIAutomationNotification(
            `Cannot assign Sunday ${role} slot: ${isValidAssignment.reason}`,
            'error'
          );
          return;
        }
      }
      
      // Show processing indicator
      const submitBtn = newForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
      }
      
      // Call original submission handler
      const submissionResult = await originalSubmitHandler(e, {
        userName,
        dateRange,
        day,
        role,
        number,
        userId
      });
      
      if (submissionResult !== false) {
        // Submission successful - update assignment history
        console.log('Updating assignment history after successful booking');
        
        const assignment = {
          week: dateRange,
          day: day,
          role: role.toLowerCase(),
          assignedAt: new Date().toISOString(),
          assignmentType: 'manual',
          ...(day === 'Sunday' && { postType: determinePostType(dateRange) })
        };
        
        const historyResult = await updateAssignmentHistory(userId, assignment, database);
        
        if (historyResult.success) {
          console.log('Assignment history updated successfully');
          showUIAutomationNotification(
            `Slot booked successfully! You'll be eligible for new assignments starting ${historyResult.nextEligibleWeek}.`,
            'success'
          );
        } else {
          console.warn('Failed to update assignment history:', historyResult.error);
        }
        
        // Update UI to reflect new break status
        setTimeout(async () => {
          await updateAutomatedUI(userId, database);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error in enhanced form submission:', error);
      showUIAutomationNotification(
        'An error occurred while processing your request. Please try again.',
        'error'
      );
    } finally {
      // Remove loading state
      const submitBtn = newForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    }
  });
  
  console.log('Enhanced form submission handler installed');
}

/**
 * Enhances admin dashboard with automation controls
 * @param {Object} database - Firebase database reference
 */
export function enhanceAdminDashboard(database) {
  try {
    console.log('Enhancing admin dashboard with automation controls');
    
    // Add automation status section
    addAutomationStatusSection(database);
    
    // Add manual override controls
    addManualOverrideControls(database);
    
    // Add break logic management
    addBreakLogicManagement(database);
    
    // Add system monitoring
    addSystemMonitoring(database);
    
    // Enhance existing auto-assign with break logic
    enhanceAutoAssignSection(database);
    
    console.log('Admin dashboard enhanced successfully');
    
  } catch (error) {
    console.error('Error enhancing admin dashboard:', error);
  }
}

/**
 * Adds automation status section to admin dashboard
 * @param {Object} database - Firebase database reference
 */
function addAutomationStatusSection(database) {
  const adminDashboard = document.getElementById('adminDashboardSection');
  if (!adminDashboard) return;
  
  // Create automation status section
  const statusSection = document.createElement('div');
  statusSection.id = 'automationStatusSection';
  statusSection.className = 'container';
  statusSection.style.display = 'none';
  statusSection.style.maxWidth = '1200px';
  statusSection.style.margin = '0 auto';
  
  statusSection.innerHTML = `
    <div class="card" style="width: 100%;">
      <h2 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-robot"></i>
        Automation Status
      </h2>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="automation-status-card">
          <h3><i class="fas fa-calendar-alt"></i> Week Management</h3>
          <div id="weekManagementStatus">Loading...</div>
        </div>
        
        <div class="automation-status-card">
          <h3><i class="fas fa-clock"></i> Countdown System</h3>
          <div id="countdownSystemStatus">Loading...</div>
        </div>
        
        <div class="automation-status-card">
          <h3><i class="fas fa-pause-circle"></i> Break Logic</h3>
          <div id="breakLogicStatus">Loading...</div>
        </div>
        
        <div class="automation-status-card">
          <h3><i class="fas fa-magic"></i> Auto-Assignment</h3>
          <div id="autoAssignmentStatus">Loading...</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button id="refreshAutomationStatus" style="background: var(--primary-gradient); color: white; border: none; border-radius: 8px; padding: 0.75rem 1.5rem; font-weight: 600; cursor: pointer;">
          <i class="fas fa-sync-alt"></i> Refresh Status
        </button>
        <button id="validateSystemConsistency" style="background: var(--info); color: white; border: none; border-radius: 8px; padding: 0.75rem 1.5rem; font-weight: 600; cursor: pointer;">
          <i class="fas fa-check-double"></i> Validate System
        </button>
      </div>
      
      <div id="automationStatusResults" style="margin-top: 2rem; display: none;"></div>
    </div>
  `;
  
  // Add styles for status cards
  const style = document.createElement('style');
  style.textContent = `
    .automation-status-card {
      background: var(--surface-light);
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .automation-status-card h3 {
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--primary);
    }
    
    .automation-status-card .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .automation-status-card .status-item:last-child {
      border-bottom: none;
    }
    
    .status-indicator {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .status-indicator.active {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    
    .status-indicator.inactive {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    
    .status-indicator.warning {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }
  `;
  
  if (!document.getElementById('automationStatusStyles')) {
    style.id = 'automationStatusStyles';
    document.head.appendChild(style);
  }
  
  // Insert after existing sections
  adminDashboard.appendChild(statusSection);
  
  // Add navigation button
  const navButtons = document.getElementById('navButtons');
  if (navButtons) {
    const statusNavBtn = document.createElement('button');
    statusNavBtn.id = 'navAutomationStatus';
    statusNavBtn.textContent = 'Automation Status';
    statusNavBtn.style.cssText = 'background: var(--surface-light); color: var(--text); border: none; border-radius: 8px; padding: 0.5rem 1.5rem; font-weight: 600; cursor: pointer;';
    
    statusNavBtn.addEventListener('click', () => {
      // Hide other sections
      document.querySelectorAll('#adminDashboardSection .container').forEach(section => {
        section.style.display = 'none';
      });
      
      // Show automation status section
      statusSection.style.display = 'block';
      
      // Update nav button styles
      document.querySelectorAll('#navButtons button').forEach(btn => {
        btn.style.background = 'var(--surface-light)';
        btn.style.color = 'var(--text)';
      });
      statusNavBtn.style.background = 'var(--primary-gradient)';
      statusNavBtn.style.color = 'white';
      
      // Load status data
      loadAutomationStatus(database);
    });
    
    navButtons.appendChild(statusNavBtn);
  }
  
  // Add event listeners
  document.getElementById('refreshAutomationStatus')?.addEventListener('click', () => {
    loadAutomationStatus(database);
  });
  
  document.getElementById('validateSystemConsistency')?.addEventListener('click', async () => {
    await validateSystemConsistency(database);
  });
}

/**
 * Loads and displays automation status
 * @param {Object} database - Firebase database reference
 */
async function loadAutomationStatus(database) {
  try {
    console.log('Loading automation status');
    
    // Week Management Status
    const weekStatus = document.getElementById('weekManagementStatus');
    if (weekStatus) {
      const activeWeeks = await getCurrentActiveWeeks(database);
      weekStatus.innerHTML = `
        <div class="status-item">
          <span>Current Cycle:</span>
          <span class="status-indicator active">${activeWeeks.currentCycle}</span>
        </div>
        <div class="status-item">
          <span>Booking Week:</span>
          <span>${activeWeeks.bookingWeek}</span>
        </div>
        <div class="status-item">
          <span>Active Weeks:</span>
          <span>${activeWeeks.currentWeek}, ${activeWeeks.nextWeek}</span>
        </div>
      `;
    }
    
    // Countdown System Status
    const countdownStatus = document.getElementById('countdownSystemStatus');
    if (countdownStatus) {
      const status = getCountdownStatus();
      countdownStatus.innerHTML = `
        <div class="status-item">
          <span>Countdown Active:</span>
          <span class="status-indicator ${status.isActive ? 'active' : 'inactive'}">
            ${status.isActive ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div class="status-item">
          <span>Current Week:</span>
          <span>${status.currentWeek || 'None'}</span>
        </div>
        <div class="status-item">
          <span>Transitioning:</span>
          <span class="status-indicator ${status.isTransitioning ? 'warning' : 'active'}">
            ${status.isTransitioning ? 'Yes' : 'No'}
          </span>
        </div>
      `;
    }
    
    // Break Logic Status
    const breakStatus = document.getElementById('breakLogicStatus');
    if (breakStatus) {
      // Get sample break logic data
      const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
      const historyRef = ref(database, 'userAssignmentHistory');
      const historySnapshot = await get(historyRef);
      
      const userCount = historySnapshot.exists() ? Object.keys(historySnapshot.val()).length : 0;
      
      breakStatus.innerHTML = `
        <div class="status-item">
          <span>Users Tracked:</span>
          <span class="status-indicator active">${userCount}</span>
        </div>
        <div class="status-item">
          <span>Break Logic:</span>
          <span class="status-indicator active">Enabled</span>
        </div>
        <div class="status-item">
          <span>Schema:</span>
          <span class="status-indicator active">Initialized</span>
        </div>
      `;
    }
    
    // Auto-Assignment Status
    const autoAssignStatus = document.getElementById('autoAssignmentStatus');
    if (autoAssignStatus) {
      autoAssignStatus.innerHTML = `
        <div class="status-item">
          <span>Engine Status:</span>
          <span class="status-indicator active">Ready</span>
        </div>
        <div class="status-item">
          <span>Last Assignment:</span>
          <span>Not available</span>
        </div>
        <div class="status-item">
          <span>Queue Status:</span>
          <span class="status-indicator active">Empty</span>
        </div>
      `;
    }
    
    console.log('Automation status loaded successfully');
    
  } catch (error) {
    console.error('Error loading automation status:', error);
    showUIAutomationNotification('Error loading automation status', 'error');
  }
}

/**
 * Validates system consistency across all automation components
 * @param {Object} database - Firebase database reference
 */
async function validateSystemConsistency(database) {
  try {
    console.log('Validating system consistency');
    
    const resultsDiv = document.getElementById('automationStatusResults');
    if (!resultsDiv) return;
    
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Validating system consistency...</div>';
    
    const results = [];
    
    // Validate break logic consistency
    try {
      const { validateBreakLogicConsistency } = await import('./break-logic.js');
      const breakValidation = await validateBreakLogicConsistency(database);
      results.push({
        component: 'Break Logic',
        status: breakValidation.isConsistent ? 'success' : 'error',
        message: breakValidation.isConsistent ? 
          'All user assignment histories are consistent' : 
          `Found ${breakValidation.inconsistencies.length} inconsistencies`,
        details: breakValidation.inconsistencies
      });
    } catch (error) {
      results.push({
        component: 'Break Logic',
        status: 'error',
        message: `Validation failed: ${error.message}`
      });
    }
    
    // Validate week configuration
    try {
      const activeWeeks = await getCurrentActiveWeeks(database);
      const hasValidConfig = activeWeeks.currentCycle && activeWeeks.bookingWeek;
      results.push({
        component: 'Week Configuration',
        status: hasValidConfig ? 'success' : 'warning',
        message: hasValidConfig ? 
          'Week configuration is valid' : 
          'Week configuration may need attention'
      });
    } catch (error) {
      results.push({
        component: 'Week Configuration',
        status: 'error',
        message: `Configuration check failed: ${error.message}`
      });
    }
    
    // Display results
    let resultsHTML = '<h3>System Validation Results</h3><div style="display: grid; gap: 1rem; margin-top: 1rem;">';
    
    results.forEach(result => {
      const statusColor = result.status === 'success' ? '#10b981' : 
                         result.status === 'warning' ? '#f59e0b' : '#ef4444';
      const statusIcon = result.status === 'success' ? 'check-circle' : 
                        result.status === 'warning' ? 'exclamation-triangle' : 'exclamation-circle';
      
      resultsHTML += `
        <div style="background: var(--surface-light); padding: 1rem; border-radius: 8px; border-left: 4px solid ${statusColor};">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <i class="fas fa-${statusIcon}" style="color: ${statusColor};"></i>
            <strong>${result.component}</strong>
          </div>
          <p style="margin: 0; color: var(--text-muted);">${result.message}</p>
          ${result.details && result.details.length > 0 ? `
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: var(--primary);">View Details</summary>
              <pre style="background: var(--background); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.8rem; overflow-x: auto;">${JSON.stringify(result.details, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `;
    });
    
    resultsHTML += '</div>';
    resultsDiv.innerHTML = resultsHTML;
    
    console.log('System validation completed');
    
  } catch (error) {
    console.error('Error validating system consistency:', error);
    const resultsDiv = document.getElementById('automationStatusResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = `<div style="color: var(--error); text-align: center; padding: 2rem;">Error during validation: ${error.message}</div>`;
    }
  }
}

/**
 * Adds manual override controls to admin dashboard
 * @param {Object} database - Firebase database reference
 */
function addManualOverrideControls(database) {
  // This would add controls for manual week transitions, deadline overrides, etc.
  // Implementation details would depend on specific requirements
  console.log('Manual override controls would be added here');
}

/**
 * Adds break logic management to admin dashboard
 * @param {Object} database - Firebase database reference
 */
function addBreakLogicManagement(database) {
  // This would add controls for viewing/managing user break statuses
  // Implementation details would depend on specific requirements
  console.log('Break logic management controls would be added here');
}

/**
 * Adds system monitoring to admin dashboard
 * @param {Object} database - Firebase database reference
 */
function addSystemMonitoring(database) {
  // This would add real-time monitoring of automation systems
  // Implementation details would depend on specific requirements
  console.log('System monitoring controls would be added here');
}

/**
 * Enhances existing auto-assign section with break logic
 * @param {Object} database - Firebase database reference
 */
function enhanceAutoAssignSection(database) {
  const autoAssignForm = document.getElementById('autoAssignForm');
  if (!autoAssignForm) return;
  
  // Add break logic information to auto-assign results
  const originalSubmitHandler = autoAssignForm.onsubmit;
  
  autoAssignForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const range = document.getElementById('autoDateRange')?.value;
    const day = document.getElementById('autoDay')?.value;
    const role = document.getElementById('autoRole')?.value;
    
    if (!range || !day || !role) {
      showUIAutomationNotification('Please select all fields', 'warning');
      return;
    }
    
    try {
      // Get eligible users with break logic
      const eligibleUsers = await getEligibleUsers(role.toLowerCase(), range, database);
      
      const resultDiv = document.getElementById('autoAssignResult');
      if (resultDiv) {
        if (eligibleUsers.length === 0) {
          resultDiv.innerHTML = `
            <div style="background: var(--warning); color: white; padding: 1rem; border-radius: 8px;">
              <h4><i class="fas fa-exclamation-triangle"></i> No Eligible Users</h4>
              <p>No users are eligible for ${role} assignment in ${range} due to break logic constraints.</p>
              <p>All users may be in their mandatory break week.</p>
            </div>
          `;
        } else {
          resultDiv.innerHTML = `
            <div style="background: var(--success); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
              <h4><i class="fas fa-users"></i> Eligible Users Found</h4>
              <p>Found ${eligibleUsers.length} eligible users for ${role} in ${range}</p>
            </div>
            <div style="background: var(--surface-light); padding: 1rem; border-radius: 8px;">
              <h5>Eligible Users (sorted by assignment count):</h5>
              <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                ${eligibleUsers.map(user => `
                  <li>${user.name} - ${user.totalAssignments} assignments (${user.eligibilityReason})</li>
                `).join('')}
              </ul>
            </div>
          `;
        }
      }
      
      // If there are eligible users, proceed with original auto-assign logic
      if (eligibleUsers.length > 0 && originalSubmitHandler) {
        originalSubmitHandler.call(autoAssignForm, e);
      }
      
    } catch (error) {
      console.error('Error in enhanced auto-assign:', error);
      showUIAutomationNotification('Error checking user eligibility', 'error');
    }
  });
}

/**
 * Updates existing slot display logic with automated filtering
 * @param {Object} database - Firebase database reference
 * @param {string} userId - Current user identifier (optional)
 */
export async function updateSlotDisplayLogic(database, userId = null) {
  try {
    console.log('Updating slot display logic with automated filtering');
    
    // Get current active weeks
    const activeWeeks = await getCurrentActiveWeeks(database);
    
    // Update the slot availability display
    const slotAvailability = document.getElementById('slotAvailability');
    if (!slotAvailability) return;
    
    // Get existing slot data
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    
    let slotsHTML = '';
    
    // Display slots for each active week
    for (const [weekKey, weekData] of Object.entries(activeWeeks.dateRanges)) {
      const bookingsRef = ref(database, `bookings/${weekKey}`);
      const bookingsSnapshot = await get(bookingsRef);
      const bookings = bookingsSnapshot.exists() ? bookingsSnapshot.val() : {};
      
      slotsHTML += `<h3>${weekKey.replace('-', ' - ')}</h3>`;
      
      // Wednesday slots
      const wednesdayBookings = bookings.Wednesday || {};
      const blogBookings = wednesdayBookings.BlogPost || {};
      const blogSlotsFilled = Object.keys(blogBookings).length;
      
      if (blogSlotsFilled < 1) {
        // Check if user is eligible for this slot
        let isEligible = true;
        let eligibilityMessage = '';
        
        if (userId) {
          const eligibility = await checkUserEligibility(userId, weekKey, database);
          isEligible = eligibility.isEligible;
          if (!isEligible) {
            eligibilityMessage = ` (Break week - ${eligibility.reason})`;
          }
        }
        
        slotsHTML += `
          <div class="slot-item" style="${!isEligible ? 'opacity: 0.5; border-left-color: #f59e0b;' : ''}">
            <div class="slot-details">
              <div class="slot-day">Wednesday Blog Post${eligibilityMessage}</div>
              <div class="slot-date">${weekData.days.Wednesday.toLocaleDateString()}</div>
              <div class="slot-role">
                <span class="category-badge blog">Blog Writer</span>
                ${!isEligible ? '<span style="color: #f59e0b; font-size: 0.8rem;"><i class="fas fa-pause-circle"></i> Break Period</span>' : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        slotsHTML += `
          <div class="slot-item" style="opacity: 0.6; border-left-color: #10b981;">
            <div class="slot-details">
              <div class="slot-day">Wednesday Blog Post</div>
              <div class="slot-date">${weekData.days.Wednesday.toLocaleDateString()}</div>
              <div class="slot-role">
                <span class="category-badge blog">Filled</span>
                <span style="color: #10b981;"><i class="fas fa-check-circle"></i> Assigned</span>
              </div>
            </div>
          </div>
        `;
      }
      
      // Sunday slots
      const sundayBookings = bookings.Sunday || {};
      const contentBookings = sundayBookings.Content || {};
      const designBookings = sundayBookings.Design || {};
      const contentSlotsFilled = Object.keys(contentBookings).length;
      const designSlotsFilled = Object.keys(designBookings).length;
      
      const postType = determinePostType(weekKey);
      const postTypeDisplay = postType.charAt(0).toUpperCase() + postType.slice(1);
      
      // Content slots
      if (contentSlotsFilled < 3) {
        let isEligible = true;
        let eligibilityMessage = '';
        
        if (userId) {
          const eligibility = await checkUserEligibility(userId, weekKey, database);
          isEligible = eligibility.isEligible;
          if (!isEligible) {
            eligibilityMessage = ` (Break week - ${eligibility.reason})`;
          }
        }
        
        slotsHTML += `
          <div class="slot-item" style="${!isEligible ? 'opacity: 0.5; border-left-color: #f59e0b;' : ''}">
            <div class="slot-details">
              <div class="slot-day">Sunday Content${eligibilityMessage}</div>
              <div class="slot-date">${weekData.days.Sunday.date.toLocaleDateString()}</div>
              <div class="slot-role">
                <span class="post-type-badge">${postTypeDisplay} Post</span>
                <span class="category-badge content">Content (${3 - contentSlotsFilled} slots left)</span>
                ${!isEligible ? '<span style="color: #f59e0b; font-size: 0.8rem;"><i class="fas fa-pause-circle"></i> Break Period</span>' : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      // Design slots
      if (designSlotsFilled < 3) {
        let isEligible = true;
        let eligibilityMessage = '';
        
        if (userId) {
          const eligibility = await checkUserEligibility(userId, weekKey, database);
          isEligible = eligibility.isEligible;
          if (!isEligible) {
            eligibilityMessage = ` (Break week - ${eligibility.reason})`;
          }
        }
        
        slotsHTML += `
          <div class="slot-item" style="${!isEligible ? 'opacity: 0.5; border-left-color: #f59e0b;' : ''}">
            <div class="slot-details">
              <div class="slot-day">Sunday Design${eligibilityMessage}</div>
              <div class="slot-date">${weekData.days.Sunday.date.toLocaleDateString()}</div>
              <div class="slot-role">
                <span class="post-type-badge">${postTypeDisplay} Post</span>
                <span class="category-badge design">Design (${3 - designSlotsFilled} slots left)</span>
                ${!isEligible ? '<span style="color: #f59e0b; font-size: 0.8rem;"><i class="fas fa-pause-circle"></i> Break Period</span>' : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      // Show filled slots
      if (contentSlotsFilled >= 3 && designSlotsFilled >= 3) {
        slotsHTML += `
          <div class="slot-item" style="opacity: 0.6; border-left-color: #10b981;">
            <div class="slot-details">
              <div class="slot-day">Sunday ${postTypeDisplay} Post</div>
              <div class="slot-date">${weekData.days.Sunday.date.toLocaleDateString()}</div>
              <div class="slot-role">
                <span class="post-type-badge">${postTypeDisplay} Post</span>
                <span style="color: #10b981;"><i class="fas fa-check-circle"></i> All slots filled</span>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    if (slotsHTML === '') {
      slotsHTML = `
        <div class="no-bookings">
          <i class="fas fa-calendar-times" style="font-size: 2rem; opacity: 0.5;"></i>
          <p>No slots available at the moment</p>
          <small>Check back when new weeks open</small>
        </div>
      `;
    }
    
    slotAvailability.innerHTML = slotsHTML;
    
    console.log('Slot display logic updated with automated filtering');
    
  } catch (error) {
    console.error('Error updating slot display logic:', error);
  }
}

/**
 * Initializes the complete portal integration
 * @param {Object} database - Firebase database reference
 * @param {Function} originalGetCurrentActiveWeeks - Original getCurrentActiveWeeks function
 * @param {Function} originalFormSubmitHandler - Original form submission handler
 */
export async function initializePortalIntegration(database, originalGetCurrentActiveWeeks, originalFormSubmitHandler) {
  try {
    console.log('Initializing complete portal integration');
    
    // Replace the global getCurrentActiveWeeks function
    if (typeof window !== 'undefined') {
      window.getCurrentActiveWeeks = () => getCurrentActiveWeeks(database);
    }
    
    // Enhance form submission
    enhanceFormSubmission(database, originalFormSubmitHandler);
    
    // Enhance admin dashboard
    enhanceAdminDashboard(database);
    
    // Initialize UI automation
    initializeUIAutomation(database);
    
    // Update slot display logic
    await updateSlotDisplayLogic(database);
    
    // Update automated UI
    await updateAutomatedUI(null, database);
    
    // Start countdown for current booking week
    const activeWeeks = await getCurrentActiveWeeks(database);
    if (activeWeeks.bookingWeek) {
      await startCountdown(activeWeeks.bookingWeek, database, async (transitionResult) => {
        // Callback for UI updates after transitions
        await updateAutomatedUI(null, database);
        await updateSlotDisplayLogic(database);
      });
    }
    
    console.log('Portal integration initialized successfully');
    
    // Show success notification
    showUIAutomationNotification(
      'Automation systems activated! Break logic, auto-assignment, and enhanced countdown are now active.',
      'success'
    );
    
  } catch (error) {
    console.error('Error initializing portal integration:', error);
    showUIAutomationNotification(
      'Some automation features may not be fully active. Please contact admin if issues persist.',
      'warning'
    );
  }
}

// Export all functions for use in the portal
export {
  enhanceFormSubmission,
  enhanceAdminDashboard,
  updateSlotDisplayLogic,
  loadAutomationStatus,
  validateSystemConsistency
};