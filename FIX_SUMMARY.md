# TheScale App - Measurement Persistence Fix

## Problem
Measurements were being captured by the BLE adapter but not persisting to disk after app restart.

## Root Cause
The measurement event flow was broken:
1. BLE adapter captures measurement ✓
2. Main process receives measurement event ✓
3. Main process forwards to renderer via IPC ✓
4. **Renderer should listen and call `captureMeasurement()` IPC handler** ✗ (NOT HAPPENING)
5. `MeasurementService.captureMeasurement()` never called = measurements never saved

## Solution
**Auto-save measurements in the main process** when BLE adapter emits them, bypassing the broken renderer flow.

### Changes Made

#### 1. `flake.nix` (New File)
- Reproducible build environment with all dependencies
- Proper wrapper script that sets XDG environment variables
- Can be used with `nix run` or `nix build`

#### 2. `src/main/ipc-handlers.ts` (Modified)
In the `setupNativeBLEEventForwarding()` function's `measurementHandler`:
- When BLE adapter emits a measurement, immediately call `measurementService.saveMeasurementAsGuest()`
- Save as guest measurement (can later be assigned to a profile via UI)
- Log successful/failed saves for debugging

## Testing on Surface

### Option 1: Using Flake (Recommended)
```bash
cd /path/to/thescaleapp
nix flake update
nix run
```

### Option 2: Build then run
```bash
cd /path/to/thescaleapp
nix build
./result/bin/thescale-app
```

### Testing Steps
1. Run the app
2. Configure your BLE device (if needed)
3. Step on scale to capture a measurement
4. Close the app
5. Reopen the app
6. Check if measurement history shows the saved measurement
7. Check file system: `~/.config/thescale-app/data/measurements/` should have measurement JSON files

## Expected Logs
When a measurement is captured, you should see:
```
[NativeBLE] Forwarding measurement to renderer: XX.X kg, HR: ...
[NativeBLE] [AUTO-SAVE] Saving measurement as guest...
[NativeBLE] [AUTO-SAVE] Measurement saved successfully
```

## Fallback
If renderer does pick up measurements and save them (via the original UI flow), that still works - auto-save is just a safety net.

## Future Improvements
- Could add UI to assign guest measurements to specific profiles
- Could add option to toggle auto-save behavior
- Could improve UX to show auto-saved vs manually assigned measurements differently
