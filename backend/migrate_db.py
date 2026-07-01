import sqlite3

def migrate():
    print("Connecting to database...")
    conn = sqlite3.connect("avl_tools.db")
    cursor = conn.cursor()

    try:
        # Add is_approved column to users table
        print("Adding is_approved to users...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT 0;")
        # Note: In SQLite, boolean 0 means False.
    except sqlite3.OperationalError as e:
        print(f"Column might already exist: {e}")

    try:
        print("Creating file_shares table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS file_shares (
                file_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                PRIMARY KEY (file_id, user_id),
                FOREIGN KEY(file_id) REFERENCES files (id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)
    except sqlite3.OperationalError as e:
        print(f"Error creating file_shares: {e}")

    try:
        print("Creating password_reset_requests table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reset_token VARCHAR(128) UNIQUE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at DATETIME,
                used_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)
    except sqlite3.OperationalError as e:
        print(f"Error creating password_reset_requests: {e}")

    try:
        print("Creating password_change_requests table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_change_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                reason TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)
    except sqlite3.OperationalError as e:
        print(f"Error creating password_change_requests: {e}")

    try:
        print("Creating mock_emails table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mock_emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                to_email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
    except sqlite3.OperationalError as e:
        print(f"Error creating mock_emails: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
