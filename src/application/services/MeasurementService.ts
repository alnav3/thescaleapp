/**
 * MeasurementService
 *
 * Orchestrates the measurement capture flow: BLE reading, calculations, and storage.
 * Supports both profile-assigned and guest measurements for multi-profile scenarios.
 *
 * @module application/services/MeasurementService
 */

import crypto from 'crypto';
import type { BLEPort } from '../ports/BLEPort';
import type {
  MeasurementRepository,
  MeasurementResult,
  MeasurementQuery,
} from '../ports/MeasurementRepository';
import { GUEST_PROFILE_ID } from '../ports/MeasurementRepository';
import type { ProfileRepository } from '../ports/ProfileRepository';
import { calculateAgeFromBirthYear } from '../ports/ProfileRepository';
import { calculateAllMetrics } from '../../domain/calculations';
import type { RawMeasurement } from '../../domain/calculations/types';
import {
  ProfileNotFoundError,
  MeasurementReadError,
  MeasurementNotFoundError,
} from '../../domain/errors';

// Re-export errors for backward compatibility
export { ProfileNotFoundError, MeasurementReadError, MeasurementNotFoundError };

/**
 * Service for managing body composition measurements
 */
export class MeasurementService {
  constructor(
    private readonly blePort: BLEPort,
    private readonly measurementRepository: MeasurementRepository,
    private readonly profileRepository: ProfileRepository
  ) {}

  /**
   * Capture a new measurement from the scale
   *
   * @param profileId - The user profile ID to associate with the measurement
   * @returns The complete measurement result with calculated metrics
   * @throws ProfileNotFoundError if profile doesn't exist
   * @throws MeasurementReadError if BLE reading fails
   */
  async captureMeasurement(profileId: string): Promise<MeasurementResult> {
    // 1. Get user profile
    const profile = await this.profileRepository.getById(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }

    // 2. Read raw measurement from scale
    let rawMeasurement: RawMeasurement;
    try {
      rawMeasurement = await this.blePort.readMeasurement();
    } catch (error) {
      throw new MeasurementReadError(
        'Failed to read measurement from scale',
        error instanceof Error ? error : undefined
      );
    }

    // 3. Calculate age from birth year (and month if available)
    const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);

    // 4. Calculate all metrics
    const calculatedMetrics = calculateAllMetrics(
      {
        gender: profile.gender,
        age,
        heightCm: profile.heightCm,
        ethnicity: profile.ethnicity,
      },
      rawMeasurement
    );

    // 5. Create measurement result
    const measurementResult: MeasurementResult = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      raw: rawMeasurement,
      calculated: calculatedMetrics,
      userProfileId: profileId,
    };

    // 6. Save to repository
    await this.measurementRepository.save(measurementResult);

    return measurementResult;
  }

  /**
   * Save a raw measurement directly to a profile with calculated metrics
   *
   * Used when the raw measurement data is already captured from BLE.
   * This skips the BLE reading step and directly calculates metrics using the profile's data.
   *
   * @param profileId - The user profile ID to associate with the measurement
   * @param raw - The raw measurement data already captured from the scale
   * @returns The measurement result with calculated metrics
   * @throws ProfileNotFoundError if profile doesn't exist
   */
  async saveMeasurementWithProfile(profileId: string, raw: RawMeasurement): Promise<MeasurementResult> {
    // 1. Get user profile
    const profile = await this.profileRepository.getById(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }

    // 2. Calculate age from birth year (and month if available)
    const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);

    // 3. Calculate all metrics
    const calculatedMetrics = calculateAllMetrics(
      {
        gender: profile.gender,
        age,
        heightCm: profile.heightCm,
        ethnicity: profile.ethnicity,
      },
      raw
    );

    // 4. Create measurement result
    const measurementResult: MeasurementResult = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      raw,
      calculated: calculatedMetrics,
      userProfileId: profileId,
    };

    // 5. Save to repository
    await this.measurementRepository.save(measurementResult);

    return measurementResult;
  }

  /**
   * Save a measurement as guest (unassigned)
   *
   * Used when profile cannot be determined automatically.
   * Guest measurements can later be assigned to a specific profile.
   *
   * @param raw - The raw measurement data
   * @returns The measurement result (with basic metrics only, no profile-specific calculations)
   */
  async saveMeasurementAsGuest(raw: RawMeasurement): Promise<MeasurementResult> {
    // Calculate basic metrics using default profile values
    // These will be recalculated when assigned to a real profile
    const defaultMetrics = calculateAllMetrics(
      {
        gender: 'male', // Default for basic calculation
        age: 30, // Default for basic calculation
        heightCm: 170, // Default for basic calculation
      },
      raw
    );

    const measurementResult: MeasurementResult = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      raw,
      calculated: defaultMetrics,
      userProfileId: GUEST_PROFILE_ID,
    };

    await this.measurementRepository.save(measurementResult);

    return measurementResult;
  }

  /**
   * Assign a guest measurement to a specific profile
   *
   * Recalculates metrics using the target profile's data
   * and updates the measurement's profile assignment.
   *
   * @param measurementId - The ID of the guest measurement to assign
   * @param profileId - The profile ID to assign the measurement to
   * @returns The updated measurement result with recalculated metrics
   * @throws MeasurementNotFoundError if measurement doesn't exist
   * @throws ProfileNotFoundError if profile doesn't exist
   */
  async assignGuestMeasurement(
    measurementId: string,
    profileId: string
  ): Promise<MeasurementResult> {
    // 1. Get the measurement
    const measurement = await this.measurementRepository.getById(measurementId);
    if (!measurement) {
      throw new MeasurementNotFoundError(measurementId);
    }

    // 2. Get the target profile
    const profile = await this.profileRepository.getById(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }

    // 3. Calculate age from birth year (and month if available)
    const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);

    // 4. Recalculate metrics with the target profile's data
    const recalculatedMetrics = calculateAllMetrics(
      {
        gender: profile.gender,
        age,
        heightCm: profile.heightCm,
        ethnicity: profile.ethnicity,
      },
      measurement.raw
    );

    // 5. Create updated measurement
    const updatedMeasurement: MeasurementResult = {
      ...measurement,
      calculated: recalculatedMetrics,
      userProfileId: profileId,
    };

    // 6. Save updated measurement
    await this.measurementRepository.save(updatedMeasurement);

    return updatedMeasurement;
  }

  /**
   * Get all guest (unassigned) measurements
   *
   * @returns Array of measurements with GUEST_PROFILE_ID
   */
  async getGuestMeasurements(): Promise<MeasurementResult[]> {
    return this.measurementRepository.getAll({
      userProfileId: GUEST_PROFILE_ID,
    });
  }

  /**
   * Get measurement history with filtering and pagination
   */
  async getMeasurementHistory(
    query: MeasurementQuery
  ): Promise<MeasurementResult[]> {
    return this.measurementRepository.getAll(query);
  }

  /**
   * Get the latest measurement for a profile
   */
  async getLatestMeasurement(
    profileId: string
  ): Promise<MeasurementResult | null> {
    const measurements = await this.measurementRepository.getAll({
      userProfileId: profileId,
      limit: 1,
    });
    return measurements[0] ?? null;
  }

  /**
   * Get a specific measurement by ID
   */
  async getMeasurement(id: string): Promise<MeasurementResult | null> {
    return this.measurementRepository.getById(id);
  }

  /**
   * Delete a measurement
   */
  async deleteMeasurement(id: string): Promise<void> {
    await this.measurementRepository.delete(id);
  }

  /**
   * Delete all measurements for a profile
   */
  async deleteAllMeasurements(profileId: string): Promise<void> {
    await this.measurementRepository.deleteAll(profileId);
  }

  /**
   * Count measurements for a profile
   */
  async countMeasurements(profileId: string): Promise<number> {
    return this.measurementRepository.count({ userProfileId: profileId });
  }
}

// Re-export for convenience
export { GUEST_PROFILE_ID };
