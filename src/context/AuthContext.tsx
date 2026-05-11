import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signIn, signOut } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signInInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    if (signInInFlightRef.current) {
      return signInInFlightRef.current;
    }

    signInInFlightRef.current = (async () => {
      try {
        await signIn();
      } catch (error) {
        console.error("Login failed:", error);
        throw error;
      } finally {
        signInInFlightRef.current = null;
      }
    })();

    return signInInFlightRef.current;
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  }, []);

  const contextValue = useMemo(() => ({
    user,
    loading,
    signIn: handleSignIn,
    signOut: handleSignOut
  }), [user, loading, handleSignIn, handleSignOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
