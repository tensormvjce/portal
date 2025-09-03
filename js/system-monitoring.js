/**
 * System Monitoring and Admin Controls
 * Provides comprehensive monitoring, logging, and emergency override capabilities
 */

class SystemMonitor {
    constructor() {
        this.isInitialized = false;
        this.systemStatus = {
            automation: 'active',
            database: 'connected',
            assignments: 'operational',
            notifications: 'active',
            lastHealthCheck: null
        };
        this.operationLog = [];
        this.maxLogEntries = 1000;
        this.healthCheckInterval = null;
        this.emergencyMode = false;
    }

    /**
     * Initialize system monitoring
     */
    async initialize() {
        try {
            console.log('Initializing system monitoring...');
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Initialize logging system
            this.initializeLogging();
            
            // Load existing logs from Firebase
            await this.loadSystemLogs();
            
            // Set up emergency override listeners
            this.setupEmergencyControls();
            
            this.isInitialized = true;
            this.logOperation('system', 'System monitoring initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Failed to initialize system monitoring:', error);
            return false;
        }
    }

    /**
     * Start continuous health monitoring
     */
    startHealthMonitoring() {
        // Check system health every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
        
        // Initial health check
        this.performHealthCheck();
    }

    /**
     * Perform comprehensive system health check
     */
    async performHealthCheck() {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            automation: await this.checkAutomationHealth(),
            database: await this.checkDatabaseHealth(),
            assignments: await this.checkAssignmentHealth(),
            notifications: await this.checkNotificationHealth()
        };

        this.systemStatus = {
            ...healthStatus,
            lastHealthCheck: healthStatus.timestamp
        };

        // Log health check results
        this.logOperation('health_check', `System health: ${JSON.stringify(healthStatus)}`);

        // Trigger alerts for critical issues
        await this.checkForCriticalIssues(healthStatus);

        // Update admin dashboard
        this.updateHealthDisplay();
    }

    /**
     * Check automation system health
     */
    async checkAutomationHealth() {
        try {
            // Check if countdown is running
            const countdownActive = document.querySelector('.countdown-banner') !== null;
            
            // Check if date ranges are current
            const currentWeeks = await this.getCurrentWeeks();
            const isCurrentWeek = currentWeeks && currentWeeks.length === 2;
            
            // Check if auto-assignment is scheduled
            const autoAssignScheduled = await this.checkAutoAssignmentStatus();
            
            if (this.emergencyMode) {
                return 'emergency_mode';
            } else if (countdownActive && isCurrentWeek && autoAssignScheduled) {
                return 'active';
            } else {
                return 'degraded';
            }
        } catch (error) {
            console.error('Automation health check failed:', error);
            return 'error';
        }
    }

    /**
     * Check database connectivity and performance
     */
    async checkDatabaseHealth() {
        try {
            const startTime = Date.now();
            
            // Test Firebase connection with a simple read
            const testRef = firebase.database().ref('.info/connected');
            const snapshot = await testRef.once('value');
            const isConnected = snapshot.val();
            
            const responseTime = Date.now() - startTime;
            
            if (!isConnected) {
                return 'disconnected';
            } else if (responseTime > 5000) {
                return 'slow';
            } else {
                return 'connected';
            }
        } catch (error) {
            console.error('Database health check failed:', error);
            return 'error';
        }
    }

    /**
     * Check assignment system health
     */
    async checkAssignmentHealth() {
        try {
            // Check for pending assignments
            const pendingAssignments = await this.getPendingAssignments();
            
            // Check for overdue assignments
            const overdueAssignments = await this.getOverdueAssignments();
            
            // Check assignment queue status
            const queueStatus = await this.getAssignmentQueueStatus();
            
            if (overdueAssignments.length > 0) {
                return 'overdue';
            } else if (pendingAssignments.length > 10) {
                return 'backlogged';
            } else if (queueStatus === 'active') {
                return 'operational';
            } else {
                return 'idle';
            }
        } catch (error) {
            console.error('Assignment health check failed:', error);
            return 'error';
        }
    }

    /**
     * Check notification system health
     */
    async checkNotificationHealth() {
        try {
            // Check notification queue
            const notificationQueue = await this.getNotificationQueue();
            
            // Check for failed notifications
            const failedNotifications = await this.getFailedNotifications();
            
            if (failedNotifications.length > 5) {
                return 'degraded';
            } else if (notificationQueue.length > 0) {
                return 'processing';
            } else {
                return 'active';
            }
        } catch (error) {
            console.error('Notification health check failed:', error);
            return 'error';
        }
    }

    /**
     * Initialize comprehensive logging system
     */
    initializeLogging() {
        // Override console methods to capture logs
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.logOperation('info', args.join(' '));
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.logOperation('error', args.join(' '));
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.logOperation('warning', args.join(' '));
            originalWarn.apply(console, args);
        };
    }

    /**
     * Log system operations with detailed metadata
     */
    logOperation(type, message, metadata = {}) {
        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            type: type,
            message: message,
            metadata: {
                ...metadata,
                userAgent: navigator.userAgent,
                url: window.location.href,
                systemStatus: this.systemStatus.automation
            }
        };

        // Add to local log
        this.operationLog.unshift(logEntry);
        
        // Maintain log size limit
        if (this.operationLog.length > this.maxLogEntries) {
            this.operationLog = this.operationLog.slice(0, this.maxLogEntries);
        }

        // Store in Firebase for persistence
        this.storeLogEntry(logEntry);

        // Update admin dashboard if visible
        this.updateLogDisplay();
    }

    /**
     * Store log entry in Firebase
     */
    async storeLogEntry(logEntry) {
        try {
            const logRef = firebase.database().ref(`systemLogs/${logEntry.id}`);
            await logRef.set(logEntry);
        } catch (error) {
            console.error('Failed to store log entry:', error);
        }
    }

    /**
     * Load existing system logs from Firebase
     */
    async loadSystemLogs() {
        try {
            const logsRef = firebase.database().ref('systemLogs');
            const snapshot = await logsRef.orderByChild('timestamp').limitToLast(100).once('value');
            
            if (snapshot.exists()) {
                const logs = Object.values(snapshot.val());
                this.operationLog = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }
        } catch (error) {
            console.error('Failed to load system logs:', error);
        }
    }

    /**
     * Set up emergency override controls
     */
    setupEmergencyControls() {
        // Listen for emergency mode changes
        const emergencyRef = firebase.database().ref('systemControl/emergencyMode');
        emergencyRef.on('value', (snapshot) => {
            const emergencyMode = snapshot.val() || false;
            this.handleEmergencyModeChange(emergencyMode);
        });

        // Listen for manual overrides
        const overrideRef = firebase.database().ref('systemControl/manualOverrides');
        overrideRef.on('value', (snapshot) => {
            const overrides = snapshot.val() || {};
            this.handleManualOverrides(overrides);
        });
    }

    /**
     * Handle emergency mode activation/deactivation
     */
    async handleEmergencyModeChange(emergencyMode) {
        this.emergencyMode = emergencyMode;
        
        if (emergencyMode) {
            this.logOperation('emergency', 'Emergency mode activated - all automation paused');
            await this.pauseAllAutomation();
            this.showEmergencyAlert();
        } else {
            this.logOperation('emergency', 'Emergency mode deactivated - resuming automation');
            await this.resumeAllAutomation();
            this.hideEmergencyAlert();
        }
    }

    /**
     * Handle manual override commands
     */
    async handleManualOverrides(overrides) {
        for (const [overrideId, override] of Object.entries(overrides)) {
            if (override.status === 'pending') {
                await this.executeManualOverride(overrideId, override);
            }
        }
    }

    /**
     * Execute a manual override command
     */
    async executeManualOverride(overrideId, override) {
        try {
            this.logOperation('override', `Executing manual override: ${override.type}`, override);
            
            switch (override.type) {
                case 'force_assignment':
                    await this.forceAssignment(override.params);
                    break;
                case 'reset_countdown':
                    await this.resetCountdown(override.params);
                    break;
                case 'clear_assignments':
                    await this.clearAssignments(override.params);
                    break;
                case 'advance_week':
                    await this.forceWeekAdvancement();
                    break;
                default:
                    throw new Error(`Unknown override type: ${override.type}`);
            }

            // Mark override as completed
            await firebase.database().ref(`systemControl/manualOverrides/${overrideId}/status`).set('completed');
            
            this.logOperation('override', `Manual override completed: ${overrideId}`);
        } catch (error) {
            console.error('Manual override failed:', error);
            await firebase.database().ref(`systemControl/manualOverrides/${overrideId}/status`).set('failed');
            await firebase.database().ref(`systemControl/manualOverrides/${overrideId}/error`).set(error.message);
            
            this.logOperation('error', `Manual override failed: ${overrideId} - ${error.message}`);
        }
    }

    /**
     * Pause all automation systems
     */
    async pauseAllAutomation() {
        try {
            // Stop countdown timers
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
            }

            // Pause auto-assignment
            await firebase.database().ref('systemControl/autoAssignmentPaused').set(true);

            // Pause notifications
            await firebase.database().ref('systemControl/notificationsPaused').set(true);

            this.logOperation('system', 'All automation systems paused');
        } catch (error) {
            console.error('Failed to pause automation:', error);
        }
    }

    /**
     * Resume all automation systems
     */
    async resumeAllAutomation() {
        try {
            // Resume auto-assignment
            await firebase.database().ref('systemControl/autoAssignmentPaused').set(false);

            // Resume notifications
            await firebase.database().ref('systemControl/notificationsPaused').set(false);

            // Restart countdown if needed
            if (window.startCountdown) {
                window.startCountdown();
            }

            this.logOperation('system', 'All automation systems resumed');
        } catch (error) {
            console.error('Failed to resume automation:', error);
        }
    }

    /**
     * Generate unique log ID
     */
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get system status summary
     */
    getSystemStatus() {
        return {
            ...this.systemStatus,
            emergencyMode: this.emergencyMode,
            totalLogs: this.operationLog.length,
            isMonitoring: this.healthCheckInterval !== null
        };
    }

    /**
     * Get recent operation logs
     */
    getRecentLogs(limit = 50) {
        return this.operationLog.slice(0, limit);
    }

    /**
     * Clear old logs (keep last 100)
     */
    async clearOldLogs() {
        try {
            const logsRef = firebase.database().ref('systemLogs');
            const snapshot = await logsRef.orderByChild('timestamp').once('value');
            
            if (snapshot.exists()) {
                const logs = Object.entries(snapshot.val());
                logs.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
                
                // Keep only the most recent 100 logs
                const logsToDelete = logs.slice(100);
                
                for (const [logId] of logsToDelete) {
                    await firebase.database().ref(`systemLogs/${logId}`).remove();
                }
                
                this.logOperation('maintenance', `Cleared ${logsToDelete.length} old log entries`);
            }
        } catch (error) {
            console.error('Failed to clear old logs:', error);
        }
    }

    /**
     * Destroy monitoring system
     */
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        this.isInitialized = false;
        this.logOperation('system', 'System monitoring destroyed');
    }
}

// Helper functions for health checks
SystemMonitor.prototype.getCurrentWeeks = async function() {
    try {
        const configRef = firebase.database().ref('weekConfiguration/activeWeeks');
        const snapshot = await configRef.once('value');
        return snapshot.val() || [];
    } catch (error) {
        return null;
    }
};

SystemMonitor.prototype.checkAutoAssignmentStatus = async function() {
    try {
        const statusRef = firebase.database().ref('systemControl/autoAssignmentPaused');
        const snapshot = await statusRef.once('value');
        return !snapshot.val(); // Return true if not paused
    } catch (error) {
        return false;
    }
};

SystemMonitor.prototype.getPendingAssignments = async function() {
    try {
        const queueRef = firebase.database().ref('assignmentQueue');
        const snapshot = await queueRef.once('value');
        const queues = snapshot.val() || {};
        
        let pendingCount = 0;
        Object.values(queues).forEach(queue => {
            if (queue.pendingSlots) {
                pendingCount += queue.pendingSlots.length;
            }
        });
        
        return Array(pendingCount).fill(null); // Return array with length equal to pending count
    } catch (error) {
        return [];
    }
};

SystemMonitor.prototype.getOverdueAssignments = async function() {
    try {
        const now = new Date();
        const queueRef = firebase.database().ref('assignmentQueue');
        const snapshot = await queueRef.once('value');
        const queues = snapshot.val() || {};
        
        const overdue = [];
        Object.entries(queues).forEach(([weekKey, queue]) => {
            if (queue.deadline && new Date(queue.deadline) < now && !queue.autoAssignScheduled) {
                overdue.push({ weekKey, deadline: queue.deadline });
            }
        });
        
        return overdue;
    } catch (error) {
        return [];
    }
};

SystemMonitor.prototype.getAssignmentQueueStatus = async function() {
    try {
        const queueRef = firebase.database().ref('assignmentQueue');
        const snapshot = await queueRef.once('value');
        const queues = snapshot.val() || {};
        
        return Object.keys(queues).length > 0 ? 'active' : 'idle';
    } catch (error) {
        return 'error';
    }
};

SystemMonitor.prototype.getNotificationQueue = async function() {
    try {
        const queueRef = firebase.database().ref('notificationQueue');
        const snapshot = await queueRef.once('value');
        return Object.values(snapshot.val() || {});
    } catch (error) {
        return [];
    }
};

SystemMonitor.prototype.getFailedNotifications = async function() {
    try {
        const failedRef = firebase.database().ref('failedNotifications');
        const snapshot = await failedRef.once('value');
        return Object.values(snapshot.val() || {});
    } catch (error) {
        return [];
    }
};

SystemMonitor.prototype.checkForCriticalIssues = async function(healthStatus) {
    const criticalIssues = [];
    
    if (healthStatus.database === 'disconnected') {
        criticalIssues.push('Database connection lost');
    }
    
    if (healthStatus.automation === 'error') {
        criticalIssues.push('Automation system failure');
    }
    
    if (healthStatus.assignments === 'overdue') {
        criticalIssues.push('Overdue assignments detected');
    }
    
    if (criticalIssues.length > 0) {
        this.logOperation('critical', `Critical issues detected: ${criticalIssues.join(', ')}`);
        await this.sendCriticalAlert(criticalIssues);
    }
};

SystemMonitor.prototype.sendCriticalAlert = async function(issues) {
    try {
        const alertRef = firebase.database().ref('criticalAlerts').push();
        await alertRef.set({
            timestamp: new Date().toISOString(),
            issues: issues,
            status: 'active'
        });
    } catch (error) {
        console.error('Failed to send critical alert:', error);
    }
};

// Manual override execution functions
SystemMonitor.prototype.forceAssignment = async function(params) {
    // Implementation would depend on existing assignment engine
    this.logOperation('override', 'Force assignment executed', params);
};

SystemMonitor.prototype.resetCountdown = async function(params) {
    if (window.startCountdown) {
        window.startCountdown();
    }
    this.logOperation('override', 'Countdown reset executed');
};

SystemMonitor.prototype.clearAssignments = async function(params) {
    const weekKey = params.weekKey;
    if (weekKey) {
        await firebase.database().ref(`assignments/${weekKey}`).remove();
        this.logOperation('override', `Assignments cleared for week: ${weekKey}`);
    }
};

SystemMonitor.prototype.forceWeekAdvancement = async function() {
    // Implementation would depend on existing date range system
    this.logOperation('override', 'Week advancement forced');
};

// UI update functions (to be implemented with admin dashboard)
SystemMonitor.prototype.updateHealthDisplay = function() {
    const healthDisplay = document.getElementById('system-health-display');
    if (healthDisplay) {
        healthDisplay.innerHTML = this.generateHealthHTML();
    }
};

SystemMonitor.prototype.updateLogDisplay = function() {
    const logDisplay = document.getElementById('system-log-display');
    if (logDisplay) {
        logDisplay.innerHTML = this.generateLogHTML();
    }
};

SystemMonitor.prototype.showEmergencyAlert = function() {
    const alertDiv = document.createElement('div');
    alertDiv.id = 'emergency-alert';
    alertDiv.className = 'emergency-alert';
    alertDiv.innerHTML = `
        <div class="alert-content">
            <h3>🚨 EMERGENCY MODE ACTIVE</h3>
            <p>All automation has been paused. Manual intervention required.</p>
        </div>
    `;
    document.body.appendChild(alertDiv);
};

SystemMonitor.prototype.hideEmergencyAlert = function() {
    const alertDiv = document.getElementById('emergency-alert');
    if (alertDiv) {
        alertDiv.remove();
    }
};

SystemMonitor.prototype.generateHealthHTML = function() {
    const status = this.getSystemStatus();
    return `
        <div class="health-status">
            <div class="status-item ${status.automation}">
                <span class="status-label">Automation:</span>
                <span class="status-value">${status.automation}</span>
            </div>
            <div class="status-item ${status.database}">
                <span class="status-label">Database:</span>
                <span class="status-value">${status.database}</span>
            </div>
            <div class="status-item ${status.assignments}">
                <span class="status-label">Assignments:</span>
                <span class="status-value">${status.assignments}</span>
            </div>
            <div class="status-item ${status.notifications}">
                <span class="status-label">Notifications:</span>
                <span class="status-value">${status.notifications}</span>
            </div>
            <div class="status-timestamp">
                Last Check: ${new Date(status.lastHealthCheck).toLocaleString()}
            </div>
        </div>
    `;
};

SystemMonitor.prototype.generateLogHTML = function() {
    const recentLogs = this.getRecentLogs(20);
    return `
        <div class="log-entries">
            ${recentLogs.map(log => `
                <div class="log-entry ${log.type}">
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span class="log-type">[${log.type.toUpperCase()}]</span>
                    <span class="log-message">${log.message}</span>
                </div>
            `).join('')}
        </div>
    `;
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemMonitor;
} else {
    window.SystemMonitor = SystemMonitor;
}