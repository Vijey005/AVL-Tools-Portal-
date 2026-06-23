from app.database import SessionLocal, engine, Base
from app.models import User
from app.auth import hash_password

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    try:
        # Check if users already exist
        admin = db.query(User).filter(User.email == "admin@avl.com").first()
        if not admin:
            admin_user = User(
                email="admin@avl.com",
                display_name="Admin User",
                hashed_password=hash_password("admin123"),
                is_admin=True
            )
            db.add(admin_user)
            
        emp1 = db.query(User).filter(User.email == "emp1@avl.com").first()
        if not emp1:
            emp1_user = User(
                email="emp1@avl.com",
                display_name="Employee One",
                hashed_password=hash_password("emp123"),
                is_admin=False
            )
            db.add(emp1_user)
            
        emp2 = db.query(User).filter(User.email == "emp2@avl.com").first()
        if not emp2:
            emp2_user = User(
                email="emp2@avl.com",
                display_name="Employee Two",
                hashed_password=hash_password("emp123"),
                is_admin=False
            )
            db.add(emp2_user)
            
        db.commit()
        print("Database seeded with admin and two employee users.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
