/**
 * Break Logic System
 * Manages user assignment history and enforces one-week break between assignments
 */

/**
 * Firebase schema structure for user assignment history
 */
export const BREAK_LOGIC_FIREBASE_SCHEMA = {
  userAssignmentHistory: {
    "user123": {
      lastAssignedWeek: "Sep1-Sep7",
      totalAssignments: 3,
      assignmentHistory: [
        {
          week: "Aug25-Aug31",
          day: "Wednesday",
          role: "blog",
          assignedAt: "2025-08-31T10:00:00Z",
          assignmentType: "manual"
        },
        {
          week: "Sep1-Sep7", 
          day: "Sunday",
          role: "content",
          assignedAt: "2025-09-01T15:30:00Z",
          assignmentType: "automatic",
          postType: "text"
        }
      ],
      isEligibleForWeek: {
        "Sep8-Sep14": false, // break week
        "Sep15-Sep21": true
      }
    }
  },
  
  // Enhanced member data with break logic tracking
  members: {
    contentTeam: {
      "user123": {
        name: "John Doe",
        number: "+91XXXXXXXXXX",
        lastAssignedWeek: "Sep1-Sep7",
        totalAssignments: 3,
        isEligibleForWeek: {
          "Sep8-Sep14": false,
          "Sep15-Sep21": true
        }
      }
    },
    designTeam: {
      "user456": {
        name: "Jane Smith", 
        number: "+91YYYYYYYYYY",
        lastAssignedWeek: null,
        totalAssignments: 0,
        isEligibleForWeek: {
          "Sep8-Sep14": true,
          "Sep15-Sep21": true
        }
      }
    }
  }
};

/**
 * Checks if a user is eligible for assignment in a specific week
 * @param {string} userId - User identifier
 * @param {string} targetWeek - Week to check eligibility for (e.g., "Sep8-14")
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Eligibility result with reason
 */
export async function checkUserEligibility(userId, targetWeek, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Get user assignment history
    const historyRef = ref(database, `userAssignmentHistory/${userId}`);
    const historySnapshot = await get(historyRef);
    
    // If no history exists, user is eligible
    if (!historySnapshot.exists()) {
      return {
        isEligible: true,
        reason: 'No previous assignments',
        lastAssignedWeek: null,
        breakWeek: null
      };
    }
    
    const userHistory = historySnapshot.val();
    const lastAssignedWeek = userHistory.lastAssignedWeek;
    
    // If no last assigned week, user is eligible
    if (!lastAssignedWeek) {
      return {
        isEligible: true,
        reason: 'No recent assignments',
        lastAssignedWeek: null,
        breakWeek: null
      };
    }
    
    // Calculate if target week is immediately after last assigned week
    const isBreakWeek = isConsecutiveWeek(lastAssignedWeek, targetWeek);
    
    if (isBreakWeek) {
      return {
        isEligible: false,
        reason: 'User is in mandatory break week',
        lastAssignedWeek,
        breakWeek: targetWeek,
        nextEligibleWeek: getNextWeek(targetWeek)
      };
    }
    
    return {
      isEligible: true,
      reason: 'Break period completed',
      lastAssignedWeek,
      breakWeek: null
    };
    
  } catch (error) {
    console.error('Error checking user eligibility:', error);
    return {
      isEligible: false,
      reason: `Error checking eligibility: ${error.message}`,
      lastAssignedWeek: null,
      breakWeek: null
    };
  }
}

/**
 * Updates user assignment history after a new assignment
 * @param {string} userId - User identifier
 * @param {Object} assignment - Assignment details
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Update result
 */
export async function updateAssignmentHistory(userId, assignment, database) {
  const { ref, get, set, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Validate assignment object
    if (!assignment.week || !assignment.day || !assignment.role) {
      throw new Error('Invalid assignment object: missing required fields');
    }
    
    // Get current user history
    const historyRef = ref(database, `userAssignmentHistory/${userId}`);
    const historySnapshot = await get(historyRef);
    
    let userHistory = historySnapshot.exists() ? historySnapshot.val() : {
      assignmentHistory: [],
      totalAssignments: 0
    };
    
    // Create new assignment record
    const assignmentRecord = {
      week: assignment.week,
      day: assignment.day,
      role: assignment.role,
      assignedAt: assignment.assignedAt || new Date().toISOString(),
      assignmentType: assignment.assignmentType || 'manual',
      ...(assignment.postType && { postType: assignment.postType })
    };
    
    // Add to assignment history
    if (!userHistory.assignmentHistory) {
      userHistory.assignmentHistory = [];
    }
    userHistory.assignmentHistory.push(assignmentRecord);
    
    // Update tracking fields
    userHistory.lastAssignedWeek = assignment.week;
    userHistory.totalAssignments = (userHistory.totalAssignments || 0) + 1;
    userHistory.lastUpdated = new Date().toISOString();
    
    // Calculate eligibility for upcoming weeks
    userHistory.isEligibleForWeek = calculateWeekEligibility(assignment.week);
    
    // Save updated history
    await set(historyRef, userHistory);
    
    // Also update the member record for quick access
    await updateMemberEligibility(userId, assignment.week, database);
    
    console.log(`Updated assignment history for user ${userId}:`, assignmentRecord);
    
    return {
      success: true,
      userId,
      assignment: assignmentRecord,
      totalAssignments: userHistory.totalAssignments,
      nextEligibleWeek: getNextWeek(getNextWeek(assignment.week)) // Two weeks later
    };
    
  } catch (error) {
    console.error('Error updating assignment history:', error);
    return {
      success: false,
      error: error.message,
      userId,
      assignment
    };
  }
}

/**
 * Gets all eligible users for a specific role and week
 * @param {string} role - Role type ('content', 'design', 'blog')
 * @param {string} targetWeek - Week to check eligibility for
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of eligible users
 */
export async function getEligibleUsers(role, targetWeek, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Determine which team to check based on role
    let teamType;
    if (role === 'content' || role === 'blog') {
      teamType = 'contentTeam';
    } else if (role === 'design') {
      teamType = 'designTeam';
    } else {
      throw new Error(`Invalid role: ${role}`);
    }
    
    // Get all members from the appropriate team
    const membersRef = ref(database, `members/${teamType}`);
    const membersSnapshot = await get(membersRef);
    
    if (!membersSnapshot.exists()) {
      console.log(`No members found in ${teamType}`);
      return [];
    }
    
    const members = membersSnapshot.val();
    const eligibleUsers = [];
    
    // Check eligibility for each member
    for (const [userId, memberData] of Object.entries(members)) {
      const eligibility = await checkUserEligibility(userId, targetWeek, database);
      
      if (eligibility.isEligible) {
        eligibleUsers.push({
          userId,
          name: memberData.name,
          number: memberData.number,
          role: role,
          teamType,
          totalAssignments: memberData.totalAssignments || 0,
          lastAssignedWeek: memberData.lastAssignedWeek || null,
          eligibilityReason: eligibility.reason
        });
      } else {
        console.log(`User ${memberData.name} not eligible for ${targetWeek}: ${eligibility.reason}`);
      }
    }
    
    // Sort by assignment count (least assigned first) and then by last assignment date
    eligibleUsers.sort((a, b) => {
      // Primary sort: total assignments (ascending)
      if (a.totalAssignments !== b.totalAssignments) {
        return a.totalAssignments - b.totalAssignments;
      }
      
      // Secondary sort: last assigned week (oldest first, null values first)
      if (!a.lastAssignedWeek && !b.lastAssignedWeek) return 0;
      if (!a.lastAssignedWeek) return -1;
      if (!b.lastAssignedWeek) return 1;
      
      return a.lastAssignedWeek.localeCompare(b.lastAssignedWeek);
    });
    
    console.log(`Found ${eligibleUsers.length} eligible users for ${role} in ${targetWeek}:`, 
      eligibleUsers.map(u => `${u.name} (${u.totalAssignments} assignments)`));
    
    return eligibleUsers;
    
  } catch (error) {
    console.error('Error getting eligible users:', error);
    return [];
  }
}

/**
 * Filters available slots for a specific user based on break logic
 * @param {string} userId - User identifier
 * @param {Array} availableSlots - Array of available slot objects
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of slots the user is eligible for
 */
export async function filterSlotsForUser(userId, availableSlots, database) {
  try {
    const eligibleSlots = [];
    
    for (const slot of availableSlots) {
      const eligibility = await checkUserEligibility(userId, slot.week, database);
      
      if (eligibility.isEligible) {
        eligibleSlots.push({
          ...slot,
          eligibilityReason: eligibility.reason
        });
      } else {
        console.log(`Slot filtered out for user ${userId}: ${slot.week} ${slot.day} - ${eligibility.reason}`);
      }
    }
    
    return eligibleSlots;
    
  } catch (error) {
    console.error('Error filtering slots for user:', error);
    return availableSlots; // Return all slots if filtering fails
  }
}

/**
 * Helper function to check if two weeks are consecutive
 * @param {string} week1 - First week (e.g., "Sep1-7")
 * @param {string} week2 - Second week (e.g., "Sep8-14")
 * @returns {boolean} True if week2 immediately follows week1
 */
function isConsecutiveWeek(week1, week2) {
  try {
    const date1 = parseWeekKey(week1);
    const date2 = parseWeekKey(week2);
    
    if (!date1 || !date2) {
      console.error('Invalid week format:', { week1, week2 });
      return false;
    }
    
    // Calculate the difference in days
    const timeDiff = date2.getTime() - date1.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    // Weeks are consecutive if they are exactly 7 days apart
    return daysDiff === 7;
    
  } catch (error) {
    console.error('Error checking consecutive weeks:', error);
    return false;
  }
}

/**
 * Helper function to get the next week after a given week
 * @param {string} weekKey - Current week (e.g., "Sep1-7")
 * @returns {string} Next week key (e.g., "Sep8-14")
 */
function getNextWeek(weekKey) {
  try {
    const startDate = parseWeekKey(weekKey);
    if (!startDate) return null;
    
    // Add 7 days to get next week
    const nextWeekStart = new Date(startDate);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    
    return formatDateToWeekKey(nextWeekStart);
    
  } catch (error) {
    console.error('Error calculating next week:', error);
    return null;
  }
}

/**
 * Helper function to calculate week eligibility for multiple upcoming weeks
 * @param {string} lastAssignedWeek - Week when user was last assigned
 * @returns {Object} Eligibility status for upcoming weeks
 */
function calculateWeekEligibility(lastAssignedWeek) {
  const eligibility = {};
  
  try {
    // Calculate next few weeks
    let currentWeek = lastAssignedWeek;
    for (let i = 1; i <= 4; i++) { // Check next 4 weeks
      currentWeek = getNextWeek(currentWeek);
      if (currentWeek) {
        // First week after assignment is break week (not eligible)
        // Subsequent weeks are eligible
        eligibility[currentWeek] = i > 1;
      }
    }
    
  } catch (error) {
    console.error('Error calculating week eligibility:', error);
  }
  
  return eligibility;
}

/**
 * Helper function to update member eligibility in the members collection
 * @param {string} userId - User identifier
 * @param {string} lastAssignedWeek - Week when user was assigned
 * @param {Object} database - Firebase database reference
 */
async function updateMemberEligibility(userId, lastAssignedWeek, database) {
  const { ref, get, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Find user in both content and design teams
    const teams = ['contentTeam', 'designTeam'];
    
    for (const team of teams) {
      const memberRef = ref(database, `members/${team}/${userId}`);
      const memberSnapshot = await get(memberRef);
      
      if (memberSnapshot.exists()) {
        const updates = {
          lastAssignedWeek,
          totalAssignments: (memberSnapshot.val().totalAssignments || 0) + 1,
          isEligibleForWeek: calculateWeekEligibility(lastAssignedWeek),
          lastUpdated: new Date().toISOString()
        };
        
        await update(memberRef, updates);
        console.log(`Updated member eligibility for ${userId} in ${team}`);
        break;
      }
    }
    
  } catch (error) {
    console.error('Error updating member eligibility:', error);
  }
}

/**
 * Helper function to parse week key into Date object
 * @param {string} weekKey - Week key like "Sep1-7" or "Sep29-Oct5"
 * @returns {Date|null} Start date of the week or null if invalid
 */
function parseWeekKey(weekKey) {
  try {
    // Handle both same-month and cross-month formats
    const sameMonthMatch = weekKey.match(/([A-Za-z]+)(\d+)-(\d+)$/);
    const crossMonthMatch = weekKey.match(/([A-Za-z]+)(\d+)-([A-Za-z]+)(\d+)$/);
    
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    if (crossMonthMatch) {
      // Cross-month format like "Sep29-Oct5"
      const startMonth = crossMonthMatch[1];
      const startDay = parseInt(crossMonthMatch[2]);
      const startMonthIndex = monthMap[startMonth];
      
      if (startMonthIndex === undefined) return null;
      return new Date(2025, startMonthIndex, startDay);
    } else if (sameMonthMatch) {
      // Same-month format like "Sep1-7"
      const monthAbbr = sameMonthMatch[1];
      const startDay = parseInt(sameMonthMatch[2]);
      const monthIndex = monthMap[monthAbbr];
      
      if (monthIndex === undefined) return null;
      return new Date(2025, monthIndex, startDay);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing week key:', error);
    return null;
  }
}

/**
 * Helper function to format Date object back to week key
 * @param {Date} date - Date within the week
 * @returns {string} Week key in format "Sep1-7"
 */
function formatDateToWeekKey(date) {
  try {
    const monthAbbr = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Find start of week (assuming weeks start on the day provided)
    const weekStart = new Date(date);
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = monthAbbr[weekStart.getMonth()];
    const endMonth = monthAbbr[weekEnd.getMonth()];
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    
    // Handle month transitions
    if (startMonth === endMonth) {
      return `${startMonth}${startDay}-${endDay}`;
    } else {
      return `${startMonth}${startDay}-${endMonth}${endDay}`;
    }
  } catch (error) {
    console.error('Error formatting date to week key:', error);
    return null;
  }
}

/**
 * Gets break status for a user across multiple weeks
 * @param {string} userId - User identifier
 * @param {Array} weekKeys - Array of week keys to check
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Break status for each week
 */
export async function getUserBreakStatus(userId, weekKeys, database) {
  try {
    const breakStatus = {};
    
    for (const weekKey of weekKeys) {
      const eligibility = await checkUserEligibility(userId, weekKey, database);
      breakStatus[weekKey] = {
        isEligible: eligibility.isEligible,
        reason: eligibility.reason,
        isBreakWeek: !eligibility.isEligible && eligibility.reason.includes('break'),
        lastAssignedWeek: eligibility.lastAssignedWeek
      };
    }
    
    return breakStatus;
    
  } catch (error) {
    console.error('Error getting user break status:', error);
    return {};
  }
}

/**
 * Removes an assignment and updates break logic accordingly
 * @param {string} userId - User identifier
 * @param {string} weekKey - Week of the assignment to remove
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Removal result
 */
export async function removeAssignmentFromHistory(userId, weekKey, database) {
  const { ref, get, set } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Get current user history
    const historyRef = ref(database, `userAssignmentHistory/${userId}`);
    const historySnapshot = await get(historyRef);
    
    if (!historySnapshot.exists()) {
      return {
        success: false,
        error: 'No assignment history found for user'
      };
    }
    
    const userHistory = historySnapshot.val();
    const assignmentHistory = userHistory.assignmentHistory || [];
    
    // Find and remove the assignment for the specified week
    const assignmentIndex = assignmentHistory.findIndex(a => a.week === weekKey);
    
    if (assignmentIndex === -1) {
      return {
        success: false,
        error: 'No assignment found for the specified week'
      };
    }
    
    const removedAssignment = assignmentHistory[assignmentIndex];
    assignmentHistory.splice(assignmentIndex, 1);
    
    // Recalculate last assigned week and eligibility
    let newLastAssignedWeek = null;
    if (assignmentHistory.length > 0) {
      // Find the most recent assignment
      const sortedAssignments = assignmentHistory.sort((a, b) => 
        new Date(b.assignedAt) - new Date(a.assignedAt)
      );
      newLastAssignedWeek = sortedAssignments[0].week;
    }
    
    // Update user history
    const updatedHistory = {
      ...userHistory,
      assignmentHistory,
      lastAssignedWeek: newLastAssignedWeek,
      totalAssignments: Math.max(0, (userHistory.totalAssignments || 1) - 1),
      isEligibleForWeek: newLastAssignedWeek ? 
        calculateWeekEligibility(newLastAssignedWeek) : {},
      lastUpdated: new Date().toISOString()
    };
    
    await set(historyRef, updatedHistory);
    
    // Update member record as well
    if (newLastAssignedWeek) {
      await updateMemberEligibility(userId, newLastAssignedWeek, database);
    } else {
      // Reset member eligibility if no assignments remain
      const teams = ['contentTeam', 'designTeam'];
      for (const team of teams) {
        const memberRef = ref(database, `members/${team}/${userId}`);
        const memberSnapshot = await get(memberRef);
        
        if (memberSnapshot.exists()) {
          const { update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
          await update(memberRef, {
            lastAssignedWeek: null,
            totalAssignments: 0,
            isEligibleForWeek: {},
            lastUpdated: new Date().toISOString()
          });
          break;
        }
      }
    }
    
    return {
      success: true,
      removedAssignment,
      newLastAssignedWeek,
      remainingAssignments: assignmentHistory.length,
      userId
    };
    
  } catch (error) {
    console.error('Error removing assignment from history:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initializes break logic schema in Firebase
 * @param {Object} database - Firebase database reference
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export async function initializeBreakLogicSchema(database) {
  const { ref, get, set } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Check if userAssignmentHistory exists
    const historyRef = ref(database, 'userAssignmentHistory');
    const historySnapshot = await get(historyRef);
    
    if (!historySnapshot.exists()) {
      // Initialize empty structure
      await set(historyRef, {});
      console.log('Break logic schema initialized in Firebase');
    } else {
      console.log('Break logic schema already exists in Firebase');
    }
    
    // Ensure all existing members have break logic fields
    const teams = ['contentTeam', 'designTeam'];
    
    for (const team of teams) {
      const membersRef = ref(database, `members/${team}`);
      const membersSnapshot = await get(membersRef);
      
      if (membersSnapshot.exists()) {
        const members = membersSnapshot.val();
        const { update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
        
        for (const [userId, memberData] of Object.entries(members)) {
          // Add break logic fields if they don't exist
          if (!memberData.hasOwnProperty('lastAssignedWeek')) {
            await update(ref(database, `members/${team}/${userId}`), {
              lastAssignedWeek: null,
              totalAssignments: 0,
              isEligibleForWeek: {},
              lastUpdated: new Date().toISOString()
            });
          }
        }
      }
    }
    
    console.log('Member break logic fields initialized');
    
  } catch (error) {
    console.error('Error initializing break logic schema:', error);
    throw error;
  }
}

/**
 * Validates break logic consistency across the system
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Validation result with any inconsistencies found
 */
export async function validateBreakLogicConsistency(database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const inconsistencies = [];
    const teams = ['contentTeam', 'designTeam'];
    
    for (const team of teams) {
      const membersRef = ref(database, `members/${team}`);
      const membersSnapshot = await get(membersRef);
      
      if (membersSnapshot.exists()) {
        const members = membersSnapshot.val();
        
        for (const [userId, memberData] of Object.entries(members)) {
          // Check if user has assignment history
          const historyRef = ref(database, `userAssignmentHistory/${userId}`);
          const historySnapshot = await get(historyRef);
          
          if (historySnapshot.exists()) {
            const userHistory = historySnapshot.val();
            
            // Validate consistency between member data and history
            if (memberData.lastAssignedWeek !== userHistory.lastAssignedWeek) {
              inconsistencies.push({
                userId,
                team,
                type: 'lastAssignedWeek_mismatch',
                memberValue: memberData.lastAssignedWeek,
                historyValue: userHistory.lastAssignedWeek
              });
            }
            
            if (memberData.totalAssignments !== userHistory.totalAssignments) {
              inconsistencies.push({
                userId,
                team,
                type: 'totalAssignments_mismatch',
                memberValue: memberData.totalAssignments,
                historyValue: userHistory.totalAssignments
              });
            }
          } else if (memberData.lastAssignedWeek || memberData.totalAssignments > 0) {
            // Member has assignment data but no history
            inconsistencies.push({
              userId,
              team,
              type: 'missing_history',
              memberData: {
                lastAssignedWeek: memberData.lastAssignedWeek,
                totalAssignments: memberData.totalAssignments
              }
            });
          }
        }
      }
    }
    
    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      checkedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error validating break logic consistency:', error);
    return {
      isConsistent: false,
      error: error.message,
      inconsistencies: []
    };
  }
}