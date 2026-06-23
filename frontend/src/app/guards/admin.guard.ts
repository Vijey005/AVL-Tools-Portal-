import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // We need to wait for the profile to be loaded to know if user is admin.
  // currentUser$ is a BehaviorSubject that holds the user profile.
  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (user && user.is_admin) {
        return true;
      }
      return router.parseUrl('/hub');
    })
  );
};
