/**
 * Admin Dashboard for System Monitoring and Controls
 * Provides comprehensive admin interface for monitoring and emergency controls
 */

class AdminDashboard {
    constructor() {
        this.systemMonitor = null;
        this.isVisible = false;
        this.refreshInterval = null;
        this.dashboardElement = null;
    }

    /**
     * Initialize admin dashboard
     */
    async initialize(systemMonitor) {
        this.systemMonitor = systemMonitor;
        
        // Create dashboard UI
        this.createDashboardUI();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        console.log('Admin dashboard initialized');
    }

    /**
     * Create the admin dashboard UI
     */
    createDashboardUI() {
        // Create dashboard container
        this.dashboardElement = document.createElement('div');
        this.dashboardElement.id = 'admin-dashboard';
        this.dashboardElement.className = 'admin-dashboard hidden';
        
        this.dashboardElement.innerHTML = `
            <div class="dashboard-header">
                <h2>🔧 System Administration Dashboard</h2>
                <button id="close-dashboard" class="close-btn">×</button>
            </div>
            
            <div class="dashboard-content">
                <!-- System Status Section -->
                <div class="dashboard-section">
                    <h3>📊 System Status</h3>
                    <div id="system-health-display" class="health-display">
                        Loading system status...
                    </div>
                    <div class="status-actions">
                        <button id="refresh-status" class="action-btn">🔄 Refresh Status</button>
                        <button id="run-health-check" class="action-btn">🏥 Run Health Check</button>
                    </div>
                </div>

                <!-- Emergency Controls Section -->
                <div class="dashboard-section emergency-section">
                    <h3>🚨 Emergency Controls</h3>
                    <div class="emergency-controls">
                        <div class="control-group">
                            <label>Emergency Mode:</label>
                            <button id="toggle-emergency" class="emergency-btn">
                                <span id="emergency-status">Activate Emergency Mode</span>
                            </button>
                        </div>
                        <div class="control-group">
                            <label>Quick Actions:</label>
                            <div class="quick-actions">
                                <button id="pause-automation" class="action-btn warning">⏸️ Pause Automation</button>
                                <button id="resume-automation" class="action-btn success">▶️ Resume Automation</button>
                                <button id="force-assignment" class="action-btn">⚡ Force Assignment</button>
                                <button id="reset-countdown" class="action-btn">🔄 Reset Countdown</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Manual Override Section -->
                <div class="dashboard-section">
                    <h3>🎛️ Manual Overrides</h3>
                    <div class="override-controls">
                        <div class="override-form">
                            <select id="override-type">
                                <option value="">Select Override Type</option>
                                <option value="force_assignment">Force Assignment</option>
                                <option value="reset_countdown">Reset Countdown</option>
                                <option value="clear_assignments">Clear Assignments</option>
                                <option value="advance_week">Advance Week</option>
                            </select>
                            <input type="text" id="override-params" placeholder="Parameters (JSON format)" />
                            <button id="execute-override" class="action-btn warning">Execute Override</button>
                        </div>
                        <div id="override-history" class="override-history">
                            <h4>Recent Overrides:</h4>
                            <div id="override-list">No recent overrides</div>
                        </div>
                    </div>
                </div>

                <!-- System Logs Section -->
                <div class="dashboard-section">
                    <h3>📋 System Logs</h3>
                    <div class="log-controls">
                        <select id="log-filter">
                            <option value="all">All Logs</option>
                            <option value="error">Errors Only</option>
                            <option value="warning">Warnings Only</option>
                            <option value="critical">Critical Only</option>
                            <option value="emergency">Emergency Only</option>
                        </select>
                        <button id="clear-logs" class="action-btn warning">🗑️ Clear Logs</button>
                        <button id="export-logs" class="action-btn">📥 Export Logs</button>
                    </div>
                    <div id="system-log-display" class="log-display">
                        Loading system logs...
                    </div>
                </div>

                <!-- System Metrics Section -->
                <div class="dashboard-section">
                    <h3>📈 System Metrics</h3>
                    <div id="system-metrics" class="metrics-display">
                        <div class="metric-item">
                            <span class="metric-label">Uptime:</span>
                            <span id="system-uptime" class="metric-value">--</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Total Operations:</span>
                            <span id="total-operations" class="metric-value">--</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Error Rate:</span>
                            <span id="error-rate" class="metric-value">--</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Last Assignment:</span>
                            <span id="last-assignment" class="metric-value">--</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add dashboard styles
        this.addDashboardStyles();
        
        // Append to body
        document.body.appendChild(this.dashboardElement);
    }

    /**
     * Add CSS styles for the dashboard
     */
    addDashboardStyles() {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .admin-dashboard {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 10000;
                overflow-y: auto;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .admin-dashboard.hidden {
                display: none;
            }

            .dashboard-header {
                background: #1a1a1a;
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #333;
            }

            .dashboard-header h2 {
                margin: 0;
                font-size: 24px;
            }

            .close-btn {
                background: #ff4444;
                color: white;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .close-btn:hover {
                background: #ff6666;
            }

            .dashboard-content {
                padding: 20px;
                max-width: 1200px;
                margin: 0 auto;
            }

            .dashboard-section {
                background: #2a2a2a;
                margin-bottom: 20px;
                border-radius: 8px;
                padding: 20px;
                color: white;
            }

            .dashboard-section h3 {
                margin: 0 0 15px 0;
                color: #4CAF50;
                font-size: 18px;
            }

            .emergency-section {
                border: 2px solid #ff4444;
                background: #3a1a1a;
            }

            .emergency-section h3 {
                color: #ff6666;
            }

            .health-display {
                background: #1a1a1a;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 15px;
            }

            .status-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #444;
            }

            .status-item:last-child {
                border-bottom: none;
            }

            .status-label {
                font-weight: bold;
            }

            .status-value {
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 12px;
                text-transform: uppercase;
            }

            .status-item.active .status-value,
            .status-item.connected .status-value,
            .status-item.operational .status-value {
                background: #4CAF50;
                color: white;
            }

            .status-item.degraded .status-value,
            .status-item.slow .status-value,
            .status-item.processing .status-value {
                background: #FF9800;
                color: white;
            }

            .status-item.error .status-value,
            .status-item.disconnected .status-value,
            .status-item.overdue .status-value {
                background: #f44336;
                color: white;
            }

            .status-item.emergency_mode .status-value {
                background: #9C27B0;
                color: white;
            }

            .status-timestamp {
                text-align: center;
                font-size: 12px;
                color: #888;
                margin-top: 10px;
            }

            .action-btn {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin: 5px;
                font-size: 14px;
            }

            .action-btn:hover {
                background: #45a049;
            }

            .action-btn.warning {
                background: #FF9800;
            }

            .action-btn.warning:hover {
                background: #e68900;
            }

            .action-btn.success {
                background: #4CAF50;
            }

            .emergency-btn {
                background: #ff4444;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }

            .emergency-btn:hover {
                background: #ff6666;
            }

            .emergency-btn.active {
                background: #9C27B0;
            }

            .control-group {
                margin-bottom: 15px;
            }

            .control-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }

            .quick-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }

            .override-form {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
                flex-wrap: wrap;
            }

            .override-form select,
            .override-form input {
                background: #1a1a1a;
                color: white;
                border: 1px solid #444;
                padding: 8px;
                border-radius: 4px;
                flex: 1;
                min-width: 150px;
            }

            .log-display {
                background: #1a1a1a;
                padding: 15px;
                border-radius: 5px;
                max-height: 400px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }

            .log-entry {
                padding: 5px 0;
                border-bottom: 1px solid #333;
                display: flex;
                gap: 10px;
            }

            .log-entry:last-child {
                border-bottom: none;
            }

            .log-timestamp {
                color: #888;
                min-width: 80px;
            }

            .log-type {
                min-width: 80px;
                font-weight: bold;
            }

            .log-entry.error .log-type {
                color: #f44336;
            }

            .log-entry.warning .log-type {
                color: #FF9800;
            }

            .log-entry.critical .log-type {
                color: #9C27B0;
            }

            .log-entry.emergency .log-type {
                color: #ff4444;
            }

            .log-entry.info .log-type {
                color: #4CAF50;
            }

            .log-message {
                flex: 1;
                word-break: break-word;
            }

            .log-controls {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
                flex-wrap: wrap;
            }

            .log-controls select {
                background: #1a1a1a;
                color: white;
                border: 1px solid #444;
                padding: 8px;
                border-radius: 4px;
            }

            .metrics-display {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }

            .metric-item {
                background: #1a1a1a;
                padding: 15px;
                border-radius: 5px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .metric-label {
                font-weight: bold;
            }

            .metric-value {
                color: #4CAF50;
                font-weight: bold;
            }

            .override-history {
                background: #1a1a1a;
                padding: 15px;
                border-radius: 5px;
            }

            .override-history h4 {
                margin: 0 0 10px 0;
                color: #4CAF50;
            }

            .emergency-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff4444;
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 10001;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }

            .alert-content h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
            }

            .alert-content p {
                margin: 0;
            }

            @media (max-width: 768px) {
                .dashboard-content {
                    padding: 10px;
                }
                
                .override-form {
                    flex-direction: column;
                }
                
                .quick-actions {
                    flex-direction: column;
                }
                
                .metrics-display {
                    grid-template-columns: 1fr;
                }
            }
        `;
        
        document.head.appendChild(styleSheet);
    }

    /**
     * Set up event listeners for dashboard controls
     */
    setupEventListeners() {
        // Close dashboard
        document.getElementById('close-dashboard').addEventListener('click', () => {
            this.hide();
        });

        // Refresh status
        document.getElementById('refresh-status').addEventListener('click', () => {
            this.refreshSystemStatus();
        });

        // Run health check
        document.getElementById('run-health-check').addEventListener('click', () => {
            this.runHealthCheck();
        });

        // Emergency mode toggle
        document.getElementById('toggle-emergency').addEventListener('click', () => {
            this.toggleEmergencyMode();
        });

        // Quick actions
        document.getElementById('pause-automation').addEventListener('click', () => {
            this.pauseAutomation();
        });

        document.getElementById('resume-automation').addEventListener('click', () => {
            this.resumeAutomation();
        });

        document.getElementById('force-assignment').addEventListener('click', () => {
            this.forceAssignment();
        });

        document.getElementById('reset-countdown').addEventListener('click', () => {
            this.resetCountdown();
        });

        // Manual override
        document.getElementById('execute-override').addEventListener('click', () => {
            this.executeManualOverride();
        });

        // Log controls
        document.getElementById('log-filter').addEventListener('change', (e) => {
            this.filterLogs(e.target.value);
        });

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('export-logs').addEventListener('click', () => {
            this.exportLogs();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Show the admin dashboard
     */
    show() {
        this.dashboardElement.classList.remove('hidden');
        this.isVisible = true;
        this.refreshAll();
    }

    /**
     * Hide the admin dashboard
     */
    hide() {
        this.dashboardElement.classList.add('hidden');
        this.isVisible = false;
    }

    /**
     * Toggle dashboard visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Start auto-refresh of dashboard data
     */
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.isVisible) {
                this.refreshAll();
            }
        }, 10000); // Refresh every 10 seconds
    }

    /**
     * Refresh all dashboard data
     */
    refreshAll() {
        this.refreshSystemStatus();
        this.refreshLogs();
        this.refreshMetrics();
        this.refreshOverrideHistory();
        this.updateEmergencyStatus();
    }

    /**
     * Refresh system status display
     */
    refreshSystemStatus() {
        if (this.systemMonitor) {
            const healthDisplay = document.getElementById('system-health-display');
            if (healthDisplay) {
                healthDisplay.innerHTML = this.systemMonitor.generateHealthHTML();
            }
        }
    }

    /**
     * Refresh system logs display
     */
    refreshLogs() {
        if (this.systemMonitor) {
            const logDisplay = document.getElementById('system-log-display');
            if (logDisplay) {
                logDisplay.innerHTML = this.systemMonitor.generateLogHTML();
            }
        }
    }

    /**
     * Refresh system metrics
     */
    async refreshMetrics() {
        try {
            const metrics = await this.calculateSystemMetrics();
            
            document.getElementById('system-uptime').textContent = metrics.uptime;
            document.getElementById('total-operations').textContent = metrics.totalOperations;
            document.getElementById('error-rate').textContent = metrics.errorRate;
            document.getElementById('last-assignment').textContent = metrics.lastAssignment;
        } catch (error) {
            console.error('Failed to refresh metrics:', error);
        }
    }

    /**
     * Calculate system metrics
     */
    async calculateSystemMetrics() {
        const logs = this.systemMonitor ? this.systemMonitor.getRecentLogs(1000) : [];
        
        // Calculate uptime (time since first log)
        const firstLog = logs[logs.length - 1];
        const uptime = firstLog ? 
            this.formatUptime(Date.now() - new Date(firstLog.timestamp).getTime()) : 
            'Unknown';

        // Calculate error rate
        const errorLogs = logs.filter(log => log.type === 'error' || log.type === 'critical');
        const errorRate = logs.length > 0 ? 
            `${((errorLogs.length / logs.length) * 100).toFixed(1)}%` : 
            '0%';

        // Find last assignment
        const assignmentLogs = logs.filter(log => log.message.includes('assignment'));
        const lastAssignment = assignmentLogs.length > 0 ? 
            new Date(assignmentLogs[0].timestamp).toLocaleString() : 
            'None';

        return {
            uptime,
            totalOperations: logs.length,
            errorRate,
            lastAssignment
        };
    }

    /**
     * Format uptime duration
     */
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }

    /**
     * Refresh override history
     */
    async refreshOverrideHistory() {
        try {
            const overrideRef = firebase.database().ref('systemControl/manualOverrides');
            const snapshot = await overrideRef.orderByChild('timestamp').limitToLast(5).once('value');
            
            const overrideList = document.getElementById('override-list');
            if (snapshot.exists()) {
                const overrides = Object.values(snapshot.val());
                overrideList.innerHTML = overrides.map(override => `
                    <div class="override-item">
                        <strong>${override.type}</strong> - ${override.status}
                        <br><small>${new Date(override.timestamp).toLocaleString()}</small>
                    </div>
                `).join('');
            } else {
                overrideList.innerHTML = 'No recent overrides';
            }
        } catch (error) {
            console.error('Failed to refresh override history:', error);
        }
    }

    /**
     * Update emergency status display
     */
    async updateEmergencyStatus() {
        try {
            const emergencyRef = firebase.database().ref('systemControl/emergencyMode');
            const snapshot = await emergencyRef.once('value');
            const emergencyMode = snapshot.val() || false;
            
            const toggleBtn = document.getElementById('toggle-emergency');
            const statusSpan = document.getElementById('emergency-status');
            
            if (emergencyMode) {
                toggleBtn.classList.add('active');
                statusSpan.textContent = 'Deactivate Emergency Mode';
            } else {
                toggleBtn.classList.remove('active');
                statusSpan.textContent = 'Activate Emergency Mode';
            }
        } catch (error) {
            console.error('Failed to update emergency status:', error);
        }
    }

    /**
     * Run manual health check
     */
    async runHealthCheck() {
        if (this.systemMonitor) {
            await this.systemMonitor.performHealthCheck();
            this.refreshSystemStatus();
        }
    }

    /**
     * Toggle emergency mode
     */
    async toggleEmergencyMode() {
        try {
            const emergencyRef = firebase.database().ref('systemControl/emergencyMode');
            const snapshot = await emergencyRef.once('value');
            const currentMode = snapshot.val() || false;
            
            await emergencyRef.set(!currentMode);
            
            if (this.systemMonitor) {
                this.systemMonitor.logOperation('admin', `Emergency mode ${!currentMode ? 'activated' : 'deactivated'} via dashboard`);
            }
        } catch (error) {
            console.error('Failed to toggle emergency mode:', error);
        }
    }

    /**
     * Pause automation
     */
    async pauseAutomation() {
        if (this.systemMonitor) {
            await this.systemMonitor.pauseAllAutomation();
        }
    }

    /**
     * Resume automation
     */
    async resumeAutomation() {
        if (this.systemMonitor) {
            await this.systemMonitor.resumeAllAutomation();
        }
    }

    /**
     * Force assignment execution
     */
    async forceAssignment() {
        const weekKey = prompt('Enter week key for force assignment (e.g., Sep8-Sep14):');
        if (weekKey) {
            await this.createManualOverride('force_assignment', { weekKey });
        }
    }

    /**
     * Reset countdown
     */
    async resetCountdown() {
        await this.createManualOverride('reset_countdown', {});
    }

    /**
     * Execute manual override
     */
    async executeManualOverride() {
        const overrideType = document.getElementById('override-type').value;
        const paramsText = document.getElementById('override-params').value;
        
        if (!overrideType) {
            alert('Please select an override type');
            return;
        }

        let params = {};
        if (paramsText) {
            try {
                params = JSON.parse(paramsText);
            } catch (error) {
                alert('Invalid JSON in parameters field');
                return;
            }
        }

        await this.createManualOverride(overrideType, params);
        
        // Clear form
        document.getElementById('override-type').value = '';
        document.getElementById('override-params').value = '';
    }

    /**
     * Create manual override in Firebase
     */
    async createManualOverride(type, params) {
        try {
            const overrideRef = firebase.database().ref('systemControl/manualOverrides').push();
            await overrideRef.set({
                type,
                params,
                status: 'pending',
                timestamp: new Date().toISOString(),
                createdBy: 'admin_dashboard'
            });

            if (this.systemMonitor) {
                this.systemMonitor.logOperation('admin', `Manual override created: ${type}`, params);
            }

            alert(`Override "${type}" has been queued for execution`);
        } catch (error) {
            console.error('Failed to create manual override:', error);
            alert('Failed to create override');
        }
    }

    /**
     * Filter logs by type
     */
    filterLogs(filterType) {
        if (!this.systemMonitor) return;
        
        const logs = this.systemMonitor.getRecentLogs(100);
        const filteredLogs = filterType === 'all' ? 
            logs : 
            logs.filter(log => log.type === filterType);

        const logDisplay = document.getElementById('system-log-display');
        logDisplay.innerHTML = `
            <div class="log-entries">
                ${filteredLogs.map(log => `
                    <div class="log-entry ${log.type}">
                        <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span class="log-type">[${log.type.toUpperCase()}]</span>
                        <span class="log-message">${log.message}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Clear system logs
     */
    async clearLogs() {
        if (confirm('Are you sure you want to clear all system logs?')) {
            if (this.systemMonitor) {
                await this.systemMonitor.clearOldLogs();
                this.refreshLogs();
            }
        }
    }

    /**
     * Export system logs
     */
    exportLogs() {
        if (!this.systemMonitor) return;
        
        const logs = this.systemMonitor.getRecentLogs(1000);
        const logText = logs.map(log => 
            `${log.timestamp} [${log.type.toUpperCase()}] ${log.message}`
        ).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy dashboard
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.dashboardElement) {
            this.dashboardElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminDashboard;
} else {
    window.AdminDashboard = AdminDashboard;
}