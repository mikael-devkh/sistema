import { useEffect, useState } from "react";
import { onAuthStateChanged, type Auth, type User } from "firebase/auth";

export const useAuthState = (
  auth: Auth,
): [User | null | undefined, boolean, Error | undefined] => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setUser(null);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [auth]);

  return [user, loading, error];
};
