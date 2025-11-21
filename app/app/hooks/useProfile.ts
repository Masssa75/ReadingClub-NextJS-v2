'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export interface Profile {
  id: string;
  name: string;
  user_id: string | null;
  created_at: string;
}

export function useProfile() {
  const [currentProfile, setCurrentProfile] = useState<string>('Default');
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [guestProfileId, setGuestProfileId] = useState<string | null>(null);
  const [profileNames, setProfileNames] = useState<string[]>(['Default']);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize profile on mount
  useEffect(() => {
    initializeProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeProfile = async () => {
    try {
      const savedProfileName = localStorage.getItem('currentProfile');

      if (savedProfileName && savedProfileName !== 'Default') {
        // Has a saved named profile - load it
        console.log('📝 Loading named profile:', savedProfileName);
        setCurrentProfile(savedProfileName);

        const profile = await getOrCreateProfile(savedProfileName);
        if (profile) {
          setCurrentProfileId(profile.id);
          console.log(`✅ Loaded profile: ${savedProfileName} (${profile.id.substring(0, 8)}...)`);
        }
      } else {
        // No named profile - use anonymous guest system
        console.log('📝 Guest mode - creating anonymous profile');

        // Check if we have a saved guest profile ID
        const savedGuestId = localStorage.getItem('guestProfileId');
        console.log('🔍 Checking localStorage for guestProfileId:', savedGuestId);

        if (savedGuestId) {
          // Try to load existing guest profile
          console.log('✓ Found saved guest profile, attempting to load:', savedGuestId);
          try {
            const { data: existingProfile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', savedGuestId)
              .is('user_id', null)
              .single();

            if (error) {
              console.error('❌ Error loading guest profile:', error);
              throw error;
            }

            if (existingProfile) {
              setCurrentProfileId(existingProfile.id);
              setGuestProfileId(existingProfile.id);
              console.log('✅ Loaded existing guest profile:', existingProfile.id);
            } else {
              console.log('⚠️ Profile not found, creating new');
              await createAnonymousProfile();
            }
          } catch (error) {
            console.error('⚠️ Failed to load guest profile, creating new:', error);
            await createAnonymousProfile();
          }
        } else {
          // No saved profile - create new anonymous profile
          console.log('🆕 No saved profile, creating new');
          await createAnonymousProfile();
        }
      }

      // Load profile names from localStorage
      loadProfileNames();
    } catch (error) {
      console.error('❌ Error initializing profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrCreateProfile = async (profileName: string): Promise<Profile | null> => {
    try {
      // Try to find existing profile by name (get the most recent one if multiple exist)
      const { data: existingProfiles, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('name', profileName)
        .is('user_id', null) // Only get anonymous profiles
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (existingProfiles && existingProfiles.length > 0) {
        console.log(`✅ Found existing profile: ${profileName} (${existingProfiles[0].id.substring(0, 8)}...)`);
        return existingProfiles[0];
      }

      // Create new profile if not found
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ name: profileName }])
        .select()
        .single();

      if (createError) throw createError;

      console.log(`✅ Created new profile: ${profileName} (${newProfile.id.substring(0, 8)}...)`);
      return newProfile;
    } catch (error) {
      console.error('❌ Error with profile:', error);
      return null;
    }
  };

  const createAnonymousProfile = async () => {
    try {
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([{
          name: `Guest_${Date.now()}`,
          user_id: null  // Explicitly anonymous
        }])
        .select()
        .single();

      if (error) throw error;

      setCurrentProfileId(newProfile.id);
      setGuestProfileId(newProfile.id);
      localStorage.setItem('guestProfileId', newProfile.id);
      console.log('✅ Created anonymous profile:', newProfile.id);
    } catch (error) {
      console.error('❌ Error creating anonymous profile:', error);
    }
  };

  const loadProfileNames = () => {
    const saved = localStorage.getItem('phonicsProfiles');
    const names = saved ? JSON.parse(saved) : ['Default'];
    setProfileNames(names);
    return names;
  };

  const saveProfileNames = (names: string[]) => {
    localStorage.setItem('phonicsProfiles', JSON.stringify(names));
    setProfileNames(names);
  };

  const switchProfile = async (profileName: string) => {
    setCurrentProfile(profileName);
    localStorage.setItem('currentProfile', profileName);

    // Clear guest profile ID since we're using a named profile
    localStorage.removeItem('guestProfileId');
    setGuestProfileId(null);

    // Get or create profile in Supabase by name
    const profile = await getOrCreateProfile(profileName);
    if (profile) {
      setCurrentProfileId(profile.id);
      console.log(`✅ Switched to profile: ${profileName} (${profile.id.substring(0, 8)}...)`);
    }

    // Trigger calibration reload (handled by parent component)
    return profile;
  };

  const createNewProfile = async (name: string): Promise<boolean> => {
    if (!name || name.trim() === '') return false;

    const trimmedName = name.trim();
    const names = loadProfileNames();

    if (names.includes(trimmedName)) {
      alert('Profile already exists!');
      return false;
    }

    names.push(trimmedName);
    saveProfileNames(names);
    setCurrentProfile(trimmedName);
    localStorage.setItem('currentProfile', trimmedName);

    // Clear guest profile ID
    localStorage.removeItem('guestProfileId');
    setGuestProfileId(null);

    // Create profile in Supabase
    const profile = await getOrCreateProfile(trimmedName);
    if (profile) {
      setCurrentProfileId(profile.id);
      console.log(`✅ Created new profile: ${trimmedName} (${profile.id.substring(0, 8)}...)`);
      return true;
    }

    return false;
  };

  return {
    currentProfile,
    currentProfileId,
    guestProfileId,
    profileNames,
    isLoading,
    switchProfile,
    createNewProfile,
    loadProfileNames
  };
}
