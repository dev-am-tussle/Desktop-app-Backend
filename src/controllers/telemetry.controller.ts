import { User, UserTelemetry } from '../models';

/**
 * Sync Telemetry Data
 * Intelligently saves the raw Electron payload into a separate collection
 * for Admin Portal tracking.
 */
export const syncUserTelemetry = async (userId: string, payload: any) => {
  // 1. Validation: Ensure payload and timestamp exist
  if (!payload || typeof payload.global_ts === 'undefined') {
    return null;
  }

  try {
    // 2. Fetch User to ensure it exists
    const user = await User.findById(userId);
    if (!user) return null;

    // 3. Upsert Strategy: Update if global_ts matches, otherwise create
    const telemetry = await UserTelemetry.findOneAndUpdate(
      { 
        user_id: userId, 
        global_ts: payload.global_ts 
      },
      { 
        $set: { payload: payload } 
      },
      { 
        new: true, 
        upsert: true // Creates if doesn't exist, updates if it does
      }
    );

    // 4. Update User's Sync Metadata and legacy onboarding state
    const updateData: any = {
      last_telemetry_sync: new Date()
    };

    const hasCompletedOnboarding = payload.tracks?.some(
      (t: any) => t.phase === 'onboarding_completed' && t.status === 'success'
    );

    if (hasCompletedOnboarding && user.onboardingPhase !== 'completed') {
      updateData.onboardingPhase = 'completed';
      updateData['phaseCompletedAt.completed'] = new Date();
    }

    await User.findByIdAndUpdate(userId, { $set: updateData });

    return telemetry;
  } catch (error) {
    console.error('❌ Tracking Error (syncUserTelemetry):', error);
    return null;
  }
};

