/**
 * Automated Assignment Engine
 * Handles automatic slot assignment when deadlines pass with workload balancing
 */

/**
 * Firebase schema structure for assignment engine
 */
export const ASSIGNMENT_ENGINE_FIREBASE_SCHEMA = {
  assignmentQueue: {
    "Sep8-Sep14": {
      pendingSlots: [
        {
          day: "Wednesday",
          role: "blog",
          maxAssignees: 1,
          currentAssignees: 0,
          priority: 1
        },
        {
          day: "Sunday",
          role: "content",
          postType: "video",
          maxAssignees: 3,
          currentAssignees: 1,
          priority: 2
        }
      ],
      autoAssignScheduled: false,
      deadline: "2025-09-07T19:00:00+05:30",
      processedAt: null
    }
  },
  
  workloadTracking: {
    "user123": {
      totalAssignments: 5,
      recentAssignments: [
        {
          week: "Sep1-Sep7",
          day: "Wednesday",
          role: "blog",
          assignedAt: "2025-09-03T10:00:00Z"
        }
      ],
      workloadScore: 0.75, // 0-1 scale, higher = more loaded
      lastAssignedWeek: "Sep1-Sep7",
      preferredRoles: ["content", "blog"],
      availability: {
        "Sep8-Sep14": true,
        "Sep15-Sep21": false // break week
      }
    }
  }
};

/**
 * Automatically assigns remaining slots when deadline is reached
 * @param {string} weekKey - Week identifier (e.g., "Sep8-14")
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Assignment result with details
 */
export async function autoAssignRemainingSlots(weekKey, database) {
  const { ref, get, set, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    console.log(`Starting auto-assignment for week: ${weekKey}`);
    
    // Get current bookings to identify remaining slots
    const bookingsRef = ref(database, `bookings/${weekKey}`);
    const bookingsSnapshot = await get(bookingsRef);
    
    const existingBookings = bookingsSnapshot.exists() ? bookingsSnapshot.val() : {};
    
    // Identify remaining slots that need assignment
    const remainingSlots = await identifyRemainingSlots(weekKey, existingBookings, database);
    
    if (remainingSlots.length === 0) {
      return {
        success: true,
        weekKey,
        message: 'All slots already assigned',
        assignments: [],
        remainingSlots: 0
      };
    }
    
    console.log(`Found ${remainingSlots.length} remaining slots to assign:`, remainingSlots);
    
    // Get all eligible users for assignment
    const eligibleUsers = await getAllEligibleUsers(weekKey, database);
    
    if (eligibleUsers.length === 0) {
      return {
        success: false,
        weekKey,
        error: 'No eligible users available for assignment',
        remainingSlots: remainingSlots.length,
        slots: remainingSlots
      };
    }
    
    // Distribute workload fairly across remaining slots
    const assignments = await distributeWorkload(remainingSlots, eligibleUsers, database);
    
    // Execute assignments
    const assignmentResults = [];
    const errors = [];
    
    for (const assignment of assignments) {
      try {
        const result = await executeAssignment(weekKey, assignment, database);
        if (result.success) {
          assignmentResults.push(result);
        } else {
          errors.push({
            slot: assignment.slot,
            user: assignment.user.name,
            error: result.error
          });
        }
      } catch (error) {
        console.error('Error executing assignment:', error);
        errors.push({
          slot: assignment.slot,
          user: assignment.user.name,
          error: error.message
        });
      }
    }
    
    // Send notifications for successful assignments
    const notificationResults = await sendAssignmentNotifications(assignmentResults);
    
    // Update assignment queue status
    await updateAssignmentQueueStatus(weekKey, {
      processed: true,
      processedAt: new Date().toISOString(),
      totalAssigned: assignmentResults.length,
      errors: errors.length
    }, database);
    
    console.log(`Auto-assignment completed for ${weekKey}:`, {
      assigned: assignmentResults.length,
      errors: errors.length
    });
    
    return {
      success: true,
      weekKey,
      assignments: assignmentResults,
      errors,
      totalAssigned: assignmentResults.length,
      remainingSlots: remainingSlots.length - assignmentResults.length,
      notifications: notificationResults
    };
    
  } catch (error) {
    console.error('Error in auto-assignment process:', error);
    return {
      success: false,
      weekKey,
      error: error.message,
      assignments: []
    };
  }
}

/**
 * Selects the optimal user for a specific slot based on workload and eligibility
 * @param {Array} availableUsers - Array of eligible users
 * @param {Object} slot - Slot information (day, role, etc.)
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Selected user with selection reasoning
 */
export async function selectOptimalUser(availableUsers, slot, database) {
  try {
    if (availableUsers.length === 0) {
      throw new Error('No available users to select from');
    }
    
    if (availableUsers.length === 1) {
      return {
        selectedUser: availableUsers[0],
        reason: 'Only available user',
        score: 1.0
      };
    }
    
    // Calculate selection scores for each user
    const userScores = await Promise.all(
      availableUsers.map(async (user) => {
        const score = await calculateUserSelectionScore(user, slot, database);
        return {
          user,
          score: score.totalScore,
          breakdown: score.breakdown
        };
      })
    );
    
    // Sort by score (higher is better for selection)
    userScores.sort((a, b) => b.score - a.score);
    
    const selected = userScores[0];
    
    console.log(`Selected user ${selected.user.name} for ${slot.day} ${slot.role}:`, {
      score: selected.score,
      breakdown: selected.breakdown
    });
    
    return {
      selectedUser: selected.user,
      reason: `Optimal selection based on workload balance and availability`,
      score: selected.score,
      breakdown: selected.breakdown,
      alternativeUsers: userScores.slice(1, 3) // Top 2 alternatives
    };
    
  } catch (error) {
    console.error('Error selecting optimal user:', error);
    throw error;
  }
}

/**
 * Distributes workload fairly across multiple slots and users
 * @param {Array} slots - Array of slots to assign
 * @param {Array} users - Array of eligible users
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of slot-user assignments
 */
export async function distributeWorkload(slots, users, database) {
  try {
    console.log(`Distributing workload for ${slots.length} slots among ${users.length} users`);
    
    // Sort slots by priority (higher priority assigned first)
    const prioritizedSlots = slots.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Track assignments to prevent overloading users
    const assignments = [];
    const userAssignmentCount = new Map();
    
    // Initialize user assignment tracking
    users.forEach(user => {
      userAssignmentCount.set(user.userId, 0);
    });
    
    // Assign each slot to optimal available user
    for (const slot of prioritizedSlots) {
      // Filter users eligible for this specific slot
      const eligibleForSlot = users.filter(user => {
        // Check role compatibility
        if (slot.role === 'blog' && user.teamType !== 'contentTeam') return false;
        if (slot.role === 'content' && user.teamType !== 'contentTeam') return false;
        if (slot.role === 'design' && user.teamType !== 'designTeam') return false;
        
        // Check if user already has too many assignments this round
        const currentAssignments = userAssignmentCount.get(user.userId) || 0;
        const maxAssignmentsPerRound = Math.ceil(slots.length / users.length) + 1;
        
        return currentAssignments < maxAssignmentsPerRound;
      });
      
      if (eligibleForSlot.length === 0) {
        console.warn(`No eligible users for slot: ${slot.day} ${slot.role}`);
        continue;
      }
      
      // Select optimal user for this slot
      const selection = await selectOptimalUser(eligibleForSlot, slot, database);
      
      // Record assignment
      assignments.push({
        slot,
        user: selection.selectedUser,
        selectionReason: selection.reason,
        score: selection.score
      });
      
      // Update assignment count
      const currentCount = userAssignmentCount.get(selection.selectedUser.userId) || 0;
      userAssignmentCount.set(selection.selectedUser.userId, currentCount + 1);
      
      console.log(`Assigned ${slot.day} ${slot.role} to ${selection.selectedUser.name} (${currentCount + 1} assignments)`);
    }
    
    // Log final distribution
    const distributionSummary = Array.from(userAssignmentCount.entries())
      .filter(([userId, count]) => count > 0)
      .map(([userId, count]) => {
        const user = users.find(u => u.userId === userId);
        return `${user?.name || userId}: ${count} assignments`;
      });
    
    console.log('Workload distribution summary:', distributionSummary);
    
    return assignments;
    
  } catch (error) {
    console.error('Error distributing workload:', error);
    throw error;
  }
}

/**
 * Calculates a selection score for a user based on multiple factors
 * @param {Object} user - User object with assignment history
 * @param {Object} slot - Slot information
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Score breakdown and total
 */
async function calculateUserSelectionScore(user, slot, database) {
  try {
    const breakdown = {
      workloadBalance: 0,    // 0-40 points: Lower total assignments = higher score
      recency: 0,           // 0-30 points: Longer since last assignment = higher score
      rolePreference: 0,    // 0-20 points: Preferred role match
      availability: 0       // 0-10 points: General availability
    };
    
    // 1. Workload Balance Score (0-40 points)
    // Users with fewer total assignments get higher scores
    const totalAssignments = user.totalAssignments || 0;
    const maxAssignments = Math.max(...[user.totalAssignments || 0, 10]); // Normalize against max or 10
    breakdown.workloadBalance = Math.max(0, 40 - (totalAssignments / maxAssignments) * 40);
    
    // 2. Recency Score (0-30 points)
    // Users who haven't been assigned recently get higher scores
    if (!user.lastAssignedWeek) {
      breakdown.recency = 30; // Never assigned = highest recency score
    } else {
      // Calculate weeks since last assignment
      const weeksSinceAssignment = calculateWeeksSince(user.lastAssignedWeek);
      breakdown.recency = Math.min(30, weeksSinceAssignment * 10);
    }
    
    // 3. Role Preference Score (0-20 points)
    // Users get bonus for roles they prefer or have experience with
    if (user.preferredRoles && user.preferredRoles.includes(slot.role)) {
      breakdown.rolePreference = 20;
    } else if (slot.role === 'content' && user.teamType === 'contentTeam') {
      breakdown.rolePreference = 15;
    } else if (slot.role === 'design' && user.teamType === 'designTeam') {
      breakdown.rolePreference = 15;
    } else if (slot.role === 'blog' && user.teamType === 'contentTeam') {
      breakdown.rolePreference = 10;
    } else {
      breakdown.rolePreference = 5; // Base score for any eligible user
    }
    
    // 4. Availability Score (0-10 points)
    // General availability and engagement
    breakdown.availability = 10; // Default full availability
    
    // Calculate total score
    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    
    return {
      totalScore,
      breakdown,
      maxPossibleScore: 100
    };
    
  } catch (error) {
    console.error('Error calculating user selection score:', error);
    return {
      totalScore: 0,
      breakdown: { workloadBalance: 0, recency: 0, rolePreference: 0, availability: 0 },
      maxPossibleScore: 100
    };
  }
}

/**
 * Identifies remaining slots that need assignment for a given week
 * @param {string} weekKey - Week identifier
 * @param {Object} existingBookings - Current bookings from Firebase
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of remaining slots
 */
async function identifyRemainingSlots(weekKey, existingBookings, database) {
  try {
    const remainingSlots = [];
    
    // Define expected slots for each day
    const expectedSlots = {
      'Wednesday': [
        { role: 'blog', maxAssignees: 1, priority: 1 }
      ],
      'Sunday': [
        { role: 'content', maxAssignees: 3, priority: 2 },
        { role: 'design', maxAssignees: 3, priority: 2 }
      ]
    };
    
    // Get post type for Sunday slots
    const { determinePostType } = await import('./content-type-alternation.js');
    const sundayPostType = determinePostType(weekKey);
    
    // Check each expected slot
    for (const [day, daySlots] of Object.entries(expectedSlots)) {
      const dayBookings = existingBookings[day] || {};
      
      for (const expectedSlot of daySlots) {
        const roleBookings = dayBookings[expectedSlot.role] || {};
        const currentAssignees = Object.keys(roleBookings).length;
        
        // If slot is not fully assigned, add to remaining slots
        if (currentAssignees < expectedSlot.maxAssignees) {
          const slotsNeeded = expectedSlot.maxAssignees - currentAssignees;
          
          for (let i = 0; i < slotsNeeded; i++) {
            const slot = {
              day,
              role: expectedSlot.role,
              maxAssignees: expectedSlot.maxAssignees,
              currentAssignees,
              priority: expectedSlot.priority,
              slotIndex: i + currentAssignees
            };
            
            // Add post type for Sunday slots
            if (day === 'Sunday') {
              slot.postType = sundayPostType;
            }
            
            remainingSlots.push(slot);
          }
        }
      }
    }
    
    return remainingSlots;
    
  } catch (error) {
    console.error('Error identifying remaining slots:', error);
    return [];
  }
}

/**
 * Gets all eligible users for assignment in a specific week
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of eligible users from all teams
 */
async function getAllEligibleUsers(weekKey, database) {
  try {
    const { getEligibleUsers } = await import('./break-logic.js');
    
    // Get eligible users for each role type
    const [contentUsers, designUsers] = await Promise.all([
      getEligibleUsers('content', weekKey, database),
      getEligibleUsers('design', weekKey, database)
    ]);
    
    // Combine all eligible users
    const allEligibleUsers = [...contentUsers, ...designUsers];
    
    console.log(`Found ${allEligibleUsers.length} total eligible users for ${weekKey}:`, {
      content: contentUsers.length,
      design: designUsers.length
    });
    
    return allEligibleUsers;
    
  } catch (error) {
    console.error('Error getting all eligible users:', error);
    return [];
  }
}

/**
 * Executes a single assignment (adds to Firebase and updates history)
 * @param {string} weekKey - Week identifier
 * @param {Object} assignment - Assignment object with slot and user
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Execution result
 */
async function executeAssignment(weekKey, assignment, database) {
  const { ref, push, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const { slot, user } = assignment;
    
    // Create booking entry
    const bookingData = {
      name: user.name,
      number: user.number,
      timestamp: new Date().toISOString(),
      assignmentType: 'automatic',
      role: slot.role,
      ...(slot.postType && { postType: slot.postType })
    };
    
    // Add to bookings
    const bookingRef = ref(database, `bookings/${weekKey}/${slot.day}/${slot.role}`);
    const bookingResult = await push(bookingRef, bookingData);
    
    // Update assignment history using break logic system
    const { updateAssignmentHistory } = await import('./break-logic.js');
    const historyResult = await updateAssignmentHistory(user.userId, {
      week: weekKey,
      day: slot.day,
      role: slot.role,
      assignedAt: bookingData.timestamp,
      assignmentType: 'automatic',
      ...(slot.postType && { postType: slot.postType })
    }, database);
    
    if (!historyResult.success) {
      console.warn('Failed to update assignment history:', historyResult.error);
    }
    
    console.log(`Successfully assigned ${user.name} to ${slot.day} ${slot.role} for ${weekKey}`);
    
    return {
      success: true,
      weekKey,
      slot,
      user,
      bookingId: bookingResult.key,
      bookingData,
      historyUpdated: historyResult.success
    };
    
  } catch (error) {
    console.error('Error executing assignment:', error);
    return {
      success: false,
      error: error.message,
      weekKey,
      slot,
      user
    };
  }
}

/**
 * Sends notifications for completed assignments
 * @param {Array} assignments - Array of successful assignment results
 * @returns {Promise<Object>} Notification results
 */
async function sendAssignmentNotifications(assignments) {
  try {
    const notifications = [];
    
    for (const assignment of assignments) {
      try {
        // Create notification data
        const notificationData = {
          type: 'auto_assignment',
          recipient: {
            name: assignment.user.name,
            number: assignment.user.number,
            userId: assignment.user.userId
          },
          message: `Hi ${assignment.user.name}! You've been automatically assigned to ${assignment.slot.role} for ${assignment.slot.day}, ${assignment.weekKey}. Please check the portal for details.`,
          assignmentDetails: {
            week: assignment.weekKey,
            day: assignment.slot.day,
            role: assignment.slot.role,
            assignedAt: assignment.bookingData.timestamp,
            assignmentType: 'automatic',
            ...(assignment.slot.postType && { postType: assignment.slot.postType })
          },
          sentAt: new Date().toISOString()
        };
        
        // For now, just log the notification
        // In production, this would integrate with email/WhatsApp APIs
        console.log('Auto-assignment notification:', notificationData);
        
        notifications.push({
          success: true,
          user: assignment.user.name,
          notificationData
        });
        
      } catch (error) {
        console.error(`Error sending notification to ${assignment.user.name}:`, error);
        notifications.push({
          success: false,
          user: assignment.user.name,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      totalSent: notifications.filter(n => n.success).length,
      totalFailed: notifications.filter(n => !n.success).length,
      notifications
    };
    
  } catch (error) {
    console.error('Error sending assignment notifications:', error);
    return {
      success: false,
      error: error.message,
      notifications: []
    };
  }
}

/**
 * Updates assignment queue status after processing
 * @param {string} weekKey - Week identifier
 * @param {Object} status - Status update object
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Update result
 */
async function updateAssignmentQueueStatus(weekKey, status, database) {
  const { ref, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const queueRef = ref(database, `assignmentQueue/${weekKey}`);
    await update(queueRef, status);
    
    console.log(`Updated assignment queue status for ${weekKey}:`, status);
    
    return { success: true, weekKey, status };
    
  } catch (error) {
    console.error('Error updating assignment queue status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to calculate weeks since a given week
 * @param {string} weekKey - Week key like "Sep1-7"
 * @returns {number} Number of weeks since that week
 */
function calculateWeeksSince(weekKey) {
  try {
    // Parse week key to get start date
    const { parseWeekKey } = await import('./break-logic.js');
    const weekDate = parseWeekKey(weekKey);
    
    if (!weekDate) return 0;
    
    const now = new Date();
    const timeDiff = now.getTime() - weekDate.getTime();
    const weeksDiff = Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000));
    
    return Math.max(0, weeksDiff);
    
  } catch (error) {
    console.error('Error calculating weeks since:', error);
    return 0;
  }
}

/**
 * Gets assignment engine status and statistics
 * @param {Array} weekKeys - Array of week identifiers
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Comprehensive status
 */
export async function getAssignmentEngineStatus(weekKeys, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const status = {
      weeks: {},
      summary: {
        totalWeeks: weekKeys.length,
        fullyAssigned: 0,
        partiallyAssigned: 0,
        unassigned: 0,
        autoAssignmentsCompleted: 0
      }
    };
    
    for (const weekKey of weekKeys) {
      // Get bookings for this week
      const bookingsRef = ref(database, `bookings/${weekKey}`);
      const bookingsSnapshot = await get(bookingsRef);
      
      const bookings = bookingsSnapshot.exists() ? bookingsSnapshot.val() : {};
      
      // Count assignments
      const wednesdayBlog = Object.keys(bookings.Wednesday?.blog || {}).length;
      const sundayContent = Object.keys(bookings.Sunday?.content || {}).length;
      const sundayDesign = Object.keys(bookings.Sunday?.design || {}).length;
      
      const totalAssigned = wednesdayBlog + sundayContent + sundayDesign;
      const totalSlots = 7; // 1 blog + 3 content + 3 design
      
      // Get queue status
      const queueRef = ref(database, `assignmentQueue/${weekKey}`);
      const queueSnapshot = await get(queueRef);
      const queueData = queueSnapshot.exists() ? queueSnapshot.val() : {};
      
      status.weeks[weekKey] = {
        totalSlots,
        totalAssigned,
        remainingSlots: totalSlots - totalAssigned,
        assignments: {
          blog: wednesdayBlog,
          content: sundayContent,
          design: sundayDesign
        },
        isFullyAssigned: totalAssigned === totalSlots,
        autoAssignCompleted: queueData.processed || false,
        lastProcessed: queueData.processedAt || null
      };
      
      // Update summary
      if (totalAssigned === totalSlots) {
        status.summary.fullyAssigned++;
      } else if (totalAssigned > 0) {
        status.summary.partiallyAssigned++;
      } else {
        status.summary.unassigned++;
      }
      
      if (queueData.processed) {
        status.summary.autoAssignmentsCompleted++;
      }
    }
    
    return status;
    
  } catch (error) {
    console.error('Error getting assignment engine status:', error);
    return {
      error: error.message,
      weeks: {},
      summary: { totalWeeks: 0, fullyAssigned: 0, partiallyAssigned: 0, unassigned: 0 }
    };
  }
}

/**
 * Manually triggers auto-assignment for a specific week (admin function)
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Assignment result
 */
export async function triggerManualAutoAssignment(weekKey, database) {
  try {
    console.log(`Manually triggering auto-assignment for ${weekKey}`);
    
    // Check if auto-assignment already completed
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const queueRef = ref(database, `assignmentQueue/${weekKey}`);
    const queueSnapshot = await get(queueRef);
    
    if (queueSnapshot.exists() && queueSnapshot.val().processed) {
      return {
        success: false,
        weekKey,
        error: 'Auto-assignment already completed for this week',
        alreadyProcessed: true
      };
    }
    
    // Execute auto-assignment
    const result = await autoAssignRemainingSlots(weekKey, database);
    
    return {
      ...result,
      manualTrigger: true,
      triggeredAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in manual auto-assignment trigger:', error);
    return {
      success: false,
      weekKey,
      error: error.message,
      manualTrigger: true
    };
  }
}

/**
 * Initializes assignment engine schema in Firebase
 * @param {Object} database - Firebase database reference
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export async function initializeAssignmentEngineSchema(database) {
  const { ref, get, set } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Initialize assignment queue structure
    const queueRef = ref(database, 'assignmentQueue');
    const queueSnapshot = await get(queueRef);
    
    if (!queueSnapshot.exists()) {
      await set(queueRef, {});
      console.log('Assignment queue schema initialized');
    }
    
    // Initialize workload tracking structure
    const workloadRef = ref(database, 'workloadTracking');
    const workloadSnapshot = await get(workloadRef);
    
    if (!workloadSnapshot.exists()) {
      await set(workloadRef, {});
      console.log('Workload tracking schema initialized');
    }
    
    console.log('Assignment engine schema initialization complete');
    
  } catch (error) {
    console.error('Error initializing assignment engine schema:', error);
    throw error;
  }
}

/**
 * Validates assignment engine configuration and dependencies
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Validation result
 */
export async function validateAssignmentEngineSetup(database) {
  try {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      dependencies: {
        breakLogic: false,
        contentTypeAlternation: false,
        blogAutomation: false,
        firebaseSchema: false
      }
    };
    
    // Check break logic dependency
    try {
      const { checkUserEligibility } = await import('./break-logic.js');
      validation.dependencies.breakLogic = typeof checkUserEligibility === 'function';
    } catch (error) {
      validation.errors.push('Break logic module not available');
    }
    
    // Check content type alternation dependency
    try {
      const { determinePostType } = await import('./content-type-alternation.js');
      validation.dependencies.contentTypeAlternation = typeof determinePostType === 'function';
    } catch (error) {
      validation.errors.push('Content type alternation module not available');
    }
    
    // Check blog automation dependency
    try {
      const { scheduleWednesdayBlogPosts } = await import('./blog-automation.js');
      validation.dependencies.blogAutomation = typeof scheduleWednesdayBlogPosts === 'function';
    } catch (error) {
      validation.warnings.push('Blog automation module not available (optional)');
    }
    
    // Check Firebase schema
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    try {
      const membersRef = ref(database, 'members');
      const membersSnapshot = await get(membersRef);
      validation.dependencies.firebaseSchema = membersSnapshot.exists();
      
      if (!validation.dependencies.firebaseSchema) {
        validation.errors.push('Members data not found in Firebase');
      }
    } catch (error) {
      validation.errors.push('Cannot access Firebase database');
    }
    
    validation.isValid = validation.errors.length === 0;
    
    return validation;
    
  } catch (error) {
    console.error('Error validating assignment engine setup:', error);
    return {
      isValid: false,
      errors: [error.message],
      warnings: [],
      dependencies: {}
    };
  }
}