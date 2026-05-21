/**
 * Shared Types
 *
 * Types shared between the main process and renderer process.
 * These types define the IPC communication contract.
 *
 * Note: Types are defined inline here to avoid CommonJS/ESM module resolution issues
 * when the shared module is used by both the main process (CommonJS) and
 * renderer process (ESM bundled by Vite).
 *
 * @module shared/types
 */

// ====== Domain Types (inline definitions for cross-process compatibility) ======

/**
 * User profile data required for body composition calculations
 * Uses birthYear for dynamic age calculation
 */
export interface UserProfile {
  gender: 'male' | 'female';
  /** Birth year for age calculation */
  birthYear: number;
  /** Optional birth month for more accurate age (1-12) */
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * Raw measurement data from the scale
 * S400 dual-frequency BIA provides two impedance values:
 * - impedanceOhm: high-frequency impedance (with weight)
 * - impedanceLowOhm: low-frequency impedance (body composition phase)
 */
export interface RawMeasurement {
  weightKg: number;
  impedanceOhm?: number;
  impedanceLowOhm?: number;
  heartRateBpm?: number;
}

/**
 * All calculated body composition metrics
 */
export interface CalculatedMetrics {
  bmi: number;
  bodyFatPercent: number;
  muscleMassKg: number;
  bodyWaterPercent: number;
  boneMassKg: number;
  visceralFatLevel: number;
  bmrKcal: number;
  leanBodyMassKg: number;
  proteinPercent: number;
  bodyScore: number;
}

/**
 * Complete measurement result with all data
 */
export interface MeasurementResult {
  id: string;
  timestamp: Date;
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  userProfileId: string;
}

/**
 * Query parameters for filtering measurements
 */
export interface MeasurementQuery {
  userProfileId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Extended user profile with persistence metadata
 */
export interface StoredUserProfile extends UserProfile {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ====== BLE Types ======

/**
 * Possible states of the BLE connection
 */
export type BLEConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'error';

/**
 * Error codes for BLE operations
 */
export type BLEErrorCode =
  | 'BLUETOOTH_OFF'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_TIMEOUT'
  | 'READ_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_DATA';

/**
 * Structured BLE error with recovery information
 */
export interface BLEError {
  code: BLEErrorCode;
  message: string;
  recoverable: boolean;
  suggestion: string;
}

/**
 * Device information returned during scanning
 */
export interface BLEDeviceInfo {
  mac: string;
  name: string;
  rssi: number;
}

/**
 * Native BLE device info (from @abandonware/noble)
 */
export interface NativeBLEDevice {
  id: string;
  name: string;
  rssi?: number;
}

/**
 * BLE scanning mode
 * - mibeacon: Passive scanning of MiBeacon advertisements (final measurements only)
 * - gatt: Active GATT connection for real-time weight updates
 */
export type BLEScanMode = 'mibeacon' | 'gatt';

/**
 * Native BLE status response
 */
export interface NativeBLEStatus {
  isConnected: boolean;
  isScanning: boolean;
  device: NativeBLEDevice | null;
  state: 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';
  scanMode: BLEScanMode;
}

/**
 * Native BLE measurement event
 * S400 dual-frequency BIA provides two impedance values
 */
export interface NativeBLEMeasurement {
  weightKg: number;
  impedanceOhm?: number;
  impedanceLowOhm?: number;
  heartRateBpm?: number;
  profileId?: number;
  timestamp: string;
  isStabilized?: boolean;
  isImpedanceMeasurement?: boolean;
  isHeartRateMeasurement?: boolean;
}

/**
 * Configuration for BLE adapter
 */
export interface BLEConfig {
  deviceMac: string;
  bleKey: string;
  scanTimeoutMs?: number;
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
}

// ====== Service Input/Output Types ======

/**
 * Input for creating a new profile
 */
export interface CreateProfileInput {
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * Input for updating an existing profile
 */
export interface UpdateProfileInput {
  name?: string;
  gender?: 'male' | 'female';
  birthYear?: number;
  birthMonth?: number;
  heightCm?: number;
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * Health recommendation from the report service
 * Matches the domain layer HealthRecommendation interface
 */
export interface HealthRecommendation {
  type: 'info' | 'warning' | 'critical';
  category: 'body_fat' | 'muscle' | 'visceral' | 'bmi' | 'hydration' | 'general';
  title: string;
  message: string;
  actions: string[];
  sources?: string[];
}

/**
 * Trends in health metrics over time
 */
export interface MetricTrends {
  weightChange: number;
  bodyFatChange: number;
  muscleChange: number;
  measurementCount: number;
  period: number;
}

/**
 * Summary of the health report
 */
export interface ReportSummary {
  overallStatus: 'improving' | 'stable' | 'declining';
  bodyScore: number;
  keyInsight: string;
}

/**
 * Complete health report
 */
export interface HealthReport {
  profileId: string;
  profileName: string;
  generatedAt: Date;
  latestMeasurement: MeasurementResult;
  trends: MetricTrends;
  recommendations: HealthRecommendation[];
  summary: ReportSummary;
}

// ====== Xiaomi Cloud Types ======

/**
 * Xiaomi cloud regions
 */
export type XiaomiRegion = 'cn' | 'de' | 'us' | 'ru' | 'tw' | 'sg' | 'in' | 'i2';

/**
 * QR code login session
 */
export interface QRLoginSession {
  sessionId: string;
  qrCodeUrl: string;
  loginUrl: string;
  expiresAt: number;
}

/**
 * QR login status
 */
export type QRLoginStatus =
  | 'pending'
  | 'scanned'
  | 'confirmed'
  | 'expired'
  | 'error';

/**
 * QR login poll result
 */
export interface QRLoginPollResult {
  status: QRLoginStatus;
  authToken?: string;
  error?: string;
}

/**
 * Xiaomi device info from cloud
 */
export interface XiaomiCloudDevice {
  did: string;
  name: string;
  model: string;
  mac: string;
  isBLE: boolean;
  parentId?: string;
}

/**
 * BLE key extraction result
 */
export interface BLEKeyResult {
  did: string;
  mac: string;
  beaconKey: string;
}

/**
 * Xiaomi auth state
 */
export interface XiaomiAuthState {
  isAuthenticated: boolean;
  region?: XiaomiRegion;
  userId?: string;
  expiresAt?: number;
}

// ====== IPC Types ======

/**
 * IPC Response wrapper for consistent error handling
 */
export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: IpcError;
}

/**
 * Standardized IPC error structure
 */
export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * BLE State change event payload
 */
export interface BLEStateChangeEvent {
  state: BLEConnectionState;
  timestamp: number;
}

/**
 * BLE Error event payload
 */
export interface BLEErrorEvent {
  code: BLEErrorCode;
  message: string;
  recoverable: boolean;
  suggestion: string;
  timestamp: number;
}

// ====== Backup Types ======

/**
 * Backup metadata
 */
export interface BackupMetadata {
  version: string;
  appName: string;
  createdAt: string;
  profileCount: number;
  measurementCount: number;
}

/**
 * Complete backup data structure
 */
export interface BackupData {
  metadata: BackupMetadata;
  profiles: unknown[];
  measurements: unknown[];
  config: ConfigExport;
}

/**
 * Backup validation result
 */
export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Restore options
 */
export interface RestoreOptions {
  mode: 'merge' | 'replace';
  skipConfig?: boolean;
}

/**
 * Backup info summary
 */
export interface BackupInfo {
  version: string;
  createdAt: string;
  profileCount: number;
  measurementCount: number;
  hasConfig: boolean;
}

// ====== Config Types ======

/**
 * BLE device configuration (stored in electron-store)
 */
export interface StoredBLEConfig {
  deviceMac: string | null;
  bleKey: string | null;
  autoConnect: boolean;
  scanTimeout: number;
}

/**
 * Application settings
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dataVersion: string;
}

/**
 * Config export format
 */
export interface ConfigExport {
  version: string;
  exportedAt: string;
  ble: StoredBLEConfig;
  settings: AppSettings;
}

/**
 * IPC Channel names - use these constants for type safety
 */
export const IpcChannels = {
  // Measurement channels
   MEASUREMENT_CAPTURE: 'measurement:capture',
   MEASUREMENT_SAVE_WITH_RAW: 'measurement:saveWithRaw',
   MEASUREMENT_GET_ALL: 'measurement:getAll',
   MEASUREMENT_GET_BY_ID: 'measurement:getById',
   MEASUREMENT_DELETE: 'measurement:delete',
   MEASUREMENT_DELETE_ALL: 'measurement:deleteAll',
   MEASUREMENT_COUNT: 'measurement:count',

  // Profile channels
  PROFILE_CREATE: 'profile:create',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_GET: 'profile:get',
  PROFILE_GET_ALL: 'profile:getAll',
  PROFILE_DELETE: 'profile:delete',
  PROFILE_SET_DEFAULT: 'profile:setDefault',
  PROFILE_GET_DEFAULT: 'profile:getDefault',

  // Report channels
  REPORT_GENERATE: 'report:generate',
  REPORT_QUICK_SUMMARY: 'report:quickSummary',

  // BLE channels
  BLE_SCAN: 'ble:scan',
  BLE_SCAN_FOR_DEVICES: 'ble:scanForDevices',
  BLE_STOP_SCAN: 'ble:stopScan',
  BLE_CONNECT: 'ble:connect',
  BLE_DISCONNECT: 'ble:disconnect',
  BLE_GET_STATE: 'ble:getState',
  BLE_IS_AVAILABLE: 'ble:isAvailable',

  // BLE Event channels (main -> renderer)
  BLE_STATE_CHANGE: 'ble:stateChange',
  BLE_ERROR: 'ble:error',
  BLE_DEVICE_DISCOVERED: 'ble:deviceDiscovered',

  // Native BLE channels (using @abandonware/noble)
  NATIVE_BLE_START_SCANNING: 'nativeBle:startScanning',
  NATIVE_BLE_STOP_SCANNING: 'nativeBle:stopScanning',
  NATIVE_BLE_DISCONNECT: 'nativeBle:disconnect',
  NATIVE_BLE_SET_DEVICE: 'nativeBle:setDevice',
  NATIVE_BLE_GET_STATUS: 'nativeBle:getStatus',
  NATIVE_BLE_SET_SCAN_MODE: 'nativeBle:setScanMode',
  NATIVE_BLE_GET_SCAN_MODE: 'nativeBle:getScanMode',

  // Native BLE Event channels (main -> renderer)
  NATIVE_BLE_MEASUREMENT: 'nativeBle:measurement',
  NATIVE_BLE_CONNECTED: 'nativeBle:connected',
  NATIVE_BLE_DISCONNECTED: 'nativeBle:disconnected',
  NATIVE_BLE_SCANNING: 'nativeBle:scanning',
  NATIVE_BLE_DISCOVERED: 'nativeBle:discovered',
  NATIVE_BLE_ERROR: 'nativeBle:error',
  NATIVE_BLE_READY: 'nativeBle:ready',
  NATIVE_BLE_UNAVAILABLE: 'nativeBle:unavailable',

  // Xiaomi Cloud channels
  XIAOMI_START_QR_LOGIN: 'xiaomi:startQRLogin',
  XIAOMI_POLL_LOGIN: 'xiaomi:pollLogin',
  XIAOMI_COMPLETE_LOGIN: 'xiaomi:completeLogin',
  XIAOMI_GET_DEVICES: 'xiaomi:getDevices',
  XIAOMI_GET_BLE_KEY: 'xiaomi:getBLEKey',
  XIAOMI_GET_AUTH_STATE: 'xiaomi:getAuthState',
  XIAOMI_LOGOUT: 'xiaomi:logout',

  // Backup channels
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_VALIDATE: 'backup:validate',
  BACKUP_GET_INFO: 'backup:getInfo',

  // Config channels
  CONFIG_GET_BLE: 'config:getBLE',
  CONFIG_SET_BLE: 'config:setBLE',
  CONFIG_GET_SETTINGS: 'config:getSettings',
  CONFIG_SET_SETTINGS: 'config:setSettings',
  CONFIG_EXPORT: 'config:export',
  CONFIG_IMPORT: 'config:import',
  CONFIG_RESET: 'config:reset',

  // Shell channels
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
} as const;

/**
 * Type for IPC channel names
 */
export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/**
 * Type-safe Electron API exposed to renderer
 */
export interface ElectronAPI {
  // Measurements
  captureMeasurement: (profileId: string) => Promise<IpcResponse<MeasurementResult>>;
  getMeasurements: (query: MeasurementQuery) => Promise<IpcResponse<MeasurementResult[]>>;
  getMeasurementById: (id: string) => Promise<IpcResponse<MeasurementResult | null>>;
  deleteMeasurement: (id: string) => Promise<IpcResponse<void>>;
  deleteAllMeasurements: (profileId: string) => Promise<IpcResponse<void>>;
  countMeasurements: (profileId: string) => Promise<IpcResponse<number>>;

  // Profiles
  createProfile: (data: CreateProfileInput) => Promise<IpcResponse<StoredUserProfile>>;
  updateProfile: (id: string, data: UpdateProfileInput) => Promise<IpcResponse<StoredUserProfile>>;
  getProfile: (id: string) => Promise<IpcResponse<StoredUserProfile | null>>;
  getAllProfiles: () => Promise<IpcResponse<StoredUserProfile[]>>;
  deleteProfile: (id: string) => Promise<IpcResponse<void>>;
  setDefaultProfile: (id: string) => Promise<IpcResponse<void>>;
  getDefaultProfile: () => Promise<IpcResponse<StoredUserProfile | null>>;

  // Reports
  generateReport: (profileId: string) => Promise<IpcResponse<HealthReport>>;
  getQuickSummary: (profileId: string) => Promise<IpcResponse<{ bodyScore: number; status: string } | null>>;

  // BLE
  scanForDevice: () => Promise<IpcResponse<void>>;
  scanForDevices: (timeoutMs?: number) => Promise<IpcResponse<BLEDeviceInfo[]>>;
  stopScan: () => Promise<IpcResponse<void>>;
  connectDevice: (mac: string, key: string) => Promise<IpcResponse<void>>;
  disconnectDevice: () => Promise<IpcResponse<void>>;
  getBLEState: () => Promise<IpcResponse<BLEConnectionState>>;
  isDeviceAvailable: () => Promise<IpcResponse<boolean>>;

  // BLE Events
  onBLEStateChange: (callback: (event: BLEStateChangeEvent) => void) => () => void;
  onBLEError: (callback: (event: BLEErrorEvent) => void) => () => void;
  onBLEDeviceDiscovered: (callback: (device: BLEDeviceInfo) => void) => () => void;

  // Native BLE (using bleak Python adapter)
  nativeBLE: {
    startScanning: () => Promise<IpcResponse<void>>;
    stopScanning: () => Promise<IpcResponse<void>>;
    disconnect: () => Promise<IpcResponse<void>>;
    setDevice: (mac: string) => Promise<IpcResponse<void>>;
    getStatus: () => Promise<IpcResponse<NativeBLEStatus>>;
    /** Set scan mode: 'mibeacon' for passive ads, 'gatt' for real-time connection */
    setScanMode: (mode: BLEScanMode) => Promise<IpcResponse<void>>;
    getScanMode: () => Promise<IpcResponse<BLEScanMode>>;
    // Event subscriptions (return unsubscribe function)
    onMeasurement: (callback: (measurement: NativeBLEMeasurement) => void) => () => void;
    onConnected: (callback: (device: NativeBLEDevice) => void) => () => void;
    onDisconnected: (callback: () => void) => () => void;
    onScanning: (callback: () => void) => () => void;
    onDiscovered: (callback: (device: NativeBLEDevice) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
    onReady: (callback: () => void) => () => void;
    onUnavailable: (callback: (state: string) => void) => () => void;
  };

  // Xiaomi Cloud
  startXiaomiQRLogin: () => Promise<IpcResponse<QRLoginSession>>;
  pollXiaomiLogin: (sessionId: string) => Promise<IpcResponse<QRLoginPollResult>>;
  completeXiaomiLogin: (authToken: string, region: XiaomiRegion) => Promise<IpcResponse<void>>;
  getXiaomiDevices: () => Promise<IpcResponse<XiaomiCloudDevice[]>>;
  getXiaomiBLEKey: (deviceId: string) => Promise<IpcResponse<BLEKeyResult>>;
  getXiaomiAuthState: () => Promise<IpcResponse<XiaomiAuthState>>;
  xiaomiLogout: () => Promise<IpcResponse<void>>;

  // Backup
  createBackup: () => Promise<IpcResponse<BackupData>>;
  restoreBackup: (backup: BackupData, options?: RestoreOptions) => Promise<IpcResponse<void>>;
  validateBackup: (backup: unknown) => Promise<IpcResponse<BackupValidationResult>>;
  getBackupInfo: (backup: BackupData) => Promise<IpcResponse<BackupInfo>>;

  // Config
  getBLEConfig: () => Promise<IpcResponse<StoredBLEConfig>>;
  setBLEConfig: (config: StoredBLEConfig) => Promise<IpcResponse<void>>;
  getAppSettings: () => Promise<IpcResponse<AppSettings>>;
  setAppSettings: (settings: AppSettings) => Promise<IpcResponse<void>>;
  exportConfig: () => Promise<IpcResponse<ConfigExport>>;
  importConfig: (config: ConfigExport) => Promise<IpcResponse<void>>;
  resetConfig: () => Promise<IpcResponse<void>>;

  // Shell
  openExternalUrl: (url: string) => Promise<IpcResponse<void>>;
}

/**
 * Augment the Window interface to include electronAPI
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
