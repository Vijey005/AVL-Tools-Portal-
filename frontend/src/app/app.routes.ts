import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HubComponent } from './pages/hub/hub.component';
import { AdminComponent } from './pages/admin/admin.component';
import { LmmPlannerComponent } from './pages/lmm-planner/lmm-planner.component';
import { OrganigramComponent } from './pages/organigram/organigram.component';
import { WeeklyDashboardComponent } from './pages/weekly-dashboard/weekly-dashboard.component';
import { AnalyticsComponent } from './pages/analytics/analytics.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
 { path: 'login', component: LoginComponent },
 { path: 'hub', component: HubComponent, canActivate: [authGuard] },
 { path: 'analytics', component: AnalyticsComponent, canActivate: [authGuard] },
 { path: 'admin', component: AdminComponent, canActivate: [authGuard, adminGuard] },
 { path: 'tools/lmm/:fileId', component: LmmPlannerComponent, canActivate: [authGuard] },
 { path: 'tools/organigram/:fileId', component: OrganigramComponent, canActivate: [authGuard] },
 { path: 'tools/dashboard/:fileId', component: WeeklyDashboardComponent, canActivate: [authGuard] },
 { path: '', redirectTo: '/hub', pathMatch: 'full' },
 { path: '**', redirectTo: '/hub' }
];
