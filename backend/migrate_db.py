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

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
