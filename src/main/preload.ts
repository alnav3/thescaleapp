/**
 * Preload Script
 *
 * Exposes a secure, type-safe API to the renderer process via contextBridge.
 * This script runs in an isolated context with access to both Node.js and DOM APIs.
 *
 * Security considerations:
 * - contextIsolation is enabled, preventing renderer from accessing Node.js directly
 * - nodeIntegration is disabled in the main window
 * - Only specific IPC channels are exposed, not the full ipcRenderer
 *
 * @module main/preload
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  IpcResponse,
  BLEStateChangeEvent,
  BLEErrorEvent,
  BLEDeviceInfo,
  MeasurementQuery,
  MeasurementResult,
  StoredUserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  HealthReport,
  BLEConnectionState,
  QRLoginSession,
  QRLoginPollResult,
  XiaomiCloudDevice,
  BLEKeyResult,
  XiaomiAuthState,
  XiaomiRegion,
  BackupData,
  BackupInfo,
  BackupValidationResult,
  RestoreOptions,
  StoredBLEConfig,
  AppSettings,
  ConfigExport,
  NativeBLEDevice,
  NativeBLEMeasurement,
  NativeBLEStatus,
} from '../shared/types';
import { IpcChannels } from '../shared/types';

/**
 * Type-safe API exposed to the renderer process
 */
const electronAPI: ElectronAPI = {
  // ====== Measurements ======

   /**
    * Capture a new measurement from the connected scale
    * @param profileId - The profile to associate the measurement with
    */
   captureMeasurement: (profileId: string): Promise<IpcResponse<MeasurementResult>> => {
     return ipcRenderer.invoke(IpcChannels.MEASUREMENT_CAPTURE, profileId);
   },

   /**
    * Save a measurement with raw data (without reading from scale)
    * @param profileId - The profile to associate the measurement with
    * @param raw - The raw measurement data
    */
   saveMeasurementWithRaw: (profileId: string, raw: any): Promise<IpcResponse<MeasurementResult>> => {
     return ipcRenderer.invoke(IpcChannels.MEASUREMENT_SAVE_WITH_RAW, profileId, raw);
   },

   /**
    * Get measurements with optional filtering and pagination
    * @param query - Query parameters for filtering
    */
   getMeasurements: (query: MeasurementQuery): Promise<IpcResponse<MeasurementResult[]>> => {
    return ipcRenderer.invoke(IpcChannels.MEASUREMENT_GET_ALL, query);
  },

  /**
   * Get a specific measurement by ID
   * @param id - Measurement ID
   */
  getMeasurementById: (id: string): Promise<IpcResponse<MeasurementResult | null>> => {
    return ipcRenderer.invoke(IpcChannels.MEASUREMENT_GET_BY_ID, id);
  },

  /**
   * Delete a measurement
   * @param id - Measurement ID to delete
   */
  deleteMeasurement: (id: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.MEASUREMENT_DELETE, id);
  },

  /**
   * Delete all measurements for a profile
   * @param profileId - Profile ID whose measurements should be deleted
   */
  deleteAllMeasurements: (profileId: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.MEASUREMENT_DELETE_ALL, profileId);
  },

  /**
   * Count measurements for a profile
   * @param profileId - Profile ID to count measurements for
   */
  countMeasurements: (profileId: string): Promise<IpcResponse<number>> => {
    return ipcRenderer.invoke(IpcChannels.MEASUREMENT_COUNT, profileId);
  },

  // ====== Profiles ======

  /**
   * Create a new user profile
   * @param data - Profile creation data
   */
  createProfile: (data: CreateProfileInput): Promise<IpcResponse<StoredUserProfile>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_CREATE, data);
  },

  /**
   * Update an existing profile
   * @param id - Profile ID to update
   * @param data - Fields to update
   */
  updateProfile: (
    id: string,
    data: UpdateProfileInput
  ): Promise<IpcResponse<StoredUserProfile>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_UPDATE, id, data);
  },

  /**
   * Get a profile by ID
   * @param id - Profile ID
   */
  getProfile: (id: string): Promise<IpcResponse<StoredUserProfile | null>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_GET, id);
  },

  /**
   * Get all profiles
   */
  getAllProfiles: (): Promise<IpcResponse<StoredUserProfile[]>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_GET_ALL);
  },

  /**
   * Delete a profile
   * @param id - Profile ID to delete
   */
  deleteProfile: (id: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_DELETE, id);
  },

  /**
   * Set a profile as the default
   * @param id - Profile ID to set as default
   */
  setDefaultProfile: (id: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_SET_DEFAULT, id);
  },

  /**
   * Get the default profile
   */
  getDefaultProfile: (): Promise<IpcResponse<StoredUserProfile | null>> => {
    return ipcRenderer.invoke(IpcChannels.PROFILE_GET_DEFAULT);
  },

  // ====== Reports ======

  /**
   * Generate a full health report for a profile
   * @param profileId - Profile ID to generate report for
   */
  generateReport: (profileId: string): Promise<IpcResponse<HealthReport>> => {
    return ipcRenderer.invoke(IpcChannels.REPORT_GENERATE, profileId);
  },

  /**
   * Get a quick summary for a profile
   * @param profileId - Profile ID
   */
  getQuickSummary: (
    profileId: string
  ): Promise<IpcResponse<{ bodyScore: number; status: string } | null>> => {
    return ipcRenderer.invoke(IpcChannels.REPORT_QUICK_SUMMARY, profileId);
  },

  // ====== BLE ======

  /**
   * Start scanning for the Xiaomi Mi Scale S400
   */
  scanForDevice: (): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_SCAN);
  },

  /**
   * Scan for nearby Mi Scale devices and return discovered devices
   * @param timeoutMs - Scan timeout in milliseconds (default: 10000)
   */
  scanForDevices: (timeoutMs?: number): Promise<IpcResponse<BLEDeviceInfo[]>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_SCAN_FOR_DEVICES, timeoutMs);
  },

  /**
   * Stop current scanning operation
   */
  stopScan: (): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_STOP_SCAN);
  },

  /**
   * Connect to the scale
   * @param mac - MAC address of the scale
   * @param key - BLE encryption key
   */
  connectDevice: (mac: string, key: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_CONNECT, mac, key);
  },

  /**
   * Disconnect from the scale
   */
  disconnectDevice: (): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_DISCONNECT);
  },

  /**
   * Get the current BLE connection state
   */
  getBLEState: (): Promise<IpcResponse<BLEConnectionState>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_GET_STATE);
  },

  /**
   * Check if the configured device is available
   */
  isDeviceAvailable: (): Promise<IpcResponse<boolean>> => {
    return ipcRenderer.invoke(IpcChannels.BLE_IS_AVAILABLE);
  },

  // ====== BLE Events ======

  /**
   * Subscribe to BLE state changes
   * @param callback - Function called when state changes
   * @returns Unsubscribe function
   */
  onBLEStateChange: (callback: (event: BLEStateChangeEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: BLEStateChangeEvent) => {
      callback(data);
    };

    ipcRenderer.on(IpcChannels.BLE_STATE_CHANGE, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IpcChannels.BLE_STATE_CHANGE, listener);
    };
  },

  /**
   * Subscribe to BLE errors
   * @param callback - Function called when an error occurs
   * @returns Unsubscribe function
   */
  onBLEError: (callback: (event: BLEErrorEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: BLEErrorEvent) => {
      callback(data);
    };

    ipcRenderer.on(IpcChannels.BLE_ERROR, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IpcChannels.BLE_ERROR, listener);
    };
  },

  /**
   * Subscribe to device discovery events during scanning
   * @param callback - Function called when a Mi Scale device is discovered
   * @returns Unsubscribe function
   */
  onBLEDeviceDiscovered: (callback: (device: BLEDeviceInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: BLEDeviceInfo) => {
      callback(data);
    };

    ipcRenderer.on(IpcChannels.BLE_DEVICE_DISCOVERED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IpcChannels.BLE_DEVICE_DISCOVERED, listener);
    };
  },

  // ====== Native BLE (using @abandonware/noble) ======

  nativeBLE: {
    /**
     * Start scanning for Mi Scale devices
     */
    startScanning: (): Promise<IpcResponse<void>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_START_SCANNING);
    },

    /**
     * Stop scanning
     */
    stopScanning: (): Promise<IpcResponse<void>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_STOP_SCANNING);
    },

    /**
     * Disconnect from current device
     */
    disconnect: (): Promise<IpcResponse<void>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_DISCONNECT);
    },

    /**
     * Set target device MAC address
     */
    setDevice: (mac: string): Promise<IpcResponse<void>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_SET_DEVICE, mac);
    },

    /**
     * Get current BLE status
     */
    getStatus: (): Promise<IpcResponse<NativeBLEStatus>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_GET_STATUS);
    },

    /**
     * Set scan mode: 'mibeacon' for passive ads, 'gatt' for real-time connection
     */
    setScanMode: (mode: 'mibeacon' | 'gatt'): Promise<IpcResponse<void>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_SET_SCAN_MODE, mode);
    },

    /**
     * Get current scan mode
     */
    getScanMode: (): Promise<IpcResponse<'mibeacon' | 'gatt'>> => {
      return ipcRenderer.invoke(IpcChannels.NATIVE_BLE_GET_SCAN_MODE);
    },

    /**
     * Subscribe to measurement events
     */
    onMeasurement: (callback: (measurement: NativeBLEMeasurement) => void): (() => void) => {
      console.log('[Preload] onMeasurement subscription registered');
      const listener = (_event: Electron.IpcRendererEvent, data: NativeBLEMeasurement) => {
        console.log('[Preload] Received measurement IPC:', data.weightKg, 'kg');
        callback(data);
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_MEASUREMENT, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_MEASUREMENT, listener);
    },

    /**
     * Subscribe to connected events
     */
    onConnected: (callback: (device: NativeBLEDevice) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: NativeBLEDevice) => {
        callback(data);
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_CONNECTED, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_CONNECTED, listener);
    },

    /**
     * Subscribe to disconnected events
     */
    onDisconnected: (callback: () => void): (() => void) => {
      const listener = () => {
        callback();
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_DISCONNECTED, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_DISCONNECTED, listener);
    },

    /**
     * Subscribe to scanning events
     */
    onScanning: (callback: () => void): (() => void) => {
      const listener = () => {
        callback();
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_SCANNING, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_SCANNING, listener);
    },

    /**
     * Subscribe to discovered device events
     */
    onDiscovered: (callback: (device: NativeBLEDevice) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: NativeBLEDevice) => {
        console.log('[Preload] Received discovered event:', data);
        callback(data);
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_DISCOVERED, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_DISCOVERED, listener);
    },

    /**
     * Subscribe to error events
     */
    onError: (callback: (error: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => {
        callback(error);
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_ERROR, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_ERROR, listener);
    },

    /**
     * Subscribe to ready events (Bluetooth powered on)
     */
    onReady: (callback: () => void): (() => void) => {
      const listener = () => {
        callback();
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_READY, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_READY, listener);
    },

    /**
     * Subscribe to unavailable events (Bluetooth powered off)
     */
    onUnavailable: (callback: (state: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: string) => {
        callback(state);
      };
      ipcRenderer.on(IpcChannels.NATIVE_BLE_UNAVAILABLE, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NATIVE_BLE_UNAVAILABLE, listener);
    },
  },

  // ====== Xiaomi Cloud ======

  /**
   * Start QR code login flow for Xiaomi cloud
   */
  startXiaomiQRLogin: (): Promise<IpcResponse<QRLoginSession>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_START_QR_LOGIN);
  },

  /**
   * Poll for QR login status
   * @param sessionId - Session ID from startXiaomiQRLogin
   */
  pollXiaomiLogin: (sessionId: string): Promise<IpcResponse<QRLoginPollResult>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_POLL_LOGIN, sessionId);
  },

  /**
   * Complete login after QR confirmation
   * @param authToken - Auth token from successful poll
   * @param region - Xiaomi cloud region
   */
  completeXiaomiLogin: (
    authToken: string,
    region: XiaomiRegion
  ): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_COMPLETE_LOGIN, authToken, region);
  },

  /**
   * Get list of devices from Xiaomi cloud
   */
  getXiaomiDevices: (): Promise<IpcResponse<XiaomiCloudDevice[]>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_GET_DEVICES);
  },

  /**
   * Get BLE encryption key for a device
   * @param deviceId - Device ID
   */
  getXiaomiBLEKey: (deviceId: string): Promise<IpcResponse<BLEKeyResult>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_GET_BLE_KEY, deviceId);
  },

  /**
   * Get current Xiaomi authentication state
   */
  getXiaomiAuthState: (): Promise<IpcResponse<XiaomiAuthState>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_GET_AUTH_STATE);
  },

  /**
   * Logout from Xiaomi cloud
   */
  xiaomiLogout: (): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.XIAOMI_LOGOUT);
  },

  // ====== Backup ======

  /**
   * Create a complete backup of all application data
   */
  createBackup: (): Promise<IpcResponse<BackupData>> => {
    return ipcRenderer.invoke(IpcChannels.BACKUP_CREATE);
  },

  /**
   * Restore data from a backup
   * @param backup - Backup data to restore
   * @param options - Restore options (merge or replace)
   */
  restoreBackup: (backup: BackupData, options?: RestoreOptions): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.BACKUP_RESTORE, backup, options);
  },

  /**
   * Validate backup structure and compatibility
   * @param backup - Backup data to validate
   */
  validateBackup: (backup: unknown): Promise<IpcResponse<BackupValidationResult>> => {
    return ipcRenderer.invoke(IpcChannels.BACKUP_VALIDATE, backup);
  },

  /**
   * Get summary information about a backup
   * @param backup - Backup data
   */
  getBackupInfo: (backup: BackupData): Promise<IpcResponse<BackupInfo>> => {
    return ipcRenderer.invoke(IpcChannels.BACKUP_GET_INFO, backup);
  },

  // ====== Config ======

  /**
   * Get current BLE configuration
   */
  getBLEConfig: (): Promise<IpcResponse<StoredBLEConfig>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_GET_BLE);
  },

  /**
   * Set BLE configuration
   * @param config - BLE configuration to set
   */
  setBLEConfig: (config: StoredBLEConfig): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_SET_BLE, config);
  },

  /**
   * Get current app settings
   */
  getAppSettings: (): Promise<IpcResponse<AppSettings>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_GET_SETTINGS);
  },

  /**
   * Set app settings
   * @param settings - App settings to set
   */
  setAppSettings: (settings: AppSettings): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_SET_SETTINGS, settings);
  },

  /**
   * Export all configuration data
   */
  exportConfig: (): Promise<IpcResponse<ConfigExport>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_EXPORT);
  },

  /**
   * Import configuration data
   * @param config - Configuration to import
   */
  importConfig: (config: ConfigExport): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_IMPORT, config);
  },

  /**
   * Reset all configuration to defaults
   */
  resetConfig: (): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.CONFIG_RESET);
  },

  // ====== Shell ======

  /**
   * Open a URL in the default external browser
   * @param url - The URL to open (must be http:// or https://)
   */
  openExternalUrl: (url: string): Promise<IpcResponse<void>> => {
    return ipcRenderer.invoke(IpcChannels.SHELL_OPEN_EXTERNAL, url);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Log that preload has been loaded
console.log('[Preload] Electron API exposed to renderer');
