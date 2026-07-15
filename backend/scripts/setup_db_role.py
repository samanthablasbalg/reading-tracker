#!/usr/bin/env python3
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

APP_ROLE = "app_user"
DATABASE_URLS = [os.environ["DATABASE_URL"], os.environ["TEST_DATABASE_URL"]]


def create_role() -> None:
    with psycopg2.connect(DATABASE_URLS[0]) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,))
            if cur.fetchone() is None:
                cur.execute(f"CREATE ROLE {APP_ROLE} LOGIN")
                print(f"Created role {APP_ROLE}")
            else:
                print(f"Role {APP_ROLE} already exists")


def grant_privileges(database_url: str) -> None:
    with psycopg2.connect(database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT current_user")
            owner = cur.fetchone()[0]
            cur.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
            cur.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE "
                f"ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"
            )
            cur.execute(
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {owner} IN SCHEMA public "
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE}"
            )
    print(f"Granted privileges on {database_url}")


create_role()
for url in DATABASE_URLS:
    grant_privileges(url)
