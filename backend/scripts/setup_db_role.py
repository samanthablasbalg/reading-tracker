#!/usr/bin/env python3
import os

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

APP_ROLE = "app_user"
APP_ROLE_PASSWORD = os.environ.get("APP_DB_PASSWORD")

DATABASE_URLS = [os.environ["DATABASE_URL"]]
if os.environ.get("TEST_DATABASE_URL"):
    DATABASE_URLS.append(os.environ["TEST_DATABASE_URL"])


def ensure_role() -> None:
    role = sql.Identifier(APP_ROLE)
    with psycopg2.connect(DATABASE_URLS[0]) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,))
            if cur.fetchone() is None:
                cur.execute(sql.SQL("CREATE ROLE {role} LOGIN").format(role=role))
                print(f"Created role {APP_ROLE}")
            else:
                print(f"Role {APP_ROLE} already exists")
            if APP_ROLE_PASSWORD:
                cur.execute(
                    sql.SQL("ALTER ROLE {role} PASSWORD %s").format(role=role),
                    (APP_ROLE_PASSWORD,),
                )
                print(f"Set password for {APP_ROLE}")


def grant_privileges(database_url: str) -> None:
    role = sql.Identifier(APP_ROLE)
    with psycopg2.connect(database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT current_user")
            owner = sql.Identifier(cur.fetchone()[0])
            cur.execute(
                sql.SQL("GRANT USAGE ON SCHEMA public TO {role}").format(role=role)
            )
            cur.execute(
                sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}").format(
                    role=role
                )
            )
            cur.execute(
                sql.SQL(
                    "GRANT SELECT, INSERT, UPDATE, DELETE "
                    "ON ALL TABLES IN SCHEMA public TO {role}"
                ).format(role=role)
            )
            cur.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES FOR ROLE {owner} IN SCHEMA public "
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role}"
                ).format(owner=owner, role=role)
            )
    print(f"Granted privileges on {database_url}")


ensure_role()
for url in DATABASE_URLS:
    grant_privileges(url)
