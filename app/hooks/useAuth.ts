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

        // Link guest profile to authenticated user
        if (session?.user) {
          await linkGuestProfile(session.user.id);
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

  const linkGuestProfile = async (userId: string): Promise<void> => {
    const guestProfileId = localStorage.getItem('guestProfileId');

    if (!guestProfileId) {
      console.log('No guest profile to link');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_id: userId })
        .eq('id', guestProfileId);

      if (error) throw error;

      console.log('✅ Guest profile linked to authenticated user');
      localStorage.removeItem('guestProfileId');
    } catch (error) {
      console.error('❌ Error linking guest profile:', error);
    }
  };

  return {
    user,
    loading,
    sendMagicLink,
    signOut,
  };
}
