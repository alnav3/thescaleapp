/**
 * MeasurementPanel Component
 *
 * Main panel for taking new measurements.
 * Handles BLE connection, real-time display, result saving,
 * and profile auto-detection for multi-profile support.
 *
 * @module presentation/components/measurement/MeasurementPanel
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { BLEStatus } from './BLEStatus';
import { MeasurementResult, LiveWeightDisplay } from './MeasurementResult';
import { ProfileSelectionDialog, ProfileOption } from './ProfileSelectionDialog';
import { useBLEStore, useIsConnected, useIsBusy, useIsDeviceConfigured } from '../../stores/bleStore';
import { useMeasurementStore } from '../../stores/measurementStore';
import { useProfileStore, useCurrentProfile } from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';
import { GUEST_PROFILE_ID } from '../history/GuestMeasurements';
import { useBLE } from '../../hooks/useBLE';
import type { RawMeasurement } from '../../../domain/calculations/types';
import { calculateAllMetrics } from '../../../domain/calculations';

/**
 * Panel state type
 */
type PanelState = 'idle' | 'connecting' | 'ready' | 'measuring' | 'result' | 'selecting-profile';

/**
 * Detection result interface for profile auto-detection
 */
interface DetectionResult {
  detectedProfileId: string | null;
  confidence: number;
  requiresConfirmation: boolean;
  candidates: Array<{ id: string; name: string; confidence: number }>;
}

/**
 * Calculate age from birth year and optional month
 */
const calculateAgeFromBirthYear = (birthYear: number, birthMonth?: number): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;
  if (birthMonth !== undefined && today.getMonth() + 1 < birthMonth) {
    age--;
  }
  return age;
};

/**
 * Instructions step component
 */
const InstructionStep: React.FC<{
  number: number;
  title: string;
  description: string;
  isActive?: boolean;
  isComplete?: boolean;
}> = ({ number, title, description, isActive = false, isComplete = false }) => (
  <div className={`flex gap-4 p-4 rounded-lg transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
      ${isComplete
        ? 'bg-green-500 text-white'
        : isActive
          ? 'bg-primary-500 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      }
    `}>
      {isComplete ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        number
      )}
    </div>
    <div>
      <h4 className={`font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
        {title}
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
    </div>
  </div>
);

/**
 * First-time connection prompt
 * Shows when no device has been configured - guides user to settings
 */
const FirstTimeConnectionPrompt: React.FC<{ onConfigure: () => void }> = ({ onConfigure }) => {
  const { t } = useTranslation('measurement');

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-blue-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('panel.firstTime.title')}
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {t('panel.firstTime.description')}
      </p>
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-w-md mx-auto">
        <p
          className="text-blue-700 dark:text-blue-300 text-sm"
          dangerouslySetInnerHTML={{ __html: t('panel.firstTime.instructions') }}
        />
      </div>
      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        onClick={onConfigure}
      >
        {t('panel.firstTime.goToSettings')}
      </Button>
    </div>
  );
};

/**
 * Saved device reconnect prompt
 * Shows when device was previously connected but is currently disconnected
 */
const SavedDeviceReconnectPrompt: React.FC<{
  onConnect: () => void;
  isConnecting: boolean;
}> = ({ onConnect, isConnecting }) => {
  const { t } = useTranslation('measurement');

  return (
    <div className="text-center py-12">
      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 ${
        isConnecting
          ? 'bg-yellow-100 dark:bg-yellow-900/30 animate-pulse'
          : 'bg-green-100 dark:bg-green-900/30'
      }`}>
        <svg
          className={`w-12 h-12 ${isConnecting ? 'text-yellow-500' : 'text-green-500'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {isConnecting ? t('panel.reconnect.connecting') : t('panel.reconnect.ready')}
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {isConnecting
          ? t('panel.reconnect.selectDevice')
          : t('panel.reconnect.configured')
        }
      </p>
      {!isConnecting && (
        <>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-w-md mx-auto">
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              <strong>{t('panel.reconnect.beforeClick')}</strong> {t('panel.reconnect.beforeClickHint')}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-6"
            onClick={onConnect}
          >
            {t('panel.reconnect.activateListening')}
          </Button>
        </>
      )}
      {isConnecting && (
        <div className="mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Profile not selected warning - now allows measurement as guest
 */
const NoProfilesAvailable: React.FC<{
  onContinueAsGuest: () => void;
  onCreateProfile: () => void;
}> = ({ onContinueAsGuest, onCreateProfile }) => {
  const { t } = useTranslation('measurement');

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-yellow-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('panel.noProfile.title')}
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {t('panel.noProfile.description')}
      </p>
      <div className="flex justify-center gap-4 mt-6">
        <Button
          variant="outline"
          size="lg"
          onClick={onContinueAsGuest}
        >
          {t('panel.noProfile.continueAsGuest')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onCreateProfile}
        >
          {t('panel.noProfile.createProfile')}
        </Button>
      </div>
    </div>
  );
};

/**
 * MeasurementPanel component
 */
export const MeasurementPanel: React.FC = () => {
  const { t } = useTranslation('measurement');
  const [panelState, setPanelState] = React.useState<PanelState>('idle');
  const [pendingMeasurement, setPendingMeasurement] = React.useState<{
    raw: RawMeasurement;
    calculated: any;
  } | null>(null);
  const [detectionResult, setDetectionResult] = React.useState<DetectionResult | null>(null);

  // Track last processed measurement to prevent duplicates
  const lastProcessedMeasurementRef = React.useRef<number | null>(null);

  // Store hooks
  const { connectionState, liveWeight, liveHeartRate, liveImpedance, isStable, setConnectionState, setLiveWeight, setIsStable, lastError, deviceMac } = useBLEStore();
  const isConnected = useIsConnected();
  const isBusy = useIsBusy();
  const isDeviceConfigured = useIsDeviceConfigured();
  const { currentMeasurement, setCurrentMeasurement, clearCurrentMeasurement, addMeasurement, setSaving, isSaving } = useMeasurementStore();
  const { profiles, showProfileSelector, setShowProfileSelector } = useProfileStore();
  const currentProfile = useCurrentProfile();
  const { addNotification, setActiveTab } = useAppStore();

  // Native BLE hook for measurement listening
  const ble = useBLE();

  // Derived state
  const hasMeasurementResult = currentMeasurement.raw !== null && currentMeasurement.calculated !== null;
  const hasProfiles = profiles.length > 0;

  // Get available profiles for selection
  const availableProfiles: ProfileOption[] = React.useMemo(
    () => profiles.map((p) => ({ id: p.id, name: p.name })),
    [profiles]
  );

  // Handle continue as guest when no profiles
  const handleContinueAsGuest = () => {
    // Allow measurement without profile
    setPanelState('idle');
  };

  // Handle create profile
  const handleCreateProfile = () => {
    setActiveTab('settings');
  };

  // Handle connect action - starts Native BLE scanning and listening
  // Defined before early returns that use it
  const handleConnect = async () => {
    setPanelState('connecting');
    setConnectionState('scanning');

    try {
      // Use Native BLE to connect
      // This starts scanning for the configured device
      const connected = await ble.connect();

      if (connected) {
        // Connection state is managed by the BLE service
        setPanelState('ready');
        addNotification({
          type: 'success',
          title: t('panel.listening.active'),
          message: `${t('panel.status.connected')} ${ble.deviceName || 'Mi Scale'}`,
          duration: 5000,
        });
      } else {
        // Connection failed - check if device is configured
        setConnectionState('disconnected');
        setPanelState('idle');

        if (!deviceMac) {
          addNotification({
            type: 'warning',
            title: t('panel.listening.noConfiguredScale'),
            message: t('panel.listening.goToSettings'),
            duration: 8000,
          });
        }
      }
    } catch (error) {
      console.error('[MeasurementPanel] Connection error:', error);
      setConnectionState('disconnected');
      setPanelState('idle');
      addNotification({
        type: 'error',
        title: t('panel.error.connection'),
        message: error instanceof Error ? error.message : t('panel.error.unknown'),
        duration: 5000,
      });
    }
  };

  // Auto-transition to ready state when device connects
  React.useEffect(() => {
    if (panelState === 'idle' && (connectionState === 'connected' || connectionState === 'reading')) {
      setPanelState('ready');
    }
  }, [panelState, connectionState]);

  // Check for device configuration and connection state
  // Show appropriate prompt based on state
  // IMPORTANT: If already connected, skip prompts and show measurement UI
  if (panelState === 'idle' || panelState === 'connecting') {
    // If device is connected/reading, skip all prompts - show measurement UI
    if (connectionState !== 'connected' && connectionState !== 'reading') {
      if (!isDeviceConfigured) {
        // First time - no device configured, guide to settings
        return <FirstTimeConnectionPrompt onConfigure={() => setActiveTab('settings')} />;
      } else {
        // Device saved but not connected - show reconnect prompt
        return (
          <SavedDeviceReconnectPrompt
            onConnect={handleConnect}
            isConnecting={panelState === 'connecting' || connectionState === 'scanning' || connectionState === 'connecting'}
          />
        );
      }
    }
  }

  // Handle start measurement - with auto-connect, measurements are captured automatically
  // This function now just prepares the UI for passive measurement capture
  const handleStartMeasurement = () => {
    setPanelState('measuring');
    setConnectionState('reading');
    setLiveWeight(0);
    setIsStable(false);

    console.log('[MeasurementPanel] Waiting for measurement... Step on the scale!');

    // The auto-connect hook handles the actual measurement capture via BLE notifications
    // When a measurement is received, it will:
    // 1. Update liveWeight and isStable in the store
    // 2. Call setCurrentMeasurement with raw and calculated metrics
    // 3. Show notification

    // No active waiting needed - the hook will capture the measurement automatically
  };

  // Effect to react to captured measurements (from Native BLE)
  React.useEffect(() => {
    // When Native BLE captures a measurement and we're in measuring mode (or ready state)
    if (ble.lastMeasurement && (panelState === 'measuring' || panelState === 'ready')) {
      // Check if we already processed this measurement (prevent duplicates)
      const measurementKey = ble.lastMeasurement.weightKg;
      if (lastProcessedMeasurementRef.current === measurementKey) {
        console.log('[MeasurementPanel] Skipping already processed measurement');
        return;
      }
      lastProcessedMeasurementRef.current = measurementKey;

      const rawMeasurement = ble.lastMeasurement;
      console.log('[MeasurementPanel] Processing measurement:', rawMeasurement);

      setLiveWeight(rawMeasurement.weightKg);
      setIsStable(true);

      // Calculate body composition metrics
      // currentProfile is StoredProfile which has birthYear, not age
      const profileForCalc = currentProfile
        ? {
            gender: currentProfile.gender,
            birthYear: currentProfile.birthYear,
            heightCm: currentProfile.heightCm,
            ethnicity: currentProfile.ethnicity,
          }
        : {
            gender: 'male' as const,
            birthYear: new Date().getFullYear() - 30, // Default to 30 years old
            heightCm: 175,
          };

      const calculatedMetrics = calculateAllMetrics(profileForCalc, rawMeasurement);

      // Handle profile detection (this shows the result screen)
      handleProfileDetection(rawMeasurement, calculatedMetrics);
    }
  }, [ble.lastMeasurement, panelState]);

  // Effect to update connection state from Native BLE
  React.useEffect(() => {
    if (ble.isConnected && panelState === 'connecting') {
      setPanelState('ready');
    }
  }, [ble.isConnected, panelState]);

  /**
   * Handle profile detection after measurement capture
   */
  const handleProfileDetection = (raw: RawMeasurement, calculated: any) => {
    setConnectionState('connected');

    // If no profiles exist, always save as guest
    if (!hasProfiles) {
      saveMeasurementToProfile(raw, calculated, GUEST_PROFILE_ID);
      return;
    }

    // If only one profile, use it directly
    if (profiles.length === 1) {
      saveMeasurementToProfile(raw, calculated, profiles[0].id);
      return;
    }

    // Multiple profiles - simulate detection (in real app, this would use weight matching)
    const detection = detectProfile(raw.weightKg);

    if (detection.requiresConfirmation) {
      // Ambiguous - show profile selection dialog
      setPendingMeasurement({ raw, calculated });
      setDetectionResult(detection);
      setPanelState('selecting-profile');
    } else if (detection.detectedProfileId) {
      // Confident detection - save directly
      saveMeasurementToProfile(raw, calculated, detection.detectedProfileId);
    } else {
      // No match - ask user
      setPendingMeasurement({ raw, calculated });
      setDetectionResult(detection);
      setPanelState('selecting-profile');
    }
  };

  /**
   * Detect profile based on weight (simplified implementation)
   * In a real app, this would use historical data and more sophisticated matching
   */
  const detectProfile = (weightKg: number): DetectionResult => {
    // For demonstration, simulate detection based on current profile or ambiguous
    const hasMultipleSimilarProfiles = profiles.length > 1;

    if (currentProfile && !hasMultipleSimilarProfiles) {
      return {
        detectedProfileId: currentProfile.id,
        confidence: 0.95,
        requiresConfirmation: false,
        candidates: [{ id: currentProfile.id, name: currentProfile.name, confidence: 0.95 }],
      };
    }

    // Simulate ambiguous detection
    return {
      detectedProfileId: null,
      confidence: 0.5,
      requiresConfirmation: true,
      candidates: profiles.map((p, index) => ({
        id: p.id,
        name: p.name,
        confidence: 0.5 - index * 0.1,
      })),
    };
  };

  /**
   * Save measurement to specified profile
   */
  const saveMeasurementToProfile = (raw: RawMeasurement, calculated: any, profileId: string) => {
    setCurrentMeasurement({
      raw,
      calculated,
      timestamp: new Date(),
      isSaved: false,
    });
    setPanelState('result');

    // Store the profile ID for saving
    (window as any).__pendingProfileId = profileId;
  };

  // Handle profile selection from dialog
  const handleProfileSelect = (profileId: string) => {
    if (pendingMeasurement) {
      saveMeasurementToProfile(
        pendingMeasurement.raw,
        pendingMeasurement.calculated,
        profileId
      );
      setPendingMeasurement(null);
      setDetectionResult(null);
    }
  };

  // Handle save as guest from dialog
  const handleSaveAsGuest = React.useCallback(() => {
    if (pendingMeasurement) {
      saveMeasurementToProfile(
        pendingMeasurement.raw,
        pendingMeasurement.calculated,
        GUEST_PROFILE_ID
      );
      setPendingMeasurement(null);
      setDetectionResult(null);

      addNotification({
        type: 'info',
        title: t('panel.guestSaved.title'),
        message: t('panel.guestSaved.message'),
        duration: 5000,
      });
    }
  }, [pendingMeasurement, t, addNotification]);

  // Handle cancel profile selection
  const handleCancelSelection = () => {
    setPendingMeasurement(null);
    setDetectionResult(null);
    setPanelState('ready');
  };

  // Handle save measurement
  const handleSave = React.useCallback(async () => {
    if (!currentMeasurement.raw || !currentMeasurement.calculated) return;

    setSaving(true);

    const profileId = (window as any).__pendingProfileId || currentProfile?.id || GUEST_PROFILE_ID;

    try {
      // Call the actual save method via IPC
      const result = await (window as any).electronAPI.saveMeasurementWithRaw(profileId, currentMeasurement.raw);
      
      if (result.success && result.data) {
        const measurement = {
          id: result.data.id,
          timestamp: result.data.timestamp instanceof Date 
            ? result.data.timestamp.toISOString() 
            : result.data.timestamp,
          raw: result.data.raw,
          calculated: result.data.calculated,
          userProfileId: result.data.userProfileId,
        };

        addMeasurement(measurement);
        setCurrentMeasurement({ isSaved: true });
        
        // Clean up
        delete (window as any).__pendingProfileId;

        const isGuestMeasurement = profileId === GUEST_PROFILE_ID;
        addNotification({
          type: 'success',
          title: t('panel.saved.title'),
          message: isGuestMeasurement
            ? t('panel.saved.guestMessage')
            : t('panel.status.savedToHistory'),
          duration: 3000,
        });
      } else {
        addNotification({
          type: 'error',
          title: t('panel.saved.error') || 'Error',
          message: result.error?.message || 'Failed to save measurement',
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Error saving measurement:', err);
      addNotification({
        type: 'error',
        title: t('panel.saved.error') || 'Error',
        message: (err instanceof Error ? err.message : 'Failed to save measurement'),
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, [currentMeasurement, currentProfile?.id, t, setSaving, addMeasurement, setCurrentMeasurement, addNotification]);

  // Handle discard measurement
  const handleDiscard = () => {
    clearCurrentMeasurement();
    delete (window as any).__pendingProfileId;
    setPanelState('ready');
  };

  // Handle new measurement
  const handleNewMeasurement = () => {
    clearCurrentMeasurement();
    delete (window as any).__pendingProfileId;
    setPanelState('ready');
  };

  // Handle retry on error
  const handleRetry = () => {
    setPanelState('idle');
    setConnectionState('disconnected');
  };

  // Get current step for instructions
  const getCurrentStep = (): number => {
    switch (panelState) {
      case 'idle': return 1;
      case 'connecting': return 1;
      case 'ready': return 2;
      case 'measuring': return 3;
      case 'selecting-profile': return 3;
      case 'result': return 4;
      default: return 1;
    }
  };

  // Get current profile display name
  const getProfileDisplayName = (): string => {
    if (!currentProfile) {
      return t('common.guest');
    }
    return currentProfile.name;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* BLE Status - hide when showing measurement result */}
      {panelState !== 'result' && (
        <BLEStatus
          showAction={panelState === 'idle'}
          onAction={handleConnect}
        />
      )}

      {/* Error state */}
      {connectionState === 'error' && lastError && (
        <ErrorMessage
          severity="error"
          title={lastError.message}
          message={lastError.suggestion}
          onRetry={handleRetry}
        />
      )}

      {/* Idle state - show instructions */}
      {panelState === 'idle' && connectionState !== 'error' && (
        <Card title={t('panel.instructions.title')} subtitle={t('panel.instructions.subtitle')}>
          <div className="space-y-2">
            <InstructionStep
              number={1}
              title={t('panel.instructions.step1.title')}
              description={t('panel.instructions.step1.description')}
              isActive={getCurrentStep() === 1}
            />
            <InstructionStep
              number={2}
              title={t('panel.instructions.step2.title')}
              description={t('panel.instructions.step2.description')}
              isActive={getCurrentStep() === 2}
            />
            <InstructionStep
              number={3}
              title={t('panel.instructions.step4.title')}
              description={t('panel.instructions.step4.description')}
              isActive={getCurrentStep() === 3}
            />
            <InstructionStep
              number={4}
              title={t('panel.instructions.step3.title')}
              description={t('panel.instructions.step3.description')}
              isActive={getCurrentStep() === 4}
            />
          </div>
        </Card>
      )}

      {/* Ready state - passive listening mode with live weight */}
      {panelState === 'ready' && (
        <Card>
          {/* Show live weight when receiving data from scale */}
          {(liveWeight ?? 0) > 0 ? (
            <LiveWeightDisplay weight={liveWeight} heartRate={liveHeartRate} impedance={liveImpedance} isStable={isStable} />
          ) : (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-pulse">
                <svg
                  className="w-12 h-12 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('panel.listening.active')}
              </h2>
            </div>
          )}
          <div className="text-center mt-4">
            <p className="text-gray-500 dark:text-gray-400">
              {t('panel.status.connected')} <span className="font-medium text-green-600">{ble.deviceName || 'Mi Scale'}</span>
            </p>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {t('panel.status.profile')} <span className="font-medium">{getProfileDisplayName()}</span>
              {profiles.length > 1 && (
                <span className="text-sm ml-2">{t('panel.status.autoDetection')}</span>
              )}
            </p>
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-700 dark:text-green-300 font-medium">
                {(liveWeight ?? 0) > 0 ? t('panel.status.stayOnScale') : t('panel.status.ready')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Measuring state - live weight */}
      {panelState === 'measuring' && (
        <Card>
          <LiveWeightDisplay weight={liveWeight} heartRate={liveHeartRate} impedance={liveImpedance} isStable={isStable} />
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('panel.status.stayOnScale')}
            </p>
          </div>
        </Card>
      )}

      {/* Result state */}
      {panelState === 'result' && hasMeasurementResult && (
        <MeasurementResult
          raw={currentMeasurement.raw!}
          calculated={currentMeasurement.calculated!}
          timestamp={currentMeasurement.timestamp || new Date()}
          isSaved={currentMeasurement.isSaved}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onNewMeasurement={handleNewMeasurement}
          isLoading={isSaving}
        />
      )}

      {/* Profile selection dialog for ambiguous detection */}
      <ProfileSelectionDialog
        isOpen={panelState === 'selecting-profile'}
        title={t('panel.ambiguous.selectProfile')}
        message={t('panel.ambiguous.message')}
        profiles={availableProfiles}
        onSelect={handleProfileSelect}
        onSaveAsGuest={handleSaveAsGuest}
        onCancel={handleCancelSelection}
      />
    </div>
  );
};

export default MeasurementPanel;
