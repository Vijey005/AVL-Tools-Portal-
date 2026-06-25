# AVL Unified Tools Portal - Project Structure and Workflow

This document outlines the architecture, framework, database schema, structure, and workflow of the AVL Unified Tools Portal. It serves as a reference for future development, onboarding, and scaling of the application.

## 1. Overview and Frameworks
The AVL Unified Tools Portal is a full-stack web application designed to host multiple internal tools (LMM Planner, Organigram Creator, and Weekly Dashboard) under a single, unified interface.

### **Tech Stack:**
- **Frontend Framework:** Angular 18 (TypeScript)
- **Backend Framework:** FastAPI (Python)
- **Database:** SQLite (using SQLAlchemy ORM)
- **Authentication:** JWT (JSON Web Tokens)

---

## 2. Application Architecture

### **Data Storage Approach (JSON Payloads):**
To support multiple disjointed tools without constantly altering the database schema, the backend treats tool data agnostically. Each user document is stored in a `File` table containing a `json_payload` text field.
When a tool (e.g., LMM Planner) is opened, the frontend parses this JSON string to populate the UI. Upon saving, the frontend serializes its state back into JSON and sends it to the backend.

### **Database Schema:**
The SQLite database (`avl_tools.db`) consists of two main tables defined in [models.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/models.py):

#### 1. `users` Table
Stores user account details and privileges.
- `id` (Integer, Primary Key, Index): Unique user identifier.
- `email` (String(255), Unique, Index, Not Null): User's registration and login email address.
- `display_name` (String(255), Not Null): The name shown in the UI.
- `hashed_password` (String(255), Not Null): Password hash generated using passlib (bcrypt).
- `is_admin` (Boolean, Default `False`, Not Null): Flag indicating if the user has administrative privileges.
- `is_active` (Boolean, Default `True`, Not Null): Flag indicating if the account is active or disabled.
- `created_at` (DateTime, Not Null): Timestamp of account creation (UTC).

#### 2. `files` Table
Stores the payload and metadata for the individual files created within the portal.
- `id` (Integer, Primary Key, Index): Unique file identifier.
- `owner_id` (Integer, ForeignKey `users.id` with `CASCADE` delete, Not Null, Index): ID of the user who owns this file copy.
- `shared_by_user_id` (Integer, ForeignKey `users.id` with `SET NULL` on delete, Nullable, Index): ID of the user who shared/cloned this file to the owner (supporting the sharing/cloning feature).
- `tool_type` (String(20), Not Null, Index): Identifies the tool (`lmm`, `organigram`, or `dashboard`).
- `name` (String(255), Not Null): The display name of the file.
- `json_payload` (Text, Not Null, Default `"{}"`): The serialized state of the tool workspace.
- `created_at` (DateTime, Not Null): Timestamp of file creation (UTC).
- `updated_at` (DateTime, Not Null, automatic on update): Timestamp of the last save (UTC).

---

## 3. Directory Structure

### **Backend (`/backend`)**
The backend is structured using FastAPI best practices.
- [main.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/main.py): Entry point of the FastAPI application. Sets up CORS, configures the database lifecycle, and registers API routers.
- [database.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/database.py): Configures SQLAlchemy engine, session maker ([SessionLocal](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/database.py)), and base ORM classes.
- [models.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/models.py): Defines the SQLAlchemy tables ([User](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/models.py#L18) and [File](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/models.py#L36)).
- [auth.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/auth.py): Implements security logic (password hashing/verification, JWT token creation, and FastAPI dependency overrides like [get_current_user](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/auth.py#L55)).
- [config.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/config.py): Configures settings such as JWT secret keys, token expiration (24 hours), database URLs, and the list of initial users ([SEED_USERS](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/config.py#L20)).
- [schemas.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/schemas.py): Defines Pydantic models for request validation and API serialization (e.g., [FileCreate](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/schemas.py#L55), [FileOut](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/schemas.py#L66), [ShareRequest](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/schemas.py#L94)).
- [seed.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/seed.py) (in `app/`): Handles initial database seeding of the standard admin and default employees upon application startup.
- [seed.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/seed.py) (root backend folder): Standalone Python script for manually creating tables and seeding the database.
- [test_api.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/test_api.py): Integration test suite verifying authentication, files CRUD, and sharing functionality. Runs 11 test cases.
- **Routers Directory (`app/routers/`):**
  - [users.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/routers/users.py): Endpoints for registering accounts (`POST /api/users/register`), logging in (`POST /api/users/login`), and fetching active user profile (`GET /api/users/me`).
  - [files.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/routers/files.py): Core endpoints for managing user workspaces: listing, creating, reading, updating, and deleting files, as well as the sharing endpoint (`POST /api/files/{file_id}/share`).
  - [admin.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/routers/admin.py): Administrative endpoints for listing registered users (`GET /api/admin/users`), updating user active/admin status (`PUT /api/admin/users/{user_id}`), and deleting users (`DELETE /api/admin/users/{user_id}`).

### **Frontend (`/frontend`)**
The frontend is structured as a standard Angular 18 standalone application.
- [app.routes.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/app.routes.ts): Binds page paths to their standalone component files and registers route authentication and administration guards.
- **Pages Directory (`src/app/pages/`):**
  - `login/`: Screen for credential input and form validations.
  - `hub/`: Main user cockpit. Lists files sorted into separate tabs: **My Projects** and **Shared with Me**. Contains options for creating new files and opening tool routes.
  - `admin/`: Screen for administrators to view, modify, or delete user accounts.
  - `lmm-planner/`, `organigram/`, `weekly-dashboard/`: Interactive standalone tool interfaces parsing and serializing JSON payloads.
- **Shared Components (`src/app/shared/`):**
  - `navbar/`: Sticky global top menu for navigating to the Hub, Admin Panel (visible to admins), and logging out.
  - `share-modal/`: Reusable overlay modal verifying target email addresses and calling the share endpoint.
- **Services (`src/app/services/`):**
  - [api.service.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/api.service.ts): Client wrapper mapping HTTP requests to backend API routers (e.g. [getFiles](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/api.service.ts#L14), [shareFile](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/api.service.ts#L38)).
  - [auth.service.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/auth.service.ts): Manages JWT login state, handles token lookup and persistence in `localStorage` under key `avl_token`, and fetches user metadata.
- **Guards (`src/app/guards/`):**
  - [auth.guard.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/guards/auth.guard.ts): Restricts access to authenticated users by checking for tokens.
  - [admin.guard.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/guards/admin.guard.ts): Prevents access to the admin cockpit for users without the `is_admin` role.
- **Interceptors (`src/app/interceptors/`):**
  - [auth.interceptor.ts](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/interceptors/auth.interceptor.ts): Intercepts HTTP requests and attaches the `Authorization: Bearer <token>` header if a token exists in local storage.

---

## 4. Typical User Workflow

1. **Authentication:**
   - The user inputs credentials at `/login`.
   - The frontend calls `POST /api/users/login` using [AuthService](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/auth.service.ts).
   - The backend validates details against the database, generating a JWT token on success.
   - The frontend intercepts the response, stores the token in `localStorage` under the key `'avl_token'`, loads the user's profile, and redirects them to the Hub dashboard `/hub`.

2. **Hub and File Cockpit:**
   - On navigating to the Hub (`/hub`), the frontend queries `GET /api/files` via the [ApiService](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/frontend/src/app/services/api.service.ts).
   - The database returns all file lists belonging to the current user (either created by them or shared to them).
   - The frontend parses the `shared_by_user_id` attribute on each file record to segregate them:
     - **My Projects**: Files where `shared_by_user_id` is empty.
     - **Shared with Me**: Files where `shared_by_user_id` is set to the user ID of another developer.
   - The user can filter these lists using a tool selector button (e.g. LMM, Organigram, or Dashboard).

3. **Workspace Operations:**
   - **Creation**: The user clicks "Create File" and selects the tool type. The frontend calls `POST /api/files` passing basic details.
   - **Opening**: The user clicks the workspace card, and the router navigates to `/tools/{tool_name}/{fileId}`. The tool initializes and performs a `GET /api/files/{fileId}` request. It parses the JSON payload string into local component states.
   - **Saving**: Clicking "Save" serializes the component state structure into a string and triggers a `PUT /api/files/{fileId}` request, updating the database record.

4. **Cloning & Sharing:**
   - The owner of a project clicks the "Share" action.
   - The reusable share modal displays, requesting the target user's email.
   - On submission, the frontend fires `POST /api/files/{file_id}/share` passing the email parameter.
   - The backend:
     - Confirms that the caller owns the file.
     - Assures the recipient is registered and active in the database.
     - Creates a duplicate `File` record setting the recipient as `owner_id`, prefixing the filename with ` (Shared)`, and linking the sender in `shared_by_user_id`.
   - The cloned file displays immediately in the recipient's "Shared with Me" tab.

---

## 5. Technical Aspects & Code Roles

- **FastAPI Dependency Injection:** The backend utilizes FastAPI's `Depends()` for database sessions and authentication checks. For example, [get_current_user](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/auth.py#L55) is injected into protected endpoints to automatically validate the JWT and return the user model.
- **Angular Standalone Components:** The frontend uses Angular 18's standalone component architecture, negating the need for large module declarations (`NgModule`). Components import what they need directly (e.g., standard Angular modules, shared services).
- **State Management (Frontend):** State is managed at the component level. Tool components fetch their payload on `ngOnInit`, manage state locally during edits, and serialize it back on save.
- **CORS Handling:** The backend's [main.py](file:///c:/Users/Vijey/Documents/AVL%20Projects/AVL%20tools/backend/app/main.py) configures `CORSMiddleware` to allow the Angular frontend (running on a separate port during development, e.g., `localhost:4200`) to successfully make API requests without browser security blocks.
