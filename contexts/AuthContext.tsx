import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabaseService } from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const client = await supabaseService.getAuthClient();
      
      // Get initial session
      const { data: { session } } = await client.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      // Listen for auth changes
      const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Store session for offline access
        if (session) {
          await AsyncStorage.setItem('@secretary_auth_session', JSON.stringify(session));
        } else {
          await AsyncStorage.removeItem('@secretary_auth_session');
        }
      });

      // Check for stored session (offline support)
      if (!session) {
        const storedSession = await AsyncStorage.getItem('@secretary_auth_session');
        if (storedSession) {
          const parsedSession = JSON.parse(storedSession);
          // Verify session is still valid
          const { data: { session: refreshedSession } } = await client.auth.refreshSession({
            refresh_token: parsedSession.refresh_token
          });
          if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          }
        }
      }

      setLoading(false);

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Auth initialization error:', error);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const client = await supabaseService.getAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const client = await supabaseService.getAuthClient();
    const { error } = await client.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const client = await supabaseService.getAuthClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    await AsyncStorage.removeItem('@secretary_auth_session');
  };

  const resetPassword = async (email: string) => {
    const client = await supabaseService.getAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}