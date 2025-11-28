'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(session?.user ?? null);

        // Link guest profile OR load existing profiles for authenticated user
        if (session?.user) {
          await linkOrLoadProfile(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    try {
      // Use production URL if on wunderkind.world, otherwise use current origin
      const isProduction = typeof window !== 'undefined' &&
        (window.location.hostname === 'wunderkind.world' ||
         window.location.hostname === 'www.wunderkind.world');
      const redirectUrl = isProduction ? 'https://wunderkind.world' : window.location.origin;

      console.log('🔗 Magic link redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('❌ Magic link error:', error);
      return { success: false, error: 'Failed to send magic link. Please try again.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      // Optionally reload to reset to guest mode
      window.location.reload();
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  const linkOrLoadProfile = async (userId: string): Promise<void> => {
    try {
      // First, check if user already has profiles in Supabase
      const { data: existingProfiles, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (existingProfiles && existingProfiles.length > 0) {
        // User has existing profiles! Load the most recent one
        const profile = existingProfiles[0];
        console.log('✅ Found existing profile for user:', profile.name, profile.id);

        // Check if we're already using this profile (prevent infinite reload)
        const currentProfile = localStorage.getItem('currentProfile');
        if (currentProfile === profile.name) {
          console.log('✅ Already using authenticated profile, no reload needed');
          return;
        }

        // Update localStorage to use this profile
        localStorage.setItem('currentProfile', profile.name);
        localStorage.removeItem('guestProfileId'); // Clear guest profile

        // Add profile name to the list if not already there
        const savedProfiles = localStorage.getItem('phonicsProfiles');
        const profileNames: string[] = savedProfiles ? JSON.parse(savedProfiles) : ['Default'];
        if (!profileNames.includes(profile.name)) {
          profileNames.push(profile.name);
          localStorage.setItem('phonicsProfiles', JSON.stringify(profileNames));
        }

        console.log('🔄 Reloading to use authenticated profile...');
        window.location.reload();
        return;
      }

      // No existing profiles - link current guest profile to user
      const guestProfileId = localStorage.getItem('guestProfileId');
      if (!guestProfileId) {
        console.log('No guest profile to link and no existing profiles');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ user_id: userId })
        .eq('id', guestProfileId);

      if (updateError) throw updateError;

      console.log('✅ Guest profile linked to authenticated user');
      // Keep the guestProfileId for now since it's now linked
    } catch (error) {
      console.error('❌ Error in linkOrLoadProfile:', error);
    }
  };

  return {
    user,
    loading,
    sendMagicLink,
    signOut,
  };
}
