/**
 * IPC Handlers
 *
 * Registers all IPC handlers for communication between main and renderer processes.
 * Each handler validates input, calls the appropriate service, and returns a standardized response.
 *
 * @module main/ipc-handlers
 */

import { ipcMain, BrowserWindow, shell } from 'electron';
import {
  getMeasurementService,
  getProfileService,
  getReportService,
  getBLEPort,
  getMeasurementRepository,
  getXiaomiCloudService,
  getBackupService,
  getAppConfigStoreInstance,
} from './services';
import { BleakBLEAdapter } from './ble/BleakBLEAdapter';
import type {
  IpcResponse,
  IpcError,
  MeasurementQuery,
  MeasurementResult,
  StoredUserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  HealthReport,
  BLEConnectionState,
  BLEDeviceInfo,
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
} from '../shared/types';
import { IpcChannels } from '../shared/types';
import {
  isDomainError,
  getErrorCode,
  serializeDomainError,
} from '../domain/errors';

/**
 * Create a successful IPC response
 */
function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

/**
 * Create an error IPC response
 */
function errorResponse(code: string, message: string, details?: unknown): IpcResponse<never> {
  const error: IpcError = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return { success: false, error };
}

/**
 * Map errors to IPC error codes using centralized domain errors.
 */
function mapErrorToCode(error: unknown): string {
  return getErrorCode(error);
}

/**
 * Get error details for IPC response.
 */
function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (isDomainError(error)) {
    const serialized = serializeDomainError(error);
    return serialized.details;
  }
  return undefined;
}

/**
 * Wrap an async handler with error handling
 */
function wrapHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<IpcResponse<TResult>> {
  return async (...args: TArgs): Promise<IpcResponse<TResult>> => {
    try {
      const result = await handler(...args);
      return successResponse(result);
    } catch (error) {
      const code = mapErrorToCode(error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      const details = getErrorDetails(error);
      console.error(`[IPC Error] ${code}:`, message, error);
      return errorResponse(code, message, details);
    }
  };
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  console.log('[IPC] Registering handlers...');

  // ====== Measurement Handlers ======

  ipcMain.handle(
    IpcChannels.MEASUREMENT_CAPTURE,
    wrapHandler(async (_event, profileId: string): Promise<MeasurementResult> => {
      const measurementService = getMeasurementService();
      const result = await measurementService.captureMeasurement(profileId);
      // Convert Date to serializable format for IPC
      return {
        ...result,
        timestamp: result.timestamp,
      };
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_GET_ALL,
    wrapHandler(async (_event, query: MeasurementQuery): Promise<MeasurementResult[]> => {
      const measurementService = getMeasurementService();
      // Convert date strings to Date objects if needed
      const normalizedQuery: MeasurementQuery = {
        ...query,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
      };
      return measurementService.getMeasurementHistory(normalizedQuery);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_GET_BY_ID,
    wrapHandler(async (_event, id: string): Promise<MeasurementResult | null> => {
      const measurementService = getMeasurementService();
      return measurementService.getMeasurement(id);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_DELETE,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const measurementService = getMeasurementService();
      return measurementService.deleteMeasurement(id);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_DELETE_ALL,
    wrapHandler(async (_event, profileId: string): Promise<void> => {
      const measurementService = getMeasurementService();
      return measurementService.deleteAllMeasurements(profileId);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_COUNT,
    wrapHandler(async (_event, profileId: string): Promise<number> => {
      const measurementRepository = getMeasurementRepository();
      return measurementRepository.count({ userProfileId: profileId });
    })
  );

  // ====== Profile Handlers ======

  ipcMain.handle(
    IpcChannels.PROFILE_CREATE,
    wrapHandler(async (_event, data: CreateProfileInput): Promise<StoredUserProfile> => {
      const profileService = getProfileService();
      return profileService.createProfile(data);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_UPDATE,
    wrapHandler(async (_event, id: string, data: UpdateProfileInput): Promise<StoredUserProfile> => {
      const profileService = getProfileService();
      return profileService.updateProfile(id, data);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET,
    wrapHandler(async (_event, id: string): Promise<StoredUserProfile | null> => {
      const profileService = getProfileService();
      return profileService.getProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET_ALL,
    wrapHandler(async (_event): Promise<StoredUserProfile[]> => {
      const profileService = getProfileService();
      return profileService.getAllProfiles();
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_DELETE,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const profileService = getProfileService();
      return profileService.deleteProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_SET_DEFAULT,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const profileService = getProfileService();
      return profileService.setDefaultProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET_DEFAULT,
    wrapHandler(async (_event): Promise<StoredUserProfile | null> => {
      const profileService = getProfileService();
      return profileService.getDefaultProfile();
    })
  );

  // ====== Report Handlers ======

  ipcMain.handle(
    IpcChannels.REPORT_GENERATE,
    wrapHandler(async (_event, profileId: string): Promise<HealthReport> => {
      const reportService = getReportService();
      return reportService.generateReport(profileId);
    })
  );

  ipcMain.handle(
    IpcChannels.REPORT_QUICK_SUMMARY,
    wrapHandler(
      async (_event, profileId: string): Promise<{ bodyScore: number; status: string } | null> => {
        const reportService = getReportService();
        return reportService.getQuickSummary(profileId);
      }
    )
  );

  // ====== BLE Handlers ======

  ipcMain.handle(
    IpcChannels.BLE_SCAN,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.scan();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_SCAN_FOR_DEVICES,
    wrapHandler(async (_event, timeoutMs?: number): Promise<BLEDeviceInfo[]> => {
      const blePort = getBLEPort();
      return blePort.scanForDevices(timeoutMs);
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_STOP_SCAN,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      blePort.stopScan();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_CONNECT,
    wrapHandler(async (_event, mac: string, key: string): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.connect(mac, key);
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_DISCONNECT,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.disconnect();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_GET_STATE,
    wrapHandler(async (_event): Promise<BLEConnectionState> => {
      const blePort = getBLEPort();
      return blePort.getState();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_IS_AVAILABLE,
    wrapHandler(async (_event): Promise<boolean> => {
      const blePort = getBLEPort();
      return blePort.isDeviceAvailable();
    })
  );

  // ====== Xiaomi Cloud Handlers ======

  ipcMain.handle(
    IpcChannels.XIAOMI_START_QR_LOGIN,
    wrapHandler(async (_event): Promise<QRLoginSession> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.startQRLogin();
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_POLL_LOGIN,
    wrapHandler(async (_event, sessionId: string): Promise<QRLoginPollResult> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.pollLoginStatus(sessionId);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_COMPLETE_LOGIN,
    wrapHandler(async (_event, authToken: string, region: XiaomiRegion): Promise<void> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.completeLogin(authToken, region);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_DEVICES,
    wrapHandler(async (_event): Promise<XiaomiCloudDevice[]> => {
      const xiaomiService = getXiaomiCloudService();
      const devices = await xiaomiService.getDevices();
      return devices.map((d) => ({
        did: d.did,
        name: d.name,
        model: d.model,
        mac: d.mac,
        isBLE: d.isBLE,
        parentId: d.parentId,
      }));
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_BLE_KEY,
    wrapHandler(async (_event, deviceId: string): Promise<BLEKeyResult> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.getBLEKey(deviceId);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_AUTH_STATE,
    wrapHandler(async (_event): Promise<XiaomiAuthState> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.getAuthState();
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_LOGOUT,
    wrapHandler(async (_event): Promise<void> => {
      const xiaomiService = getXiaomiCloudService();
      xiaomiService.logout();
    })
  );

  // ====== Backup Handlers ======

  ipcMain.handle(
    IpcChannels.BACKUP_CREATE,
    wrapHandler(async (_event): Promise<BackupData> => {
      const backupService = getBackupService();
      return backupService.createBackup();
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_RESTORE,
    wrapHandler(async (_event, backup: BackupData, options?: RestoreOptions): Promise<void> => {
      const backupService = getBackupService();
      return backupService.restoreBackup(backup, options);
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_VALIDATE,
    wrapHandler(async (_event, backup: unknown): Promise<BackupValidationResult> => {
      const backupService = getBackupService();
      return backupService.validateBackup(backup);
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_GET_INFO,
    wrapHandler(async (_event, backup: BackupData): Promise<BackupInfo> => {
      const backupService = getBackupService();
      return backupService.getBackupInfo(backup);
    })
  );

  // ====== Config Handlers ======

  ipcMain.handle(
    IpcChannels.CONFIG_GET_BLE,
    wrapHandler(async (_event): Promise<StoredBLEConfig> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.getBLEConfig();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_SET_BLE,
    wrapHandler(async (_event, config: StoredBLEConfig): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.setBLEConfig(config);

      // Sync to existing BLE adapter if it exists
      if (bleAdapter) {
        console.log('[IPC] Syncing BLE config to adapter:', {
          deviceMac: config.deviceMac,
          hasBleKey: !!config.bleKey,
        });

        // Stop current scan if running so next scan uses new config
        // This is important because the Python process uses config at start time
        if (bleAdapter.getState() === 'scanning') {
          console.log('[IPC] Stopping current scan to apply new config');
          await bleAdapter.stopScanning();
        }

        bleAdapter.setDeviceMac(config.deviceMac || null);
        bleAdapter.setBleKey(config.bleKey || null);
      }
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_GET_SETTINGS,
    wrapHandler(async (_event): Promise<AppSettings> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.getAppSettings();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_SET_SETTINGS,
    wrapHandler(async (_event, settings: AppSettings): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.setAppSettings(settings);
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_EXPORT,
    wrapHandler(async (_event): Promise<ConfigExport> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.exportConfig();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_IMPORT,
    wrapHandler(async (_event, config: ConfigExport): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.importConfig(config);
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_RESET,
    wrapHandler(async (_event): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.reset();
    })
  );

  // ====== Shell Handlers ======

  ipcMain.handle(
    IpcChannels.SHELL_OPEN_EXTERNAL,
    wrapHandler(async (_event, url: string): Promise<void> => {
      // Validate URL to prevent security issues
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        throw new Error('Invalid URL: must start with http:// or https://');
      }
      await shell.openExternal(url);
    })
  );

  console.log('[IPC] Handlers registered successfully');
}

// ====== Native BLE Adapter Instance ======
// Using BleakBLEAdapter (Python bleak) instead of NobleBLEAdapter
// because noble's XPC bindings don't work on macOS Sequoia
let bleAdapter: BleakBLEAdapter | null = null;

/**
 * Get or create the Native BLE adapter instance
 */
function getBLEAdapter(): BleakBLEAdapter {
  if (!bleAdapter) {
    const configStore = getAppConfigStoreInstance();
    const bleConfig = configStore.getBLEConfig();

    bleAdapter = new BleakBLEAdapter({
      deviceMac: bleConfig.deviceMac || null,
      bleKey: bleConfig.bleKey || null,  // MiBeacon decryption key
      autoConnect: bleConfig.autoConnect ?? true,
      scanInterval: 5000,
      scanTimeout: 60000,  // Longer timeout for advertisement scanning
      allowDuplicates: true,
    });

    console.log('[NativeBLE] BleakBLEAdapter initialized (using Python bleak)');
    console.log('[NativeBLE] Device MAC:', bleConfig.deviceMac);
    console.log('[NativeBLE] Has BLE Key:', !!bleConfig.bleKey);
  }
  return bleAdapter;
}

/**
 * Register Native BLE IPC handlers
 * Call this after registerIpcHandlers()
 */
export function registerNativeBLEHandlers(): void {
  console.log('[NativeBLE] Registering handlers...');

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_START_SCANNING,
    wrapHandler(async (): Promise<void> => {
      const adapter = getBLEAdapter();

      // Reload config from store before scanning to ensure latest values
      const configStore = getAppConfigStoreInstance();
      const bleConfig = configStore.getBLEConfig();
      console.log('[NativeBLE] Reloading config before scan:', {
        deviceMac: bleConfig.deviceMac,
        hasBleKey: !!bleConfig.bleKey,
      });
      adapter.setDeviceMac(bleConfig.deviceMac || null);
      adapter.setBleKey(bleConfig.bleKey || null);

      await adapter.startScanning();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_STOP_SCANNING,
    wrapHandler(async (): Promise<void> => {
      const adapter = getBLEAdapter();
      await adapter.stopScanning();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_DISCONNECT,
    wrapHandler(async (): Promise<void> => {
      const adapter = getBLEAdapter();
      await adapter.disconnect();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_SET_DEVICE,
    wrapHandler(async (_event, mac: string): Promise<void> => {
      const adapter = getBLEAdapter();
      adapter.setDeviceMac(mac);

      // Also save to config
      const configStore = getAppConfigStoreInstance();
      const currentConfig = configStore.getBLEConfig();
      configStore.setBLEConfig({
        ...currentConfig,
        deviceMac: mac,
      });
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_GET_STATUS,
    wrapHandler(async (): Promise<{
      isConnected: boolean;
      isScanning: boolean;
      device: { id: string; name: string } | null;
      state: string;
      scanMode: string;
    }> => {
      const adapter = getBLEAdapter();
      return {
        isConnected: adapter.isConnected(),
        isScanning: adapter.getState() === 'scanning',
        device: adapter.getConnectedDevice(),
        state: adapter.getState(),
        scanMode: adapter.getScanMode(),
      };
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_SET_SCAN_MODE,
    wrapHandler(async (_event, mode: 'mibeacon' | 'gatt'): Promise<void> => {
      console.log('[NativeBLE] Setting scan mode:', mode);
      const adapter = getBLEAdapter();

      // Stop scanning if currently scanning
      if (adapter.getState() === 'scanning') {
        await adapter.stopScanning();
      }

      adapter.setScanMode(mode);

      // Save to config
      const configStore = getAppConfigStoreInstance();
      const currentConfig = configStore.getBLEConfig();
      configStore.setBLEConfig({
        ...currentConfig,
        scanMode: mode,
      });
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_GET_SCAN_MODE,
    wrapHandler(async (): Promise<string> => {
      const adapter = getBLEAdapter();
      return adapter.getScanMode();
    })
  );

  console.log('[NativeBLE] Handlers registered successfully');
}

/**
 * Setup Native BLE event forwarding to renderer
 * Call this after creating the main window
 */
export function setupNativeBLEEventForwarding(mainWindow: BrowserWindow): () => void {
  const adapter = getBLEAdapter();
  console.log('[NativeBLE] Setting up event forwarding, adapter state:', adapter.getState());
  console.log('[NativeBLE] Adapter listener count before:', adapter.listenerCount('measurement'));

  // Forward measurement events (all fields from BLE scanner)
  const measurementHandler = (measurement: {
    weightKg: number;
    impedanceOhm?: number;
    impedanceLowOhm?: number;
    heartRateBpm?: number;
    profileId?: number;
    timestamp?: Date;
    isStabilized?: boolean;
    isImpedanceMeasurement?: boolean;
    isHeartRateMeasurement?: boolean;
  }) => {
    console.log('[NativeBLE] Forwarding measurement to renderer:', measurement.weightKg, 'kg, HR:', measurement.heartRateBpm);
    
    // AUTO-SAVE: Save measurement immediately as guest measurement
    // This fixes the issue where renderer doesn't trigger captureMeasurement IPC
    try {
      const measurementService = getMeasurementService();
      
      // Create raw measurement object, filtering out null/undefined optional fields
      const rawMeasurement: any = {
        weightKg: measurement.weightKg,
      };
      
      // Only include optional fields if they have valid values
      if (measurement.impedanceOhm !== null && measurement.impedanceOhm !== undefined) {
        rawMeasurement.impedanceOhm = measurement.impedanceOhm;
      }
      if (measurement.impedanceLowOhm !== null && measurement.impedanceLowOhm !== undefined) {
        rawMeasurement.impedanceLowOhm = measurement.impedanceLowOhm;
      }
      if (measurement.heartRateBpm !== null && measurement.heartRateBpm !== undefined) {
        rawMeasurement.heartRateBpm = measurement.heartRateBpm;
      }
      
      console.log('[NativeBLE] [AUTO-SAVE] Saving measurement as guest...', rawMeasurement);
      measurementService.saveMeasurementAsGuest(rawMeasurement)
        .then(() => {
          console.log('[NativeBLE] [AUTO-SAVE] Measurement saved successfully');
        })
        .catch((err) => {
          console.error('[NativeBLE] [AUTO-SAVE] Failed to save measurement:', err);
        });
    } catch (err) {
      console.error('[NativeBLE] [AUTO-SAVE] Error during auto-save:', err);
    }
    
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_MEASUREMENT, {
        ...measurement,
        timestamp: measurement.timestamp?.toISOString() || new Date().toISOString(),
      });
    }
  };
  adapter.on('measurement', measurementHandler);
  console.log('[NativeBLE] Adapter listener count after:', adapter.listenerCount('measurement'));

  // Forward connected events
  const connectedHandler = (device: { id: string; name: string }) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_CONNECTED, device);
    }
  };
  adapter.on('connected', connectedHandler);

  // Forward disconnected events
  const disconnectedHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_DISCONNECTED);
    }
  };
  adapter.on('disconnected', disconnectedHandler);

  // Forward scanning events
  const scanningHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_SCANNING);
    }
  };
  adapter.on('scanning', scanningHandler);

  // Forward discovered events
  const discoveredHandler = (device: { id: string; name: string }) => {
    console.log('[NativeBLE] Forwarding discovered event to renderer:', device);
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_DISCOVERED, device);
    }
  };
  adapter.on('discovered', discoveredHandler);

  // Forward error events
  const errorHandler = (error: Error) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_ERROR, error.message);
    }
  };
  adapter.on('error', errorHandler);

  // Forward ready events
  const readyHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_READY);
    }
  };
  adapter.on('ready', readyHandler);

  // Forward unavailable events
  const unavailableHandler = (state: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_UNAVAILABLE, state);
    }
  };
  adapter.on('unavailable', unavailableHandler);

  // Cleanup function
  return () => {
    adapter.off('measurement', measurementHandler);
    adapter.off('connected', connectedHandler);
    adapter.off('disconnected', disconnectedHandler);
    adapter.off('scanning', scanningHandler);
    adapter.off('discovered', discoveredHandler);
    adapter.off('error', errorHandler);
    adapter.off('ready', readyHandler);
    adapter.off('unavailable', unavailableHandler);

    // Disconnect and cleanup adapter
    adapter.disconnect().catch(console.error);
    adapter.removeAllListeners();
    bleAdapter = null;
  };
}

/**
 * Setup BLE event forwarding to renderer
 * Call this after creating the main window
 */
export function setupBLEEventForwarding(mainWindow: BrowserWindow): () => void {
  const blePort = getBLEPort();

  // Forward state changes to renderer
  const unsubscribeState = blePort.onStateChange((state) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_STATE_CHANGE, {
        state,
        timestamp: Date.now(),
      });
    }
  });

  // Forward errors to renderer
  const unsubscribeError = blePort.onError((error) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_ERROR, {
        code: error.code,
        message: error.message,
        recoverable: error.recoverable,
        suggestion: error.suggestion,
        timestamp: Date.now(),
      });
    }
  });

  // Forward device discoveries to renderer
  const unsubscribeDeviceDiscovered = blePort.onDeviceDiscovered((device) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_DEVICE_DISCOVERED, device);
    }
  });

  // Return cleanup function
  return () => {
    unsubscribeState();
    unsubscribeError();
    unsubscribeDeviceDiscovered();
  };
}
