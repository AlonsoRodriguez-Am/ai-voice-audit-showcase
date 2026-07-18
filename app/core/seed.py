import json
import bcrypt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User
from app.models.lob import LOB
from app.models.tenant import Tenant

def seed_db(db: Session):
    print("[SEED] Starting seed_db...")
    seeded_users = []
    
    # Seed default tenant
    tenant = db.query(Tenant).filter(Tenant.slug == 'acme-corp').first()
    if not tenant:
        tenant = Tenant(name='Acme Corp', slug='acme-corp')
        db.add(tenant)
        db.flush() # To get the tenant ID
        print("[SEED] Seeded default tenant 'Acme Corp'.")

    # Helper to ensure default credentials match env settings
    def ensure_user(email: str, role: str, tenant_id: int) -> User:
        user = db.query(User).filter(User.email == email).first()
        salt = bcrypt.gensalt()
        hashed_pw = bcrypt.hashpw(settings.DEFAULT_ADMIN_PASSWORD.encode('utf-8'), salt).decode('utf-8')
        
        if not user:
            user = User(email=email, password_hash=hashed_pw, role=role, tenant_id=tenant_id)
            db.add(user)
            print(f"[SEED] Created default {role} user: {email}")
        else:
            if user.tenant_id is None:
                user.tenant_id = tenant_id
            
            # Verify if password hash matches current config, if not, update it
            try:
                pw_matches = bcrypt.checkpw(settings.DEFAULT_ADMIN_PASSWORD.encode('utf-8'), user.password_hash.encode('utf-8'))
            except Exception:
                pw_matches = False
                
            if not pw_matches:
                user.password_hash = hashed_pw
                print(f"[SEED] Updated credentials for {role} user: {email}")
        return user

    # Seed default admin
    admin = ensure_user('admin@admin.com', 'super_admin', tenant.id)
    seeded_users.append({"role": "Admin", "email": admin.email, "password": settings.DEFAULT_ADMIN_PASSWORD})

    # Seed default QA Manager
    manager = ensure_user('manager@admin.com', 'qa_manager', tenant.id)
    seeded_users.append({"role": "QA Manager", "email": manager.email, "password": settings.DEFAULT_ADMIN_PASSWORD})

    # Seed default Agent / Analyst
    agent = ensure_user('agent@admin.com', 'analyst', tenant.id)
    seeded_users.append({"role": "Agent/Analyst", "email": agent.email, "password": settings.DEFAULT_ADMIN_PASSWORD})

    # --- LOB Seeding Helper ---
    def seed_lob(name, system_prompt, criteria, is_builtin=True):
        lob = db.query(LOB).filter(LOB.name == name).first()
        if not lob:
            lob = LOB(
                name=name,
                tenant_id=tenant.id,
                system_prompt=system_prompt,
                criteria_json=criteria,
                is_builtin=is_builtin,
                is_active=True
            )
            db.add(lob)
            print(f"[SEED] Seeded default '{name}' LOB.")
        else:
            # Update existing LOB to match seed data
            lob.system_prompt = system_prompt
            lob.criteria_json = criteria
            lob.is_builtin = is_builtin
            lob.is_active = True
            print(f"[SEED] Updated existing '{name}' LOB.")
        return lob

    # 1. Call Center LOB
    call_center_prompt = (
        "You are an expert Call Center QA Auditor. You will be provided with a numbered call transcript.\n\n"
        "YOUR TASKS:\n"
        "1. Evaluate the agent's performance against specific criteria.\n"
        "2. Identify the main topics discussed.\n"
        "3. Identify the speaker for each numbered line (Agent or Customer).\n\n"
        "OUTPUT FORMAT:\n"
        "You MUST respond ONLY with a JSON object in this exact format:\n"
        "{\n"
        "  \"topics\": \"comma, separated, list, of, topics\",\n"
        "  \"speaker_map\": {\"0\": \"Agent\", \"1\": \"Customer\", ...},\n"
        "  \"evaluations\": {\n"
        "    \"criterion_key\": {\"answer\": \"Yes/No/N/A\", \"explanation\": \"Specific reason from transcript\"}\n"
        "  }\n"
        "}\n"
    )
    call_center_criteria = {
        "greeting": {"question": "Did the agent use the appropriate greeting and acknowledgement per protocol?", "points": 12.5, "mandatory": True, "context": "Evaluate based on standard professional call center protocols."},
        "hipaa_verification": {"question": "Did the agent correctly verify the customer's identity (HIPAA)?", "points": 12.5, "mandatory": False, "context": "CRITICAL RULE: Determine if the caller is seeking Personal Health Information (PHI). If NOT seeking PHI (general inquiry, vendor, etc.), HIPAA is not required; answer \"N/A\". Only if seeking PHI should you evaluate if the agent verified identity."},
        "resolve_concern": {"question": "Did the agent take the correct steps to resolve the customer's primary concern?", "points": 12.5, "mandatory": False, "context": "Evaluate based on standard professional call center protocols."},
        "pci_compliance": {"question": "If a payment was made, did the agent follow the PCI compliance script?", "points": 12.5, "mandatory": False, "context": "CRITICAL RULE: First, determine if a payment was discussed OR attempted. If NO payment was discussed or attempted, you MUST set the answer to \"N/A\" and explain why. Only if a payment *was* discussed/attempted should you evaluate adherence."},
        "call_closing": {"question": "Did the agent close the call professionally and offer the survey?", "points": 12.5, "mandatory": True, "context": "Evaluate based on standard professional call center protocols."},
        "professionalism": {"question": "Did the agent actively listen and use an empathetic and professional tone?", "points": 12.5, "mandatory": False, "context": "Evaluate based on standard professional call center protocols."},
        "call_management": {"question": "Did the agent manage the call efficiently, without extended silences?", "points": 12.5, "mandatory": True, "context": "Evaluate based on standard professional call center protocols."},
        "documentation": {"question": "Did the agent document the account accurately and professionally?", "points": 12.5, "mandatory": False, "context": "Manual score required.", "manual_score_required": True}
    }
    seed_lob("Call Center", call_center_prompt, call_center_criteria)

    # 2. Retail LOB
    retail_prompt = (
        "You are an expert Retail Customer Service Auditor. You will be provided with a numbered call transcript.\n\n"
        "YOUR TASKS:\n"
        "1. Evaluate the agent's performance against retail-specific criteria.\n"
        "2. Identify the main topics discussed.\n"
        "3. Identify the speaker for each numbered line (Agent or Customer).\n\n"
        "OUTPUT FORMAT: (JSON only)"
    )
    retail_criteria = {
        "greeting": {"question": "Did the agent greet the customer with a friendly tone?", "points": 20, "mandatory": True, "context": "Retail friendly greeting."},
        "product_knowledge": {"question": "Did the agent demonstrate good product knowledge?", "points": 40, "mandatory": False, "context": "Evaluate if the agent knows the inventory."},
        "upsell_attempt": {"question": "Did the agent attempt to upsell or cross-sell?", "points": 20, "mandatory": False, "context": "Check for related product suggestions."},
        "call_closing": {"question": "Did the agent thank the customer and close the call?", "points": 20, "mandatory": True, "context": "Standard retail closing."}
    }
    seed_lob("Retail", retail_prompt, retail_criteria)

    # 3. Sales LOB
    sales_prompt = "Act as a senior call center QA analyst for a sales department, evaluate the call accordingly."
    sales_criteria = {
        "greeting": {"question": "Did the agent open the call properly?", "points": 25, "mandatory": False},
        "sale_attempt": {"question": "Did the agent make a professional sales pitch?", "points": 50, "mandatory": False},
        "closing": {"question": "Did the agent close the call professionally?", "points": 25, "mandatory": False}
    }
    seed_lob("Sales", sales_prompt, sales_criteria)

    # 4. Healthcare LOB
    healthcare_prompt = "Act as a senior Healthcare QA analyst. Focus on HIPAA compliance and patient empathy."
    healthcare_criteria = {
        "greeting": {"question": "Did the agent use the proper healthcare greeting?", "points": 20, "mandatory": True},
        "hipaa_compliance": {"question": "Did the agent verify patient identity correctly?", "points": 40, "mandatory": True},
        "empathy": {"question": "Did the agent show appropriate empathy to the patient?", "points": 20, "mandatory": False},
        "closing": {"question": "Did the agent provide clear next steps for the patient?", "points": 20, "mandatory": True}
    }
    seed_lob("Healthcare", healthcare_prompt, healthcare_criteria)

    db.commit()
    
    return seeded_users
